"use client";

import { useState } from "react";
import { parseUnits, type Address } from "viem";
import { useWaitForTransactionReceipt } from "wagmi";
import { Product, TokenType, OrderCreate } from "@/lib/types";
import { useEscrowContract } from "@/hooks/useEscrowContract";
import { useNotificationStore } from "@/stores/notificationStore";
import { api } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { PLATFORM_FEE_BPS, BPS_DENOMINATOR } from "@/lib/config";

type Step = "select-token" | "approve" | "create-order" | "done";

interface BuyFlowProps {
  product: Product;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BuyFlow({ product, open, onClose, onSuccess }: BuyFlowProps) {
  const [step, setStep] = useState<Step>("select-token");
  const [token, setToken] = useState<TokenType>(TokenType.USDT);
  const [loading, setLoading] = useState(false);
  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | null>(
    null
  );
  const { approveToken, createOrder, isPending } = useEscrowContract();
  const { addNotification } = useNotificationStore();

  const totalAmount = product.price_usdt;
  const platformFee = (totalAmount * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
  const totalWithFee = totalAmount + platformFee;

  // Token decimals: USDT/USDC on BSC typically 18 decimals
  const amountWei = parseUnits(totalWithFee.toString(), 18);

  const handleApprove = async () => {
    setLoading(true);
    try {
      const hash = await approveToken(token, amountWei);
      setApproveTxHash(hash);
      addNotification("info", "Approval submitted, waiting for confirmation...");
      setStep("create-order");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Approval failed";
      addNotification("error", message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async () => {
    setLoading(true);
    try {
      const productHashHex = product.product_hash as `0x${string}`;
      const hash = await createOrder(
        product.seller_wallet as Address,
        token,
        amountWei,
        productHashHex
      );

      // Register order on backend
      await api.post<OrderCreate>("/orders", {
        product_id: product.id,
        token,
        amount: totalAmount,
        tx_hash: hash,
        chain: "bsc",
      });

      addNotification("success", "Order created successfully!");
      setStep("done");
      onSuccess();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Order creation failed";
      addNotification("error", message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep("select-token");
    setApproveTxHash(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Purchase Product">
      <div className="space-y-6">
        {/* Summary */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Product</span>
            <span>{product.title_preview}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Price</span>
            <span>${totalAmount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Platform Fee (2%)</span>
            <span>${platformFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-semibold border-t border-border pt-2">
            <span>Total</span>
            <span className="text-primary">${totalWithFee.toFixed(2)}</span>
          </div>
        </div>

        {step === "select-token" && (
          <div className="space-y-4">
            <Select
              label="Payment Token"
              options={[
                { value: TokenType.USDT, label: "USDT" },
                { value: TokenType.USDC, label: "USDC" },
              ]}
              value={token}
              onChange={(e) => setToken(e.target.value as TokenType)}
            />
            <Button className="w-full" onClick={() => setStep("approve")}>
              Continue
            </Button>
          </div>
        )}

        {step === "approve" && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Step 1: Approve the escrow contract to spend your {token}
            </p>
            <Button
              className="w-full"
              loading={loading || isPending}
              onClick={handleApprove}
            >
              Approve {totalWithFee.toFixed(2)} {token}
            </Button>
          </div>
        )}

        {step === "create-order" && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Step 2: Create the escrow order on-chain
            </p>
            <Button
              className="w-full"
              loading={loading || isPending}
              onClick={handleCreateOrder}
            >
              Create Order
            </Button>
          </div>
        )}

        {step === "done" && (
          <div className="text-center space-y-4">
            <p className="text-success font-medium">
              Order created. Waiting for seller to confirm delivery.
            </p>
            <Button variant="secondary" className="w-full" onClick={handleClose}>
              Close
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

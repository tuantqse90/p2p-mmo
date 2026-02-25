"use client";

import { useCallback } from "react";
import { useWriteContract, useReadContract } from "wagmi";
import { parseUnits, type Address } from "viem";
import { P2PEscrowABI, ERC20ABI } from "@/lib/contracts";
import { CONTRACTS, TOKENS } from "@/lib/config";
import { TokenType } from "@/lib/types";
import { useNotificationStore } from "@/stores/notificationStore";

export function useEscrowContract() {
  const { writeContractAsync, isPending } = useWriteContract();
  const { addNotification } = useNotificationStore();

  const getTokenAddress = (token: TokenType): Address => {
    return token === TokenType.USDT ? TOKENS.USDT : TOKENS.USDC;
  };

  const approveToken = useCallback(
    async (token: TokenType, amount: bigint) => {
      const tokenAddress = getTokenAddress(token);
      return writeContractAsync({
        address: tokenAddress,
        abi: ERC20ABI,
        functionName: "approve",
        args: [CONTRACTS.escrow, amount],
      });
    },
    [writeContractAsync]
  );

  const createOrder = useCallback(
    async (
      seller: Address,
      token: TokenType,
      amount: bigint,
      productHash: `0x${string}`
    ) => {
      const tokenAddress = getTokenAddress(token);
      return writeContractAsync({
        address: CONTRACTS.escrow,
        abi: P2PEscrowABI,
        functionName: "createOrder",
        args: [seller, tokenAddress, amount, productHash],
      });
    },
    [writeContractAsync]
  );

  const sellerConfirmDelivery = useCallback(
    async (orderId: bigint) => {
      return writeContractAsync({
        address: CONTRACTS.escrow,
        abi: P2PEscrowABI,
        functionName: "sellerConfirmDelivery",
        args: [orderId],
      });
    },
    [writeContractAsync]
  );

  const buyerConfirmReceived = useCallback(
    async (orderId: bigint) => {
      return writeContractAsync({
        address: CONTRACTS.escrow,
        abi: P2PEscrowABI,
        functionName: "buyerConfirmReceived",
        args: [orderId],
      });
    },
    [writeContractAsync]
  );

  const cancelOrder = useCallback(
    async (orderId: bigint) => {
      return writeContractAsync({
        address: CONTRACTS.escrow,
        abi: P2PEscrowABI,
        functionName: "cancelOrder",
        args: [orderId],
      });
    },
    [writeContractAsync]
  );

  const openDispute = useCallback(
    async (orderId: bigint, evidenceHash: string) => {
      return writeContractAsync({
        address: CONTRACTS.escrow,
        abi: P2PEscrowABI,
        functionName: "openDispute",
        args: [orderId, evidenceHash],
      });
    },
    [writeContractAsync]
  );

  const submitEvidence = useCallback(
    async (orderId: bigint, ipfsHash: string) => {
      return writeContractAsync({
        address: CONTRACTS.escrow,
        abi: P2PEscrowABI,
        functionName: "submitEvidence",
        args: [orderId, ipfsHash],
      });
    },
    [writeContractAsync]
  );

  const resolveDispute = useCallback(
    async (orderId: bigint, favorBuyer: boolean) => {
      return writeContractAsync({
        address: CONTRACTS.escrow,
        abi: P2PEscrowABI,
        functionName: "resolveDispute",
        args: [orderId, favorBuyer],
      });
    },
    [writeContractAsync]
  );

  const useTokenBalance = (token: TokenType, account?: Address) => {
    return useReadContract({
      address: getTokenAddress(token),
      abi: ERC20ABI,
      functionName: "balanceOf",
      args: account ? [account] : undefined,
      query: { enabled: !!account },
    });
  };

  const useAllowance = (token: TokenType, owner?: Address) => {
    return useReadContract({
      address: getTokenAddress(token),
      abi: ERC20ABI,
      functionName: "allowance",
      args: owner ? [owner, CONTRACTS.escrow] : undefined,
      query: { enabled: !!owner },
    });
  };

  return {
    approveToken,
    createOrder,
    sellerConfirmDelivery,
    buyerConfirmReceived,
    cancelOrder,
    openDispute,
    submitEvidence,
    resolveDispute,
    useTokenBalance,
    useAllowance,
    isPending,
    getTokenAddress,
    parseAmount: (amount: string, decimals = 18) =>
      parseUnits(amount, decimals),
  };
}

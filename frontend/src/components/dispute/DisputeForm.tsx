"use client";

import { useState } from "react";
import { EvidenceType } from "@/lib/types";
import { useEscrowContract } from "@/hooks/useEscrowContract";
import { useNotificationStore } from "@/stores/notificationStore";
import { api } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

interface DisputeFormProps {
  orderId: string;
  onchainOrderId: number;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const evidenceTypeOptions = [
  { value: EvidenceType.SCREENSHOT, label: "Screenshot" },
  { value: EvidenceType.CONVERSATION, label: "Conversation" },
  { value: EvidenceType.PRODUCT_PROOF, label: "Product Proof" },
  { value: EvidenceType.OTHER, label: "Other" },
];

export function DisputeForm({
  orderId,
  onchainOrderId,
  open,
  onClose,
  onSuccess,
}: DisputeFormProps) {
  const [evidenceHash, setEvidenceHash] = useState("");
  const [evidenceType, setEvidenceType] = useState<EvidenceType>(
    EvidenceType.OTHER
  );
  const [loading, setLoading] = useState(false);
  const { openDispute, isPending } = useEscrowContract();
  const { addNotification } = useNotificationStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidenceHash.trim()) return;

    setLoading(true);
    try {
      // Open dispute on-chain
      await openDispute(BigInt(onchainOrderId), evidenceHash);

      // Register dispute on backend
      await api.post(`/orders/${orderId}/dispute`, {
        evidence_hash: evidenceHash,
        evidence_type: evidenceType,
      });

      addNotification("success", "Dispute opened successfully");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to open dispute";
      addNotification("error", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Open Dispute">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-muted">
          Opening a dispute will assign an arbitrator to review the case.
          An arbitration fee (5%) applies.
        </p>

        <Input
          label="Evidence IPFS Hash"
          placeholder="Qm... or bafy..."
          value={evidenceHash}
          onChange={(e) => setEvidenceHash(e.target.value)}
        />

        <Select
          label="Evidence Type"
          options={evidenceTypeOptions}
          value={evidenceType}
          onChange={(e) => setEvidenceType(e.target.value as EvidenceType)}
        />

        <div className="flex gap-3">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="danger"
            className="flex-1"
            loading={loading || isPending}
          >
            Open Dispute
          </Button>
        </div>
      </form>
    </Modal>
  );
}

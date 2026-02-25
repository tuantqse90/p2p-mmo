import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DisputeForm } from "./DisputeForm";

// Mock hooks
vi.mock("@/hooks/useEscrowContract", () => ({
  useEscrowContract: () => ({
    openDispute: vi.fn().mockResolvedValue(undefined),
    isPending: false,
  }),
}));

vi.mock("@/stores/notificationStore", () => ({
  useNotificationStore: () => ({
    addNotification: vi.fn(),
  }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    post: vi.fn().mockResolvedValue({}),
  },
}));

describe("DisputeForm", () => {
  const defaultProps = {
    orderId: "order-1",
    onchainOrderId: 42,
    open: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  it("renders nothing when closed", () => {
    const { container } = render(
      <DisputeForm {...defaultProps} open={false} />
    );
    // Modal renders null when not open
    expect(container.querySelector("form")).toBeNull();
  });

  it("renders form when open", () => {
    render(<DisputeForm {...defaultProps} />);
    expect(screen.getByText("Evidence IPFS Hash")).toBeDefined();
    expect(screen.getByText("Evidence Type")).toBeDefined();
  });

  it("renders evidence input", () => {
    render(<DisputeForm {...defaultProps} />);
    expect(screen.getByLabelText("Evidence IPFS Hash")).toBeDefined();
  });

  it("renders evidence type selector", () => {
    render(<DisputeForm {...defaultProps} />);
    expect(screen.getByLabelText("Evidence Type")).toBeDefined();
  });

  it("renders Cancel and Open Dispute buttons", () => {
    render(<DisputeForm {...defaultProps} />);
    expect(screen.getByText("Cancel")).toBeDefined();
    // The submit button says "Open Dispute"
    const buttons = screen.getAllByRole("button");
    const submitBtn = buttons.find((b) => b.textContent?.includes("Open Dispute"));
    expect(submitBtn).toBeDefined();
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn();
    render(<DisputeForm {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows info about arbitration fee", () => {
    render(<DisputeForm {...defaultProps} />);
    expect(screen.getByText(/arbitration fee/i)).toBeDefined();
  });
});

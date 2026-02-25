import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Modal } from "./Modal";

describe("Modal", () => {
  it("renders nothing when open is false", () => {
    const { container } = render(
      <Modal open={false} onClose={() => {}}>Content</Modal>
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders children when open is true", () => {
    render(
      <Modal open={true} onClose={() => {}}>
        Modal content
      </Modal>
    );
    expect(screen.getByText("Modal content")).toBeDefined();
  });

  it("renders title when provided", () => {
    render(
      <Modal open={true} onClose={() => {}} title="My Title">
        Content
      </Modal>
    );
    expect(screen.getByText("My Title")).toBeDefined();
  });

  it("renders close button when title is provided", () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} title="Title">
        Content
      </Modal>
    );
    const closeBtn = screen.getByRole("button");
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when Escape key is pressed", () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose}>Content</Modal>
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when overlay is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open={true} onClose={onClose}>Content</Modal>
    );
    const overlay = container.querySelector(".fixed");
    if (overlay) {
      fireEvent.click(overlay, { target: overlay });
    }
    expect(onClose).toHaveBeenCalled();
  });

  it("does not call onClose when inner content is clicked", () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose}>
        <span>Inner</span>
      </Modal>
    );
    fireEvent.click(screen.getByText("Inner"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("sets body overflow to hidden when open", () => {
    render(
      <Modal open={true} onClose={() => {}}>Content</Modal>
    );
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("restores body overflow when closed", () => {
    const { rerender } = render(
      <Modal open={true} onClose={() => {}}>Content</Modal>
    );
    rerender(
      <Modal open={false} onClose={() => {}}>Content</Modal>
    );
    expect(document.body.style.overflow).toBe("");
  });
});

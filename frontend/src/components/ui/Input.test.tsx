import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Input } from "./Input";

describe("Input", () => {
  it("renders an input element", () => {
    render(<Input placeholder="Type here" />);
    expect(screen.getByPlaceholderText("Type here")).toBeDefined();
  });

  it("renders label when provided", () => {
    render(<Input label="Email" />);
    expect(screen.getByText("Email")).toBeDefined();
  });

  it("generates id from label", () => {
    render(<Input label="First Name" />);
    const input = screen.getByLabelText("First Name");
    expect(input.id).toBe("first-name");
  });

  it("uses explicit id over generated one", () => {
    render(<Input label="Email" id="custom-id" />);
    const input = screen.getByLabelText("Email");
    expect(input.id).toBe("custom-id");
  });

  it("renders error message when provided", () => {
    render(<Input error="Required field" />);
    expect(screen.getByText("Required field")).toBeDefined();
  });

  it("applies danger border style when error exists", () => {
    const { container } = render(<Input error="Error" />);
    const input = container.querySelector("input");
    expect(input?.className).toContain("border-danger");
  });

  it("applies normal border style when no error", () => {
    const { container } = render(<Input />);
    const input = container.querySelector("input");
    expect(input?.className).toContain("border-border");
  });

  it("applies custom className", () => {
    const { container } = render(<Input className="w-24" />);
    const input = container.querySelector("input");
    expect(input?.className).toContain("w-24");
  });

  it("forwards onChange events", () => {
    const onChange = vi.fn();
    render(<Input onChange={onChange} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "test" } });
    expect(onChange).toHaveBeenCalled();
  });

  it("does not render label when not provided", () => {
    const { container } = render(<Input />);
    expect(container.querySelector("label")).toBeNull();
  });

  it("does not render error when not provided", () => {
    const { container } = render(<Input />);
    expect(container.querySelector("p")).toBeNull();
  });
});

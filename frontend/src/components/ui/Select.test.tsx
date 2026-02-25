import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Select } from "./Select";

const options = [
  { value: "a", label: "Option A" },
  { value: "b", label: "Option B" },
  { value: "c", label: "Option C" },
];

describe("Select", () => {
  it("renders all options", () => {
    render(<Select options={options} />);
    expect(screen.getByText("Option A")).toBeDefined();
    expect(screen.getByText("Option B")).toBeDefined();
    expect(screen.getByText("Option C")).toBeDefined();
  });

  it("renders label when provided", () => {
    render(<Select label="Choose" options={options} />);
    expect(screen.getByText("Choose")).toBeDefined();
  });

  it("generates id from label", () => {
    render(<Select label="My Select" options={options} />);
    const select = screen.getByLabelText("My Select");
    expect(select.id).toBe("my-select");
  });

  it("uses explicit id over generated one", () => {
    render(<Select label="Choose" id="custom" options={options} />);
    const select = screen.getByLabelText("Choose");
    expect(select.id).toBe("custom");
  });

  it("renders error message", () => {
    render(<Select options={options} error="Required" />);
    expect(screen.getByText("Required")).toBeDefined();
  });

  it("applies danger border on error", () => {
    const { container } = render(<Select options={options} error="Err" />);
    const select = container.querySelector("select");
    expect(select?.className).toContain("border-danger");
  });

  it("applies normal border without error", () => {
    const { container } = render(<Select options={options} />);
    const select = container.querySelector("select");
    expect(select?.className).toContain("border-border");
  });

  it("calls onChange when selection changes", () => {
    const onChange = vi.fn();
    render(<Select options={options} onChange={onChange} />);
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "b" } });
    expect(onChange).toHaveBeenCalled();
  });

  it("applies custom className", () => {
    const { container } = render(<Select options={options} className="w-full" />);
    const select = container.querySelector("select");
    expect(select?.className).toContain("w-full");
  });

  it("does not render label when not provided", () => {
    const { container } = render(<Select options={options} />);
    expect(container.querySelector("label")).toBeNull();
  });

  it("does not render error when not provided", () => {
    const { container } = render(<Select options={options} />);
    expect(container.querySelector("p")).toBeNull();
  });
});

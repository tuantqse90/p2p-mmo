import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "./Button";

describe("Button", () => {
  it("renders children text", () => {
    render(<Button>Click Me</Button>);
    expect(screen.getByText("Click Me")).toBeDefined();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(screen.getByText("Click"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is disabled when disabled prop is true", () => {
    render(<Button disabled>Disabled</Button>);
    const btn = screen.getByText("Disabled").closest("button");
    expect(btn?.disabled).toBe(true);
  });

  it("is disabled when loading", () => {
    render(<Button loading>Loading</Button>);
    const btn = screen.getByText("Loading").closest("button");
    expect(btn?.disabled).toBe(true);
  });

  it("shows spinner when loading", () => {
    const { container } = render(<Button loading>Load</Button>);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
  });

  it("does not show spinner when not loading", () => {
    const { container } = render(<Button>Normal</Button>);
    const svg = container.querySelector("svg");
    expect(svg).toBeNull();
  });

  it("applies primary variant styles by default", () => {
    const { container } = render(<Button>Primary</Button>);
    const btn = container.querySelector("button");
    expect(btn?.className).toContain("bg-primary");
  });

  it("applies secondary variant styles", () => {
    const { container } = render(
      <Button variant="secondary">Secondary</Button>
    );
    const btn = container.querySelector("button");
    expect(btn?.className).toContain("bg-surface");
  });

  it("applies danger variant styles", () => {
    const { container } = render(<Button variant="danger">Danger</Button>);
    const btn = container.querySelector("button");
    expect(btn?.className).toContain("bg-danger");
  });

  it("applies size styles", () => {
    const { container } = render(<Button size="lg">Large</Button>);
    const btn = container.querySelector("button");
    expect(btn?.className).toContain("px-6");
  });

  it("applies custom className", () => {
    const { container } = render(
      <Button className="my-custom">Custom</Button>
    );
    const btn = container.querySelector("button");
    expect(btn?.className).toContain("my-custom");
  });

  it("does not call onClick when disabled", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Disabled
      </Button>
    );
    fireEvent.click(screen.getByText("Disabled"));
    expect(onClick).not.toHaveBeenCalled();
  });
});

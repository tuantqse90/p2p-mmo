import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Card, CardHeader, CardContent } from "./Card";

describe("Card", () => {
  it("renders children", () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText("Card content")).toBeDefined();
  });

  it("applies custom className", () => {
    const { container } = render(<Card className="custom">Content</Card>);
    expect(container.firstChild).toHaveClass("custom");
  });

  it("applies hover styles when hover prop is true", () => {
    const { container } = render(<Card hover>Hoverable</Card>);
    expect((container.firstChild as HTMLElement).className).toContain("hover:border-primary/30");
  });

  it("does not apply hover styles by default", () => {
    const { container } = render(<Card>Normal</Card>);
    expect((container.firstChild as HTMLElement).className).not.toContain("hover:border-primary/30");
  });

  it("applies cursor-pointer when onClick is provided", () => {
    const { container } = render(<Card onClick={() => {}}>Clickable</Card>);
    expect((container.firstChild as HTMLElement).className).toContain("cursor-pointer");
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<Card onClick={onClick}>Click me</Card>);
    fireEvent.click(screen.getByText("Click me"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("CardHeader", () => {
  it("renders children", () => {
    render(<CardHeader>Header</CardHeader>);
    expect(screen.getByText("Header")).toBeDefined();
  });

  it("applies custom className", () => {
    const { container } = render(<CardHeader className="extra">H</CardHeader>);
    expect(container.firstChild).toHaveClass("extra");
  });

  it("has border-b style", () => {
    const { container } = render(<CardHeader>H</CardHeader>);
    expect((container.firstChild as HTMLElement).className).toContain("border-b");
  });
});

describe("CardContent", () => {
  it("renders children", () => {
    render(<CardContent>Body</CardContent>);
    expect(screen.getByText("Body")).toBeDefined();
  });

  it("applies custom className", () => {
    const { container } = render(<CardContent className="extra">B</CardContent>);
    expect(container.firstChild).toHaveClass("extra");
  });
});

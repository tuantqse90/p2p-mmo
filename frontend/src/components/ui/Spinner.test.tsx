import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Spinner } from "./Spinner";

describe("Spinner", () => {
  it("renders an SVG element", () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("applies medium size by default", () => {
    const { container } = render(<Spinner />);
    const svg = container.querySelector("svg");
    expect(svg?.className).toContain("h-6 w-6");
  });

  it("applies small size", () => {
    const { container } = render(<Spinner size="sm" />);
    const svg = container.querySelector("svg");
    expect(svg?.className).toContain("h-4 w-4");
  });

  it("applies large size", () => {
    const { container } = render(<Spinner size="lg" />);
    const svg = container.querySelector("svg");
    expect(svg?.className).toContain("h-10 w-10");
  });

  it("applies animate-spin class", () => {
    const { container } = render(<Spinner />);
    const svg = container.querySelector("svg");
    expect(svg?.className).toContain("animate-spin");
  });

  it("applies custom className", () => {
    const { container } = render(<Spinner className="ml-2" />);
    const svg = container.querySelector("svg");
    expect(svg?.className).toContain("ml-2");
  });
});

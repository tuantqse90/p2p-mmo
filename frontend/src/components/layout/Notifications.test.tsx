import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Notifications } from "./Notifications";
import { useNotificationStore } from "@/stores/notificationStore";

describe("Notifications", () => {
  beforeEach(() => {
    // Reset notifications between tests
    useNotificationStore.setState({ notifications: [] });
  });

  it("renders nothing when no notifications", () => {
    const { container } = render(<Notifications />);
    expect(container.innerHTML).toBe("");
  });

  it("renders notification title", () => {
    useNotificationStore.getState().addNotification("success", "Operation done");
    render(<Notifications />);
    expect(screen.getByText("Operation done")).toBeDefined();
  });

  it("renders notification message", () => {
    useNotificationStore.getState().addNotification("info", "Title", "Detail message");
    render(<Notifications />);
    expect(screen.getByText("Detail message")).toBeDefined();
  });

  it("renders success icon", () => {
    useNotificationStore.getState().addNotification("success", "Success");
    render(<Notifications />);
    expect(screen.getByText("\u2713")).toBeDefined();
  });

  it("renders error icon", () => {
    useNotificationStore.getState().addNotification("error", "Error");
    render(<Notifications />);
    expect(screen.getByText("\u2717")).toBeDefined();
  });

  it("renders warning icon", () => {
    useNotificationStore.getState().addNotification("warning", "Warn");
    render(<Notifications />);
    expect(screen.getByText("!")).toBeDefined();
  });

  it("renders info icon", () => {
    useNotificationStore.getState().addNotification("info", "Info");
    render(<Notifications />);
    expect(screen.getByText("i")).toBeDefined();
  });

  it("renders multiple notifications", () => {
    useNotificationStore.getState().addNotification("success", "First");
    useNotificationStore.getState().addNotification("error", "Second");
    render(<Notifications />);
    expect(screen.getByText("First")).toBeDefined();
    expect(screen.getByText("Second")).toBeDefined();
  });

  it("removes notification when close button is clicked", () => {
    useNotificationStore.getState().addNotification("info", "Dismissable");
    render(<Notifications />);
    expect(screen.getByText("Dismissable")).toBeDefined();
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);
    expect(screen.queryByText("Dismissable")).toBeNull();
  });
});

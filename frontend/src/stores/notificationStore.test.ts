import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useNotificationStore } from "./notificationStore";

describe("notificationStore", () => {
  beforeEach(() => {
    useNotificationStore.setState({ notifications: [] });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("has correct initial state", () => {
    const state = useNotificationStore.getState();
    expect(state.notifications).toEqual([]);
  });

  it("addNotification adds a notification", () => {
    useNotificationStore.getState().addNotification("success", "Done!");
    const notes = useNotificationStore.getState().notifications;
    expect(notes).toHaveLength(1);
    expect(notes[0].type).toBe("success");
    expect(notes[0].title).toBe("Done!");
  });

  it("addNotification includes optional message", () => {
    useNotificationStore
      .getState()
      .addNotification("error", "Failed", "Something went wrong");
    const notes = useNotificationStore.getState().notifications;
    expect(notes[0].message).toBe("Something went wrong");
  });

  it("addNotification assigns unique id", () => {
    useNotificationStore.getState().addNotification("info", "One");
    useNotificationStore.getState().addNotification("info", "Two");
    const notes = useNotificationStore.getState().notifications;
    expect(notes[0].id).not.toBe(notes[1].id);
  });

  it("removeNotification removes by id", () => {
    useNotificationStore.getState().addNotification("info", "Test");
    const id = useNotificationStore.getState().notifications[0].id;

    useNotificationStore.getState().removeNotification(id);
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });

  it("auto-removes notification after 5 seconds", () => {
    useNotificationStore.getState().addNotification("warning", "Timeout");
    expect(useNotificationStore.getState().notifications).toHaveLength(1);

    vi.advanceTimersByTime(5000);
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });

  it("does not remove other notifications on auto-dismiss", () => {
    useNotificationStore.getState().addNotification("info", "First");

    // Add second after 2 seconds
    vi.advanceTimersByTime(2000);
    useNotificationStore.getState().addNotification("info", "Second");

    // First should auto-dismiss at 5s total (3s from now)
    vi.advanceTimersByTime(3000);
    const notes = useNotificationStore.getState().notifications;
    expect(notes).toHaveLength(1);
    expect(notes[0].title).toBe("Second");
  });

  it("handles multiple notification types", () => {
    useNotificationStore.getState().addNotification("success", "S");
    useNotificationStore.getState().addNotification("error", "E");
    useNotificationStore.getState().addNotification("warning", "W");
    useNotificationStore.getState().addNotification("info", "I");

    const types = useNotificationStore
      .getState()
      .notifications.map((n) => n.type);
    expect(types).toEqual(["success", "error", "warning", "info"]);
  });
});

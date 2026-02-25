import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWebSocket } from "./useWebSocket";

// Mock auth store
const mockToken = { token: null as string | null };
vi.mock("@/stores/authStore", () => ({
  useAuthStore: () => mockToken,
}));

vi.mock("@/lib/config", () => ({
  WS_URL: "ws://localhost:8000",
}));

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  sentMessages: string[] = [];
  closeCalled = false;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.closeCalled = true;
    this.readyState = 3;
  }

  simulateOpen() {
    this.readyState = 1;
    this.onopen?.();
  }

  simulateMessage(data: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  simulateError() {
    this.onerror?.();
  }

  simulateClose() {
    this.onclose?.();
  }
}

// Replace global WebSocket
const OriginalWebSocket = globalThis.WebSocket;

describe("useWebSocket", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    (globalThis as any).WebSocket = MockWebSocket as any;
    // Need OPEN constant
    (globalThis.WebSocket as any).OPEN = 1;
    mockToken.token = null;
  });

  afterEach(() => {
    globalThis.WebSocket = OriginalWebSocket;
  });

  it("does not connect without orderId", () => {
    mockToken.token = "jwt-token";
    renderHook(() => useWebSocket(null));
    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it("does not connect without token", () => {
    renderHook(() => useWebSocket("order-1"));
    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it("connects when orderId and token are provided", () => {
    mockToken.token = "jwt-token";
    renderHook(() => useWebSocket("order-1"));
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toBe(
      "ws://localhost:8000/ws/orders/order-1?token=jwt-token"
    );
  });

  it("sets connected to true on open", () => {
    mockToken.token = "jwt-token";
    const { result } = renderHook(() => useWebSocket("order-1"));
    expect(result.current.connected).toBe(false);
    act(() => MockWebSocket.instances[0].simulateOpen());
    expect(result.current.connected).toBe(true);
  });

  it("sets connected to false on error", () => {
    mockToken.token = "jwt-token";
    const { result } = renderHook(() => useWebSocket("order-1"));
    act(() => MockWebSocket.instances[0].simulateOpen());
    expect(result.current.connected).toBe(true);
    act(() => MockWebSocket.instances[0].simulateError());
    expect(result.current.connected).toBe(false);
  });

  it("sets connected to false on close", () => {
    mockToken.token = "jwt-token";
    const { result } = renderHook(() => useWebSocket("order-1"));
    act(() => MockWebSocket.instances[0].simulateOpen());
    act(() => MockWebSocket.instances[0].simulateClose());
    expect(result.current.connected).toBe(false);
  });

  it("calls onMessage with parsed data", () => {
    mockToken.token = "jwt-token";
    const onMessage = vi.fn();
    renderHook(() => useWebSocket("order-1", onMessage));
    act(() => MockWebSocket.instances[0].simulateMessage({ type: "test" }));
    expect(onMessage).toHaveBeenCalledWith({ type: "test" });
  });

  it("send sends JSON data when connected", () => {
    mockToken.token = "jwt-token";
    const { result } = renderHook(() => useWebSocket("order-1"));
    act(() => MockWebSocket.instances[0].simulateOpen());
    act(() => result.current.send({ action: "ping" }));
    expect(MockWebSocket.instances[0].sentMessages).toHaveLength(1);
    expect(JSON.parse(MockWebSocket.instances[0].sentMessages[0])).toEqual({
      action: "ping",
    });
  });

  it("closes websocket on unmount", () => {
    mockToken.token = "jwt-token";
    const { unmount } = renderHook(() => useWebSocket("order-1"));
    const ws = MockWebSocket.instances[0];
    unmount();
    expect(ws.closeCalled).toBe(true);
  });
});

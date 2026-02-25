"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { WS_URL } from "@/lib/config";
import { useAuthStore } from "@/stores/authStore";

type MessageHandler = (data: Record<string, unknown>) => void;

export function useWebSocket(
  orderId: string | null,
  onMessage?: MessageHandler
) {
  const wsRef = useRef<WebSocket | null>(null);
  const { token } = useAuthStore();
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!orderId || !token) return;

    const ws = new WebSocket(
      `${WS_URL}/ws/orders/${orderId}?token=${token}`
    );
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessageRef.current?.(data);
      } catch {
        console.error("Failed to parse WebSocket message");
      }
    };

    ws.onerror = () => setConnected(false);
    ws.onclose = () => setConnected(false);

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [orderId, token]);

  const send = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { send, connected };
}

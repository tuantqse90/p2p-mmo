"use client";

import { useState, useRef, useEffect } from "react";
import { Message } from "@/lib/types";
import { useEncryption } from "@/hooks/useEncryption";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAuthStore } from "@/stores/authStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";

interface ChatWindowProps {
  orderId: string;
  counterpartyPublicKey: string | null;
}

interface DecryptedMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
  isMine: boolean;
}

export function ChatWindow({ orderId, counterpartyPublicKey }: ChatWindowProps) {
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const { encrypt, decrypt, hasKeys } = useEncryption();
  const { walletAddress } = useAuthStore();
  const { addNotification } = useNotificationStore();

  // WebSocket for real-time messages
  useWebSocket(orderId, (data) => {
    if (data.type === "new_message" && counterpartyPublicKey) {
      const msg = data.message as Message;
      try {
        const text = decrypt(msg.ciphertext, msg.nonce, counterpartyPublicKey);
        setMessages((prev) => [
          ...prev,
          {
            id: msg.id,
            sender: msg.sender_wallet,
            text,
            timestamp: msg.created_at,
            isMine:
              msg.sender_wallet.toLowerCase() ===
              walletAddress?.toLowerCase(),
          },
        ]);
      } catch {
        // Can't decrypt - might not be for us
      }
    }
  });

  const decryptMessages = (items: Message[]): DecryptedMessage[] => {
    if (!counterpartyPublicKey) return [];
    const decrypted: DecryptedMessage[] = [];
    for (const msg of items) {
      try {
        const text = decrypt(msg.ciphertext, msg.nonce, counterpartyPublicKey);
        decrypted.push({
          id: msg.id,
          sender: msg.sender_wallet,
          text,
          timestamp: msg.created_at,
          isMine:
            msg.sender_wallet.toLowerCase() === walletAddress?.toLowerCase(),
        });
      } catch {
        // Skip messages we can't decrypt
      }
    }
    return decrypted;
  };

  // Load existing messages
  useEffect(() => {
    if (!orderId || !counterpartyPublicKey || !hasKeys) return;

    const loadMessages = async () => {
      try {
        const data = await api.get<{ items: Message[]; total_pages: number }>(
          `/orders/${orderId}/messages?page=1&page_size=50`
        );
        setMessages(decryptMessages(data.items));
        setHasMoreMessages(data.total_pages > 1);
        setCurrentPage(1);
      } catch {
        // Failed to load messages
      }
    };

    loadMessages();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, counterpartyPublicKey, hasKeys, walletAddress]);

  const loadOlderMessages = async () => {
    if (loadingOlder || !hasMoreMessages) return;
    setLoadingOlder(true);
    try {
      const nextPage = currentPage + 1;
      const data = await api.get<{ items: Message[]; total_pages: number }>(
        `/orders/${orderId}/messages?page=${nextPage}&page_size=50`
      );
      const older = decryptMessages(data.items);
      setMessages((prev) => [...older, ...prev]);
      setCurrentPage(nextPage);
      setHasMoreMessages(nextPage < data.total_pages);
    } catch {
      // Failed to load older messages
    } finally {
      setLoadingOlder(false);
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !counterpartyPublicKey || !hasKeys) return;

    setLoading(true);
    try {
      const { ciphertext, nonce } = encrypt(input, counterpartyPublicKey);

      await api.post(`/orders/${orderId}/messages`, {
        ciphertext,
        nonce,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sender: walletAddress || "",
          text: input,
          timestamp: new Date().toISOString(),
          isMine: true,
        },
      ]);
      setInput("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send message";
      addNotification("error", message);
    } finally {
      setLoading(false);
    }
  };

  if (!hasKeys) {
    return (
      <div className="bg-surface border border-border rounded-xl p-6 text-center">
        <p className="text-muted">Sign in to use encrypted chat</p>
      </div>
    );
  }

  if (!counterpartyPublicKey) {
    return (
      <div className="bg-surface border border-border rounded-xl p-6 text-center">
        <p className="text-muted">
          Counterparty has not registered their encryption key yet
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl flex flex-col h-[400px]">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold">Encrypted Chat</h3>
        <p className="text-xs text-muted">End-to-end encrypted with NaCl</p>
      </div>

      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {hasMoreMessages && (
          <div className="text-center">
            <button
              onClick={loadOlderMessages}
              disabled={loadingOlder}
              className="text-xs text-primary hover:underline disabled:opacity-50"
            >
              {loadingOlder ? "Loading..." : "Load older messages"}
            </button>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.isMine ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[70%] px-3 py-2 rounded-lg text-sm ${
                msg.isMine
                  ? "bg-primary/20 text-foreground"
                  : "bg-surface-hover text-foreground"
              }`}
            >
              <p>{msg.text}</p>
              <p className="text-xs text-muted mt-1">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-border flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Type a message..."
          className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder-muted focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
        <Button size="sm" onClick={handleSend} loading={loading}>
          Send
        </Button>
      </div>
    </div>
  );
}

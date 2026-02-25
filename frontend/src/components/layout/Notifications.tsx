"use client";

import { useNotificationStore, NotificationType } from "@/stores/notificationStore";

const iconMap: Record<NotificationType, string> = {
  success: "text-success",
  error: "text-danger",
  warning: "text-warning",
  info: "text-blue-400",
};

export function Notifications() {
  const { notifications, removeNotification } = useNotificationStore();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map((n) => (
        <div
          key={n.id}
          className="bg-surface border border-border rounded-lg p-4 shadow-lg flex items-start gap-3 animate-in slide-in-from-right"
        >
          <span className={`text-lg ${iconMap[n.type]}`}>
            {n.type === "success"
              ? "\u2713"
              : n.type === "error"
              ? "\u2717"
              : n.type === "warning"
              ? "!"
              : "i"}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{n.title}</p>
            {n.message && (
              <p className="text-xs text-muted mt-0.5">{n.message}</p>
            )}
          </div>
          <button
            onClick={() => removeNotification(n.id)}
            className="text-muted hover:text-foreground"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

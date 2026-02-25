import { create } from "zustand";

export type NotificationType = "success" | "error" | "warning" | "info";

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
}

interface NotificationState {
  notifications: Notification[];
  addNotification: (
    type: NotificationType,
    title: string,
    message?: string
  ) => void;
  removeNotification: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  addNotification: (type, title, message) => {
    const id = crypto.randomUUID();
    set((state) => ({
      notifications: [...state.notifications, { id, type, title, message }],
    }));
    setTimeout(() => {
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      }));
    }, 5000);
  },
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
}));

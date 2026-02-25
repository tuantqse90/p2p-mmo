import { create } from "zustand";
import { Order } from "@/lib/types";

interface OrderState {
  orders: Order[];
  activeOrder: Order | null;
  loading: boolean;
  setOrders: (orders: Order[]) => void;
  setActiveOrder: (order: Order | null) => void;
  updateOrder: (id: string, updates: Partial<Order>) => void;
  setLoading: (loading: boolean) => void;
}

export const useOrderStore = create<OrderState>((set) => ({
  orders: [],
  activeOrder: null,
  loading: false,
  setOrders: (orders) => set({ orders }),
  setActiveOrder: (order) => set({ activeOrder: order }),
  updateOrder: (id, updates) =>
    set((state) => ({
      orders: state.orders.map((o) =>
        o.id === id ? { ...o, ...updates } : o
      ),
      activeOrder:
        state.activeOrder?.id === id
          ? { ...state.activeOrder, ...updates }
          : state.activeOrder,
    })),
  setLoading: (loading) => set({ loading }),
}));

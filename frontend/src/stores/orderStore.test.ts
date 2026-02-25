import { describe, it, expect, beforeEach } from "vitest";
import { useOrderStore } from "./orderStore";
import { Order, OrderStatus, TokenType } from "@/lib/types";

const makeOrder = (overrides: Partial<Order> = {}): Order => ({
  id: "order-1",
  onchain_order_id: null,
  chain: "bsc",
  buyer_wallet: "0xbuyer",
  seller_wallet: "0xseller",
  arbitrator_wallet: null,
  product_id: "prod-1",
  token: TokenType.USDT,
  amount: 100,
  platform_fee: 2,
  status: OrderStatus.CREATED,
  product_key_encrypted: null,
  tx_hash_create: "0xtx",
  tx_hash_complete: null,
  seller_confirmed_at: null,
  dispute_opened_at: null,
  dispute_deadline: null,
  completed_at: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

describe("orderStore", () => {
  beforeEach(() => {
    useOrderStore.setState({
      orders: [],
      activeOrder: null,
      loading: false,
    });
  });

  it("has correct initial state", () => {
    const state = useOrderStore.getState();
    expect(state.orders).toEqual([]);
    expect(state.activeOrder).toBeNull();
    expect(state.loading).toBe(false);
  });

  it("setOrders updates orders list", () => {
    const orders = [makeOrder(), makeOrder({ id: "order-2" })];
    useOrderStore.getState().setOrders(orders);
    expect(useOrderStore.getState().orders).toHaveLength(2);
  });

  it("setActiveOrder updates active order", () => {
    const order = makeOrder();
    useOrderStore.getState().setActiveOrder(order);
    expect(useOrderStore.getState().activeOrder).toEqual(order);
  });

  it("setActiveOrder clears with null", () => {
    useOrderStore.getState().setActiveOrder(makeOrder());
    useOrderStore.getState().setActiveOrder(null);
    expect(useOrderStore.getState().activeOrder).toBeNull();
  });

  it("updateOrder updates an order in the list", () => {
    const orders = [
      makeOrder({ id: "order-1" }),
      makeOrder({ id: "order-2" }),
    ];
    useOrderStore.getState().setOrders(orders);

    useOrderStore
      .getState()
      .updateOrder("order-1", { status: OrderStatus.COMPLETED });

    const updated = useOrderStore.getState().orders;
    expect(updated[0].status).toBe(OrderStatus.COMPLETED);
    expect(updated[1].status).toBe(OrderStatus.CREATED);
  });

  it("updateOrder updates activeOrder if it matches", () => {
    const order = makeOrder({ id: "order-1" });
    useOrderStore.getState().setOrders([order]);
    useOrderStore.getState().setActiveOrder(order);

    useOrderStore
      .getState()
      .updateOrder("order-1", { status: OrderStatus.SELLER_CONFIRMED });

    expect(useOrderStore.getState().activeOrder?.status).toBe(
      OrderStatus.SELLER_CONFIRMED
    );
  });

  it("updateOrder does not affect activeOrder if different id", () => {
    useOrderStore.getState().setOrders([
      makeOrder({ id: "order-1" }),
      makeOrder({ id: "order-2" }),
    ]);
    useOrderStore.getState().setActiveOrder(makeOrder({ id: "order-2" }));

    useOrderStore
      .getState()
      .updateOrder("order-1", { status: OrderStatus.CANCELLED });

    expect(useOrderStore.getState().activeOrder?.status).toBe(
      OrderStatus.CREATED
    );
  });

  it("setLoading toggles loading state", () => {
    useOrderStore.getState().setLoading(true);
    expect(useOrderStore.getState().loading).toBe(true);

    useOrderStore.getState().setLoading(false);
    expect(useOrderStore.getState().loading).toBe(false);
  });
});

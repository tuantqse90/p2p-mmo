import { test, expect } from "@playwright/test";
import { setupApiMocks } from "./fixtures/api-mocks";
import { injectAuth } from "./fixtures/auth";
import { mockOrders, TEST_BUYER, TEST_SELLER } from "./fixtures/mock-data";

test.describe("Order Detail Page", () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test("shows order timeline with status steps", async ({ page }) => {
    await page.goto("/orders/order-001");
    await injectAuth(page);

    await expect(page.getByText("Order Details")).toBeVisible();
    // Timeline steps
    await expect(page.getByText("Order Created")).toBeVisible();
    await expect(page.getByText("Seller Confirmed")).toBeVisible();
    await expect(page.getByText("Completed")).toBeVisible();
  });

  test("shows order amount, buyer, and seller info", async ({ page }) => {
    await page.goto("/orders/order-001");
    await injectAuth(page);

    const order = mockOrders[0];
    await expect(page.getByText(`${order.amount} ${order.token}`)).toBeVisible();
    // Truncated addresses
    await expect(
      page.getByText(order.buyer_wallet.slice(0, 10))
    ).toBeVisible();
    await expect(
      page.getByText(order.seller_wallet.slice(0, 10))
    ).toBeVisible();
  });

  test("shows Cancel Order button for buyer on CREATED order", async ({
    page,
  }) => {
    await page.goto("/orders/order-001"); // Status: CREATED
    await injectAuth(page, TEST_BUYER);

    await expect(
      page.getByRole("button", { name: "Cancel Order" })
    ).toBeVisible();
  });

  test("shows Confirm Received and Open Dispute for buyer on SELLER_CONFIRMED order", async ({
    page,
  }) => {
    await page.goto("/orders/order-002"); // Status: SELLER_CONFIRMED
    await injectAuth(page, TEST_BUYER);

    await expect(
      page.getByRole("button", { name: "Confirm Received" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Open Dispute" })
    ).toBeVisible();
  });
});

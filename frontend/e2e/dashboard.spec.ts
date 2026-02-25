import { test, expect } from "@playwright/test";
import { setupApiMocks } from "./fixtures/api-mocks";
import { injectAuth } from "./fixtures/auth";

test.describe("Dashboard Page", () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test("shows sign-in prompt when not authenticated", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(
      page.getByText("Connect your wallet and sign in")
    ).toBeVisible();
  });

  test("shows purchases tab with orders when authenticated", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await injectAuth(page);

    await expect(
      page.getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();

    // Purchases tab should be active by default
    const purchasesTab = page.getByRole("button", { name: "purchases" });
    await expect(purchasesTab).toBeVisible();

    // Should show order data (amount from mock orders)
    await expect(page.getByText("99.99 USDT").first()).toBeVisible();
  });

  test("switches to sales tab and shows orders", async ({ page }) => {
    await page.goto("/dashboard");
    await injectAuth(page);

    await page.getByRole("button", { name: "sales" }).click();

    // Sales tab shows orders with sale role
    await expect(page.getByText("Sale").first()).toBeVisible();
  });

  test("switches to listings tab and shows products", async ({ page }) => {
    await page.goto("/dashboard");
    await injectAuth(page);

    await page.getByRole("button", { name: "listings" }).click();

    // Should show product titles from my listings
    await expect(page.getByText("Premium Data Bundle")).toBeVisible();
  });
});

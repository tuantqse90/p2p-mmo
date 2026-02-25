import { test, expect } from "@playwright/test";
import { setupApiMocks } from "./fixtures/api-mocks";
import { injectAuth } from "./fixtures/auth";
import { mockProducts } from "./fixtures/mock-data";

const product = mockProducts[0]; // Premium Data Bundle

test.describe("Product Detail Page", () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test("displays product info: title, description, price, seller", async ({
    page,
  }) => {
    await page.goto(`/marketplace/${product.id}`);

    await expect(
      page.getByRole("heading", { name: product.title_preview })
    ).toBeVisible();
    await expect(
      page.getByText(product.description_preview!)
    ).toBeVisible();
    await expect(page.getByText(`$${product.price_usdt}`)).toBeVisible();
    // Seller address truncated: first 6 chars
    await expect(
      page.getByText(product.seller_wallet.slice(0, 6))
    ).toBeVisible();
  });

  test("shows Buy Now button when authenticated as non-seller", async ({
    page,
  }) => {
    await page.goto(`/marketplace/${product.id}`);
    await injectAuth(page);

    await expect(page.getByRole("button", { name: "Buy Now" })).toBeVisible();
  });

  test("shows stock and total sold info", async ({ page }) => {
    await page.goto(`/marketplace/${product.id}`);

    await expect(page.getByText(String(product.stock))).toBeVisible();
    await expect(page.getByText(String(product.total_sold))).toBeVisible();
  });

  test("back button navigates back", async ({ page }) => {
    // Navigate to marketplace first, then to product detail
    await page.goto("/marketplace");
    await page.getByText(product.title_preview).click();
    await expect(page).toHaveURL(/\/marketplace\/prod-001/);

    // Click back
    await page.getByText("← Back").click();
    await expect(page).toHaveURL(/\/marketplace$/);
  });
});

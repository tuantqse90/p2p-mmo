import { test, expect } from "@playwright/test";
import { setupApiMocks } from "./fixtures/api-mocks";
import { mockProducts, paginatedProducts } from "./fixtures/mock-data";

test.describe("Marketplace Page", () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test("displays product grid from API", async ({ page }) => {
    await page.goto("/marketplace");

    // Wait for heading to confirm page loaded
    await expect(
      page.getByRole("heading", { name: "Marketplace" })
    ).toBeVisible();

    // All 3 mock products should be displayed
    for (const product of mockProducts) {
      await expect(page.getByText(product.title_preview)).toBeVisible();
    }
  });

  test("product card shows title, price, and category", async ({ page }) => {
    await page.goto("/marketplace");
    await expect(
      page.getByRole("heading", { name: "Marketplace" })
    ).toBeVisible();

    const product = mockProducts[0];
    await expect(page.getByText(product.title_preview)).toBeVisible();
    await expect(page.getByText(`$${product.price_usdt}`).first()).toBeVisible();
    // "Data" badge — filter out <option> elements by using a visible locator
    await expect(page.locator(".grid >> text=Data").first()).toBeVisible();
  });

  test("search filters products via API re-fetch", async ({ page }) => {
    // Override route for search-specific behavior (hostname-scoped)
    await page.route(/localhost:8000\/products/, (route) => {
      const url = new URL(route.request().url());
      const search = url.searchParams.get("search") || "";
      if (search.toLowerCase().includes("api")) {
        const filtered = mockProducts.filter((p) =>
          p.title_preview.toLowerCase().includes("api")
        );
        return route.fulfill({ json: paginatedProducts(filtered) });
      }
      return route.fulfill({ json: paginatedProducts() });
    });

    await page.goto("/marketplace");

    // Type in search
    await page.getByPlaceholder("Search products...").fill("API");

    // Should show only the API tool product
    await expect(page.getByText("API Access Tool")).toBeVisible();
    await expect(page.getByText("Premium Data Bundle")).toBeHidden({
      timeout: 5000,
    });
  });

  test("clicking product card navigates to product detail", async ({
    page,
  }) => {
    await page.goto("/marketplace");

    const product = mockProducts[0];
    await page.getByText(product.title_preview).click();
    await expect(page).toHaveURL(/\/marketplace\/prod-001/);
  });

  test("shows empty state when no products", async ({ page }) => {
    await page.route(/localhost:8000\/products/, (route) =>
      route.fulfill({
        json: { items: [], total: 0, page: 1, page_size: 20, total_pages: 0 },
      })
    );

    await page.goto("/marketplace");
    await expect(page.getByText("No products found")).toBeVisible();
  });
});

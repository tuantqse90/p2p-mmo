import { test, expect } from "@playwright/test";
import { setupApiMocks } from "./fixtures/api-mocks";
import { injectAuth } from "./fixtures/auth";

test.describe("Sell / Create Listing Page", () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test("shows sign-in prompt when not authenticated", async ({ page }) => {
    await page.goto("/sell");

    await expect(
      page.getByText("Connect your wallet and sign in to create a listing")
    ).toBeVisible();
  });

  test("renders create listing form with all fields", async ({ page }) => {
    await page.goto("/sell");
    await injectAuth(page);

    await expect(
      page.getByRole("heading", { name: "Create New Listing" })
    ).toBeVisible();

    // Form fields
    await expect(
      page.getByPlaceholder("Product title (visible to buyers)")
    ).toBeVisible();
    await expect(
      page.getByPlaceholder("Brief description (visible to buyers)")
    ).toBeVisible();
    await expect(page.getByPlaceholder("0.00")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create Listing" })
    ).toBeVisible();
  });

  test("shows validation errors for empty required fields", async ({
    page,
  }) => {
    await page.goto("/sell");
    await injectAuth(page);

    // Submit without filling anything
    await page.getByRole("button", { name: "Create Listing" }).click();

    // Should show validation error for title and price
    await expect(page.getByText("Title is required")).toBeVisible();
    await expect(
      page.getByText("Price must be greater than 0")
    ).toBeVisible();
  });
});

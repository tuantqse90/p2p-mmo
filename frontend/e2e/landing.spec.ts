import { test, expect } from "@playwright/test";
import { setupApiMocks } from "./fixtures/api-mocks";

test.describe("Landing Page", () => {
  test("renders hero section with title and description", async ({ page }) => {
    await setupApiMocks(page);
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "P2P"
    );
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Marketplace"
    );
    await expect(
      page.getByText("Non-custodial escrow marketplace")
    ).toBeVisible();
  });

  test("displays feature cards for Escrow, Encryption, and Disputes", async ({
    page,
  }) => {
    await setupApiMocks(page);
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Non-Custodial Escrow" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "E2E Encryption" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "On-Chain Disputes" })).toBeVisible();
  });

  test("header has Marketplace navigation link", async ({ page }) => {
    await setupApiMocks(page);
    await page.goto("/");

    const marketplaceLink = page.locator('a[href="/marketplace"]').first();
    await expect(marketplaceLink).toBeVisible();
    await marketplaceLink.click();
    await expect(page).toHaveURL(/\/marketplace/);
  });
});

import { Page } from "@playwright/test";
import {
  mockProducts,
  mockOrders,
  mockMessages,
  mockEvidence,
  paginatedProducts,
  paginatedOrders,
} from "./mock-data";

/**
 * Intercept all backend API calls (localhost:8000) and return mock data.
 * Regex patterns include "localhost:8000" to avoid intercepting Next.js
 * page navigations on localhost:3000.
 */
export async function setupApiMocks(page: Page) {
  // ---- Health ----
  await page.route(/localhost:8000\/health/, (route) =>
    route.fulfill({ json: { status: "ok" } })
  );

  // ---- Auth ----
  await page.route(/localhost:8000\/auth\/nonce/, (route) =>
    route.fulfill({
      json: {
        nonce: "test-nonce-123",
        message: "Sign this message to authenticate: test-nonce-123",
      },
    })
  );

  await page.route(/localhost:8000\/auth\/verify/, (route) =>
    route.fulfill({
      json: {
        token: "mock-jwt-token",
        expires_at: "2026-03-01T00:00:00Z",
        wallet_address: "0x1234567890123456789012345678901234567890",
      },
    })
  );

  // ---- Products (single handler for all API /products routes) ----
  await page.route(/localhost:8000\/products/, (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;
    const method = route.request().method();

    // POST /products — create product
    if (pathname === "/products" && method === "POST") {
      return route.fulfill({
        json: { data: mockProducts[0], message: "Product created" },
      });
    }

    // GET /products/me — my products
    if (pathname.startsWith("/products/me")) {
      return route.fulfill({
        json: paginatedProducts(mockProducts.slice(0, 2)),
      });
    }

    // GET /products/:id — single product detail
    const productIdMatch = pathname.match(/^\/products\/(prod-[^/]+)$/);
    if (productIdMatch) {
      const product = mockProducts.find((p) => p.id === productIdMatch[1]);
      if (product) {
        return route.fulfill({ json: product });
      }
      return route.fulfill({ status: 404, json: { detail: "Not found" } });
    }

    // GET /products — product list (with optional query params)
    const search = url.searchParams.get("search") || "";
    if (search) {
      const filtered = mockProducts.filter(
        (p) =>
          p.title_preview.toLowerCase().includes(search.toLowerCase()) ||
          p.description_preview?.toLowerCase().includes(search.toLowerCase())
      );
      return route.fulfill({ json: paginatedProducts(filtered) });
    }

    return route.fulfill({ json: paginatedProducts() });
  });

  // ---- Orders (single handler for all API /orders routes) ----
  await page.route(/localhost:8000\/orders/, (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;
    const method = route.request().method();

    // POST /orders — create order
    if (pathname === "/orders" && method === "POST") {
      return route.fulfill({ json: mockOrders[0] });
    }

    // /orders/:id/... — order sub-routes
    const orderMatch = pathname.match(/^\/orders\/(order-[^/]+)(?:\/(.+))?$/);
    if (orderMatch) {
      const orderId = orderMatch[1];
      const subPath = orderMatch[2];

      if (subPath === "messages") {
        return route.fulfill({
          json: {
            items: mockMessages.filter((m) => m.order_id === orderId),
            total: mockMessages.length,
            page: 1,
            page_size: 50,
            total_pages: 1,
          },
        });
      }

      if (subPath === "evidence") {
        return route.fulfill({
          json: {
            items: mockEvidence.filter((e) => e.order_id === orderId),
          },
        });
      }

      if (["deliver", "confirm", "cancel", "dispute"].includes(subPath || "")) {
        return route.fulfill({ status: 200, json: { message: "ok" } });
      }

      // Base order detail (no sub-path)
      if (!subPath) {
        const order = mockOrders.find((o) => o.id === orderId);
        if (order) {
          return route.fulfill({ json: order });
        }
        return route.fulfill({ status: 404, json: { detail: "Not found" } });
      }
    }

    // GET /orders — order list
    const role = url.searchParams.get("role");
    if (role === "seller") {
      return route.fulfill({ json: paginatedOrders(mockOrders.slice(0, 2)) });
    }
    return route.fulfill({ json: paginatedOrders() });
  });

  // ---- Arbitrator ----
  await page.route(/localhost:8000\/arbitrator\/me/, (route) =>
    route.fulfill({
      json: {
        is_registered: false,
        stake: "0",
        reputation: 0,
        active_disputes: 0,
      },
    })
  );
}

import { Page } from "@playwright/test";
import { TEST_BUYER } from "./mock-data";

/**
 * Inject authenticated state by calling the Zustand store's setAuth directly.
 *
 * The authStore.ts exposes the store on window.__authStore for E2E testing.
 * Must be called AFTER page.goto() since it uses page.evaluate.
 */
export async function injectAuth(page: Page, wallet = TEST_BUYER) {
  // Wait for the store to be available (JS loaded)
  await page.waitForFunction(
    () => typeof (window as unknown as Record<string, unknown>).__authStore === "function",
    { timeout: 10000 }
  );

  await page.evaluate(
    ({ address, pubKey, secKey }) => {
      const store = (window as unknown as Record<string, unknown>)
        .__authStore as {
        getState: () => {
          setAuth: (token: string, walletAddress: string) => void;
          setEncryptionKeys: (publicKey: string, secretKey: string) => void;
        };
      };
      store.getState().setAuth("mock-jwt-token", address);
      store.getState().setEncryptionKeys(pubKey, secKey);
    },
    {
      address: wallet,
      pubKey: "dGVzdC1wdWJsaWMta2V5LWJhc2U2NA==",
      secKey: "dGVzdC1zZWNyZXQta2V5LWJhc2U2NA==",
    }
  );

  // Wait for React to re-render with the new auth state
  await page.waitForTimeout(100);
}

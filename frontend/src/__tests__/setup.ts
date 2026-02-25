import "@testing-library/jest-dom/vitest";

// Mock crypto.randomUUID for notification store
if (!globalThis.crypto?.randomUUID) {
  let counter = 0;
  Object.defineProperty(globalThis, "crypto", {
    value: {
      ...globalThis.crypto,
      randomUUID: () => `test-uuid-${++counter}`,
    },
  });
}

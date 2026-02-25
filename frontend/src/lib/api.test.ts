import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiError } from "./api";

// We need to test the ApiClient class but it's instantiated with a config import.
// Let's test it by creating a fresh instance.
// First, mock the config module.
vi.mock("./config", () => ({
  API_URL: "http://test-api:8000",
}));

// Now import after mock
const { api } = await import("./api");

describe("ApiClient", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    globalThis.fetch = mockFetch;
    api.setToken(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("makes GET requests", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: "test" }),
    });

    const result = await api.get("/test");
    expect(result).toEqual({ data: "test" });
    expect(mockFetch).toHaveBeenCalledWith(
      "http://test-api:8000/test",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      })
    );
  });

  it("makes POST requests with body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 1 }),
    });

    const result = await api.post("/items", { name: "test" });
    expect(result).toEqual({ id: 1 });
    expect(mockFetch).toHaveBeenCalledWith(
      "http://test-api:8000/items",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "test" }),
      })
    );
  });

  it("makes PUT requests", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ updated: true }),
    });

    await api.put("/items/1", { name: "updated" });
    expect(mockFetch).toHaveBeenCalledWith(
      "http://test-api:8000/items/1",
      expect.objectContaining({ method: "PUT" })
    );
  });

  it("makes DELETE requests", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
    });

    const result = await api.delete("/items/1");
    expect(result).toBeUndefined();
    expect(mockFetch).toHaveBeenCalledWith(
      "http://test-api:8000/items/1",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("injects Authorization header when token is set", async () => {
    api.setToken("my-jwt-token");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });

    await api.get("/protected");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer my-jwt-token",
        }),
      })
    );
  });

  it("does not inject Authorization header when no token", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });

    await api.get("/public");
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers.Authorization).toBeUndefined();
  });

  it("throws ApiError on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: () => Promise.resolve({ detail: "UNAUTHORIZED" }),
    });

    await expect(api.get("/fail")).rejects.toThrow(ApiError);
    try {
      await api.get("/fail");
    } catch (e) {
      // Second call for assertion
    }
  });

  it("ApiError has status and detail", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: () => Promise.resolve({ detail: "NOT_FOUND" }),
    });

    try {
      await api.get("/missing");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      const err = e as ApiError;
      expect(err.status).toBe(404);
      expect(err.detail).toBe("NOT_FOUND");
    }
  });

  it("handles JSON parse error on error response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.reject(new Error("bad json")),
    });

    try {
      await api.get("/broken");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      const err = e as ApiError;
      expect(err.status).toBe(500);
      expect(err.detail).toBe("Internal Server Error");
    }
  });

  it("handles 204 No Content", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
    });

    const result = await api.delete("/items/1");
    expect(result).toBeUndefined();
  });

  it("clears token on setToken(null)", async () => {
    api.setToken("token123");
    api.setToken(null);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });

    await api.get("/test");
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers.Authorization).toBeUndefined();
  });
});

describe("ApiError", () => {
  it("is an instance of Error", () => {
    const err = new ApiError(400, "Bad Request");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("ApiError");
    expect(err.message).toBe("Bad Request");
    expect(err.status).toBe(400);
    expect(err.detail).toBe("Bad Request");
  });
});

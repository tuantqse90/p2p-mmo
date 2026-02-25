import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Header } from "./Header";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock RainbowKit ConnectButton
vi.mock("@rainbow-me/rainbowkit", () => ({
  ConnectButton: () => <button>Connect Wallet</button>,
}));

// Mock useAuth hook
const mockLogin = vi.fn();
const mockLogout = vi.fn();
const mockUseAuth = vi.fn(() => ({
  isConnected: false,
  isAuthenticated: false,
  login: mockLogin,
  logout: mockLogout,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("Header", () => {
  it("renders P2P Market logo link", () => {
    render(<Header />);
    expect(screen.getByText("P2P Market")).toBeDefined();
  });

  it("renders Marketplace nav link", () => {
    render(<Header />);
    expect(screen.getByText("Marketplace")).toBeDefined();
  });

  it("renders Connect Wallet button", () => {
    render(<Header />);
    expect(screen.getByText("Connect Wallet")).toBeDefined();
  });

  it("shows Sign In button when connected but not authenticated", () => {
    mockUseAuth.mockReturnValue({
      isConnected: true,
      isAuthenticated: false,
      login: mockLogin,
      logout: mockLogout,
    });
    render(<Header />);
    expect(screen.getByText("Sign In")).toBeDefined();
  });

  it("calls login when Sign In is clicked", () => {
    mockUseAuth.mockReturnValue({
      isConnected: true,
      isAuthenticated: false,
      login: mockLogin,
      logout: mockLogout,
    });
    render(<Header />);
    fireEvent.click(screen.getByText("Sign In"));
    expect(mockLogin).toHaveBeenCalled();
  });

  it("shows Sign Out and dashboard links when authenticated", () => {
    mockUseAuth.mockReturnValue({
      isConnected: true,
      isAuthenticated: true,
      login: mockLogin,
      logout: mockLogout,
    });
    render(<Header />);
    expect(screen.getByText("Sign Out")).toBeDefined();
    expect(screen.getByText("Dashboard")).toBeDefined();
    expect(screen.getByText("Sell")).toBeDefined();
    expect(screen.getByText("Arbitrator")).toBeDefined();
  });

  it("calls logout when Sign Out is clicked", () => {
    mockUseAuth.mockReturnValue({
      isConnected: true,
      isAuthenticated: true,
      login: mockLogin,
      logout: mockLogout,
    });
    render(<Header />);
    fireEvent.click(screen.getByText("Sign Out"));
    expect(mockLogout).toHaveBeenCalled();
  });

  it("does not show dashboard links when not authenticated", () => {
    mockUseAuth.mockReturnValue({
      isConnected: false,
      isAuthenticated: false,
      login: mockLogin,
      logout: mockLogout,
    });
    render(<Header />);
    expect(screen.queryByText("Dashboard")).toBeNull();
    expect(screen.queryByText("Sell")).toBeNull();
  });
});

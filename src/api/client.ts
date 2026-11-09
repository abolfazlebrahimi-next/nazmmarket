import { products, stores } from "../data";
import type { Address, CartState, Order, Product, Store as StoreType, User } from "../data";

/**
 * ------------------------------------------------------------------
 * API client — contract for the nazmarket backend.
 *
 * Every function below mirrors an HTTP endpoint the backend should
 * expose. Right now they resolve against local mock data so the UI
 * is fully functional; when the backend is ready, replace each body
 * with a real `request(...)` call — the signatures are final.
 * ------------------------------------------------------------------
 */
export const API_BASE = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return (await res.json()) as T;
}

// kept for the backend migration — all mock functions below can be
// replaced one by one with request() calls.
void request;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const api = {
  /* POST /auth/otp  |  POST /auth/otp/verify  |  POST /auth/profile */
  auth: {
    sendOtp: async (phone: string): Promise<{ sent: boolean; phone: string }> => {
      await wait(500);
      return { sent: true, phone: phone };
    },
    verifyOtp: async (_phone: string, code: string): Promise<{ valid: boolean; token: string }> => {
      await wait(700);
      // demo mode: any 6-digit code is accepted
      return { valid: code.length === 6, token: "demo-token" };
    },
    completeProfile: async (u: User): Promise<{ id: string; user: User }> => {
      await wait(400);
      return { id: "u_demo", user: u };
    },
  },

  /* GET /stores  |  GET /stores/:id/products */
  catalog: {
    stores: async (): Promise<StoreType[]> => {
      await wait(150);
      return stores;
    },
    products: async (category?: string): Promise<Product[]> => {
      await wait(150);
      return category && category !== "all" ? products.filter((p) => p.category === category) : products;
    },
  },

  /* GET /search?q= */
  search: {
    query: async (q: string): Promise<{ stores: StoreType[]; products: Product[] }> => {
      await wait(120);
      const t = q.trim();
      return {
        stores: t ? stores.filter((s) => s.name.includes(t) || s.area.includes(t)) : [],
        products: t ? products.filter((p) => p.name.includes(t)) : [],
      };
    },
  },

  /* PUT /cart */
  cart: {
    save: async (cart: CartState): Promise<CartState> => {
      try {
        localStorage.setItem("naz_cart", JSON.stringify(cart));
      } catch { /* ignore */ }
      return cart;
    },
  },

  /* POST /orders  |  GET /orders  |  GET /orders/:id */
  orders: {
    place: async (payload: Order): Promise<{ status: "accepted"; order: Order }> => {
      await wait(750);
      return { status: "accepted", order: payload };
    },
    list: async (): Promise<Order[]> => {
      try {
        return JSON.parse(localStorage.getItem("naz_orders") ?? "[]") as Order[];
      } catch {
        return [];
      }
    },
  },

  /* POST /addresses  |  GET /addresses */
  addresses: {
    save: async (a: Address): Promise<Address> => {
      await wait(250);
      return a;
    },
  },

  /* POST /promos/apply */
  promos: {
    apply: async (code: string, subtotal: number): Promise<{ applied: boolean; amount: number }> => {
      await wait(300);
      if (code === "NAZ60") return { applied: true, amount: Math.min(60000, subtotal) };
      if (code === "NAZ10") return { applied: true, amount: Math.min(Math.round(subtotal * 0.1), 50000) };
      if (code === "NAZARABAD") return { applied: subtotal >= 400000, amount: subtotal >= 400000 ? 25000 : 0 };
      return { applied: false, amount: 0 };
    },
  },

  /* POST /wallet/topup */
  wallet: {
    topUp: async (amount: number): Promise<{ amount: number }> => {
      await wait(450);
      return { amount };
    },
  },
};

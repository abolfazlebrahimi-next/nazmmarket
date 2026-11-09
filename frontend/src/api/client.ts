import type { Address, CartState, Order, Product, Store as StoreType, User } from "../data";

/**
 * HTTP client for the nazmarket Node.js backend (see /server).
 * Dev: Vite proxies `/api` → http://localhost:4000. Prod: same origin.
 */
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
export const API_BASE = env?.VITE_API_URL ?? "/api";

const TOKEN_KEY = "naz_token";

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string | null) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 0, code = "error") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type Options = { method?: string; body?: unknown; auth?: boolean };

async function request<T>(path: string, options: Options = {}): Promise<T> {
  const { method = "GET", body, auth = true } = options;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = tokenStore.get();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("ارتباط با سرور برقرار نشد. اتصال اینترنت یا سرور را بررسی کنید.", 0, "network");
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const err = (data as { error?: { message?: string; code?: string } })?.error;
    throw new ApiError(err?.message ?? "خطایی رخ داد؛ دوباره تلاش کنید.", res.status, err?.code ?? "error");
  }

  return (data ?? {}) as T;
}

/* ------------------------------------------------------------------ */
/* wire types                                                          */
/* ------------------------------------------------------------------ */

type WireProduct = Omit<Product, "icon"> & { icon?: string };
export type CatalogResponse = {
  products: WireProduct[];
  stores: StoreType[];
  categories: { id: string; name: string; icon?: string }[];
  brands?: { name: string; color: string }[];
  promos: { code: string; title: string; desc: string; amount: number; storeId: number; storeName: string; kind: string }[];
};

export type AuthResponse = { token: string; user: User; addresses: Address[] };

export type ServerState = {
  user: User;
  cart: CartState;
  favorites: number[];
  addresses: Address[];
  orders: Order[];
  wallet: number;
  pro: boolean;
  firstOrderEligible: boolean;
};

/* ------------------------------------------------------------------ */
/* endpoints                                                           */
/* ------------------------------------------------------------------ */

export const api = {
  auth: {
    register: (payload: { phone: string; password: string; firstName?: string; lastName?: string }) =>
      request<AuthResponse>("/auth/register", { method: "POST", body: payload, auth: false }),
    login: (phone: string, password: string) =>
      request<AuthResponse>("/auth/login", { method: "POST", body: { phone, password }, auth: false }),
    logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
    me: () => request<{ user: User }>("/auth/me"),
    updateProfile: (patch: { firstName?: string; lastName?: string; password?: string }) =>
      request<{ user: User }>("/auth/profile", { method: "PATCH", body: patch }),
  },

  /** Catalog can be fetched without a session. */
  catalog: () => request<CatalogResponse>("/catalog", { auth: false }),
  search: (q: string) =>
    request<{ stores: StoreType[]; products: WireProduct[] }>(`/search?q=${encodeURIComponent(q)}`, { auth: false }),

  state: () => request<ServerState>("/me/state"),

  cart: {
    save: (cart: CartState) => request<{ cart: CartState }>("/me/cart", { method: "PUT", body: cart }),
  },

  favorites: {
    save: (ids: number[]) => request<{ favorites: number[] }>("/me/favorites", { method: "PUT", body: { ids } }),
  },

  addresses: {
    save: (addresses: Address[]) =>
      request<{ addresses: Address[] }>("/me/addresses", { method: "PUT", body: { addresses } }),
  },

  orders: {
    place: (payload: {
      storeId: number;
      items: Record<number, number>;
      addressId?: number;
      addressTitle?: string;
      addressText?: string;
      slot?: string;
      payment?: "online" | "cash";
      promoCode?: string | null;
      firstOrderProductId?: number | null;
    }) => request<{ order: Order }>("/orders", { method: "POST", body: payload }),
    list: () => request<{ orders: Order[] }>("/orders"),
  },

  promos: {
    apply: (code: string, subtotal: number, storeId: number) =>
      request<{ applied: boolean; amount: number; message?: string; promo?: { code: string; kind: string; amount: number; minSubtotal: number; maxDiscount: number } }>("/promos/apply", {
        method: "POST",
        body: { code, subtotal, storeId },
      }),
    list: () => request<{ promos: { code: string; title: string; desc: string; amount: number }[] }>("/promos"),
  },

  wallet: {
    topUp: (amount: number) => request<{ wallet: number; user: User }>("/me/wallet/topup", { method: "POST", body: { amount } }),
  },

  pro: {
    set: (active: boolean) => request<{ pro: boolean }>("/me/pro", { method: "PATCH", body: { active } }),
  },

  health: () => request<{ ok: boolean }>("/health", { auth: false }),
};

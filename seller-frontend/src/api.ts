export type SellerStore = {
  id: number;
  name: string;
  type: string;
  category: string;
  area: string;
  address: string;
  lat?: number;
  lng?: number;
  fee: number;
  minBasket: number;
  minutes: number;
  hours: string;
  photoUrl?: string;
  logoUrl?: string;
  isActive: boolean;
  /** The seller's own «باز هستیم / بسته‌ایم» state for new orders. */
  isOpen: boolean;
};
export type Seller = {
  id: number;
  ownerName: string;
  phone: string;
  hasNationalId: boolean;
  hasIban: boolean;
  store: SellerStore | null;
};
export type Product = {
  masterId?: number;
  id: number;
  name: string;
  category: string;
  price: number;
  oldPrice?: number;
  stock: number;
  imageUrl?: string;
  active: boolean;
  unit?: string;
};
export type Promo = {
  id?: number;
  code: string;
  title: string;
  desc?: string;
  kind: "percent" | "fixed";
  amount: number;
  minSubtotal: number;
  maxDiscount: number;
  active: boolean;
  expiresAt?: string;
  /** Total redemptions allowed; `0` means unlimited. */
  maxUses: number;
  usageCount: number;
};
export type SellerOrder = {
  id: string;
  storeName: string;
  items: { id: number; name: string; qty: number; price: number }[];
  total: number;
  subtotal: number;
  addressTitle: string;
  addressText: string;
  time: string;
  status: number;
  deliveryMode?: "courier" | "seller";
  courierAssigned?: boolean;
  dispatchStartedAt?: string;
  dispatchTimedOut?: boolean;
  dispatchPaused?: boolean;
  dispatch?: { state: string; eligible: number; declined: number };
  payment: string;
  paymentStatus: string;
  customer: { name: string; phone: string };
  /** Who ended a status-0 order; `seller` means this store rejected it. */
  rejectedBy?: "seller" | "customer" | null;
  rejectReason?: string | null;
};
export type DashboardStats = {
  products: number;
  activeProducts: number;
  pendingOrders: number;
  orders: number;
  sales: number;
};

const API = "/api/seller";
const TOKEN_KEY = "naz_seller_token";
export const sellerToken = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token: string | null) => {
    try {
      token
        ? localStorage.setItem(TOKEN_KEY, token)
        : localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable */
    }
  },
};
export class SellerApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public code = "error",
  ) {
    super(message);
  }
}
async function call<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = sellerToken.get();
  if (options.auth !== false && token)
    headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined && !(options.body instanceof FormData))
    headers["Content-Type"] = "application/json";
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      method: options.method ?? "GET",
      headers,
      body:
        options.body instanceof FormData
          ? options.body
          : options.body === undefined
            ? undefined
            : JSON.stringify(options.body),
    });
  } catch {
    throw new SellerApiError(
      "ارتباط با سرور برقرار نشد؛ بک‌اند را بررسی کنید.",
      0,
      "network",
    );
  }
  const raw = await response.text();
  let data: any = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    /* non-JSON error */
  }
  if (response.status === 401 && options.auth !== false) {
    // An outdated seller router can fall through to customer auth and return
    // a misleading 401 for a perfectly valid seller session.
    if (
      token &&
      path !== "/auth/me" &&
      data?.error?.code !== "seller_unauthorized"
    ) {
      let check: Response;
      try {
        check = await fetch(`${API}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        throw new SellerApiError(
          "ارتباط با سرور برقرار نشد؛ اتصال بک‌اند را بررسی کنید.",
          0,
          "network",
        );
      }
      if (check.ok)
        throw new SellerApiError(
          "نشست فروشنده معتبر است، اما این عملیات در بک‌اند فعلی در دسترس نیست. بک‌اند را به‌روزرسانی و ری‌استارت کنید و مقصد API_PROXY_TARGET پنل فروشگاه را بررسی کنید.",
          409,
          "backend_version_mismatch",
        );
      if (check.status !== 401)
        throw new SellerApiError(
          "بررسی نشست ناموفق بود؛ اتصال بک‌اند را بررسی کنید.",
          check.status,
          "session_check_failed",
        );
    }
    sellerToken.set(null);
    window.dispatchEvent(new Event("seller-session-expired"));
  }
  if (!response.ok) {
    const message = data?.error?.message;
    throw new SellerApiError(
      typeof message === "string" && message.trim()
        ? message
        : "درخواست پنل فروشنده انجام نشد؛ اطلاعات را بررسی و دوباره تلاش کنید.",
      response.status,
      data?.error?.code ?? "error",
    );
  }
  return data as T;
}
export const sellerApi = {
  login: (phone: string, password: string) =>
    call<{ token: string; seller: Seller }>("/auth/login", {
      method: "POST",
      auth: false,
      body: { phone, password },
    }),
  register: (body: FormData) =>
    call<{ token: string; seller: Seller }>("/auth/register", {
      method: "POST",
      auth: false,
      body,
    }),
  me: () => call<{ seller: Seller }>("/auth/me"),
  logout: () => call<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  dashboard: () =>
    call<{ store: SellerStore; stats: DashboardStats }>("/dashboard"),
  getStore: () => call<{ store: SellerStore }>("/store"),
  /** «باز هستیم» / «بسته‌ایم» — closed stores get no new or reassigned orders. */
  setStoreOpen: (open: boolean) =>
    call<{ store: SellerStore }>("/store/open", {
      method: "PATCH",
      body: { open },
    }),
  saveStore: (body: FormData) =>
    call<{ store: SellerStore }>("/store", { method: "PUT", body }),
  products: () => call<{ products: Product[] }>("/products"),
  bank: () => call<{ products: Product[] }>("/product-bank"),
  bulkProducts: (masterIds: number[]) =>
    call<{ products: Product[] }>("/products/bulk", {
      method: "POST",
      body: { masterIds },
    }),
  addProduct: (body: { masterId: number; price: number; stock?: number }) =>
    call<{ product: Product }>("/products", { method: "POST", body }),
  updateProduct: (
    id: number,
    body: Partial<Pick<Product, "price" | "stock">> & {
      discountPercent?: number;
    },
  ) => call<{ product: Product }>(`/products/${id}`, { method: "PATCH", body }),
  deleteProduct: (id: number) =>
    call<{ ok: boolean }>(`/products/${id}`, { method: "DELETE" }),
  promotions: () => call<{ promotions: Promo[] }>("/promotions"),
  addPromotion: (body: {
    code: string;
    title: string;
    description: string;
    kind: "percent" | "fixed";
    amount: number;
    minSubtotal: number;
    maxDiscount: number;
    expiresAt: string | null;
    maxUses: number;
  }) => call<{ promotion: Promo }>("/promotions", { method: "POST", body }),
  deletePromotion: (id: number) =>
    call<{ ok: boolean }>(`/promotions/${id}`, { method: "DELETE" }),
  dispatch: (id: string, action: "retry" | "stop") =>
    call<{ order: SellerOrder }>(`/orders/${encodeURIComponent(id)}/dispatch`, {
      method: "POST",
      body: { action },
    }),
  selfDelivery: (id: string, complete = false) =>
    call<{ order: SellerOrder }>(
      `/orders/${encodeURIComponent(id)}/self-delivery${complete ? "/complete" : ""}`,
      { method: "POST" },
    ),
  orders: () => call<{ orders: SellerOrder[] }>("/orders"),
  setOrderStatus: (id: string, status: number) =>
    call<{ order: SellerOrder }>(`/orders/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: { status },
    }),
  /**
   * "Not this one." The customer is told the basket cannot be fulfilled here and
   * is pointed at another store; stock and any single-use code go back.
   */
  rejectOrder: (id: string, reason: string, note?: string) =>
    call<{ order: SellerOrder }>(`/orders/${encodeURIComponent(id)}/reject`, {
      method: "POST",
      body: { reason, note },
    }),
};

const API_BASE_URL = (
  import.meta.env.VITE_WAITLIST_API_BASE_URL || "https://nazarabadshop.ir/api"
).replace(/\/+$/, "");

const ACCESS_TOKEN_KEY = "naz_waitlist_php_access_token";
const REFRESH_TOKEN_KEY = "naz_waitlist_php_refresh_token";
const SESSION_EXPIRED_EVENT = "waitlist-php-session-expired";

type TokenPair = { access_token: string; refresh_token: string };
type ApiEnvelope<T = unknown> = {
  success: boolean;
  data?: T;
  meta?: Record<string, unknown>;
  error?: { code?: string; message?: string };
};
type RequestParams = {
  page: number;
  per_page: number;
  q: string;
  role: string;
  status: string;
  sort: string;
  order: "asc" | "desc";
};

export type WaitlistRole = "customer" | "seller" | "courier";
export type WaitlistStatus = "registered" | "contacted" | "approved" | "rejected";
export type WaitlistUser = {
  id: string | number;
  first_name: string;
  last_name: string;
  phone: string;
  role: WaitlistRole;
  status: WaitlistStatus;
  created_at: string;
  updated_at: string | null;
};
export type WaitlistPage = {
  items: WaitlistUser[];
  meta: Record<string, unknown>;
};
export type WaitlistStats = {
  total: number;
  customers: number;
  sellers: number;
  couriers: number;
};

let refreshFlight: Promise<TokenPair | null> | null = null;
let expirationDispatched = false;

function getTokens(): TokenPair | null {
  if (typeof window === "undefined") return null;
  try {
    const access_token = window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
    const refresh_token = window.sessionStorage.getItem(REFRESH_TOKEN_KEY);
    if (access_token && refresh_token) return { access_token, refresh_token };
    if (access_token || refresh_token) clearSession();
  } catch {
    return null;
  }
  return null;
}

function storeTokens(tokens: TokenPair) {
  if (!tokens.access_token || !tokens.refresh_token)
    throw new Error("پاسخ ورود هاست شامل هر دو توکن دسترسی و تمدید نیست.");
  try {
    window.sessionStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
    window.sessionStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
  } catch {
    clearSession();
    throw new Error("مرورگر اجازهٔ ذخیرهٔ امن نشست موقت را نمی‌دهد.");
  }
  expirationDispatched = false;
}

function clearSession() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // Continue clearing in-memory request state even if storage is unavailable.
  }
}

function announceExpired() {
  clearSession();
  if (expirationDispatched || typeof window === "undefined") return;
  expirationDispatched = true;
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

export function hasWaitlistSession() {
  return getTokens() !== null;
}

function apiUrl(path: string) {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error("پاسخ API هاست JSON معتبر نیست.");
  }
}

function envelope<T = unknown>(payload: unknown, response?: Response): ApiEnvelope<T> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new Error("ساختار پاسخ API هاست معتبر نیست.");
  const result = payload as ApiEnvelope<T>;
  if (result.success !== true) {
    const message = result.error?.message;
    throw new Error(
      typeof message === "string" && message.trim()
        ? message
        : response?.status === 403
          ? "دسترسی به این بخش مجاز نیست."
          : "درخواست API هاست انجام نشد.",
    );
  }
  return result;
}

function tokenPair(data: unknown): TokenPair {
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("ساختار توکن‌های پاسخ API هاست معتبر نیست.");
  const value = data as Record<string, unknown>;
  if (typeof value.access_token !== "string" || typeof value.refresh_token !== "string")
    throw new Error("پاسخ API هاست شامل access_token و refresh_token نیست.");
  return { access_token: value.access_token, refresh_token: value.refresh_token };
}

async function refreshSession(): Promise<TokenPair | null> {
  if (refreshFlight) return refreshFlight;
  const current = getTokens();
  if (!current) {
    announceExpired();
    return null;
  }

  refreshFlight = (async () => {
    try {
      const response = await fetch(apiUrl("/v1/admin/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ refresh_token: current.refresh_token }),
      });
      const result = envelope(await readJson(response), response);
      if (!response.ok) return null;
      const updated = tokenPair(result.data);
      storeTokens(updated);
      return updated;
    } catch {
      return null;
    }
  })().finally(() => {
    refreshFlight = null;
  });

  const updated = await refreshFlight;
  if (!updated) announceExpired();
  return updated;
}

async function authenticatedFetch(path: string, init: RequestInit = {}) {
  let tokens = getTokens();
  if (!tokens) {
    announceExpired();
    throw new Error("نشست مستقل لیست انتظار فعال نیست؛ دوباره وارد شوید.");
  }

  const send = (accessToken: string) => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    if (init.body && !(init.body instanceof FormData))
      headers.set("Content-Type", "application/json");
    return fetch(apiUrl(path), { ...init, headers });
  };

  let response: Response;
  try {
    response = await send(tokens.access_token);
  } catch {
    throw new Error("ارتباط با API هاست برقرار نشد؛ شبکه یا تنظیم CORS را بررسی کنید.");
  }

  if (response.status === 401) {
    const latestTokens = getTokens();
    tokens = latestTokens && latestTokens.access_token !== tokens.access_token
      ? latestTokens
      : await refreshSession();
    if (!tokens) throw new Error("نشست هاست منقضی شد؛ دوباره وارد شوید.");
    try {
      response = await send(tokens.access_token);
    } catch {
      throw new Error("ارتباط با API هاست برقرار نشد؛ شبکه یا تنظیم CORS را بررسی کنید.");
    }
    if (response.status === 401) {
      announceExpired();
      throw new Error("نشست هاست معتبر نیست؛ دوباره وارد شوید.");
    }
  }
  return response;
}

async function authenticatedJson<T = unknown>(path: string, init: RequestInit = {}) {
  const response = await authenticatedFetch(path, init);
  const result = envelope<T>(await readJson(response), response);
  if (!response.ok) throw new Error(result.error?.message || "درخواست API هاست انجام نشد.");
  return result;
}

function requireObject(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(message);
  return value as Record<string, unknown>;
}

function numericCount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value)))
    return Number(value);
  return null;
}

function requireUser(value: unknown): WaitlistUser {
  const record = requireObject(value, "ساختار کاربر دریافتی از API معتبر نیست.");
  const roles: WaitlistRole[] = ["customer", "seller", "courier"];
  const statuses: WaitlistStatus[] = ["registered", "contacted", "approved", "rejected"];
  if ((typeof record.id !== "string" && typeof record.id !== "number") ||
      typeof record.first_name !== "string" || typeof record.last_name !== "string" ||
      typeof record.phone !== "string" || !roles.includes(record.role as WaitlistRole) ||
      !statuses.includes(record.status as WaitlistStatus) || typeof record.created_at !== "string" ||
      !(record.updated_at === null || typeof record.updated_at === "string"))
    throw new Error("یک یا چند فیلد کاربر در پاسخ API با قرارداد مستندشده سازگار نیست.");
  return record as unknown as WaitlistUser;
}

function listUrl(params: RequestParams) {
  const query = new URLSearchParams({
    page: String(params.page),
    per_page: String(params.per_page),
    sort: params.sort,
    order: params.order,
  });
  if (params.q.trim()) query.set("q", params.q.trim());
  if (params.role !== "all") query.set("role", params.role);
  if (params.status !== "all") query.set("status", params.status);
  return `/v1/admin/waitlist?${query.toString()}`;
}

function parseListMeta(value: unknown): Record<string, unknown> {
  return requireObject(value, "اطلاعات صفحه‌بندی در response.meta موجود نیست.");
}

function detailFromData(data: unknown): WaitlistUser {
  const record = requireObject(data, "جزئیات کاربر در response.data موجود نیست.");
  const user = record.item ?? record.user ?? data;
  return requireUser(user);
}

function exportFilename(response: Response) {
  const disposition = response.headers.get("content-disposition") ?? "";
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try { return decodeURIComponent(encoded); } catch { return encoded; }
  }
  return disposition.match(/filename="?([^";]+)"?/i)?.[1] || "waitlist.csv";
}

export const waitlistApi = {
  hasSession: hasWaitlistSession,

  async login(username: string, password: string) {
    let response: Response;
    try {
      response = await fetch(apiUrl("/v1/admin/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ username, password }),
      });
    } catch {
      throw new Error("ارتباط با API ورود هاست برقرار نشد؛ شبکه یا تنظیم CORS را بررسی کنید.");
    }
    const result = envelope(await readJson(response), response);
    if (!response.ok) throw new Error(result.error?.message || "ورود به API هاست ناموفق بود.");
    const tokens = tokenPair(result.data);
    storeTokens(tokens);
    return tokens;
  },

  async logout() {
    const tokens = getTokens();
    try {
      if (tokens) {
        await fetch(apiUrl("/v1/admin/auth/logout"), {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ refresh_token: tokens.refresh_token }),
        });
      }
    } catch {
      // Always clear the local PHP session even if the remote logout is offline.
    } finally {
      clearSession();
      expirationDispatched = false;
    }
  },

  async list(params: RequestParams): Promise<WaitlistPage> {
    const result = await authenticatedJson<unknown>(listUrl(params));
    const data = requireObject(result.data, "فهرست در response.data موجود نیست.");
    if (!Array.isArray(data.items))
      throw new Error("فهرست در مسیر response.data.items موجود نیست.");
    return {
      items: data.items.map(requireUser),
      meta: parseListMeta(result.meta),
    };
  },

  async stats(): Promise<WaitlistStats> {
    const result = await authenticatedJson<unknown>("/v1/admin/stats");
    const data = requireObject(result.data, "آمار در response.data موجود نیست.");
    const source = data.stats && typeof data.stats === "object" && !Array.isArray(data.stats)
      ? data.stats as Record<string, unknown>
      : data;
    const total = numericCount(source.total);
    const customers = numericCount(source.customers);
    const sellers = numericCount(source.sellers);
    const couriers = numericCount(source.couriers);
    if ([total, customers, sellers, couriers].some((value) => value === null))
      throw new Error("فیلدهای total، customers، sellers و couriers در پاسخ آمار موجود نیست.");
    return {
      total: total!,
      customers: customers!,
      sellers: sellers!,
      couriers: couriers!,
    };
  },

  async detail(id: string | number): Promise<WaitlistUser> {
    const result = await authenticatedJson<unknown>(`/v1/admin/waitlist/${encodeURIComponent(String(id))}`);
    return detailFromData(result.data);
  },

  async update(id: string | number, fields: Pick<WaitlistUser, "first_name" | "last_name" | "phone" | "role" | "status">) {
    await authenticatedJson(`/v1/admin/waitlist/${encodeURIComponent(String(id))}`, {
      method: "PATCH",
      body: JSON.stringify(fields),
    });
  },

  async remove(id: string | number) {
    await authenticatedJson(`/v1/admin/waitlist/${encodeURIComponent(String(id))}`, {
      method: "DELETE",
    });
  },

  async exportCsv(): Promise<{ blob: Blob; filename: string }> {
    const response = await authenticatedFetch("/v1/admin/export", {
      method: "GET",
      headers: { Accept: "text/csv, application/json" },
    });
    if (!response.ok) {
      const payload = await readJson(response);
      envelope(payload, response);
      throw new Error("دریافت خروجی CSV ناموفق بود.");
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const result = envelope<Record<string, unknown>>(await readJson(response), response);
      if (typeof result.data === "string")
        return { blob: new Blob([result.data], { type: "text/csv;charset=utf-8" }), filename: "waitlist.csv" };
      throw new Error("API خروجی را به‌صورت فایل CSV برنگرداند.");
    }
    return { blob: await response.blob(), filename: exportFilename(response) };
  },
};

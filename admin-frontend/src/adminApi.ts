const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "/api" : "https://nazarabadshop.ir/api")
).replace(/\/+$/, "");

type ApiScope = "legacy" | "v1";
type DownloadResult = { blob: Blob; filename: string };

let expiring = false;
let refreshRequest: Promise<string | null> | null = null;
let memoryToken: string | null = null;

function clearPersistedAdminToken() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("naz_admin");
    sessionStorage.removeItem("naz_admin");
  } catch {
    // Storage may be disabled; this client never writes tokens to it.
  }
}

// Older panel versions persisted this bearer token in Web Storage. Remove that
// copy and keep new access tokens in memory only; a page reload requires login.
clearPersistedAdminToken();

export function adminToken(): string | null {
  return memoryToken;
}

export function setAdminToken(token: string | null) {
  memoryToken = token;
  clearPersistedAdminToken();
}

export function resetAdminExpiration() {
  expiring = false;
}

export function expireAdminSession(message: string) {
  setAdminToken(null);
  if (expiring) return;
  expiring = true;
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent("admin-expired", { detail: message }));
}

function endpoint(scope: ApiScope, path: string) {
  const prefix = scope === "legacy" ? "/admin" : "/v1/admin";
  return `${API_BASE_URL}${prefix}${path.startsWith("/") ? path : `/${path}`}`;
}

function isLogin(scope: ApiScope, path: string) {
  return path === "/login" || (scope === "v1" && path === "/auth/login");
}

function mayRefresh(scope: ApiScope, path: string) {
  return !(
    isLogin(scope, path) ||
    path === "/logout" ||
    path === "/auth/logout" ||
    path === "/auth/refresh"
  );
}

function withToken(init: RequestInit, token: string | null) {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  else headers.delete("Authorization");
  return { ...init, headers };
}

async function errorMessage(response: Response) {
  const data = await response.clone().json().catch(() => ({}));
  return typeof data?.error?.message === "string" && data.error.message.trim()
    ? data.error.message
    : response.status === 403
      ? "برای انجام این کار مجوز کافی ندارید."
      : "درخواست مدیریت انجام نشد؛ اطلاعات را بررسی و دوباره تلاش کنید.";
}

async function refreshAdminSession(token: string): Promise<string | null> {
  if (refreshRequest) return refreshRequest;
  refreshRequest = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/v1/admin/auth/refresh`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return null;
      const data = await response.json().catch(() => ({}));
      const refreshed = typeof data?.token === "string" ? data.token : token;
      setAdminToken(refreshed);
      return refreshed;
    } catch {
      return null;
    }
  })().finally(() => {
    refreshRequest = null;
  });
  return refreshRequest;
}

async function authorizedResponse(
  scope: ApiScope,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const login = isLogin(scope, path);
  let token = adminToken();
  if (!token && !login) {
    const message = "برای دیدن این بخش، اول وارد حساب مدیر شوید.";
    expireAdminSession(message);
    throw new Error(message);
  }

  const url = endpoint(scope, path);
  const send = (bearer: string | null) =>
    fetch(url, withToken(init, bearer));
  let response: Response;
  try {
    response = await send(token);
  } catch {
    throw new Error("ارتباط با سرور مدیریت برقرار نشد؛ دوباره تلاش کنید.");
  }

  if (response.status === 401 && token && mayRefresh(scope, path)) {
    const refreshed = await refreshAdminSession(token);
    if (refreshed) {
      token = refreshed;
      try {
        response = await send(token);
      } catch {
        throw new Error("ارتباط با سرور مدیریت برقرار نشد؛ دوباره تلاش کنید.");
      }
    }
  }

  if (!response.ok) {
    const message = await errorMessage(response);
    if (response.status === 401 && !login) {
      expireAdminSession(
        message || "نشست مدیریت تمام شده است؛ دوباره وارد شوید.",
      );
    }
    throw new Error(message);
  }
  return response;
}

async function jsonRequest(
  scope: ApiScope,
  path: string,
  init: RequestInit = {},
) {
  const response = await authorizedResponse(scope, path, init);
  if (response.status === 204) return {};
  return response.json().catch(() => ({}));
}

/** Existing, unversioned admin routes used by the rest of the panel. */
export function api(path: string, init: RequestInit = {}) {
  return jsonRequest("legacy", path, init);
}

/** Versioned auth and waitlist routes for the new admin section. */
export function adminV1Api(path: string, init: RequestInit = {}) {
  return jsonRequest("v1", path, init);
}

export async function adminV1Download(path: string): Promise<DownloadResult> {
  const response = await authorizedResponse("v1", path, { method: "GET" });
  const disposition = response.headers.get("content-disposition") ?? "";
  const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plainName = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  let filename = plainName || "waitlist.csv";
  if (encodedName) {
    try {
      filename = decodeURIComponent(encodedName);
    } catch {
      filename = encodedName;
    }
  }
  return { blob: await response.blob(), filename };
}

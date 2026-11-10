export type Courier = {
  id: number;
  fullName: string;
  phone: string;
  active: boolean;
  online: boolean;
  lat?: number | null;
  lng?: number | null;
  verificationStatus: string;
  rejectionReason: string;
  hasPortrait?: boolean;
};
export const TOKEN = "naz_courier_token";
export async function api<T = any>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const token = sessionStorage.getItem(TOKEN);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let r: Response;
  try {
    r = await fetch("/api/courier" + path, { ...init, headers });
  } catch {
    throw new Error(
      "ارتباط با API قطع شد. روشن بودن بک‌اند را بررسی کنید؛ اگر مدارک ارسال کرده‌اید، پیش از ارسال دوباره وضعیت احراز را تازه‌سازی کنید.",
    );
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401 && path != "/auth/login" && path !== "/auth/password")
      window.dispatchEvent(new Event("courier-expired"));
    const serverMessage = d?.error?.message;
    const fallback =
      r.status === 401 && path !== "/auth/login" && path !== "/auth/password"
        ? "نشست شما پایان یافته است؛ دوباره وارد حساب پیک شوید."
        : path === "/auth/login"
          ? "ورود انجام نشد؛ شماره موبایل و رمز عبور را بررسی کنید."
          : path === "/auth/register"
            ? "ثبت‌نام پیک انجام نشد؛ اطلاعات واردشده را بررسی کنید."
            : "درخواست پنل پیک انجام نشد؛ اطلاعات را بررسی و دوباره تلاش کنید.";
    const message =
      typeof serverMessage === "string" && serverMessage.trim()
        ? serverMessage
        : fallback;
    const reference = d?.error?.requestId;
    throw new Error(
      reference ? `${message} (شناسه پیگیری: ${reference})` : message,
    );
  }
  return d;
}
export const json = (body: unknown, method = "POST") => ({
  method,
  body: JSON.stringify(body),
});
export const money = (n: unknown) => Number(n || 0).toLocaleString("fa-IR");
export const verifyLabel: Record<string, string> = {
  unsubmitted: "احراز هویت شروع نشده",
  pending: "در حال بررسی مدارک",
  approved: "هویت تأیید شده",
  rejected: "درخواست رد شده",
  needs_correction: "مدارک نیاز به اصلاح دارد",
};

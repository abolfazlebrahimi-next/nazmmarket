export type Courier = {
  id: number;
  fullName: string;
  phone: string;
  active: boolean;
  online: boolean;
  verificationStatus: string;
  rejectionReason: string;
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
  const r = await fetch("/api/courier" + path, { ...init, headers });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401 && path != "/auth/login")
      window.dispatchEvent(new Event("courier-expired"));
    throw new Error(d?.error?.message || "ارتباط با سرور برقرار نشد.");
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

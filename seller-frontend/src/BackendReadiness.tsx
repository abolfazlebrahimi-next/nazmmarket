import { useCallback, useEffect, useState } from "react";
type State = "checking" | "ready" | "outdated" | "unreachable";
export function useBackendReadiness(enabled: boolean) {
  const [state, setState] = useState<State>("checking");
  const check = useCallback(async () => {
    try {
      const response = await fetch("/api/health", {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        setState("unreachable");
        return;
      }
      const data = await response.json();
      setState(
        data.capabilities?.sellerDispatch === true &&
          data.capabilities?.sellerSelfDelivery === true
          ? "ready"
          : "outdated",
      );
    } catch {
      setState("unreachable");
    }
  }, []);
  useEffect(() => {
    if (!enabled) return;
    void check();
    const timer = window.setInterval(() => void check(), 15000);
    return () => window.clearInterval(timer);
  }, [enabled, check]);
  return { state, check };
}
export default function BackendReadiness({
  state,
  check,
}: {
  state: State;
  check: () => Promise<void>;
}) {
  if (state === "ready")
    return (
      <p className="backend-ready" role="status">
        اتصال به بک‌اند دارای قابلیت ارسال فروشگاه و مدیریت جست‌وجوی پیک تأیید
        شد.
      </p>
    );
  return (
    <section className="backend-readiness" role="alert">
      <h3>
        {state === "checking"
          ? "در حال بررسی نسخهٔ بک‌اند…"
          : state === "outdated"
            ? "نسخهٔ قدیمی بک‌اند هنوز در حال اجراست"
            : "اتصال به بک‌اند قابل تأیید نیست"}
      </h3>
      <p>
        عملیات ارسال فروشگاه و توقف یا ارسال دوبارهٔ درخواست تا اتصال به بک‌اند
        سازگار غیرفعال‌اند؛ سفارش شما تغییر نکرده است.
      </p>
      <ol>
        <li>
          ترمینال بک‌اند قبلی را با Ctrl+C متوقف کنید؛ فقط ری‌استارت پنل فروشگاه
          کافی نیست.
        </li>
        <li>
          در نسخهٔ به‌روز پروژه، داخل پوشهٔ <bdi>backend</bdi> اجرا کنید:
          <pre dir="ltr">npm run dev</pre>
        </li>
        <li>
          در ترمینال پنل فروشگاه، مقصد API proxy باید به همین بک‌اند اشاره کند.
          اگر <bdi>API_PROXY_TARGET</bdi> را عوض کرده‌اید، پنل فروشگاه را هم
          ری‌استارت کنید.
        </li>
      </ol>
      <p>
        اگر پورت ۴۰۰۰ اشغال بود، پردازش قدیمی همان بک‌اند را ببندید؛ اجرای نسخهٔ
        جدید روی پورت دیگر، پنل را خودکار به آن وصل نمی‌کند.
      </p>
      <button className="btn small" onClick={() => void check()}>
        بررسی دوبارهٔ اتصال بک‌اند
      </button>
    </section>
  );
}

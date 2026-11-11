import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowDownLeft,
  ChartNoAxesCombined,
  ChevronLeft,
  Clock3,
  Headphones,
  MapPin,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { api, money, type Courier } from "./api";
import DispatchMap from "./DispatchMap";
type Row = Record<string, any>;
type Summary = {
  totalTrips: number;
  tripsToday: number;
  earningsToday: number;
  week: { day: string; trips: number; earnings: number }[];
};
export default function Dashboard({
  courier,
  orders,
  go,
  onLocate,
  busy,
  message,
  approved,
  loading = false,
  children,
}: {
  courier: Courier;
  orders: Row[];
  go: (page: string) => void;
  onLocate: () => void;
  busy: boolean;
  message: string;
  approved: boolean;
  /** First response pending: placeholders keep the page height. */
  loading?: boolean;
  children: ReactNode;
}) {
  const [summary, setSummary] = useState<Summary | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    async function load() {
      try {
        const s = await api("/summary");
        if (live) {
          setSummary(s);
          setError("");
        }
      } catch (e) {
        if (live) setError((e as Error).message);
      }
    }
    void load();
    const timer = setInterval(() => void load(), 30000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [courier.id, retry, orders.filter((o) => o.status === 5).length]);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.now() - (6 - i) * 86400000);
    const key = date.toISOString().slice(0, 10);
    return {
      label: date.toLocaleDateString("fa-IR", {
        weekday: "short",
        timeZone: "UTC",
      }),
      ...summary?.week.find((d) => d.day === key),
      key,
    };
  });
  const weekTrips = summary?.week.reduce((n, d) => n + d.trips, 0),
    weekEarnings = summary?.week.reduce((n, d) => n + d.earnings, 0);
  const max = Math.max(1, ...days.map((d) => d.earnings || 0));
  return (
    <div className="dashboard">
      {error && (
        <div className="alert error" role="alert">
          دریافت آمار ناموفق بود. {error}
          <button onClick={() => setRetry((n) => n + 1)}>تلاش دوباره</button>
        </div>
      )}
      <div className="dashboard-body">
        <div className="dashboard-center">
          {loading ? (
            <div
              className="dispatch-map map-skeleton"
              role="status"
              aria-label="در حال آماده‌سازی نقشه"
            >
              <span className="skeleton-sweep" aria-hidden="true" />
              <span className="map-skeleton-pill">در حال دریافت نقشه…</span>
            </div>
          ) : (
            <DispatchMap
              courier={courier}
              orders={orders}
              onLocate={onLocate}
              busy={busy}
            />
          )}
          <div
            className={`dispatch-status ${!approved ? "needs-review" : ""}`}
            role="status"
          >
            <span className="status-symbol">
              {approved ? <MapPin size={19} /> : <ShieldCheck size={19} />}
            </span>
            <p>{message}</p>
            {!approved ? (
              <button onClick={() => go("verify")}>
                بررسی مدارک <ChevronLeft size={15} />
              </button>
            ) : courier.online ? (
              <button disabled={busy} onClick={onLocate}>
                موقعیت من
              </button>
            ) : null}
          </div>
          {loading ? (
            <div className="list-skeleton" aria-hidden="true">
              <span className="skeleton-sweep" />
              <span className="skeleton-sweep" />
              <span className="skeleton-sweep" />
            </div>
          ) : (
            children
          )}
        </div>
        <aside className="dashboard-rail">
          <section className="weekly-panel">
            <div className="section-heading">
              <h2>
                <ChartNoAxesCombined size={20} /> عملکرد این هفته
              </h2>
            </div>
            <div className="weekly-numbers">
              <span>
                <b>
                  {summary ? (
                    money(weekTrips)
                  ) : (
                    <i className="skeleton-num" aria-hidden="true" />
                  )}
                </b>
                <small>سفر تکمیل‌شده</small>
              </span>
              <span>
                <b>
                  {summary ? (
                    money(weekEarnings)
                  ) : (
                    <i className="skeleton-num wide" aria-hidden="true" />
                  )}
                </b>
                <small>تومان درآمد</small>
              </span>
            </div>
            <div
              className="weekly-bars"
              aria-label="درآمد ثبت‌شدهٔ هفت روز اخیر"
            >
              {days.map((d) => (
                <div
                  key={d.key}
                  title={`${d.label}: ${money(d.earnings)} تومان`}
                >
                  <span
                    style={{
                      height: `${d.earnings ? Math.max(8, (d.earnings / max) * 100) : 3}%`,
                    }}
                  />
                  <small>{d.label}</small>
                </div>
              ))}
            </div>
            <small>۷ روز اخیر · مبنای گزارش UTC</small>
          </section>
          <section className="support-card">
            <span className="support-icon">
              <Headphones size={31} />
            </span>
            <h2>همراه شما در هر مسیر</h2>
            <p>
              سوالی دارید یا در مسیر به مشکل خوردید؟
              <br />
              با پشتیبانی در ارتباط باشید.
            </p>
            <button onClick={() => go("tickets")}>
              ثبت تیکت جدید <ArrowDownLeft size={18} />
            </button>
          </section>
          <section className="quick-panel">
            <h2>دسترسی سریع</h2>
            <div>
              <button onClick={() => go("verify")}>
                <ShieldCheck size={21} />
                <span>مدارک من</span>
              </button>
              <button onClick={() => go("wallet")}>
                <Wallet size={21} />
                <span>حساب مالی</span>
              </button>
              <button onClick={() => go("history")}>
                <Clock3 size={21} />
                <span>تاریخچه</span>
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

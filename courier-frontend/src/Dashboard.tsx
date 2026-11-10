import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowDownLeft,
  ArrowLeft,
  Bike,
  ChartNoAxesCombined,
  Check,
  ChevronLeft,
  Clock3,
  Headphones,
  MapPin,
  Package,
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
  children,
}: {
  courier: Courier;
  orders: Row[];
  go: (page: string) => void;
  onLocate: () => void;
  busy: boolean;
  message: string;
  approved: boolean;
  children: ReactNode;
}) {
  const [summary, setSummary] = useState<Summary | null>(null),
    [available, setAvailable] = useState<number | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    async function load() {
      try {
        const [s, w] = await Promise.all([api("/summary"), api("/wallet")]);
        if (live) {
          setSummary(s);
          setAvailable(w.available);
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
  const recent = orders.filter((o) => o.status === 5).slice(0, 3);
  return (
    <div className="dashboard">
      <div className="dashboard-metrics">
        <article className="stat-card">
          <span className="stat-icon mint">
            <Bike size={24} />
          </span>
          <strong>{summary ? money(summary.tripsToday) : "—"}</strong>
          <p>سفرهای تکمیل‌شدهٔ امروز</p>
          <div className="stat-line green" />
        </article>
        <article className="stat-card">
          <span className="stat-icon amber">
            <Wallet size={23} />
          </span>
          <strong>
            {summary ? money(summary.earningsToday) : "—"} <small>تومان</small>
          </strong>
          <p>درآمد ثبت‌شدهٔ امروز</p>
          <div className="stat-line orange" />
        </article>
        <article className="stat-card">
          <span className="stat-icon mint">
            <Package size={23} />
          </span>
          <strong>
            {money(
              orders.filter((o) => o.status === 3 && !o.claimedByMe).length,
            )}
          </strong>
          <p>پیشنهاد آمادهٔ دریافت</p>
          <small className="live-label">
            <i className="online-dot" /> بررسی هر ۱۰ ثانیه
          </small>
        </article>
        <article className="balance-card">
          <span>
            <Wallet size={22} /> کیف پول شما
          </span>
          <strong>
            {available === null ? "—" : money(available)} <small>تومان</small>
          </strong>
          <button onClick={() => go("wallet")}>
            برداشت وجه <ArrowLeft size={17} />
          </button>
        </article>
      </div>
      {error && (
        <div className="alert error" role="alert">
          دریافت آمار ناموفق بود. {error}
          <button onClick={() => setRetry((n) => n + 1)}>تلاش دوباره</button>
        </div>
      )}
      <div className="dashboard-body">
        <div className="dashboard-center">
          <DispatchMap
            courier={courier}
            orders={orders}
            onLocate={onLocate}
            busy={busy}
          />
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
          {children}
          <section className="recent-panel">
            <div className="section-heading">
              <h2>
                <Clock3 size={20} /> سفرهای اخیر
              </h2>
              <button onClick={() => go("history")}>
                مشاهده همه <ChevronLeft size={15} />
              </button>
            </div>
            {recent.length ? (
              recent.map((o) => (
                <button
                  className="recent-trip"
                  key={o.id}
                  onClick={() => go("history")}
                >
                  <span className="recent-icon">
                    <Check size={18} />
                  </span>
                  <span>
                    <b>{o.storeName}</b>
                    <small>
                      {o.completedAt
                        ? new Date(o.completedAt).toLocaleDateString("fa-IR")
                        : o.id}
                    </small>
                  </span>
                  <strong>
                    {money(o.courierFee)} <small>تومان</small>
                  </strong>
                  <span className="badge approved">تحویل‌شده</span>
                </button>
              ))
            ) : (
              <div className="recent-empty">
                <Package size={24} />
                <p>
                  هنوز سفری تکمیل نکرده‌اید.
                  <br />
                  <small>اولین تحویل شما، شروع این فهرست است.</small>
                </p>
              </div>
            )}
          </section>
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
                <b>{summary ? money(weekTrips) : "—"}</b>
                <small>سفر تکمیل‌شده</small>
              </span>
              <span>
                <b>{summary ? money(weekEarnings) : "—"}</b>
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

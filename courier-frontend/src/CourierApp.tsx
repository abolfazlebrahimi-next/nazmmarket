import { useEffect, useRef, useState } from "react";
import {
  Bike,
  Bell,
  House,
  Package,
  UserRound,
  Eye,
  EyeOff,
  ArrowLeft,
  X,
  ChevronLeft,
  Clock3,
  History,
  LifeBuoy,
  LogOut,
  MapPin,
  PackageCheck,
  Phone,
  Power,
  RefreshCw,
  Settings,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { api, json, TOKEN, type Courier, money, verifyLabel } from "./api";
import Verification from "./Verification";
import Dashboard from "./Dashboard";
type Row = Record<string, any>;
const nav = [
  ["work", "داشبورد", House],
  ["orders", "سفارش‌های من", Package],
  ["history", "تاریخچهٔ سفرها", History],
  ["wallet", "کیف پول", Wallet],
  ["tickets", "پشتیبانی", LifeBuoy],
  ["settings", "پروفایل و تنظیمات", Settings],
] as const;
export default function CourierApp() {
  const [courier, setCourier] = useState<Courier | null>(null),
    [boot, setBoot] = useState(!!sessionStorage.getItem(TOKEN)),
    [mode, setMode] = useState("login"),
    [showPassword, setShowPassword] = useState(false),
    [page, setPage] = useState("work"),
    [orders, setOrders] = useState<Row[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [wallet, setWallet] = useState<Row>({
      available: 0,
      earned: 0,
      ledger: [],
      withdrawals: [],
    }),
    [tickets, setTickets] = useState<Row[]>([]),
    [thread, setThread] = useState<Row | null>(null),
    [locationFresh, setLocationFresh] = useState(false),
    [dispatchStatus, setDispatchStatus] = useState("offline");
  const seenOffers = useRef(new Set<string>());
  async function loadOrders() {
    try {
      const r = await api("/orders");
      setOrders(r.orders);
      setLocationFresh(r.locationFresh);
      setDispatchStatus(r.dispatchStatus);
      setCourier((c) => (c ? { ...c, online: r.online } : c));
      const offers = r.orders.filter(
        (o: Row) => !o.claimedByMe && o.status === 3,
      );
      const freshOffers = offers.filter(
        (o: Row) => !seenOffers.current.has(o.id),
      );
      if (freshOffers.length)
        setNotice(
          `${money(freshOffers.length)} پیشنهاد جدید آماده دریافت است؛ کرایه و مسیر را بررسی و سفارش را قبول کنید.`,
        );
      seenOffers.current = new Set(offers.map((o: Row) => o.id));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function loadWallet() {
    try {
      setWallet(await api("/wallet"));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function loadTickets() {
    try {
      setTickets((await api("/tickets")).tickets);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    const expired = () => {
      sessionStorage.removeItem(TOKEN);
      setCourier(null);
    };
    window.addEventListener("courier-expired", expired);
    if (sessionStorage.getItem(TOKEN))
      api("/auth/me")
        .then((r) => setCourier(r.courier))
        .catch(() => expired())
        .finally(() => setBoot(false));
    return () => window.removeEventListener("courier-expired", expired);
  }, []);
  useEffect(() => {
    if (!courier?.id) {
      seenOffers.current.clear();
      return;
    }
    let disposed = false;
    async function refreshAccount() {
      try {
        const r = await api("/auth/me");
        if (!disposed) {
          setCourier(r.courier);
          if (!r.courier.active || r.courier.verificationStatus !== "approved")
            setOrders([]);
        }
      } catch (e) {
        if (!disposed) setError((e as Error).message);
      }
    }
    const timer = setInterval(() => void refreshAccount(), 10000);
    const focus = () => void refreshAccount();
    window.addEventListener("focus", focus);
    return () => {
      disposed = true;
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [courier?.id]);
  useEffect(() => {
    if (!courier) return;
    if (courier.active && courier.verificationStatus === "approved")
      void loadOrders();
    if (page === "wallet") void loadWallet();
    if (page === "tickets") void loadTickets();
    const timer = setInterval(() => {
      if (courier.active && courier.verificationStatus === "approved")
        void loadOrders();
    }, 10000);
    return () => clearInterval(timer);
  }, [
    courier?.id,
    courier?.active,
    courier?.verificationStatus,
    courier?.online,
    page,
  ]);
  function geo(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("مرورگر از موقعیت مکانی پشتیبانی نمی‌کند."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        resolve,
        () => reject(new Error("اجازه دسترسی به موقعیت را فعال کنید.")),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
      );
    });
  }
  async function availability(online: boolean) {
    setBusy(true);
    try {
      let location: { lat?: number; lng?: number } = {};
      if (online) {
        const p = await geo();
        location = { lat: p.coords.latitude, lng: p.coords.longitude };
      }
      await api("/availability", json({ online, ...location }, "PATCH"));
      setCourier((c) => (c ? { ...c, online, ...location } : c));
      setNotice(
        online
          ? "فعال شدید؛ سفارش‌های نزدیک برای شما نمایش داده می‌شوند."
          : "حالت غیرفعال شد؛ سفارش جاری همچنان قابل تحویل است.",
      );
      await loadOrders();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!courier?.online) return;
    const timer = setInterval(() => {
      geo()
        .then((p) =>
          api(
            "/availability",
            json(
              { online: true, lat: p.coords.latitude, lng: p.coords.longitude },
              "PATCH",
            ),
          ),
        )
        .catch(() => setLocationFresh(false));
    }, 120000);
    return () => clearInterval(timer);
  }, [courier?.online]);
  async function act(order: Row, action: string) {
    if (
      action === "claim" &&
      !window.confirm(
        "سفارش را از فروشگاه تحویل گرفته‌اید؟ با تأیید، دریافت سفارش ثبت و مرحلهٔ ارسال به مشتری آغاز می‌شود.",
      )
    )
      return;
    if (
      action === "decline" &&
      !window.confirm(
        "این پیشنهاد برای شما پنهان شود؟ سایر پیک‌ها همچنان می‌توانند آن را دریافت کنند.",
      )
    )
      return;
    if (
      action === "complete" &&
      !window.confirm("آیا سفارش را به مشتری تحویل داده‌اید؟")
    )
      return;
    setBusy(true);
    try {
      await api(`/orders/${encodeURIComponent(order.id)}/${action}`, {
        method: "POST",
      });
      setNotice(
        action === "claim"
          ? "سفارش دریافت شد؛ با مشتری هماهنگ کنید."
          : action === "decline"
            ? "پیشنهاد رد شد؛ برای سایر پیک‌ها همچنان در دسترس است."
            : "تحویل نهایی ثبت و دستمزد به کیف پول اضافه شد.",
      );
      await loadOrders();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    try {
      if (courier?.online)
        await api("/availability", json({ online: false }, "PATCH"));
      await api("/auth/logout", { method: "POST" });
    } finally {
      sessionStorage.removeItem(TOKEN);
      setCourier(null);
      setOrders([]);
    }
  }
  function go(p: string) {
    setPage(p);
    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  if (boot)
    return (
      <div className="boot">
        <Bike size={40} />
        <p>در حال بازیابی حساب…</p>
      </div>
    );
  if (!courier)
    return (
      <main className="login-page">
        <section className="login-story">
          <div className="brand">
            <Bike /> نازمارکت · همراه پیک
          </div>
          <img
            className="login-illustration"
            src="/courier-ride.webp"
            alt="پیک نازمارکت با موتور سبز و جعبه ارسال"
            width="800"
            height="800"
          />
          <h1>
            مسیر امروزت،
            <br />
            درآمد فردایت.
          </h1>
          <p>سفارش‌های نزدیک، کرایه شفاف و مدیریت درآمد؛ در یک پنل ساده.</p>
          <span>
            کرایه عادی ۵۰ تا ۸۰ هزار تومان · شرایط جوی خاص تا ۱۰۰ هزار تومان
          </span>
        </section>
        <section className="login-card">
          <span className="hero-icon">
            <Bike size={30} />
          </span>
          <h2>{mode === "login" ? "ورود به حساب پیک" : "ساخت حساب پیک"}</h2>
          <p className="muted">
            {mode === "login"
              ? "موبایل و رمز عبور خود را وارد کنید."
              : "احراز هویت را پس از ورود از تنظیمات تکمیل می‌کنید."}
          </p>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const f = Object.fromEntries(new FormData(e.currentTarget));
              try {
                if (mode === "register") {
                  await api(
                    "/auth/register",
                    json({ ...f, vehicle: "motorcycle" }),
                  );
                  setMode("login");
                  setNotice("حساب ساخته شد. اکنون وارد شوید.");
                } else {
                  const r = await api("/auth/login", json(f));
                  sessionStorage.setItem(TOKEN, r.token);
                  setCourier(r.courier);
                  setError("");
                }
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {mode === "register" && (
              <label>
                نام و نام خانوادگی
                <input name="fullName" required maxLength={120} />
              </label>
            )}
            <label>
              شماره موبایل
              <input
                name="phone"
                required
                inputMode="tel"
                autoComplete="tel"
                placeholder="09xxxxxxxxx"
              />
            </label>
            <label>
              رمز عبور
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={mode === "register" ? 10 : 1}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
              />
            </label>
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}{" "}
              {showPassword ? "پنهان کردن رمز" : "نمایش رمز عبور"}
            </button>
            <button className="primary" disabled={busy}>
              {busy
                ? "در حال بررسی…"
                : mode === "login"
                  ? "ورود به پنل"
                  : "ساخت حساب"}
            </button>
          </form>
          {error && (
            <p role="alert" className="alert error">
              {error}
            </p>
          )}
          {notice && <p className="alert success">{notice}</p>}
          <button
            className="text-btn"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
          >
            {mode === "login"
              ? "حساب ندارید؟ ثبت‌نام کنید"
              : "قبلاً ثبت‌نام کرده‌اید؟ ورود"}
          </button>
        </section>
      </main>
    );
  const isApproved =
    courier.active && courier.verificationStatus === "approved";
  const dispatchMessage = !isApproved
    ? "دریافت پیشنهاد تا تأیید مدارک توسط مدیر متوقف است. وضعیت را در تنظیمات بررسی کنید."
    : !courier.online
      ? "برای دریافت پیشنهاد، کلید فعالیت را روشن و اجازهٔ موقعیت مکانی را فعال کنید."
      : !locationFresh || dispatchStatus === "location_stale"
        ? "موقعیت شما معتبر یا به‌روز نیست؛ موقعیت مکانی را تازه‌سازی کنید."
        : dispatchStatus === "offers_available"
          ? "پیشنهادهای آمادهٔ دریافت در ادامه هستند. دریافت پیشنهادها هر ۱۰ ثانیه بررسی می‌شود."
          : "در شعاع ۱۵ کیلومتری شما سفارش آماده‌ای پیدا نشد. فروشنده باید سفارش را به «آماده تحویل به پیک» برساند و مختصات فروشگاه ثبت شده باشد. بررسی خودکار هر ۱۰ ثانیه انجام می‌شود.";
  const shown = orders.filter((o) =>
    page === "history" ? o.status === 5 : o.status !== 5,
  );
  const titles: Record<string, string> = {
    work: `سلام ${courier.fullName.split(" ")[0]} جان!`,
    orders: "سفارش‌های پیشنهادی و جاری",
    wallet: "درآمد و کیف پول",
    settings: "تنظیمات حساب",
    verify: "احراز هویت پیک",
    tickets: "پشتیبانی و تیکت",
    history: "سفرهای تکمیل‌شده",
  };
  const orderContent = (
    <>
      {["work", "orders", "history"].includes(page) && (
        <div className="section-heading orders-heading">
          <h2>
            {page === "history" ? <History size={21} /> : <Bell size={21} />}{" "}
            {page === "history"
              ? "سفرهای تکمیل‌شده"
              : "سفارش‌های پیشنهادی و جاری"}{" "}
            <span className="section-count">{money(shown.length)}</span>
          </h2>
          {page === "work" && (
            <button onClick={() => go("orders")}>
              مشاهده همه <ChevronLeft size={16} />
            </button>
          )}
        </div>
      )}
      {["work", "orders", "history"].includes(page) &&
        (shown.length ? (
          <div className="orders-grid">
            {shown.map((o) => (
              <article className="order-card" key={o.id}>
                <div className="order-top">
                  <span className="order-id">{o.id}</span>
                  <span
                    className={`badge ${o.status === 5 ? "approved" : o.claimedByMe ? "shipping" : "pending"}`}
                  >
                    {o.status === 5
                      ? "تحویل‌شده"
                      : o.claimedByMe
                        ? "در مسیر مشتری"
                        : "آماده دریافت"}
                  </span>
                </div>
                <div className="fare">
                  <small>دستمزد این مسیر</small>
                  <strong>
                    {money(o.courierFee)} <span>تومان</span>
                  </strong>
                </div>
                <div className="route">
                  <div>
                    <span className="route-dot" />
                    <section>
                      <small>دریافت از فروشگاه</small>
                      <b>{o.storeName}</b>
                      <p>{o.storeAddress}</p>
                    </section>
                  </div>
                  <div>
                    <MapPin size={17} />
                    <section>
                      <small>تحویل به مشتری</small>
                      <b>{o.addressTitle}</b>
                      <p>{o.addressText}</p>
                    </section>
                  </div>
                </div>
                <div className="trip-meta">
                  <span>
                    <MapPin size={13} />
                    {o.pickupKm === null
                      ? "فاصله نامشخص"
                      : money(o.pickupKm) + " کیلومتر تا فروشگاه"}
                  </span>
                  <span>
                    <Clock3 size={13} />
                    {money(o.fareDetails?.minutes || 15)} دقیقه تخمینی
                  </span>
                  <span>
                    {money(o.fareDetails?.weightKg || 0.5)} کیلوگرم تخمینی
                  </span>
                </div>
                <div className="items">
                  {o.items.map((i: Row) => (
                    <span key={i.id}>
                      {i.name} × {money(i.qty)}
                    </span>
                  ))}
                </div>
                <div className="order-links">
                  {o.storeLat != null && o.storeLng != null && (
                    <a
                      target="_blank"
                      rel="noreferrer"
                      href={`https://www.openstreetmap.org/?mlat=${o.storeLat}&mlon=${o.storeLng}#map=17/${o.storeLat}/${o.storeLng}`}
                    >
                      <MapPin size={14} />
                      مسیریابی فروشگاه
                    </a>
                  )}
                  {o.customerPhone && (
                    <a href={`tel:${o.customerPhone}`}>
                      <Phone size={14} />
                      تماس مشتری
                    </a>
                  )}
                </div>
                {o.status === 4 && (
                  <div className="delivery-progress">
                    <span className="done">دریافت از فروشگاه</span>
                    <span className="current">در مسیر مشتری</span>
                    <span>تحویل نهایی</span>
                  </div>
                )}
                {o.status === 3 && (
                  <p className="pickup-help">
                    پس از رسیدن به فروشگاه و دریافت بسته، سفارش را قبول کنید.
                  </p>
                )}
                {o.status === 3 && (
                  <div className="offer-actions">
                    <button
                      disabled={busy || !courier.online}
                      className="primary full"
                      onClick={() => void act(o, "claim")}
                    >
                      <PackageCheck size={18} />
                      قبول و دریافت سفارش
                    </button>
                    <button
                      className="decline"
                      disabled={busy}
                      onClick={() => void act(o, "decline")}
                    >
                      <X size={17} /> رد پیشنهاد
                    </button>
                  </div>
                )}
                {o.status === 4 && o.claimedByMe && (
                  <button
                    disabled={busy}
                    className="primary full"
                    onClick={() => void act(o, "complete")}
                  >
                    ثبت تحویل نهایی به مشتری
                  </button>
                )}
              </article>
            ))}
          </div>
        ) : (
          <Empty
            title={
              page === "history"
                ? "هنوز مسیری تکمیل نشده"
                : "سفارشی برای نمایش نیست"
            }
            text={
              page === "history"
                ? "مسیرهای تحویل‌شدهٔ شما اینجا ثبت می‌شوند."
                : dispatchMessage
            }
          />
        ))}
    </>
  );
  return (
    <div className="courier-shell">
      <aside className="sidebar">
        <div className="brand">
          <span>
            <Bike size={24} />
          </span>
          <div>
            <b>نازمارکت</b>
            <small>همراه پیک موتوری</small>
          </div>
        </div>
        <div className="profile-card">
          <span className="avatar">{courier.fullName.slice(0, 1)}</span>
          <div>
            <b>{courier.fullName}</b>
            <small>{courier.phone}</small>
          </div>
        </div>
        <nav>
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              className={`${page === id || (id === "settings" && page === "verify") ? "selected" : ""} nav-${id}`}
              onClick={() => go(id)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {id === "orders" && orders.some((o) => o.status === 3) && (
                <small className="nav-count">
                  {money(orders.filter((o) => o.status === 3).length)}
                </small>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-promo">
          <img src="/courier-ride.webp" alt="" width="800" height="800" />
          <b>هر مسیر، یک فرصت تازه</b>
          <p>با نازمارکت، همراه شهر باش.</p>
          <button onClick={() => go("orders")}>
            دیدن سفارش‌ها <ArrowLeft size={15} />
          </button>
        </div>
        <div className="sidebar-footer">
          <ShieldCheck size={17} />
          {verifyLabel[courier.verificationStatus]}
        </div>
        <button className="logout" onClick={() => void logout()}>
          <LogOut size={17} />
          خروج
        </button>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <span className="topbar-welcome">
            <span className="avatar">
              <UserRound size={19} />
            </span>
            <b>{courier.fullName}</b>
            <small>خوش آمدید به همراه پیک</small>
          </span>
          <div className="topbar-tools">
            <button
              className="notification-button"
              onClick={() => go("orders")}
              aria-label="مشاهده پیشنهادهای سفارش"
            >
              <Bell size={21} />
              {orders.some((o) => o.status === 3) && (
                <span>
                  {money(orders.filter((o) => o.status === 3).length)}
                </span>
              )}
            </button>
            <button
              className="refresh"
              onClick={async () => {
                try {
                  setCourier((await api("/auth/me")).courier);
                  if (isApproved) await loadOrders();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <RefreshCw size={16} />
              <span>به‌روزرسانی</span>
            </button>
          </div>
        </header>
        <div className="page-title">
          <div>
            <p className="eyebrow">
              {new Date().toLocaleDateString("fa-IR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}{" "}
              · همراه پیک نازمارکت
            </p>
            <h1>{titles[page]}</h1>
            <p className="muted">
              {page === "work"
                ? "آماده‌ای برای یک روز پر از مسیرهای خوب؟"
                : "همه‌چیز برای یک مسیر مطمئن، در کنار شما."}
            </p>
          </div>
          {page === "work" && (
            <button
              className={`availability ${courier.online ? "is-online" : ""}`}
              role="switch"
              aria-checked={courier.online}
              aria-label="وضعیت دریافت سفارش"
              disabled={busy || (!isApproved && !courier.online)}
              onClick={() => void availability(!courier.online)}
            >
              <Power size={19} />
              <span>
                <b>{courier.online ? "آنلاین" : "آفلاین"}</b>
                <small>
                  {courier.online
                    ? "دریافت سفارش فعال است"
                    : "برای شروع، فعال شوید"}
                </small>
              </span>
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="alert error">
            {error}
            <button onClick={() => setError("")}>بستن</button>
          </p>
        )}
        {notice && (
          <p role="status" className="alert success">
            <span>{notice}</span>
            <button onClick={() => setNotice("")} aria-label="بستن پیام">
              <X size={16} />
            </button>
          </p>
        )}
        {page === "work" && (
          <Dashboard
            courier={courier}
            orders={orders}
            go={go}
            onLocate={() => void availability(true)}
            busy={busy || !isApproved}
            message={dispatchMessage}
            approved={isApproved}
          >
            {orderContent}
          </Dashboard>
        )}
        {page !== "work" && orderContent}
        {page === "settings" && (
          <div className="settings-grid">
            {[
              [
                "verify",
                "احراز هویت",
                verifyLabel[courier.verificationStatus],
                ShieldCheck,
              ],
              [
                "tickets",
                "پشتیبانی",
                "تیکت جدید و پیگیری پاسخ مدیریت",
                LifeBuoy,
              ],
              ["wallet", "کیف پول", "ریز درآمد، برداشت و پیگیری تسویه", Wallet],
              [
                "history",
                "تاریخچه مسیرها",
                "سفارش‌هایی که تحویل داده‌اید",
                History,
              ],
            ].map(([id, title, subtitle, Icon]) => {
              const I = Icon as typeof Bike;
              return (
                <button
                  className="settings-link"
                  key={String(id)}
                  onClick={() => go(String(id))}
                >
                  <span>
                    <I size={23} />
                  </span>
                  <div>
                    <b>{String(title)}</b>
                    <small>{String(subtitle)}</small>
                  </div>
                  <ChevronLeft size={18} />
                </button>
              );
            })}
            <section className="panel">
              <h3>اطلاعات حساب</h3>
              <p>
                {courier.fullName} · {courier.phone}
              </p>
              <small>در صورت نیاز به اصلاح اطلاعات هویتی، تیکت ثبت کنید.</small>
            </section>
          </div>
        )}
        {page === "verify" && (
          <Verification courier={courier} onUpdate={setCourier} />
        )}
        {page === "wallet" && (
          <>
            <div className="wallet-hero">
              <Wallet size={34} />
              <div>
                <small>موجودی قابل برداشت</small>
                <h2>
                  {money(wallet.available)} <span>تومان</span>
                </h2>
                <p>درآمد کل ثبت‌شده: {money(wallet.earned)} تومان</p>
              </div>
            </div>
            <div className="two-cols">
              <section className="panel">
                <h2>درخواست برداشت</h2>
                <p className="muted">
                  مبلغ درخواست تا تعیین تکلیف رزرو می‌شود. پرداخت بانکی توسط
                  مدیریت ثبت خواهد شد.
                </p>
                <form
                  className="form-stack"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setBusy(true);
                    try {
                      const f = Object.fromEntries(
                        new FormData(e.currentTarget),
                      );
                      await api("/withdrawals", json(f));
                      setNotice("درخواست برداشت برای مدیریت ارسال شد.");
                      await loadWallet();
                    } catch (err) {
                      setError((err as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <label>
                    مبلغ (تومان)
                    <input
                      type="number"
                      name="amount"
                      min="50000"
                      max={wallet.available}
                      required
                    />
                  </label>
                  <label>
                    شماره شبا به نام خودتان
                    <input
                      name="iban"
                      dir="ltr"
                      placeholder="IR…"
                      required
                      pattern="IR[0-9]{24}"
                    />
                  </label>
                  <button
                    disabled={busy || !isApproved || wallet.available < 50000}
                    className="primary"
                  >
                    ثبت درخواست برداشت
                  </button>
                </form>
              </section>
              <section className="panel">
                <h2>پیگیری برداشت‌ها</h2>
                {!wallet.withdrawals.length && (
                  <p className="muted">درخواستی ثبت نشده است.</p>
                )}
                {wallet.withdrawals.map((w: Row) => (
                  <div className="list-row" key={w.id}>
                    <strong>{money(w.amount)} تومان</strong>
                    <span className="badge">
                      {w.status === "pending"
                        ? "در انتظار پرداخت"
                        : w.status === "paid"
                          ? "پرداخت ثبت‌شده"
                          : "ردشده"}
                    </span>
                    <small>{w.reason || w.reference}</small>
                  </div>
                ))}
              </section>
              <section className="panel">
                <h2>ریز درآمد مسیرها</h2>
                {!wallet.ledger.length && (
                  <p className="muted">
                    پس از تحویل نهایی اولین سفارش، درآمد اینجا ثبت می‌شود.
                  </p>
                )}
                {wallet.ledger.map((r: Row) => (
                  <div className="list-row" key={r.order_id}>
                    <span>{r.order_id}</span>
                    <b>+{money(r.amount)} تومان</b>
                    <small>
                      {new Date(r.created_at).toLocaleString("fa-IR")}
                    </small>
                  </div>
                ))}
              </section>
            </div>
          </>
        )}
        {page === "tickets" && (
          <div className="two-cols">
            <section className="panel">
              <h2>تیکت جدید</h2>
              <form
                className="form-stack"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  try {
                    await api(
                      "/tickets",
                      json(Object.fromEntries(new FormData(e.currentTarget))),
                    );
                    setNotice("تیکت شما ثبت شد.");
                    await loadTickets();
                  } catch (err) {
                    setError((err as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label>
                  موضوع
                  <input name="subject" required maxLength={180} />
                </label>
                <label>
                  شرح درخواست
                  <textarea name="body" required maxLength={5000} />
                </label>
                <button className="primary" disabled={busy}>
                  ارسال تیکت
                </button>
              </form>
            </section>
            <section className="panel">
              <h2>تیکت‌های من</h2>
              {tickets.map((t) => (
                <button
                  className="ticket-row"
                  key={t.id}
                  onClick={async () => {
                    try {
                      setThread(await api(`/tickets/${t.id}`));
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  <span>
                    <b>{t.subject}</b>
                    <small>
                      {new Date(t.created_at).toLocaleDateString("fa-IR")}
                    </small>
                  </span>
                  <span className="badge">
                    {t.status === "answered"
                      ? "پاسخ داده شده"
                      : t.status === "closed"
                        ? "بسته شده"
                        : "در انتظار پاسخ"}
                  </span>
                </button>
              ))}
              {!tickets.length && (
                <p className="muted">هنوز تیکتی ثبت نکرده‌اید.</p>
              )}
            </section>
            {thread && (
              <section className="panel thread">
                <h2>{thread.ticket.subject}</h2>
                {thread.messages.map((m: Row) => (
                  <div key={m.id} className={`message ${m.role}`}>
                    <b>{m.role === "admin" ? "پشتیبانی نازمارکت" : "شما"}</b>
                    <p>{m.body}</p>
                    <small>
                      {new Date(m.created_at).toLocaleString("fa-IR")}
                    </small>
                  </div>
                ))}
                {thread.ticket.status !== "closed" && (
                  <form
                    className="form-stack"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setBusy(true);
                      try {
                        const f = Object.fromEntries(
                          new FormData(e.currentTarget),
                        );
                        await api(
                          `/tickets/${thread.ticket.id}/messages`,
                          json(f),
                        );
                        setThread(await api(`/tickets/${thread.ticket.id}`));
                      } catch (err) {
                        setError((err as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <textarea name="body" required placeholder="پاسخ شما…" />
                    <button disabled={busy}>ارسال پاسخ</button>
                  </form>
                )}
              </section>
            )}
          </div>
        )}
        <footer>
          نازمارکت · همراه پیک · مبالغ به تومان · فاصله و زمان تخمینی‌اند
        </footer>
      </main>
    </div>
  );
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <section className="empty">
      <PackageCheck size={35} />
      <h3>{title}</h3>
      <p>{text}</p>
    </section>
  );
}

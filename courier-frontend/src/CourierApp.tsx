import { useEffect, useState } from "react";
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
  KeyRound,
  WifiOff,
  ChevronLeft,
  History,
  LifeBuoy,
  LogOut,
  PackageCheck,
  Power,
  Settings,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { api, json, TOKEN, type Courier, money, verifyLabel } from "./api";
import Verification from "./Verification";
import Dashboard from "./Dashboard";
import TripHistory from "./TripHistory";
import DispatchMap from "./DispatchMap";
import ActiveDelivery from "./ActiveDelivery";
import IncomingOffer from "./IncomingOffer";
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
    [profilePhoto, setProfilePhoto] = useState(""),
    [boot, setBoot] = useState(!!sessionStorage.getItem(TOKEN)),
    [mode, setMode] = useState("login"),
    [showPassword, setShowPassword] = useState(false),
    [page, setPage] = useState("work"),
    [connected, setConnected] = useState(navigator.onLine),
    [notifications, setNotifications] = useState<Row[]>([]),
    [unread, setUnread] = useState(0),
    [notificationError, setNotificationError] = useState(""),
    [ticketTrip, setTicketTrip] = useState(""),
    [orders, setOrders] = useState<Row[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [offerError, setOfferError] = useState(""),
    [notice, setNotice] = useState(""),
    [walletLoaded, setWalletLoaded] = useState(false),
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
  useEffect(() => {
    if (!courier?.hasPortrait) {
      setProfilePhoto("");
      return;
    }
    let url = "";
    const controller = new AbortController();
    fetch("/api/courier/profile/photo", {
      headers: { Authorization: `Bearer ${sessionStorage.getItem(TOKEN)}` },
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error("portrait unavailable");
        return r.blob();
      })
      .then((blob) => {
        if (!controller.signal.aborted) {
          url = URL.createObjectURL(blob);
          setProfilePhoto(url);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setProfilePhoto("");
      });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [courier?.id, courier?.hasPortrait, courier?.verificationStatus]);
  async function loadNotifications() {
    try {
      const r = await api("/notifications");
      setNotifications(Array.isArray(r.notifications) ? r.notifications : []);
      setUnread(Number(r.unread || 0));
      setNotificationError("");
    } catch (e) {
      setNotificationError((e as Error).message);
    }
  }
  useEffect(() => {
    const online = () => setConnected(true),
      offline = () => setConnected(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);
  useEffect(() => {
    if (!courier?.id) return;
    void loadNotifications();
    const timer = setInterval(() => void loadNotifications(), 10000);
    return () => clearInterval(timer);
  }, [courier?.id]);
  async function loadOrders() {
    try {
      const r = await api("/orders");
      setOrders(r.orders);
      setLocationFresh(r.locationFresh);
      setDispatchStatus(r.dispatchStatus);
      setCourier((c) => (c ? { ...c, online: r.online } : c));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function loadWallet() {
    try {
      setWallet(await api("/wallet"));
      setWalletLoaded(true);
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
        .catch((e) => setError((e as Error).message))
        .finally(() => setBoot(false));
    return () => window.removeEventListener("courier-expired", expired);
  }, []);
  useEffect(() => {
    if (!courier?.id) {
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
  async function refreshLocation() {
    setBusy(true);
    try {
      const p = await geo();
      const location = { lat: p.coords.latitude, lng: p.coords.longitude };
      await api("/location", json(location, "PATCH"));
      setCourier((c) => (c ? { ...c, ...location } : c));
      await loadOrders();
      setNotice("موقعیت مکانی تازه شد؛ وضعیت آنلاین/آفلاین شما تغییر نکرد.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
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
        .catch(async () => {
          setLocationFresh(false);
          setError(
            "دسترسی GPS قطع شد؛ دریافت پیشنهاد تازه متوقف شد. سفر جاری شما حفظ شده است.",
          );
          setCourier((c) => (c ? { ...c, online: false } : c));
          try {
            await api("/availability", json({ online: false }, "PATCH"));
          } catch {
            /* Server also expires stale locations. */
          }
        });
    }, 120000);
    return () => clearInterval(timer);
  }, [courier?.online]);
  async function act(order: Row, action: string, body: Row = {}) {
    if (!navigator.onLine) {
      const message =
        "اتصال اینترنت قطع است؛ عملیات ثبت نشده. پس از اتصال، وضعیت سفر را تازه‌سازی کنید.";
      setError(message);
      if (["claim", "decline"].includes(action)) setOfferError(message);
      return;
    }
    if (
      action === "claim" &&
      !window.confirm(
        "پیشنهاد را قبول می‌کنید؟ پس از پذیرش، به فروشگاه حرکت کنید. دریافت بسته در مرحلهٔ جدا ثبت می‌شود.",
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
    if (
      action === "pickup" &&
      !window.confirm(
        "بسته را واقعاً از فروشگاه تحویل گرفته‌اید و سلامت آن را بررسی کرده‌اید؟",
      )
    )
      return;
    setBusy(true);
    setOfferError("");
    try {
      await api(
        `/orders/${encodeURIComponent(order.id)}/${action}`,
        json(body),
      );
      if (action === "decline")
        setOrders((rows) => rows.filter((r) => r.id !== order.id));
      if (action === "claim")
        setOrders((rows) =>
          rows
            .filter((r) => r.claimedByMe || r.id === order.id)
            .map((r) =>
              r.id === order.id
                ? { ...r, claimedByMe: true, tripStatus: "accepted" }
                : r,
            ),
        );
      setNotice(
        action === "claim"
          ? "پیشنهاد پذیرفته شد؛ اکنون به سمت فروشگاه حرکت کنید."
          : action === "decline"
            ? "پیشنهاد رد شد؛ برای سایر پیک‌ها همچنان در دسترس است."
            : action === "arrive"
              ? "رسیدن شما به فروشگاه ثبت شد."
              : action === "pickup"
                ? "دریافت بسته ثبت شد؛ به سمت مشتری حرکت کنید."
                : "تحویل نهایی ثبت و درآمد خالص به کیف پول اضافه شد.",
      );
      await loadOrders();
      if (action === "claim") {
        setPage("active");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      if (action === "complete") {
        setPage("history");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (e) {
      setError((e as Error).message);
      if (["claim", "decline"].includes(action))
        setOfferError((e as Error).message);
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
            onClick={() =>
              setNotice(
                "بازیابی پیامکی هنوز به سرویس SMS متصل نشده است؛ برای بازیابی حساب با پشتیبانی پلتفرم تماس بگیرید.",
              )
            }
          >
            رمز عبور را فراموش کرده‌اید؟
          </button>
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
    : dispatchStatus === "active_trip"
      ? "یک سفر فعال دارید؛ تا پایان آن پیشنهاد تازه دریافت نمی‌کنید."
      : !courier.online
        ? "برای دریافت پیشنهاد، کلید فعالیت را روشن و اجازهٔ موقعیت مکانی را فعال کنید."
        : !locationFresh || dispatchStatus === "location_stale"
          ? "موقعیت شما معتبر یا به‌روز نیست؛ موقعیت مکانی را تازه‌سازی کنید."
          : dispatchStatus === "offers_available"
            ? "پیشنهادهای آمادهٔ دریافت در ادامه هستند. دریافت پیشنهادها هر ۱۰ ثانیه بررسی می‌شود."
            : "در شعاع ۱۵ کیلومتری شما سفارش آماده‌ای پیدا نشد. فروشنده باید سفارش را به «آماده تحویل به پیک» برساند و مختصات فروشگاه ثبت شده باشد. بررسی خودکار هر ۱۰ ثانیه انجام می‌شود.";
  const shown = orders.filter((o) =>
    page === "history"
      ? o.status === 5
      : page === "active"
        ? o.claimedByMe && o.status !== 5
        : o.status !== 5,
  );
  const titles: Record<string, string> = {
    work: `سلام ${courier.fullName.split(" ")[0]} جان!`,
    orders: "سفارش‌های پیشنهادی و جاری",
    wallet: "درآمد و کیف پول",
    settings: "تنظیمات حساب",
    verify: "احراز هویت پیک",
    tickets: "پشتیبانی و تیکت",
    history: "تاریخچهٔ سفرها",
    notifications: "مرکز اعلان‌ها",
    password: "تغییر رمز عبور",
    active: "مدیریت سفر فعال",
  };
  const activeOrders = shown.filter((o) => o.claimedByMe && o.status !== 5);
  const incoming =
    isApproved &&
    courier.online &&
    !orders.some((o) => o.claimedByMe && o.status !== 5)
      ? orders.find(
          (o) =>
            !o.claimedByMe &&
            o.status === 3 &&
            (!o.offerExpiresAt || Date.parse(o.offerExpiresAt) > Date.now()),
        )
      : undefined;
  const orderContent = ["work", "orders", "active"].includes(page) ? (
    <>
      {!!activeOrders.length && (
        <div className="orders-grid">
          {activeOrders.map((o) => (
            <ActiveDelivery
              key={o.id}
              order={o}
              busy={busy || !connected}
              act={act}
              support={() => {
                setTicketTrip(o.id);
                setNotice(
                  `برای گزارش مشکل، شماره سفر ${o.id} را در تیکت بنویسید.`,
                );
                setPage("tickets");
              }}
            />
          ))}
        </div>
      )}
      {page !== "work" && !activeOrders.length && (
        <Empty
          title="سفر فعالی ندارید"
          text="پیشنهادهای جدید به‌صورت پنجرهٔ پایین‌صفحه با دکمه‌های قبول و رد نمایش داده می‌شوند."
        />
      )}
    </>
  ) : null;
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
          <span className="avatar">
            {profilePhoto ? (
              <img src={profilePhoto} alt="تصویر پروفایل" />
            ) : (
              courier.fullName.slice(0, 1)
            )}
          </span>
          <div>
            <b>{courier.fullName}</b>
            <small>{courier.phone}</small>
          </div>
        </div>
        <nav>
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              className={`${page === id || (id === "orders" && page === "active") || (id === "settings" && page === "verify") ? "selected" : ""} nav-${id}`}
              onClick={() => go(id)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {id === "orders" &&
                orders.some((o) => o.status === 3 && !o.claimedByMe) && (
                  <small className="nav-count">
                    {money(
                      orders.filter((o) => o.status === 3 && !o.claimedByMe)
                        .length,
                    )}
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
      </aside>
      <main className="workspace">
        <header className="topbar">
          <span className="topbar-welcome">
            <span className="avatar">
              {profilePhoto ? (
                <img src={profilePhoto} alt="تصویر پروفایل" />
              ) : (
                <UserRound size={19} />
              )}
            </span>
            <b>{courier.fullName}</b>
            <small>خوش آمدید به همراه پیک</small>
          </span>
          <div className="topbar-tools">
            <button
              className="notification-button"
              onClick={() => go("notifications")}
              aria-label="مرکز اعلان‌ها"
            >
              <Bell size={21} />
              {unread > 0 && <span>{money(unread)}</span>}
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
        {!connected && (
          <div className="offline-banner" role="status">
            <WifiOff size={18} />
            اتصال اینترنت قطع است. پذیرش و تحویل تا برقراری اتصال تأیید
            نمی‌شوند؛ درخواست‌ها خودکار تکرار نخواهند شد.
          </div>
        )}
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
        {page !== "active" &&
          orders.some((o) => o.claimedByMe && o.status !== 5) && (
            <button className="primary full" onClick={() => go("active")}>
              <Bike size={18} /> ادامهٔ سفر فعال
            </button>
          )}
        {page === "work" && (
          <Dashboard
            courier={courier}
            orders={orders}
            go={go}
            onLocate={() => void refreshLocation()}
            busy={busy || !isApproved}
            message={dispatchMessage}
            approved={isApproved}
          >
            <p className="spec-hint">
              با آنلاین شدن، موقعیت با اجازهٔ مرورگر و هر دو دقیقه برای پیشنهاد
              سفارش تازه می‌شود. با آفلاین شدن این به‌روزرسانی متوقف می‌شود.
            </p>
            {orderContent}
          </Dashboard>
        )}
        {page === "active" &&
          orders.some((o) => o.claimedByMe && o.status !== 5) && (
            <DispatchMap
              courier={courier}
              orders={orders.filter((o) => o.claimedByMe && o.status !== 5)}
              onLocate={() => void refreshLocation()}
              busy={busy || !isApproved}
            />
          )}
        {page !== "work" && orderContent}
        {page === "history" && <TripHistory />}
        {page === "notifications" && (
          <section className="panel">
            <div className="section-heading">
              <h2>
                <Bell size={20} />
                اعلان‌های شما
              </h2>
              <button
                onClick={async () => {
                  try {
                    await api("/notifications/all/read", json({}, "PATCH"));
                    await loadNotifications();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                خواندن همه
              </button>
            </div>
            {notificationError ? (
              <p className="alert error">
                {notificationError}
                <button onClick={() => void loadNotifications()}>
                  تلاش مجدد
                </button>
              </p>
            ) : !notifications.length ? (
              <Empty
                title="اعلانی ثبت نشده"
                text="خبرهای سفر، بررسی مدارک و پاسخ پشتیبانی اینجا قرار می‌گیرند."
              />
            ) : (
              notifications.map((n) => (
                <button
                  className={`notification-row ${n.is_read ? "" : "unread"}`}
                  key={n.id}
                  onClick={async () => {
                    try {
                      await api(
                        `/notifications/${n.id}/read`,
                        json({}, "PATCH"),
                      );
                      await loadNotifications();
                      go(n.target);
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  <Bell size={19} />
                  <div>
                    <b>{n.title}</b>
                    <p>{n.body}</p>
                    <small>
                      {new Date(n.created_at).toLocaleString("fa-IR")}
                    </small>
                  </div>
                </button>
              ))
            )}
            <p className="spec-hint">
              این مرکز اعلان داخل پنل است؛ Push موبایل و اعلان هنگام بسته بودن
              برنامه هنوز متصل نیست.
            </p>
          </section>
        )}
        {page === "password" && (
          <section className="panel">
            <h2>تغییر رمز عبور</h2>
            <p className="muted">
              پس از تغییر رمز، نشست‌های دیگر شما بسته می‌شوند.
            </p>
            <form
              className="form-stack"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                const f = Object.fromEntries(new FormData(e.currentTarget));
                try {
                  if (f.newPassword !== f.confirmPassword)
                    throw new Error("تکرار رمز جدید یکسان نیست.");
                  await api("/auth/password", json(f));
                  setNotice("رمز عبور تغییر کرد؛ نشست‌های دیگر بسته شدند.");
                  go("settings");
                  setNotice("رمز عبور با موفقیت تغییر کرد.");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                رمز فعلی
                <input
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </label>
              <label>
                رمز جدید
                <input
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={128}
                  required
                />
              </label>
              <label>
                تکرار رمز جدید
                <input
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={128}
                  required
                />
              </label>
              <button className="primary" disabled={busy}>
                ذخیرهٔ رمز جدید
              </button>
            </form>
          </section>
        )}
        {page === "settings" && (
          <div className="settings-grid">
            {[
              [
                "password",
                "تغییر رمز عبور",
                "امنیت حساب و بستن نشست‌های دیگر",
                KeyRound,
              ],
              [
                "notifications",
                "مرکز اعلان‌ها",
                "خبرهای سفر، مدارک و امور مالی",
                Bell,
              ],
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
            <button
              className="settings-link settings-logout"
              onClick={() => void logout()}
            >
              <LogOut size={21} />
              <b>خروج از حساب کاربری</b>
            </button>
          </div>
        )}
        {page === "verify" && (
          <Verification courier={courier} onUpdate={setCourier} />
        )}
        {page === "wallet" && (
          <>
            {!walletLoaded && (
              <p className="muted" role="status">
                در حال دریافت اطلاعات مالی…
              </p>
            )}
            <div className="wallet-hero">
              <Wallet size={34} />
              <div>
                <small>موجودی قابل برداشت</small>
                <h2>
                  {walletLoaded ? money(wallet.available) : "—"}{" "}
                  <span>تومان</span>
                </h2>
                <p>
                  درآمد کل ثبت‌شده: {walletLoaded ? money(wallet.earned) : "—"}{" "}
                  تومان
                </p>
              </div>
            </div>
            <div className="wallet-periods">
              {[
                ["today", "درآمد امروز"],
                ["week", "هفت روز اخیر"],
                ["month", "درآمد این ماه"],
                ["commission", "کمیسیون پرداخت‌شده"],
              ].map(([id, label]) => (
                <article key={id}>
                  <small>{label}</small>
                  <strong>
                    {walletLoaded ? money(wallet.periods?.[id]) : "—"}{" "}
                    <small>تومان</small>
                  </strong>
                </article>
              ))}
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
                    disabled={
                      busy ||
                      !isApproved ||
                      !walletLoaded ||
                      wallet.available < 50000
                    }
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
                    <div>
                      <b>+{money(r.amount)} تومان خالص</b>
                      <small>
                        ناخالص {money(r.gross_amount ?? r.amount)} · کمیسیون{" "}
                        {money(r.commission_amount)}
                      </small>
                    </div>
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
                  <input
                    name="subject"
                    required
                    maxLength={180}
                    defaultValue={ticketTrip ? `مشکل سفر ${ticketTrip}` : ""}
                  />
                </label>
                <label>
                  دسته‌بندی
                  <select
                    name="category"
                    defaultValue={ticketTrip ? "order" : "other"}
                  >
                    {[
                      ["order", "مشکلات سفارش"],
                      ["store", "سوپرمارکت"],
                      ["customer", "مشتری"],
                      ["finance", "مالی و کیف پول"],
                      ["kyc", "احراز هویت"],
                      ["technical", "مشکل فنی"],
                      ["incident", "حادثه و خرابی موتور"],
                      ["other", "سایر"],
                    ].map(([id, title]) => (
                      <option value={id} key={id}>
                        {title}
                      </option>
                    ))}
                  </select>
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
      {incoming && (
        <IncomingOffer
          key={incoming.id}
          order={incoming}
          busy={busy}
          connected={connected}
          error={offerError}
          act={act}
          onExpire={() => {
            setOrders((rows) => rows.filter((r) => r.id !== incoming.id));
            setOfferError("");
          }}
        />
      )}
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

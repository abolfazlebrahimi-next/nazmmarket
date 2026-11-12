import { useEffect, useState } from "react";
import { askConfirm } from "./confirm";
import {
  Bike,
  Bell,
  House,
  Package,
  UserRound,
  Eye,
  EyeOff,
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
import {
  api,
  json,
  getToken,
  setToken,
  type Courier,
  money,
  verifyLabel,
} from "./api";
import Verification from "./Verification";
import Dashboard from "./Dashboard";
import TripHistory from "./TripHistory";
import DispatchMap from "./DispatchMap";
import ActiveDelivery from "./ActiveDelivery";
import AvailableOffer from "./AvailableOffer";
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
    [boot, setBoot] = useState(!!getToken()),
    [mode, setMode] = useState("login"),
    [showPassword, setShowPassword] = useState(false),
    [page, setPage] = useState("work"),
    [connected, setConnected] = useState(navigator.onLine),
    [notifications, setNotifications] = useState<Row[]>([]),
    [unread, setUnread] = useState(0),
    [notificationError, setNotificationError] = useState(""),
    [notifOpen, setNotifOpen] = useState(false),
    [openNotice, setOpenNotice] = useState(0),
    [ticketTrip, setTicketTrip] = useState(""),
    [orders, setOrders] = useState<Row[]>([]),
    // The map and the offer list are inserted into the flow once the first
    // response lands; until then their skeletons hold the same height, so the
    // page does not jump under the rider's thumb.
    [ordersLoaded, setOrdersLoaded] = useState(false),
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
      headers: { Authorization: `Bearer ${getToken()}` },
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
    } finally {
      setOrdersLoaded(true);
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
      setToken(null);
      setCourier(null);
    };
    window.addEventListener("courier-expired", expired);
    const bootSession = async (attempt = 0) => {
      if (!getToken()) {
        setBoot(false);
        return;
      }
      try {
        const r = await api<{ courier: Courier }>("/auth/me");
        setCourier(r.courier);
        setBoot(false);
        void captureQuiet();
      } catch (e) {
        // 401 خودش رویداد انقضا می‌دهد؛ خطای گذرا نباید به صفحهٔ ورود پرتاب کند.
        if (getToken() && attempt < 2) {
          window.setTimeout(
            () => void bootSession(attempt + 1),
            2500 * (attempt + 1),
          );
          return;
        }
        setError((e as Error).message);
        setBoot(false);
      }
    };
    void bootSession();
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
      let done = false;
      const attempt = (high: boolean) => {
        navigator.geolocation.getCurrentPosition(
          (p) => {
            if (done) return;
            done = true;
            resolve(p);
          },
          (err) => {
            if (done) return;
            if (high) {
              // GPS دقیق اغلب دیر جواب می‌دهد؛ یک بار با دقت عادی تلاش می‌کنیم.
              attempt(false);
              return;
            }
            done = true;
            reject(
              new Error(
                err.code === err.PERMISSION_DENIED
                  ? "اجازهٔ دسترسی به موقعیت را در تنظیمات مرورگر فعال کنید."
                  : "موقعیت دقیق در دسترس نشد؛ دوباره تلاش کنید.",
              ),
            );
          },
          high
            ? { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
            : { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
        );
      };
      attempt(true);
    });
  }
  /** ثبت بی‌صدای موقعیت (لاگین/آنلاین شدن) بدون مزاحمت برای کاربر. */
  async function captureQuiet() {
    try {
      const p = await geo();
      const location = { lat: p.coords.latitude, lng: p.coords.longitude };
      await api("/location", json(location, "PATCH"));
      setCourier((c) => (c ? { ...c, ...location } : c));
      setLocationFresh(true);
    } catch {
      /* بی‌صدا؛ کاربر می‌تواند «موقعیت من» را بزند. */
    }
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
      let located = true;
      if (online) {
        // بدون موقعیت هم می‌توان آنلاین شد؛ موقعیت فقط برای نمایش روی نقشه است.
        try {
          const p = await geo();
          location = { lat: p.coords.latitude, lng: p.coords.longitude };
        } catch {
          located = false;
        }
      }
      await api("/availability", json({ online, ...location }, "PATCH"));
      setCourier((c) => (c ? { ...c, online, ...location } : c));
      if (located && location.lat != null) setLocationFresh(true);
      setNotice(
        online
          ? located
            ? "فعال شدید؛ سفارش‌های نظرآباد برای شما ارسال می‌شوند."
            : "فعال شدید؛ همهٔ سفارش‌ها ارسال می‌شوند (ثبت موقعیت را از «موقعیت من» انجام دهید)."
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
          ).then(() => {
            setCourier((c) =>
              c
                ? {
                    ...c,
                    lat: p.coords.latitude,
                    lng: p.coords.longitude,
                  }
                : c,
            );
            setLocationFresh(true);
          }),
        )
        .catch(() => {
          // بدون GPS هم آنلاین می‌مانید؛ فقط موقعیت تازه نیست.
          setLocationFresh(false);
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
      !(await askConfirm(
        "پیشنهاد را قبول می‌کنید؟ پس از پذیرش، به فروشگاه حرکت کنید. دریافت بسته در مرحلهٔ جدا ثبت می‌شود.",
      ))
    )
      return;
    if (
      action === "decline" &&
      !(await askConfirm(
        "این پیشنهاد برای ۵ دقیقه پنهان شود؟ اگر تا آن زمان پذیرفته نشود، دوباره به شما پیشنهاد می‌شود.",
      ))
    )
      return;
    if (
      action === "complete" &&
      !(await askConfirm("آیا سفارش را به مشتری تحویل داده‌اید؟"))
    )
      return;
    if (
      action === "pickup" &&
      !(await askConfirm(
        "بسته را واقعاً از فروشگاه تحویل گرفته‌اید و سلامت آن را بررسی کرده‌اید؟",
      ))
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
        setOrders((rows) =>
          rows.map((r) =>
            r.id === order.id ? { ...r, declinedByMe: true } : r,
          ),
        );
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
            ? "پیشنهاد رد شد؛ اگر هنوز در جست‌وجوی سفیر باشد، در «سفارش‌های من» برای پذیرش دوباره باقی می‌ماند."
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
      if (["claim", "decline"].includes(action)) {
        setOfferError((e as Error).message);
        await loadOrders();
      }
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
      setToken(null);
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
  /**
   * The bell opens the notification list as a menu inside the current page and
   * treats the whole inbox as read the moment it opens.
   */
  async function toggleNotifications() {
    if (notifOpen) {
      setNotifOpen(false);
      setOpenNotice(0);
      return;
    }
    setNotifOpen(true);
    void loadNotifications();
    if (unread > 0) {
      try {
        await api("/notifications/all/read", json({}, "PATCH"));
        await loadNotifications();
      } catch {
        /* the next 10s poll retries; the drawer still shows the list */
      }
    }
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
            <Bike /> نازمارکت · همراه سفیر
          </div>
          <img
            className="login-illustration"
            src="/courier-ride.webp"
            alt="سفیر نازمارکت با موتور سبز و جعبه ارسال"
            width="800"
            height="800"
          />
          <h1>
            مسیر امروزت،
            <br />
            درآمد فردایت.
          </h1>
          <p>سفارش‌های نزدیک، کرایه شفاف و مدیریت درآمد؛ در یک پنل ساده.</p>
        </section>
        <section className="login-card">
          <span className="hero-icon">
            <Bike size={30} />
          </span>
          <h2>{mode === "login" ? "ورود به حساب سفیر" : "ساخت حساب سفیر"}</h2>
          {mode === "register" && (
            <p className="muted">
              احراز هویت را پس از ورود از تنظیمات تکمیل می‌کنید.
            </p>
          )}
          <form
            className="form-stack"
            onInput={() => setError("")}
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
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
                  setToken(r.token);
                  void captureQuiet();
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
              <label className="naz-floating-field">
                <span className="naz-floating-label">نام و نام خانوادگی</span>
                <input
                  name="fullName"
                  required
                  maxLength={120}
                  placeholder="مثلاً علی رضایی"
                  aria-label="نام و نام خانوادگی"
                />
              </label>
            )}
            <label className="naz-floating-field">
              <span className="naz-floating-label">شماره موبایل</span>
              <input
                type="tel"
                name="phone"
                required
                pattern="[0۰٠][9۹٩][0-9۰-۹٠-٩]{9}"
                inputMode="tel"
                autoComplete="tel"
                placeholder="09xxxxxxxxx"
                aria-label="شماره موبایل"
              />
            </label>
            <label className="password-field naz-floating-field">
              <span className="naz-floating-label">رمز عبور</span>
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={mode === "register" ? 10 : 1}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                placeholder="رمز عبور خود را وارد کنید"
                aria-label="رمز عبور"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-pressed={showPassword}
                aria-label={showPassword ? "پنهان کردن رمز عبور" : "نمایش رمز عبور"}
                title={showPassword ? "پنهان کردن رمز" : "نمایش رمز"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </label>
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
        ? "برای دریافت پیشنهاد، کلید فعالیت را روشن کنید (موقعیت مکانی اختیاری است)."
        : dispatchStatus === "offers_available"
          ? "پیشنهادهای آمادهٔ دریافت در ادامه هستند. دریافت پیشنهادها هر ۱۰ ثانیه بررسی می‌شود."
          : "فعلاً سفارش آماده‌ای نیست؛ به محض «آماده تحویل» شدن سفارش‌های نظرآباد برای شما ارسال می‌شود. بررسی خودکار هر ۱۰ ثانیه انجام می‌شود.";
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
    verify: "احراز هویت سفیر",
    tickets: "پشتیبانی و تیکت",
    history: "تاریخچهٔ سفرها",
    password: "تغییر رمز عبور",
    active: "مدیریت سفر فعال",
  };
  const activeOrders = shown.filter((o) => o.claimedByMe && o.status !== 5);
  const availableOrders =
    page === "orders"
      ? shown.filter((o) => !o.claimedByMe && o.status === 3)
      : [];
  const incoming =
    isApproved &&
    courier.online &&
    !orders.some((o) => o.claimedByMe && o.status !== 5)
      ? orders.find(
          (o) =>
            !o.claimedByMe &&
            !o.declinedByMe &&
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
              origin={{ lat: courier.lat, lng: courier.lng }}
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
      {page === "orders" && availableOrders.length > 0 && (
        <section className="available-offers-section" aria-label="سفارش‌های در دسترس">
          <div className="section-heading orders-heading">
            <h2>
              <Package size={20} /> سفارش‌های آمادهٔ پذیرش
            </h2>
            <span className="section-count">
              {money(availableOrders.length)} سفارش
            </span>
          </div>
          <div className="orders-grid">
            {availableOrders.map((o) => (
              <AvailableOffer
                key={o.id}
                order={o}
                busy={busy}
                connected={connected}
                act={act}
              />
            ))}
          </div>
        </section>
      )}
      {page !== "work" && !activeOrders.length && !availableOrders.length && (
        <Empty
          title="سفر فعالی ندارید"
          text={
            page === "orders"
              ? "سفارش‌های در دسترس در همین صفحه نمایش داده می‌شوند؛ پیشنهاد تازه را هم می‌توانید از پنجرهٔ پایین‌صفحه بررسی کنید."
              : "پس از پذیرفتن یک پیشنهاد، جزئیات سفر فعال اینجا نمایش داده می‌شود."
          }
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
            <small>همراه سفیر</small>
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
            <small>خوش آمدید به همراه سفیر</small>
          </span>
          <div className="topbar-tools">
            <button
              className={`notification-button${notifOpen ? " is-open" : ""}`}
              onClick={() => void toggleNotifications()}
              aria-label="مرکز اعلان‌ها"
              aria-expanded={notifOpen}
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
              · همراه سفیر نازمارکت
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
          {page === "work" && (
            <div className="location-strip" role="status">
              <span>
                {courier.lat != null && courier.lng != null
                  ? `موقعیت شما: ${Number(courier.lat).toFixed(5)} · ${Number(courier.lng).toFixed(5)}${locationFresh ? " (به‌روز)" : ""}`
                  : "موقعیت هنوز ثبت نشده است."}
              </span>
              <button
                type="button"
                className="text-btn"
                disabled={busy}
                onClick={() => void refreshLocation()}
              >
                موقعیت من
              </button>
            </div>
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
            loading={!ordersLoaded}
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
        {page === "password" && (
          <section className="panel">
            <h2>تغییر رمز عبور</h2>
            <p className="muted">
              پس از تغییر رمز، نشست‌های دیگر شما بسته می‌شوند.
            </p>
            <form
              className="form-stack"
              onInput={() => setError("")}
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
              <label className="naz-floating-field">
                <span className="naz-floating-label">رمز فعلی</span>
                <input
                  name="currentPassword"
                  type="password"
                  placeholder=" "
                  autoComplete="current-password"
                  required
                />
              </label>
              <label className="naz-floating-field">
                <span className="naz-floating-label">رمز جدید</span>
                <input
                  name="newPassword"
                  type="password"
                  placeholder=" "
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={128}
                  required
                />
              </label>
              <label className="naz-floating-field">
                <span className="naz-floating-label">تکرار رمز جدید</span>
                <input
                  name="confirmPassword"
                  type="password"
                  placeholder=" "
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
                  onClick={() =>
                    id === "notifications"
                      ? void toggleNotifications()
                      : go(String(id))
                  }
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
                  onInput={() => setError("")}
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
                  <label className="naz-floating-field">
                    <span className="naz-floating-label">مبلغ برداشت (تومان)</span>
                    <input
                      type="number"
                      name="amount"
                      placeholder=" "
                      min="50000"
                      max={wallet.available}
                      required
                    />
                  </label>
                  <label className="naz-floating-field">
                    <span className="naz-floating-label">شماره شبای خودتان</span>
                    <input
                      name="iban"
                      dir="ltr"
                      placeholder="IR و ۲۴ رقم"
                      maxLength={26}
                      required
                      pattern="IR[0-9]{24}"
                      onChange={(e) => {
                        e.currentTarget.value = e.currentTarget.value
                          .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
                          .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
                          .toUpperCase()
                          .replace(/[^A-Z0-9]/g, "")
                          .slice(0, 26);
                      }}
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
                onInput={() => setError("")}
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
                <label className="naz-floating-field">
                  <span className="naz-floating-label">موضوع تیکت</span>
                  <input
                    name="subject"
                    placeholder=" "
                    required
                    maxLength={180}
                    defaultValue={ticketTrip ? `مشکل سفر ${ticketTrip}` : ""}
                  />
                </label>
                <label className="naz-floating-field">
                  <span className="naz-floating-label">دسته‌بندی</span>
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
                <label className="naz-floating-field">
                  <span className="naz-floating-label">شرح درخواست</span>
                  <textarea
                    name="body"
                    placeholder="جزئیات درخواست را بنویسید"
                    required
                    maxLength={5000}
                  />
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
                    onInput={() => setError("")}
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
                    <label className="naz-floating-field">
                      <span className="naz-floating-label">پاسخ شما</span>
                      <textarea
                        name="body"
                        required
                        maxLength={5000}
                        placeholder="پاسخ خود را بنویسید…"
                      />
                    </label>
                    <button disabled={busy}>ارسال پاسخ</button>
                  </form>
                )}
              </section>
            )}
          </div>
        )}
        <footer>
          نازمارکت · همراه سفیر · مبالغ به تومان · فاصله و زمان تخمینی‌اند
        </footer>
      </main>
      {notifOpen && (
        <div className="notif-layer">
          <button
            type="button"
            className="notif-backdrop"
            aria-label="بستن اعلان‌ها"
            onClick={() => {
              setNotifOpen(false);
              setOpenNotice(0);
            }}
          />
          <aside className="notif-drawer" role="dialog" aria-modal="true" aria-label="مرکز اعلان‌ها">
            <header>
              <div>
                <h3>
                  <Bell size={18} /> مرکز اعلان‌ها
                </h3>
                <small>
                  {unread > 0
                    ? `${money(unread)} اعلان تازه`
                    : "همهٔ اعلان‌ها خوانده شد"}
                </small>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNotifOpen(false);
                  setOpenNotice(0);
                }}
                aria-label="بستن"
              >
                <X size={18} />
              </button>
            </header>
            <div className="notif-body">
              {notificationError ? (
                <p className="alert error">
                  {notificationError}
                  <button onClick={() => void loadNotifications()}>تلاش مجدد</button>
                </p>
              ) : !notifications.length ? (
                <div className="notif-empty">
                  اعلانی ثبت نشده است. خبرهای سفر، بررسی مدارک و پاسخ پشتیبانی
                  همین‌جا نمایش داده می‌شوند.
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`notif-row${n.is_read ? "" : " unread"}${openNotice === Number(n.id) ? " is-open" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setOpenNotice((current) =>
                          current === Number(n.id) ? 0 : Number(n.id),
                        )
                      }
                      aria-expanded={openNotice === Number(n.id)}
                    >
                      <span className="notif-dot" aria-hidden="true" />
                      <span className="notif-text">
                        <b>{n.title}</b>
                        <small>
                          {new Date(n.created_at).toLocaleString("fa-IR")}
                        </small>
                      </span>
                    </button>
                    {openNotice === Number(n.id) && <p>{n.body}</p>}
                  </div>
                ))
              )}
            </div>
            <footer>
              <span>با باز کردن این فهرست، همهٔ اعلان‌ها خوانده می‌شوند.</span>
              <button type="button" onClick={() => void loadNotifications()}>
                تازه‌سازی
              </button>
            </footer>
          </aside>
        </div>
      )}
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

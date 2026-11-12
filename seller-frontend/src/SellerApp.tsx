import PersianDateField from "./PersianDateField";
import { formatJalaliDay, toPersianDigits } from "../../shared/persianDate";
import BackendReadiness, { useBackendReadiness } from "./BackendReadiness";
import StoreMap from "./StoreMap";
import BankPicker from "./BankPicker";
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
} from "react";
import {
  ArrowDownLeft,
  ArrowLeft,
  BadgePercent,
  Banknote,
  Bell,
  Boxes,
  Building2,
  Camera,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  ImagePlus,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  PackagePlus,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
  TicketPercent,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import {
  sellerApi,
  sellerToken,
  SellerApiError,
  type DashboardStats,
  type FirstOfferConfig,
  type Product,
  type Promo,
  type Seller,
  type SellerAccount,
  type SellerOrder,
} from "./api";
import LocationMapPicker, {
  type LatLng,
} from "./LocationMapPicker";

type Page =
  "overview" | "orders" | "products" | "discounts" | "store" | "account";
type SellerProfile = {
  name: string;
  phone: string;
  shopName: string;
  category: string;
  address: string;
  lat: string;
  lng: string;
  logo: string;
  hours: string;
  fee: string;
  minBasket: string;
  isActive: boolean;
};

const navItems: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "نمای کلی", icon: LayoutDashboard },
  { id: "orders", label: "سفارش‌ها", icon: ShoppingBag },
  { id: "products", label: "محصولات", icon: Boxes },
  { id: "discounts", label: "کدهای تخفیف", icon: TicketPercent },
  { id: "store", label: "اطلاعات فروشگاه", icon: Store },
  { id: "account", label: "حساب و تسویه", icon: UserRound },
];
const money = (n: number) =>
  new Intl.NumberFormat("fa-IR").format(Number(n) || 0);
const toAsciiDigits = (value: string) =>
  value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
const emptyProfile: SellerProfile = {
  name: "",
  phone: "",
  shopName: "",
  category: "",
  address: "",
  lat: "",
  lng: "",
  logo: "",
  hours: "",
  fee: "35000",
  minBasket: "100000",
  isActive: false,
};
const blankStats: DashboardStats = {
  products: 0,
  activeProducts: 0,
  pendingOrders: 0,
  orders: 0,
  sales: 0,
};
const profileFromStore = (seller: Seller): SellerProfile => ({
  ...emptyProfile,
  name: seller.ownerName,
  phone: seller.phone,
  shopName: seller.store?.name ?? "",
  category: seller.store?.category ?? "",
  address: seller.store?.address ?? "",
  lat: seller.store?.lat == null ? "" : String(seller.store.lat),
  lng: seller.store?.lng == null ? "" : String(seller.store.lng),
  logo: seller.store?.logoUrl ?? "",
  isActive: seller.store?.isActive ?? false,
  hours: seller.store?.hours ?? "",
  fee: String(seller.store?.fee ?? 35000),
  minBasket: String(seller.store?.minBasket ?? 100000),
});
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field naz-floating-field">
      <span className="field-label naz-floating-label">{label}</span>
      {children}
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  );
}
function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      placeholder={props.placeholder ?? " "}
      className={`input ${props.className ?? ""}`}
    />
  );
}
function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`input ${props.className ?? ""}`} />;
}
function PhotoPicker({
  label,
  image,
  onChange,
  onFile,
  square = false,
  required = false,
}: {
  label: string;
  image: string;
  onChange: (url: string) => void;
  onFile?: (file: File) => void;
  square?: boolean;
  required?: boolean;
}) {
  const [error, setError] = useState("");
  const onSelectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("تصویر باید JPG، PNG یا WebP باشد.");
      event.currentTarget.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("حجم تصویر لوگو نباید بیشتر از ۵ مگابایت باشد.");
      event.currentTarget.value = "";
      return;
    }
    setError("");
    onChange(URL.createObjectURL(file));
    onFile?.(file);
  };
  return (
    <label
      className={`photo-picker ${square ? "photo-square" : ""} ${image ? "has-photo" : ""}`}
    >
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        required={required}
        aria-label={label}
        onChange={onSelectFile}
      />
      {image ? (
        <img src={image} alt={label} />
      ) : (
        <>
          <ImagePlus size={22} />
          <span>{label}</span>
          <small>عکس واقعی · حداکثر ۵ مگابایت</small>
        </>
      )}
      {image && (
        <span className="photo-edit">
          <Camera size={15} /> تغییر عکس
        </span>
      )}
      {error && (
        <small className="photo-picker-error" role="alert">
          {error}
        </small>
      )}
    </label>
  );
}

export default function SellerApp() {
  const [page, setPage] = useState<Page>("overview");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [seller, setSeller] = useState<Seller | null>(null);
  const backend = useBackendReadiness(Boolean(seller));
  const [authLoading, setAuthLoading] = useState(Boolean(sellerToken.get()));
  const [mobileNav, setMobileNav] = useState(false);
  const [notice, setNotice] = useState("");
  const [profile, setProfile] = useState<SellerProfile>(emptyProfile);
  const [stats, setStats] = useState<DashboardStats>(blankStats);
  const [storeOpen, setStoreOpen] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [sellerOrders, setSellerOrders] = useState<SellerOrder[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bank, setBank] = useState<Product[]>([]);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editDiscount, setEditDiscount] = useState("0");
  const [editStock, setEditStock] = useState("0");
  const [addProduct, setAddProduct] = useState(false);
  const [addPromo, setAddPromo] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const todayIso = new Date().toISOString().slice(0, 10);
  const [promoForm, setPromoForm] = useState({
    code: "",
    title: "",
    kind: "percent",
    amount: "",
    ends: "",
    maxUses: "1",
  });
  const shownProducts = useMemo(
    () => products.filter((p) => p.name.includes(query.trim())),
    [products, query],
  );

  const toast = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 3800);
  };
  const [mapPick, setMapPick] = useState(false);
  const [mapPicked, setMapPicked] = useState<LatLng | null>(null);
  /* دیالوگ تأیید حذف/اقدام حساس — تا تأیید فروشنده انجام نمی‌شود. */
  const [confirmBox, setConfirmBox] = useState<{
    text: string;
    okLabel: string;
    resolve: (ok: boolean) => void;
  } | null>(null);
  const askConfirm = (text: string, okLabel = "بله، مطمئنم") =>
    new Promise<boolean>((resolve) => {
      if (confirmBox) confirmBox.resolve(false);
      setConfirmBox({ text, okLabel, resolve });
    });
  const setProfileField = (key: keyof SellerProfile, value: string) =>
    setProfile((old) => ({ ...old, [key]: value }));
  /* «باز هستیم / بسته‌ایم»: فروشگاه بسته نه سفارش تازه می‌گیرد نه در واگذاری
     خودکار سفارش‌های بی‌پاسخ انتخاب می‌شود. */
  const toggleStoreOpen = async () => {
    const next = !storeOpen;
    try {
      const { store } = await sellerApi.setStoreOpen(next);
      setStoreOpen(store.isOpen ?? next);
      toast(
        next
          ? "فروشگاه باز شد؛ سفارش‌های جدید به شما می‌رسد."
          : "فروشگاه بسته شد؛ فعلا سفارش جدیدی دریافت نمی‌کنید.",
      );
    } catch (e) {
      toast(
        e instanceof SellerApiError ? e.message : "تغییر وضعیت انجام نشد.",
      );
    }
  };
  const goTo = (target: Page) => {
    setPage(target);
    setMobileNav(false);
  };

  useEffect(() => {
    const token = sellerToken.get();
    if (!token) {
      setAuthLoading(false);
      return;
    }
    sellerApi
      .me()
      .then(({ seller: found }) => {
        setSeller(found);
        setProfile(profileFromStore(found));
      })
      .catch(() => {
        sellerToken.set(null);
      })
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    if (!seller) return;
    sellerApi
      .bank()
      .then((r) => setBank(r.products))
      .catch((e) => toast(e.message));
    let live = true;
    Promise.all([
      sellerApi.dashboard(),
      sellerApi.products(),
      sellerApi.promotions(),
      sellerApi.orders(),
    ])
      .then(([dashboard, productResult, promoResult, orderResult]) => {
        if (!live) return;
        setStats(dashboard.stats);
        setStoreOpen(dashboard.store.isOpen ?? true);
        setProfile(profileFromStore({ ...seller, store: dashboard.store }));
        setProducts(productResult.products);
        setPromos(promoResult.promotions);
        setSellerOrders(orderResult.orders);
      })
      .catch((err) => {
        if (live)
          toast(
            err instanceof SellerApiError
              ? err.message
              : "دریافت اطلاعات فروشگاه ناموفق بود.",
          );
      });
    return () => {
      live = false;
    };
  }, [seller?.id]);

  useEffect(() => {
    if (!seller || page !== "orders") return;
    sellerApi
      .bank()
      .then((r) => setBank(r.products))
      .catch((e) => toast(e.message));
    let live = true;
    const refresh = () =>
      sellerApi
        .orders()
        .then(({ orders: currentOrders }) => {
          if (live) setSellerOrders(currentOrders);
        })
        .catch((err) => {
          if (live)
            toast(
              err instanceof SellerApiError
                ? err.message
                : "به‌روزرسانی سفارش‌ها ناموفق بود.",
            );
        });
    void refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [seller?.id, page]);

  const submitLogin = async (
    event: FormEvent,
    credentials: { phone: string; password: string },
  ) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await sellerApi.login(
        credentials.phone,
        credentials.password,
      );
      sellerToken.set(result.token);
      setSeller(result.seller);
      setProfile(profileFromStore(result.seller));
      setPage("overview");
      toast("ورود فروشنده با موفقیت انجام شد.");
    } catch (err) {
      toast(err instanceof SellerApiError ? err.message : "ورود انجام نشد.");
    } finally {
      setBusy(false);
    }
  };
  const submitRegister = async (event: FormEvent, body: FormData) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await sellerApi.register(body);
      sellerToken.set(result.token);
      setSeller(result.seller);
      setProfile(profileFromStore(result.seller));
      setPage("overview");
      toast("حساب فروشنده و فروشگاه در پایگاه‌داده ثبت شد.");
    } catch (err) {
      toast(
        err instanceof SellerApiError ? err.message : "ثبت فروشگاه انجام نشد.",
      );
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!seller) return;
    const id = setInterval(
      () =>
        sellerApi
          .orders()
          .then((r) => setSellerOrders(r.orders))
          .catch(() => {}),
      30000,
    );
    return () => clearInterval(id);
  }, [seller]);
  const logout = async () => {
    try {
      await sellerApi.logout();
    } catch {
      /* local token still removed */
    }
    sellerToken.set(null);
    setSeller(null);
    setProfile(emptyProfile);
    setProducts([]);
    setPromos([]);
    setSellerOrders([]);
    setAuthMode("login");
  };
  const submitPromo = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const { promotion } = await sellerApi.addPromotion({
        code: promoForm.code.trim().toUpperCase(),
        title: promoForm.title.trim(),
        description: "تخفیف فروشگاه",
        kind: promoForm.kind as "percent" | "fixed",
        amount: Number(promoForm.amount),
        minSubtotal: 0,
        maxDiscount: 0,
        expiresAt: promoForm.ends || null,
        maxUses: promoForm.maxUses === "" ? 1 : Number(promoForm.maxUses),
      });
      setPromos((old) => [promotion, ...old]);
      setPromoForm({
        code: "",
        title: "",
        kind: "percent",
        amount: "",
        ends: "",
        maxUses: "1",
      });
      setAddPromo(false);
      toast("کد تخفیف در پایگاه‌داده ذخیره شد.");
    } catch (err) {
      toast(
        err instanceof SellerApiError
          ? err.message
          : "ساخت کد تخفیف انجام نشد.",
      );
    } finally {
      setBusy(false);
    }
  };
  const updateProduct = async (product: Product) => {
    setEditProduct(product);
    setEditStock(String(product.stock));
    setEditPrice(String(product.oldPrice ?? product.price));
    setEditDiscount(
      String(
        product.oldPrice
          ? Math.round((1 - product.price / product.oldPrice) * 100)
          : 0,
      ),
    );
  };

  const deletePromo = async (promo: Promo) => {
    if (promo.id == null) return;
    if (!(await askConfirm(`کد «${promo.code}» حذف شود؟`, "بله، حذف شود")))
      return;
    try {
      await sellerApi.deletePromotion(promo.id);
      setPromos((old) => old.filter((p) => p.id !== promo.id));
      toast("کد تخفیف حذف شد.");
    } catch (err) {
      toast(
        err instanceof SellerApiError ? err.message : "حذف کد تخفیف انجام نشد.",
      );
    }
  };
  useEffect(() => {
    const expired = () => {
      setSeller(null);
      setAuthLoading(false);
      toast(
        "نشست فروشنده معتبر نیست؛ دوباره وارد شوید و سپس سفارش را ادامه دهید.",
      );
    };
    window.addEventListener("seller-session-expired", expired);
    return () => window.removeEventListener("seller-session-expired", expired);
  }, []);
  const dispatchOrder = async (
    order: SellerOrder,
    action: "retry" | "stop",
  ) => {
    if (deliveryBusy || backend.state !== "ready") return;
    setDeliveryBusy(order.id);
    try {
      await sellerApi.dispatch(order.id, action);
      const r = await sellerApi.orders();
      setSellerOrders(r.orders);
      toast(
        action === "retry"
          ? "درخواست دوباره برای سفیرهای واجد شرایط فعال شد؛ در بررسی بعدی پنل سفیر نمایش داده می‌شود."
          : "جست‌وجو متوقف شد.",
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "ثبت عملیات ناموفق بود.");
    } finally {
      setDeliveryBusy(null);
    }
  };
  const [deliveryBusy, setDeliveryBusy] = useState<string | null>(null);
  const selfDelivery = async (order: SellerOrder, complete = false) => {
    if (deliveryBusy || backend.state !== "ready") return;
    if (
      !(await askConfirm(
        complete
          ? "آیا سفارش واقعاً به مشتری تحویل داده شده است؟"
          : "ارسال این سفارش را خودتان انجام می‌دهید؟ پس از تأیید، جست‌وجوی سفیر متوقف می‌شود و مسئولیت ارسال با فروشگاه است.",
        "بله، تأیید می‌کنم",
      ))
    )
      return;
    setDeliveryBusy(order.id);
    try {
      const { order: updated } = await sellerApi.selfDelivery(
        order.id,
        complete,
      );
      setSellerOrders((old) =>
        old.map((o) => (o.id === order.id ? { ...o, ...updated } : o)),
      );
      toast(
        complete
          ? "تحویل سفارش ثبت شد."
          : "ارسال توسط فروشگاه ثبت شد؛ نیازی به کد تحویل سفیر نیست.",
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "ثبت ارسال انجام نشد.");
      if (!(err instanceof SellerApiError && err.status === 401))
        sellerApi
          .orders()
          .then((r) => setSellerOrders(r.orders))
          .catch(() => {});
    } finally {
      setDeliveryBusy(null);
    }
  };
  const rejectOrder = async (
    order: SellerOrder,
    reason: string,
    note: string,
  ) => {
    try {
      const { order: updated } = await sellerApi.rejectOrder(
        order.id,
        reason,
        note.trim() || undefined,
      );
      setSellerOrders((old) =>
        old.map((o) => (o.id === order.id ? { ...o, ...updated } : o)),
      );
      setStats((old) => ({
        ...old,
        pendingOrders: Math.max(0, old.pendingOrders - 1),
      }));
      toast("سفارش رد شد؛ در اپ مشتری نوشته می‌شود که فروشگاه دیگری انتخاب کند.");
      return true;
    } catch (e) {
      toast((e as Error).message);
      return false;
    }
  };

  const updateOrder = async (order: SellerOrder, status: number) => {
    try {
      const { order: updated } = await sellerApi.setOrderStatus(
        order.id,
        status,
      );
      setSellerOrders((old) =>
        old.map((o) => (o.id === order.id ? { ...o, ...updated } : o)),
      );
      setStats((old) => ({
        ...old,
        pendingOrders: Math.max(0, old.pendingOrders - (status === 3 ? 1 : 0)),
      }));
      toast(
        status === 3
          ? "سفارش آماده شد؛ سفیرهای تأییدشده و فعال اطراف فروشگاه می‌توانند آن را دریافت کنند."
          : "وضعیت سفارش ذخیره شد.",
      );
    } catch (err) {
      toast(
        err instanceof SellerApiError
          ? err.message
          : "تغییر وضعیت سفارش انجام نشد.",
      );
    }
  };
  const captureLocation = () => {
    if (!navigator.geolocation)
      return toast("مرورگر امکان دریافت موقعیت را ندارد.");
    const attempt = (high: boolean) => {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          const lat = p.coords.latitude.toFixed(6);
          const lng = p.coords.longitude.toFixed(6);
          setProfile((old) => ({ ...old, lat, lng }));
          // «ثبت موقعیت» بلافاصله ذخیره می‌کند تا به‌تنهایی کافی باشد.
          void saveStore({ lat, lng });
        },
        (err) => {
          if (high) {
            // GPS دقیق اغلب دیر جواب می‌دهد؛ یک بار با دقت عادی تلاش می‌کنیم.
            attempt(false);
            return;
          }
          toast(
            err.code === err.PERMISSION_DENIED
              ? "اجازهٔ دسترسی به موقعیت داده نشد؛ نشانی را دستی وارد کنید."
              : "موقعیت دقیق در دسترس نشد؛ دوباره تلاش کنید.",
          );
        },
        high
          ? { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
          : { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
      );
    };
    attempt(true);
  };
  const saveStore = async (overrides?: Partial<SellerProfile>) => {
    const data = overrides ? { ...profile, ...overrides } : profile;
    const body = new FormData();
    for (const key of [
      "shopName",
      "category",
      "address",
      "lat",
      "lng",
      "hours",
      "fee",
      "minBasket",
    ] as const)
      body.append(key === "shopName" ? "name" : key, data[key]);
    if (logoFile) body.append("logo", logoFile);
    setBusy(true);
    try {
      const { store } = await sellerApi.saveStore(body);
      setProfile((old) => ({
        ...old,
        shopName: store.name,
        logo: store.logoUrl ?? old.logo,
      }));
      setLogoFile(null);
      toast("اطلاعات فروشگاه ذخیره شد.");
    } catch (err) {
      toast(
        err instanceof SellerApiError
          ? err.message
          : "ذخیرهٔ فروشگاه انجام نشد.",
      );
    } finally {
      setBusy(false);
    }
  };
  if (authLoading)
    return (
      <div className="auth-loading" dir="rtl">
        <span className="brand-mark">
          <Store size={20} />
        </span>
        <p>در حال بررسی نشست فروشنده…</p>
      </div>
    );
  if (!seller)
    return (
      <>
        <AuthScreen
          mode={authMode}
          setMode={setAuthMode}
          onLogin={submitLogin}
          onRegister={submitRegister}
          busy={busy}
        />
        {notice && (
          <div className="toast" role="alert">
            {notice}
          </div>
        )}
      </>
    );

  const activeItem = navItems.find((item) => item.id === page) ?? navItems[0];
  const submitStoreForm = (e: FormEvent) => {
    e.preventDefault();
    void saveStore();
  };
  return (
    <div className="app-shell" dir="rtl">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand-lockup">
          <span className="brand-mark">
            <Store size={20} />
          </span>
          <span>
            <strong>ناز مارکت</strong>
            <small>پنل فروشندگان</small>
          </span>
          <button
            className="mobile-close icon-button"
            onClick={() => setMobileNav(false)}
            aria-label="بستن منو"
          >
            <X size={18} />
          </button>
        </div>
        <div className="seller-chip">
          <span className="avatar">{profile.shopName.slice(0, 1) || "ف"}</span>
          <span className="seller-chip-text">
            <strong>{profile.shopName || "فروشگاه شما"}</strong>
            <small>{profile.phone}</small>
          </span>
          <ChevronDown size={15} />
        </div>
        <div className="nav-caption">مدیریت فروشگاه</div>
        <nav className="side-nav">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-link ${page === id ? "active" : ""}`}
              onClick={() => goTo(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === "orders" && (
                <span className="nav-count">{money(stats.pendingOrders)}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="support-card">
            <span className="support-icon">
              <CircleHelp size={17} />
            </span>
            <strong>نیاز به راهنمایی دارید؟</strong>
            <small>مدیریت فروشگاه و سفارش</small>
            <button
              onClick={() =>
                toast("برای پشتیبانی با مدیر نازمارکت تماس بگیرید.")
              }
            >
              راهنمای پنل <ArrowLeft size={13} />
            </button>
          </div>
          <button className="nav-link logout" onClick={() => void logout()}>
            <LogOut size={17} />
            <span>خروج از حساب</span>
          </button>
        </div>
      </aside>
      {mobileNav && (
        <button
          className="scrim"
          onClick={() => setMobileNav(false)}
          aria-label="بستن منو"
        />
      )}
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-start">
            <button
              className="mobile-menu icon-button"
              onClick={() => setMobileNav(true)}
              aria-label="باز کردن منو"
            >
              <Menu size={20} />
            </button>
            <div className="crumb">
              <span>پنل فروشنده</span>
              <ArrowLeft size={14} />
              <strong>{activeItem.label}</strong>
            </div>
          </div>
          <div className="topbar-actions">
            <span className="preview-pill">
              <span /> متصل به سرور
            </span>
            <button
              className="icon-button notification"
              aria-label="اعلان‌ها"
              onClick={() => goTo("orders")}
            >
              <Bell size={18} />
              <Banknote size={16} />
            </button>
            <span className="top-avatar">
              {profile.name.slice(0, 1) || "ف"}
            </span>
          </div>
        </header>
        <div className="page-wrap">
          {page === "overview" && (
            <Overview
              profile={profile}
              products={products}
              promos={promos}
              stats={stats}
              goTo={goTo}
              storeOpen={storeOpen}
              onToggleOpen={toggleStoreOpen}
            />
          )}
          {page === "orders" && (
            <>
              <BackendReadiness state={backend.state} check={backend.check} />
              <OrdersPage
                orders={sellerOrders}
                onStatus={updateOrder}
                onReject={rejectOrder}
                onSelfDelivery={selfDelivery}
                deliveryBusy={deliveryBusy}
                onDispatch={dispatchOrder}
                deliveryAvailable={backend.state === "ready"}
              />
            </>
          )}
          {page === "products" && (
            <ProductsPage
              products={shownProducts}
              query={query}
              setQuery={setQuery}
              onAdd={() => setAddProduct(true)}
              onToggle={(id) => {
                const product = products.find((p) => p.id === id);
                if (product) void updateProduct(product);
              }}
            />
          )}
          {page === "discounts" && (
            <DiscountsPage
              promos={promos}
              products={products}
              onAdd={() => setAddPromo(true)}
              onDelete={(id) => {
                const promo = promos.find((p) => p.id === id);
                if (promo) void deletePromo(promo);
              }}
            />
          )}
          {page === "store" && (
            <StorePage
              profile={profile}
              setProfile={setProfileField}
              onLocation={captureLocation}
              onMapPick={() => {
                setMapPicked(
                  profile.lat && profile.lng
                    ? { lat: Number(profile.lat), lng: Number(profile.lng) }
                    : null,
                );
                setMapPick(true);
              }}
              onSave={submitStoreForm}
              onLogo={(file) => setLogoFile(file)}
              busy={busy}
            />
          )}
          {page === "account" && <AccountPage />}
          <footer className="page-footer">
            <span>ناز مارکت · پنل فروشندگان</span>
            <span>اطلاعات متصل به پایگاه‌داده</span>
          </footer>
        </div>
      </main>
      {mapPick && (
        <Modal
          title="انتخاب موقعیت فروشگاه روی نقشه"
          subtitle="روی نقشه بزنید یا مکان را جست‌وجو کنید؛ سپس تأیید کنید."
          onClose={() => setMapPick(false)}
        >
          <LocationMapPicker
            marker={mapPicked}
            onPick={setMapPicked}
            height={340}
          />
          <div className="modal-actions">
            <button
              className="btn primary"
              disabled={!mapPicked || busy}
              onClick={async () => {
                if (!mapPicked) return;
                const lat = mapPicked.lat.toFixed(6);
                const lng = mapPicked.lng.toFixed(6);
                setProfile((old) => ({ ...old, lat, lng }));
                await saveStore({ lat, lng });
                setMapPick(false);
              }}
            >
              <Check size={16} /> تأیید و ذخیرهٔ این نقطه
            </button>
            <button className="btn" onClick={() => setMapPick(false)}>
              انصراف
            </button>
          </div>
        </Modal>
      )}
      {confirmBox && (
        <Modal
          title="آیا مطمئنید؟"
          subtitle={confirmBox.text}
          onClose={() => {
            confirmBox.resolve(false);
            setConfirmBox(null);
          }}
        >
          <div className="modal-actions">
            <button
              className="btn primary"
              onClick={() => {
                confirmBox.resolve(true);
                setConfirmBox(null);
              }}
            >
              {confirmBox.okLabel}
            </button>
            <button
              className="btn"
              onClick={() => {
                confirmBox.resolve(false);
                setConfirmBox(null);
              }}
            >
              انصراف
            </button>
          </div>
        </Modal>
      )}
      {editProduct && (
        <Modal
          title="قیمت، تخفیف و موجودی"
          subtitle={editProduct.name}
          onClose={() => setEditProduct(null)}
        >
          <form
            className="modal-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const { product } = await sellerApi.updateProduct(
                  editProduct.id,
                  {
                    price: Number(editPrice),
                    stock: Number(editStock),
                    discountPercent: Number(editDiscount),
                  },
                );
                setProducts((old) =>
                  old.map((p) => (p.id === product.id ? product : p)),
                );
                setEditProduct(null);
                toast("قیمت و تخفیف ذخیره شد.");
              } catch (err) {
                toast((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="قیمت فروش بدون تخفیف (تومان)">
              <TextInput
                type="number"
                required
                min="1"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
              />
            </Field>
            <Field label="موجودی فروشگاه (تعداد)">
              <TextInput
                type="number"
                min="0"
                required
                value={editStock}
                onChange={(e) => setEditStock(e.target.value)}
              />
            </Field>
            <Field label="درصد تخفیف (در سقف مجاز مدیریت)">
              <TextInput
                type="number"
                required
                min="0"
                max="90"
                value={editDiscount}
                onChange={(e) => setEditDiscount(e.target.value)}
              />
            </Field>
            <div className="notice-inline">
              قیمت نهایی:{" "}
              {money(
                Math.round(
                  (Number(editPrice) * (100 - Number(editDiscount))) / 100,
                ),
              )}{" "}
              تومان
            </div>
            <button disabled={busy} className="btn primary">
              ذخیره قیمت و تخفیف
            </button>
          </form>
        </Modal>
      )}
      {addProduct && (
        <Modal
          title="انتخاب از بانک محصولات"
          subtitle="نام، تصویر و دسته کالا توسط مدیریت تعیین می‌شود."
          onClose={() => setAddProduct(false)}
        >
          <BankPicker
            bank={bank}
            existing={products}
            busy={busy}
            onAdd={async (ids) => {
              setBusy(true);
              try {
                const r = await sellerApi.bulkProducts(ids);
                setProducts((old) => [...r.products, ...old]);
                setAddProduct(false);
                toast(
                  `${r.products.length} کالا اضافه شد؛ قیمت و موجودی هر کالا را تنظیم کنید.`,
                );
              } catch (err) {
                toast((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </Modal>
      )}

      {addPromo && (
        <Modal
          title="ساخت کد تخفیف"
          subtitle="کد در فروشگاه ذخیره می‌شود؛ هر مشتری فقط یک بار می‌تواند از آن استفاده کند."
          onClose={() => setAddPromo(false)}
        >
          <form className="modal-form" onSubmit={submitPromo}>
            <Field label="عنوان تخفیف">
              <TextInput
                required
                maxLength={80}
                value={promoForm.title}
                onChange={(e) =>
                  setPromoForm({ ...promoForm, title: e.target.value })
                }
              />
            </Field>
            <Field label="کد تخفیف">
              <TextInput
                required
                maxLength={24}
                dir="ltr"
                value={promoForm.code}
                onChange={(e) =>
                  setPromoForm({
                    ...promoForm,
                    code: e.target.value.toUpperCase(),
                  })
                }
              />
            </Field>
            <div className="form-grid">
              <Field label="نوع تخفیف">
                <SelectInput
                  value={promoForm.kind}
                  onChange={(e) =>
                    setPromoForm({ ...promoForm, kind: e.target.value })
                  }
                >
                  <option value="percent">درصدی</option>
                  <option value="fixed">مبلغ ثابت (تومان)</option>
                </SelectInput>
              </Field>
              <Field
                label={promoForm.kind === "percent" ? "درصد" : "مبلغ (تومان)"}
              >
                <TextInput
                  required
                  type="number"
                  min="1"
                  max={promoForm.kind === "percent" ? 100 : undefined}
                  value={promoForm.amount}
                  onChange={(e) =>
                    setPromoForm({ ...promoForm, amount: e.target.value })
                  }
                />
              </Field>
            </div>
            <div className="form-grid">
              <div className="field">
                <span className="field-label">تاریخ پایان (اختیاری)</span>
                <PersianDateField
                  value={promoForm.ends}
                  minIso={todayIso}
                  hint="کد در پایان این روز حذف می‌شود"
                  onChange={(iso) =>
                    setPromoForm({ ...promoForm, ends: iso ?? "" })
                  }
                />
                <small className="field-hint">
                  {promoForm.ends
                    ? `میلادی: ${toPersianDigits(promoForm.ends)} — تا پایان آن روز معتبر است.`
                    : "خالی بگذارید تا کد بدون تاریخ پایان بماند."}
                </small>
              </div>
              <Field
                label="تعداد مجاز مصرف"
                hint="پیش‌فرض یک‌بارمصرف است؛ صفر یعنی بدون سقف."
              >
                <TextInput
                  type="number"
                  min="0"
                  max="1000000"
                  value={promoForm.maxUses}
                  onChange={(e) =>
                    setPromoForm({ ...promoForm, maxUses: e.target.value })
                  }
                />
              </Field>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setAddPromo(false)}
              >
                انصراف
              </button>
              <button type="submit" disabled={busy} className="btn primary">
                <BadgePercent size={16} />{" "}
                {busy ? "در حال ذخیره…" : "ذخیرهٔ کد تخفیف"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          {notice}
        </div>
      )}
    </div>
  );
}

function AuthScreen({
  mode,
  setMode,
  onLogin,
  onRegister,
  busy,
}: {
  mode: "login" | "register";
  setMode: (m: "login" | "register") => void;
  onLogin: (
    e: FormEvent,
    credentials: { phone: string; password: string },
  ) => void;
  onRegister: (e: FormEvent, body: FormData) => void;
  busy: boolean;
}) {
  const [login, setLogin] = useState({ phone: "", password: "" });
  const [register, setRegister] = useState({
    ownerName: "",
    shopName: "",
    phone: "",
    nationalId: "",
    iban: "",
    password: "",
    address: "",
    category: "supermarket",
    lat: "",
    lng: "",
    hours: "",
  });
  const [shopLogo, setShopLogo] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const registerSubmit = (e: FormEvent) => {
    const body = new FormData();
    Object.entries(register).forEach(([key, value]) => body.append(key, value));
    if (shopLogo) body.append("logo", shopLogo);
    onRegister(e, body);
  };
  return (
    <div className="auth-screen" dir="rtl">
      <div className="auth-brand">
        <span className="brand-mark">
          <Store size={20} />
        </span>
        <div>
          <strong>ناز مارکت</strong>
          <small>مرکز فروشندگان</small>
        </div>
        <span className="auth-help">
          <CircleHelp size={15} /> مرکز فروشندگان
        </span>
      </div>
      <div className="auth-layout">
        <section className="auth-hero">
          <span className="eyebrow">
            <span /> همراه رشد کسب‌وکارهای محلی
          </span>
          <h1>
            فروشگاهت را
            <br />
            <em>آنلاین و نزدیک</em> کن.
          </h1>
          <p>
            مدیریت محصولات و سفارش‌های فروشگاهت در یک پنل ساده؛ شروع همکاری با
            ناز مارکت از اینجا است.
          </p>
          <div className="hero-points">
            <span>
              <Check size={15} /> مدیریت موجودی و قیمت
            </span>
            <span>
              <Check size={15} /> ساخت کمپین تخفیف
            </span>
            <span>
              <Check size={15} /> سفارش‌های واقعی
            </span>
          </div>
          <div className="hero-note">
            <ShieldCheck size={17} />
            <span>
              اطلاعات هویتی و بانکی به‌صورت رمزگذاری‌شده ذخیره می‌شود.
            </span>
          </div>
        </section>
        <section className="auth-card">
          <div className="auth-tabs">
            <button
              className={mode === "login" ? "selected" : ""}
              onClick={() => setMode("login")}
            >
              ورود فروشندگان
            </button>
            <button
              className={mode === "register" ? "selected" : ""}
              onClick={() => setMode("register")}
            >
              ثبت فروشگاه
            </button>
          </div>
          {mode === "login" ? (
            <form onSubmit={(e) => onLogin(e, login)} className="auth-form">
              <div>
                <h2>خوش برگشتی</h2>
                <p>شماره موبایل و رمز عبور فروشنده را وارد کن.</p>
              </div>
              <Field label="شماره موبایل">
                <TextInput
                  type="tel"
                  inputMode="numeric"
                  dir="ltr"
                  required
                  pattern="09[0-9]{9}"
                  placeholder="09xxxxxxxxx"
                  value={login.phone}
                  onChange={(e) =>
                    setLogin({
                      ...login,
                      phone: toAsciiDigits(e.target.value).replace(/\D/g, "").slice(0, 11),
                    })
                  }
                />
              </Field>
              <Field label="رمز عبور">
                <TextInput
                  type="password"
                  required
                  placeholder="رمز عبور حساب فروشندگی"
                  value={login.password}
                  onChange={(e) =>
                    setLogin({ ...login, password: e.target.value })
                  }
                />
              </Field>
              <button
                type="submit"
                disabled={busy}
                className="btn primary full"
              >
                {busy ? "در حال ورود…" : "ورود به پنل"} <ArrowLeft size={16} />
              </button>
              <button
                type="button"
                className="text-action"
                onClick={() => setMode("register")}
              >
                هنوز فروشنده نیستی؟ ثبت فروشگاه
              </button>
            </form>
          ) : (
            <form onSubmit={registerSubmit} className="auth-form register-form">
              <div>
                <h2>ثبت فروشگاه</h2>
                <p>
                  اطلاعات واقعی فروشگاه را وارد و لوگوی فروشگاه را بارگذاری
                  کنید.
                </p>
              </div>
              <div className="form-grid">
                <Field label="نام و نام خانوادگی">
                  <TextInput
                    required
                    autoComplete="name"
                    value={register.ownerName}
                    onChange={(e) =>
                      setRegister({ ...register, ownerName: e.target.value })
                    }
                  />
                </Field>
                <Field label="نام فروشگاه">
                  <TextInput
                    required
                    value={register.shopName}
                    onChange={(e) =>
                      setRegister({ ...register, shopName: e.target.value })
                    }
                  />
                </Field>
              </div>
              <div className="form-grid">
                <Field label="شماره موبایل">
                  <TextInput
                    required
                    dir="ltr"
                    inputMode="numeric"
                    pattern="09[0-9]{9}"
                    maxLength={11}
                    placeholder="09xxxxxxxxx"
                    value={register.phone}
                    onChange={(e) =>
                      setRegister({
                        ...register,
                        phone: toAsciiDigits(e.target.value).replace(/\D/g, "").slice(0, 11),
                      })
                    }
                  />
                </Field>
                <Field label="رمز عبور">
                  <TextInput
                    required
                    type="password"
                    minLength={8}
                    autoComplete="new-password"
                    value={register.password}
                    onChange={(e) =>
                      setRegister({ ...register, password: e.target.value })
                    }
                  />
                </Field>
              </div>
              <div className="form-grid">
                <Field label="کد ملی">
                  <TextInput
                    required
                    dir="ltr"
                    inputMode="numeric"
                    pattern="[0-9]{10}"
                    maxLength={10}
                    value={register.nationalId}
                    onChange={(e) =>
                      setRegister({
                        ...register,
                        nationalId: toAsciiDigits(e.target.value).replace(/\D/g, "").slice(0, 10),
                      })
                    }
                  />
                </Field>
                <Field label="شماره شبا">
                  <TextInput
                    required
                    dir="ltr"
                    pattern="IR[0-9]{24}"
                    maxLength={26}
                    placeholder="IRxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={register.iban}
                    onChange={(e) =>
                      setRegister({
                        ...register,
                        iban: toAsciiDigits(e.target.value)
                          .toUpperCase()
                          .replace(/[^A-Z0-9]/g, "")
                          .slice(0, 26),
                      })
                    }
                  />
                </Field>
              </div>
              <div className="form-grid">
                <Field label="دسته‌بندی">
                  <SelectInput
                    value={register.category}
                    onChange={(e) =>
                      setRegister({ ...register, category: e.target.value })
                    }
                  >
                    <option value="supermarket">سوپرمارکت</option>
                    <option value="hypermarket">هایپرمارکت</option>
                    <option value="produce">میوه و سبزی</option>
                    <option value="bakery">نانوایی و قنادی</option>
                    <option value="other">سایر</option>
                  </SelectInput>
                </Field>
                <Field label="ساعات کاری">
                  <TextInput
                    placeholder="هر روز ۸ تا ۲۲"
                    value={register.hours}
                    onChange={(e) =>
                      setRegister({ ...register, hours: e.target.value })
                    }
                  />
                </Field>
              </div>
              <Field label="نشانی دقیق فروشگاه">
                <TextInput
                  required
                  value={register.address}
                  onChange={(e) =>
                    setRegister({ ...register, address: e.target.value })
                  }
                  placeholder="شهر، خیابان، کوچه و پلاک"
                />
              </Field>
              <div className="form-grid">
                <PhotoPicker
                  label="لوگوی فروشگاه (الزامی)"
                  image={logoUrl}
                  onChange={setLogoUrl}
                  onFile={setShopLogo}
                  square
                  required
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="btn primary full"
              >
                {busy ? "در حال ثبت…" : "ثبت فروشگاه و ایجاد حساب"}{" "}
                <ArrowLeft size={16} />
              </button>
              <button
                type="button"
                className="text-action"
                onClick={() => setMode("login")}
              >
                قبلاً ثبت‌نام کرده‌ای؟ ورود
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
function Overview({
  profile,
  products,
  promos,
  stats,
  goTo,
  storeOpen,
  onToggleOpen,
}: {
  profile: SellerProfile;
  products: Product[];
  promos: Promo[];
  stats: DashboardStats;
  goTo: (p: Page) => void;
  storeOpen: boolean;
  onToggleOpen: () => void;
}) {
  return (
    <>
      <div className="page-title">
        <div>
          <h1>سلام، {profile.name || "فروشنده"} 👋</h1>
          <p>نمای کلی فروشگاه و فعالیت‌های اخیر شما</p>
        </div>
      </div>
      <div className="stats-grid">
        <Stat
          icon={ShoppingBag}
          label="سفارش‌های ثبت‌شده"
          value={money(stats.orders)}
          note={`${money(stats.pendingOrders)} در انتظار اقدام`}
          tone="green"
        />
        <Stat
          icon={Banknote}
          label="فروش ثبت‌شده"
          value={`${money(stats.sales)} تومان`}
          note="مجموع سفارش‌های تکمیل‌شده"
          tone="orange"
        />
        <Stat
          icon={Boxes}
          label="محصولات فعال"
          value={`${money(stats.activeProducts)} از ${money(stats.products)}`}
          note="کالاهای فروشگاه"
          tone="blue"
        />
        <Stat
          icon={TicketPercent}
          label="کد تخفیف فعال"
          value={money(promos.filter((p) => p.active).length)}
          note="منتشرشده در فروشگاه"
          tone="purple"
        />
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>فروشگاه شما</h2>
              <p>اطلاعات ثبت‌شده در سامانه</p>
            </div>
            <button className="text-action" onClick={() => goTo("store")}>
              ویرایش اطلاعات
            </button>
          </div>
          <div className="store-summary">
            <span className="summary-avatar">
              {profile.logo ? (
                <img src={profile.logo} alt={profile.shopName} />
              ) : (
                profile.shopName.slice(0, 1)
              )}
            </span>
            <div>
              <strong>{profile.shopName}</strong>
              <small>
                {profile.category} · {profile.address}
              </small>
            </div>
            <span className="live-pill">
              {profile.isActive ? "فعال" : "در انتظار تأیید مدیریت / غیرفعال"}
            </span>
          </div>
          <div className={`open-close-bar ${storeOpen ? "is-open" : ""}`}>
            <div>
              <strong>{storeOpen ? "باز هستیم" : "بسته‌ایم"}</strong>
              <small>
                {storeOpen
                  ? "سفارش‌های جدید به فروشگاه شما می‌رسد."
                  : "فعلا سفارش جدید نمی‌پذیرید؛ سفارش‌های تازه و واگذارشده به فروشگاه دیگری می‌روند."}
              </small>
            </div>
            <button
              type="button"
              className={`open-toggle ${storeOpen ? "is-open" : ""}`}
              onClick={onToggleOpen}
              aria-pressed={storeOpen}
            >
              {storeOpen ? "بستن فروشگاه" : "باز کردن فروشگاه"}
            </button>
          </div>
          <div className="summary-details">
            <span>
              <Clock3 size={15} /> {profile.hours || "ساعات کاری ثبت نشده"}
            </span>
            <span>
              <MapPin size={15} /> {profile.address || "نشانی ثبت نشده"}
            </span>
          </div>
        </section>
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>اقدام‌های سریع</h2>
              <p>مدیریت روزانه فروشگاه</p>
            </div>
          </div>
          <QuickAction
            icon={ShoppingBag}
            title="مشاهده سفارش‌ها"
            text={`${money(stats.pendingOrders)} سفارش در انتظار`}
            onClick={() => goTo("orders")}
          />
          <QuickAction
            icon={PackagePlus}
            title="افزودن محصول"
            text="انتخاب از بانک مرکزی محصولات"
            onClick={() => goTo("products")}
          />
          <QuickAction
            icon={TicketPercent}
            title="ساخت تخفیف"
            text="تعریف کد برای مشتریان"
            onClick={() => goTo("discounts")}
          />
        </section>
      </div>
      <section className="panel recent-panel">
        <div className="panel-head">
          <div>
            <h2>محصولات اخیر</h2>
            <p>کالاهای ذخیره‌شده در فروشگاه</p>
          </div>
          <button className="text-action" onClick={() => goTo("products")}>
            همهٔ محصولات
          </button>
        </div>
        {products.length ? (
          <div className="recent-products">
            {products.slice(0, 4).map((p) => (
              <span key={p.id}>
                {p.imageUrl && <img src={p.imageUrl} alt="" />}
                <b>{p.name}</b>
                <small>{money(p.price)} تومان</small>
              </span>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Boxes}
            title="هنوز محصولی ثبت نشده"
            text="برای نمایش در کاتالوگ، کالا را از بانک مرکزی انتخاب کنید."
          />
        )}
      </section>
    </>
  );
}
function Stat({
  icon: Icon,
  label,
  value,
  note,
  tone,
}: {
  icon: typeof ShoppingBag;
  label: string;
  value: string;
  note: string;
  tone: string;
}) {
  return (
    <div className="stat-card">
      <span className={`stat-icon ${tone}`}>
        <Icon size={19} />
      </span>
      <span className="stat-label">{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
function QuickAction({
  icon: Icon,
  title,
  text,
  onClick,
}: {
  icon: typeof Building2;
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button className="quick-action" onClick={onClick}>
      <span>
        <Icon size={17} />
      </span>
      <div>
        <strong>{title}</strong>
        <small>{text}</small>
      </div>
      <ArrowDownLeft size={15} />
    </button>
  );
}
function EmptyState({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof ShoppingBag;
  title: string;
  text: string;
}) {
  return (
    <div className="empty-state">
      <span>
        <Icon size={25} />
      </span>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}
const rejectReasons = [
  ["stock", "کالا تمام شده است"],
  ["closed", "امروز باز نیستیم"],
  ["capacity", "ظرفیت امروز پر شده"],
  ["area", "ارسال به این آدرس ممکن نیست"],
  ["other", "دلیل دیگر"],
] as const;

function OrdersPage({
  orders,
  onStatus,
  onReject,
  onSelfDelivery,
  deliveryBusy,
  onDispatch,
  deliveryAvailable,
}: {
  orders: SellerOrder[];
  onStatus: (order: SellerOrder, status: number) => void;
  onReject: (
    order: SellerOrder,
    reason: string,
    note: string,
  ) => Promise<boolean>;
  onSelfDelivery: (order: SellerOrder, complete?: boolean) => void;
  deliveryBusy: string | null;
  deliveryAvailable: boolean;
  onDispatch: (order: SellerOrder, action: "retry" | "stop") => void;
}) {
  // `filter` is an order status; -1 is the store's own rejection bin.
  const [filter, setFilter] = useState(0);
  const [rejecting, setRejecting] = useState<SellerOrder | null>(null);
  const [rejectKind, setRejectKind] = useState<string>("stock");
  const [rejectNote, setRejectNote] = useState("");
  const [rejectBusy, setRejectBusy] = useState(false);
  const shownOrders = orders.filter(
    (o) => !filter || (filter === -1 ? o.status === 0 : o.status === filter),
  );
  const confirmReject = async () => {
    if (!rejecting) return;
    setRejectBusy(true);
    const ok = await onReject(rejecting, rejectKind, rejectNote);
    setRejectBusy(false);
    if (ok) setRejecting(null);
  };
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const searchState = (o: SellerOrder) =>
    o.dispatchPaused
      ? "paused"
      : o.dispatchTimedOut ||
          (o.dispatchStartedAt &&
            now - Date.parse(o.dispatchStartedAt) >= 15 * 60000)
        ? "timed_out"
        : o.dispatch?.state || "searching";
  const stages = [
    "ثبت سفارش",
    "در حال آماده‌سازی",
    "آماده تحویل به سفیر",
    "تحویل به سفیر",
    "تکمیل سفارش",
  ];
  return (
    <PageHeading
      title="مدیریت سفارش‌ها"
      subtitle="از ثبت تا تحویل نهایی؛ وضعیت هر سفارش را دنبال کنید."
    >
      <div className="filter-row">
        <button
          className={`filter ${filter === 0 ? "active" : ""}`}
          onClick={() => setFilter(0)}
        >
          همه <span>{money(orders.length)}</span>
        </button>
        <button
          className={`filter ${filter === -1 ? "active" : ""}`}
          onClick={() => setFilter(-1)}
        >
          رد شده{" "}
          <span>{money(orders.filter((o) => o.status === 0).length)}</span>
        </button>
        {stages.map((label, i) => (
          <button
            key={i}
            className={`filter ${filter === i + 1 ? "active" : ""}`}
            onClick={() => setFilter(i + 1)}
          >
            {label}
            <span>
              {money(orders.filter((o) => o.status === i + 1).length)}
            </span>
          </button>
        ))}
      </div>
      {shownOrders.length === 0 ? (
        <section className="panel">
          <EmptyState
            icon={ShoppingBag}
            title="سفارشی در این بخش نیست"
            text="سفارش‌های ثبت‌شده مشتریان به‌صورت خودکار در این قسمت نمایش داده می‌شوند."
          />
        </section>
      ) : (
        <div className="order-list">
          {shownOrders.map((order) => (
              <article
                className={`panel order-card stage-${order.status}`}
                key={order.id}
              >
                <div className="order-head">
                  <div className="order-title">
                    <span className="order-icon">
                      <ShoppingBag size={22} />
                    </span>
                    <div>
                      <strong>{order.id}</strong>
                      <small>
                        {order.time} · {order.addressTitle}
                      </small>
                    </div>
                  </div>
                  <span className={`status-pill status-${order.status}`}>
                    {order.status === 0
                      ? order.rejectedBy === "seller"
                        ? "رد شده توسط شما"
                        : "لغوشده"
                      : order.deliveryMode === "seller" && order.status === 4
                        ? "ارسال توسط فروشگاه"
                        : order.deliveryMode === "pickup"
                          ? order.status >= 5
                            ? "دریافت شد"
                            : order.status >= 4
                              ? "آماده برای دریافت"
                              : stages[order.status - 1]
                          : stages[order.status - 1]}
                  </span>
                </div>
                {order.status > 0 && (
                  <ol className="order-progress">
                    {stages.map((stage, i) => (
                      <li
                        className={order.status > i ? "passed" : ""}
                        key={stage}
                      >
                        <span>
                          {order.status > i + 1 ? <Check size={12} /> : i + 1}
                        </span>
                        <small>{stage}</small>
                      </li>
                    ))}
                  </ol>
                )}
                <div className="order-detail-grid">
                  <div className="order-customer">
                    <UserRound size={17} />
                    <div>
                      <small>مشتری</small>
                      <b>{order.customer?.name || "مشتری"}</b>
                      <a href={`tel:${order.customer?.phone}`}>
                        {order.customer?.phone}
                      </a>
                    </div>
                  </div>
                  <div className="order-address">
                    <MapPin size={17} />
                    <div>
                      <small>نشانی تحویل</small>
                      <p>{order.addressText}</p>
                      {order.addressLat != null && order.addressLng != null && (
                        <a
                          className="location-link"
                          href={`https://maps.google.com/?q=${order.addressLat},${order.addressLng}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          مشاهدهٔ موقعیت دقیق مشتری روی نقشه
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <div className="order-items">
                  {order.items.map((item) => (
                    <div key={item.id}>
                      <span className="item-qty">{money(item.qty)}×</span>
                      <b>{item.name}</b>
                      <span>{money(item.price * item.qty)} تومان</span>
                    </div>
                  ))}
                </div>
                <div className="order-foot">
                  <div>
                    <small>مبلغ نهایی سفارش</small>
                    <strong>
                      {money(order.total)} <small>تومان</small>
                    </strong>
                  </div>
                  <span className="payment-note">
                    {order.payment === "cash" ? "پرداخت در محل" : order.payment}{" "}
                    ·{" "}
                    {order.paymentStatus === "unpaid"
                      ? "پرداخت‌نشده"
                      : order.paymentStatus}
                  </span>
                </div>
                <div className="order-actions">
                  <small>
                    <ShieldCheck size={14} />{" "}
                    {order.deliveryMode === "seller"
                      ? "ارسال توسط فروشگاه؛ بدون کد تحویل سفیر"
                      : order.deliveryMode === "pickup"
                        ? "تحویل حضوری به مشتری در فروشگاه"
                        : "ارسال با سفیر تأییدشده یا توسط خود فروشگاه"}
                  </small>
                  {order.status === 1 && (
                    <button
                      className="btn primary small"
                      onClick={() => onStatus(order, 2)}
                    >
                      تأیید و شروع آماده‌سازی <ArrowLeft size={15} />
                    </button>
                  )}
                  {(order.status === 1 || order.status === 2) && (
                    <button
                      className="btn reject small"
                      onClick={() => {
                        setRejecting(order);
                        setRejectKind("stock");
                        setRejectNote("");
                      }}
                    >
                      <X size={15} /> رد سفارش
                    </button>
                  )}
                  {order.status === 2 && (
                    <button
                      className="btn primary small"
                      onClick={() => onStatus(order, 3)}
                    >
                      <Check size={15} />{" "}
                      {order.deliveryMode === "pickup"
                        ? "آماده شد؛ به مشتری اطلاع بده"
                        : order.addressCity && order.addressCity !== "نظرآباد"
                          ? "آماده تحویل"
                          : "آماده تحویل به سفیر"}
                    </button>
                  )}
                  {order.status === 3 && order.deliveryMode === "pickup" && (
                    <div className="seller-dispatch">
                      <strong>سفارش آمادهٔ تحویل حضوری است</strong>
                      <p>
                        وقتی مشتری کالاها را از فروشگاه گرفت، تحویل را تأیید
                        کنید.
                      </p>
                      <button
                        className="btn primary small"
                        disabled={
                          deliveryBusy === order.id || !deliveryAvailable
                        }
                        onClick={() => onSelfDelivery(order, true)}
                      >
                        {deliveryBusy === order.id
                          ? "در حال ثبت…"
                          : "تحویل حضوری دادم"}
                      </button>
                    </div>
                  )}
                  {order.status === 3 &&
                    order.deliveryMode !== "pickup" &&
                    (order.courierAssigned ? (
                      <span className="status-pill status-3">
                        سفیر پذیرفت؛ در انتظار رسیدن سفیر به فروشگاه
                      </span>
                    ) : (
                      <div className="seller-dispatch" role="status">
                        {order.addressCity && order.addressCity !== "نظرآباد" ? (
                          <>
                            <strong>خارج از محدودهٔ پیک‌های پلتفرم</strong>
                            <p>
                              این سفارش در «{order.addressCity}» است و به
                              سفیرهای پلتفرم پیشنهاد نمی‌شود؛ خودتان ارسال کنید
                              یا سفارش را رد کنید.
                            </p>
                          </>
                        ) : searchState(order) === "searching" ? (
                          <>
                            <strong>
                              <span
                                className="dispatch-spinner"
                                aria-hidden="true"
                              />{" "}
                              در انتظار پاسخ سفیرهای واجد شرایط
                            </strong>
                            <p>
                              تعداد سفیر واجد شرایط:{" "}
                              {money(order.dispatch?.eligible ?? 0)}؛ رد کرده:{" "}
                              {money(order.dispatch?.declined ?? 0)}. نمایش در
                              پنل همهٔ سفیرهای آنلاین نظرآباد انجام می‌شود؛
                              فاصله (کیلومتر) شرط نیست.
                            </p>
                          </>
                        ) : searchState(order) === "all_declined" ? (
                          <>
                            <strong>
                              همهٔ سفیرهای واجد شرایط این سفارش را رد کرده‌اند
                            </strong>
                            <p>
                              پاسخ پذیرفته‌شده‌ای نداریم. پس از ۵ دقیقه از رد هر
                              سفیر، تا پایان بازهٔ جست‌وجو دوباره به او پیشنهاد
                              می‌شود؛ یا همین حالا دوباره ارسال کنید.
                            </p>
                          </>
                        ) : searchState(order) === "no_couriers" ? (
                          <>
                            <strong>
                              در حال حاضر سفیر واجد شرایط در دسترس نیست
                            </strong>
                            <p>
                              سفیر باید تأییدشده، آنلاین و بدون سفر فعال باشد؛
                              فاصله (کیلومتر) و موقعیت شرط نیست. نمایش این وضعیت
                              به معنی ارسال درخواست به سفیر نیست.
                            </p>
                          </>
                        ) : searchState(order) === "paused" ? (
                          <>
                            <strong>جست‌وجوی سفیر متوقف شده است</strong>
                            <p>
                              برای شروع دوباره، «ارسال دوباره به سفیرها» را
                              بزنید یا خودتان ارسال کنید.
                            </p>
                          </>
                        ) : (
                          <>
                            <strong>
                              متأسفانه سفیری پیدا نشد؛ جست‌وجو متوقف شد
                            </strong>
                            <p>
                              ۱۵ دقیقه بدون پذیرش گذشت. می‌توانید درخواست را
                              دوباره ارسال کنید یا خودتان ارسال کنید.
                            </p>
                          </>
                        )}
                        {order.addressCity && order.addressCity !== "نظرآباد" ? (
                          <button
                            className="btn reject small"
                            onClick={() => {
                              setRejecting(order);
                              setRejectKind("stock");
                              setRejectNote("");
                            }}
                          >
                            <X size={15} /> رد سفارش
                          </button>
                        ) : (
                        <div className="dispatch-controls">
                          <button
                            className="btn small"
                            disabled={
                              deliveryBusy === order.id || !deliveryAvailable
                            }
                            onClick={() => onDispatch(order, "retry")}
                          >
                            ارسال دوباره به سفیرها
                          </button>
                          {!["paused", "timed_out"].includes(
                            searchState(order),
                          ) && (
                            <button
                              className="btn small"
                              disabled={
                                deliveryBusy === order.id || !deliveryAvailable
                              }
                              onClick={() => onDispatch(order, "stop")}
                            >
                              توقف جست‌وجو
                            </button>
                          )}
                        </div>
                        )}
                        <button
                          className="btn primary small"
                          disabled={
                            deliveryBusy === order.id || !deliveryAvailable
                          }
                          onClick={() => onSelfDelivery(order)}
                        >
                          {deliveryBusy === order.id
                            ? "در حال ثبت…"
                            : "خودم ارسال می‌کنم"}
                        </button>
                      </div>
                    ))}
                  {order.status === 4 &&
                    (order.deliveryMode === "pickup" ? (
                      <div className="seller-dispatch">
                        <strong>آماده برای دریافت</strong>
                        <p>
                          مشتری برای تحویل گرفتن مراجعه می‌کند؛ پس از دادن
                          سفارش، تأیید کنید.
                        </p>
                        <button
                          className="btn primary small"
                          disabled={
                            deliveryBusy === order.id || !deliveryAvailable
                          }
                          onClick={() => onSelfDelivery(order, true)}
                        >
                          {deliveryBusy === order.id
                            ? "در حال ثبت…"
                            : "تحویل حضوری دادم"}
                        </button>
                      </div>
                    ) : order.deliveryMode === "seller" ? (
                      <div className="seller-dispatch">
                        <strong>
                          در حال ارسال توسط فروشگاه — بدون کد تحویل
                        </strong>
                        <p>
                          پس از رسیدن واقعی سفارش به مشتری، تحویل را تأیید کنید.
                        </p>
                        <button
                          className="btn primary small"
                          disabled={
                            deliveryBusy === order.id || !deliveryAvailable
                          }
                          onClick={() => onSelfDelivery(order, true)}
                        >
                          {deliveryBusy === order.id
                            ? "در حال ثبت…"
                            : "سفارش را به مشتری تحویل دادم"}
                        </button>
                      </div>
                    ) : (
                      <span className="status-pill status-4">
                        در مسیر مشتری؛ ارسال با سفیر
                      </span>
                    ))}
                  {order.status === 5 && (
                    <span className="status-pill status-5">
                      <Check size={14} />
                      {order.deliveryMode === "seller"
                        ? "تحویل نهایی توسط فروشگاه"
                        : order.deliveryMode === "pickup"
                          ? "دریافت حضوری توسط مشتری"
                          : "تحویل نهایی توسط سفیر"}
                    </span>
                  )}
                </div>
              </article>
            ))}
        </div>
      )}
      {rejecting && (
        <Modal
          title={`رد سفارش ${rejecting.id}`}
          subtitle="کالاها به موجودی برمی‌گردد، کد تخفیف مصرف‌شده به حساب مشتری بازمی‌گردد و در اپ مشتری نوشته می‌شود که فروشگاه دیگری انتخاب کند."
          onClose={() => (rejectBusy ? null : setRejecting(null))}
        >
          <div className="reject-form">
            <div className="reject-reasons" role="radiogroup" aria-label="دلیل رد سفارش">
              {rejectReasons.map(([key, label]) => (
                <label className="reject-reason" key={key}>
                  <input
                    type="radio"
                    name="reject-reason"
                    value={key}
                    checked={rejectKind === key}
                    onChange={() => setRejectKind(key)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <Field label="توضیح برای مشتری (اختیاری)">
              <TextInput
                maxLength={140}
                value={rejectNote}
                placeholder="مثلاً فقط تا ساعت ۱۲ تحویل داریم"
                onChange={(e) => setRejectNote(e.target.value)}
              />
            </Field>
            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setRejecting(null)}
              >
                انصراف
              </button>
              <button
                type="button"
                className="btn reject"
                disabled={rejectBusy}
                onClick={() => void confirmReject()}
              >
                {rejectBusy ? "در حال ثبت…" : "رد سفارش"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </PageHeading>
  );
}

function ProductsPage({
  products,
  query,
  setQuery,
  onAdd,
  onToggle,
}: {
  products: Product[];
  query: string;
  setQuery: (q: string) => void;
  onAdd: () => void;
  onToggle: (id: number) => void;
}) {
  return (
    <PageHeading
      title="محصولات فروشگاه"
      subtitle="کالاها، موجودی و قیمت‌های ثبت‌شده در فروشگاه را مدیریت کنید."
    >
      <div className="toolbar">
        <div className="search-box">
          <Search size={17} />
          <input
            placeholder="جست‌وجوی نام محصول"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button className="btn primary" onClick={onAdd}>
          <Plus size={17} /> انتخاب از بانک کالا
        </button>
      </div>
      {products.length === 0 ? (
        <section className="panel">
          <EmptyState
            icon={Boxes}
            title={query ? "محصولی پیدا نشد" : "هنوز محصولی ثبت نشده"}
            text={
              query
                ? "عبارت دیگری را جست‌وجو کنید."
                : "کالا را از بانک محصولات مدیریت انتخاب کنید."
            }
          />
        </section>
      ) : (
        <div className="product-grid">
          {products.map((p) => (
            <article className="product-card" key={p.id}>
              <div className="product-image">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} />
                ) : (
                  <span>
                    <ImagePlus size={24} />
                  </span>
                )}
                <button
                  className={`toggle ${p.active ? "on" : ""}`}
                  onClick={() => onToggle(p.id)}
                  aria-label="ویرایش قیمت و تخفیف"
                >
                  <Banknote size={16} />
                </button>
              </div>
              <div className="product-info">
                <small>{p.category}</small>
                <h3>{p.name}</h3>
                <div className="product-meta">
                  <strong>
                    {money(p.price)} <small>تومان</small>
                  </strong>
                  <span>موجودی: {money(p.stock)}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </PageHeading>
  );
}
/** «خرید اول»: چند کالا + درصد تخفیف؛ مشتریِ تازه فقط یکی را با تخفیف می‌گیرد. */
function FirstOfferPanel({ products }: { products: Product[] }) {
  const [loaded, setLoaded] = useState(false);
  const [percent, setPercent] = useState("50");
  const [minBasket, setMinBasket] = useState("0");
  const [active, setActive] = useState(true);
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    sellerApi
      .getFirstOffer()
      .then(({ offer }: { offer: FirstOfferConfig | null }) => {
        if (!alive) return;
        if (offer) {
          setPercent(String(offer.percent));
          setMinBasket(String(offer.minBasket));
          setActive(offer.active);
          setSelected(offer.productIds);
        }
        setLoaded(true);
      })
      .catch(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const toggle = (id: number) =>
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= 30
          ? prev
          : [...prev, id],
    );

  const save = async () => {
    setBusy(true);
    setNote(null);
    try {
      const { offer } = await sellerApi.saveFirstOffer({
        productIds: selected,
        percent: Number(percent),
        minBasket: Number(minBasket),
        active,
      });
      setSelected(offer.productIds);
      setNote({ ok: true, text: "پیشنهاد «خرید اول» ذخیره شد." });
    } catch (e) {
      const code = e instanceof SellerApiError ? e.code : "error";
      setNote({
        ok: false,
        text:
          code === "invalid_percent"
            ? "درصد تخفیف باید بین ۲۵ تا ۱۰۰ باشد."
            : code === "invalid_min_basket"
              ? "حداقل مبلغ سبد نامعتبر است."
              : code === "products_required"
                ? "دست‌کم یک کالا را برای پیشنهاد انتخاب کنید."
                : code === "too_many_products"
                  ? "حداکثر ۳۰ کالا می‌توانید انتخاب کنید."
                  : "ذخیره انجام نشد؛ دوباره تلاش کنید.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel first-offer-panel">
      <div className="fo-head">
        <span className="fo-badge">خرید اول</span>
        <div>
          <h3>پیشنهاد ویژهٔ اولین خرید</h3>
          <p>
            مشتری‌هایی که اولین خریدشان در ناز مارکت است، فقط یک کالا را با این
            تخفیف می‌گیرند و مابقی سبد را از همین فروشگاه با قیمت عادی می‌خرند.
          </p>
        </div>
      </div>
      <div className="fo-fields">
        <label className="field">
          <span>درصد تخفیف (۲۵ تا ۱۰۰)</span>
          <input
            type="number"
            min={25}
            max={100}
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
          />
        </label>
        <label className="field">
          <span>حداقل مبلغ سبد برای تکمیل خرید اول (تومان)</span>
          <input
            type="number"
            min={0}
            value={minBasket}
            onChange={(e) => setMinBasket(e.target.value)}
          />
        </label>
        <label className="fo-active">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          پیشنهاد فعال باشد
        </label>
      </div>
      <p className="fo-label">
        کالاهای پیشنهاد ({money(selected.length)} از {money(30)} انتخاب)
      </p>
      <div className="fo-products">
        {products.map((p) => (
          <label
            key={p.id}
            className={`fo-product ${selected.includes(p.id) ? "on" : ""}`}
          >
            <input
              type="checkbox"
              checked={selected.includes(p.id)}
              onChange={() => toggle(p.id)}
            />
            <span className="fo-product-name">{p.name}</span>
            <small>{money(p.price)} تومان</small>
          </label>
        ))}
        {products.length === 0 && (
          <p className="fo-empty">ابتدا از بخش محصولات، کالا اضافه کنید.</p>
        )}
      </div>
      <div className="fo-foot">
        <button
          className="btn primary"
          disabled={busy || !loaded}
          onClick={() => void save()}
        >
          {busy ? "در حال ذخیره…" : "ذخیرهٔ پیشنهاد خرید اول"}
        </button>
        {note && (
          <p className={note.ok ? "fo-note ok" : "fo-note err"}>{note.text}</p>
        )}
      </div>
    </section>
  );
}

function DiscountsPage({
  promos,
  onAdd,
  onDelete,
  products,
}: {
  promos: Promo[];
  onAdd: () => void;
  onDelete: (id: number) => void;
  products: Product[];
}) {
  return (
    <PageHeading
      title="کدهای تخفیف"
      subtitle="کد تخفیف فروشگاه را ایجاد و مدیریت کنید."
    >
      <FirstOfferPanel products={products} />
      <div className="toolbar">
        <div className="toolbar-note">
          <TicketPercent size={17} /> هر کد به ازای هر مشتری یک‌بار مصرف است و پس
          از رسیدن به سقف مصرف، خودکار از فهرست مشتری‌ها حذف می‌شود.
        </div>
        <button className="btn primary" onClick={onAdd}>
          <Plus size={17} /> ساخت کد تخفیف
        </button>
      </div>
      {promos.length === 0 ? (
        <section className="panel">
          <EmptyState
            icon={BadgePercent}
            title="کد تخفیفی ندارید"
            text="هنوز کدی برای این فروشگاه ثبت نشده است."
          />
        </section>
      ) : (
        <section className="panel promo-list">
          {promos.map((p) => (
            <div className="promo-row" key={p.id ?? p.code}>
              <span className="promo-icon">
                <TicketPercent size={19} />
              </span>
              <div className="promo-desc">
                <strong>{p.title}</strong>
                <small dir="ltr">
                  {p.code} ·{" "}
                  {p.kind === "percent"
                    ? `${p.amount}٪`
                    : `${money(p.amount)} تومان`}
                </small>
              </div>
              <span className="promo-meta">
                <span className="promo-date">
                  {p.expiresAt
                    ? `پایان: ${formatJalaliDay(p.expiresAt)}`
                    : "بدون تاریخ پایان"}
                </span>
                <span className="promo-cap">
                  {p.maxUses > 0
                    ? `مصرف: ${toPersianDigits(p.usageCount)} از ${toPersianDigits(p.maxUses)}`
                    : `مصرف‌شده: ${toPersianDigits(p.usageCount)}`}
                </span>
              </span>
              {p.id != null && (
                <button
                  className="delete-button"
                  onClick={() => onDelete(p.id!)}
                >
                  حذف
                </button>
              )}
            </div>
          ))}
        </section>
      )}
    </PageHeading>
  );
}
function PageHeading({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <>
      <div className="page-title">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>
      {children}
    </>
  );
}

function StorePage({
  profile,
  setProfile,
  onLocation,
  onMapPick,
  onSave,
  onLogo,
  busy,
}: {
  profile: SellerProfile;
  setProfile: (k: keyof SellerProfile, v: string) => void;
  onLocation: () => void;
  onMapPick: () => void;
  onSave: (e: FormEvent) => void;
  onLogo: (file: File) => void;
  busy: boolean;
}) {
  return (
    <PageHeading
      title="اطلاعات فروشگاه"
      subtitle="اطلاعات عمومی، لوگو و موقعیت فروشگاه را ویرایش کنید."
    >
      <div className="store-layout">
        <form className="panel form-panel" onSubmit={onSave}>
          <div className="panel-head">
            <div>
              <h2>پروفایل فروشگاه</h2>
              <p>تغییرات پس از ذخیره در پایگاه‌داده ثبت می‌شود.</p>
            </div>
            <span className="live-pill">
              {profile.isActive ? "فعال" : "در انتظار تأیید مدیریت / غیرفعال"}
            </span>
          </div>
          <div className="store-photo-row logo-only">
            <PhotoPicker
              label="لوگوی فروشگاه (مربع ۱:۱)"
              image={profile.logo}
              onChange={(v) => setProfile("logo", v)}
              onFile={onLogo}
              square
            />
          </div>
          <div className="form-grid">
            <Field label="نام فروشگاه">
              <TextInput
                required
                value={profile.shopName}
                onChange={(e) => setProfile("shopName", e.target.value)}
              />
            </Field>
            <Field label="دسته‌بندی">
              <SelectInput
                value={profile.category}
                onChange={(e) => setProfile("category", e.target.value)}
              >
                <option value="supermarket">سوپرمارکت</option>
                <option value="hypermarket">هایپرمارکت</option>
                <option value="produce">میوه و سبزی</option>
                <option value="bakery">نانوایی و قنادی</option>
                <option value="other">سایر</option>
              </SelectInput>
            </Field>
          </div>
          <Field label="نشانی دقیق فروشگاه">
            <textarea
              required
              className="input textarea"
              rows={3}
              value={profile.address}
              onChange={(e) => setProfile("address", e.target.value)}
            />
          </Field>
          <StoreMap
            lat={profile.lat}
            lng={profile.lng}
            onPick={(lat, lng) => {
              setProfile("lat", lat);
              setProfile("lng", lng);
            }}
          />
          <div className="form-grid">
            <Field label="عرض جغرافیایی">
              <TextInput
                type="number"
                step="any"
                min="-90"
                max="90"
                value={profile.lat}
                onChange={(e) => setProfile("lat", e.target.value)}
              />
            </Field>
            <Field label="طول جغرافیایی">
              <TextInput
                type="number"
                step="any"
                min="-180"
                max="180"
                value={profile.lng}
                onChange={(e) => setProfile("lng", e.target.value)}
              />
            </Field>
          </div>
          <div className="location-box">
            <div className="location-icon">
              <MapPin size={18} />
            </div>
            <div className="location-copy">
              <strong>موقعیت جغرافیایی فروشگاه</strong>
              <small>
                {profile.lat && profile.lng
                  ? `عرض ${profile.lat} · طول ${profile.lng}`
                  : "اختیاری؛ برای نمایش موقعیت اجازهٔ مرورگر لازم است."}
              </small>
            </div>
            <button
              type="button"
              className="btn secondary small"
              onClick={onLocation}
            >
              <MapPin size={15} /> ثبت موقعیت
            </button>
            <button
              type="button"
              className="btn secondary small"
              onClick={onMapPick}
            >
              <MapPin size={15} /> انتخاب روی نقشه
            </button>
          </div>
          <div className="form-grid">
            <Field label="ساعات کاری">
              <TextInput
                value={profile.hours}
                onChange={(e) => setProfile("hours", e.target.value)}
              />
            </Field>
            <div className="notice-inline">
              کرایه توسط پلتفرم از مسافت، وزن و شرایط جوی محاسبه می‌شود؛ عادی ۵۰
              تا ۸۰ هزار تومان.
            </div>
            <Field label="حداقل سبد (تومان)">
              <TextInput
                type="number"
                min="0"
                value={profile.minBasket}
                onChange={(e) => setProfile("minBasket", e.target.value)}
              />
            </Field>
          </div>
          <button disabled={busy} type="submit" className="btn primary">
            <Check size={16} /> {busy ? "در حال ذخیره…" : "ذخیرهٔ تغییرات"}
          </button>
        </form>
        <aside className="panel checklist">
          <h3>اطلاعات فروشگاه</h3>
          <Checklist
            label="نام و دسته‌بندی"
            done={!!profile.shopName && !!profile.category}
          />
          <Checklist label="نشانی دقیق" done={!!profile.address} />
          <Checklist label="لوگوی فروشگاه" done={!!profile.logo} />
          <div className="checklist-note">
            <ShieldCheck size={16} /> تصاویر فقط پس از بارگذاری به سرور نمایش
            داده می‌شوند.
          </div>
        </aside>
      </div>
    </PageHeading>
  );
}
function Checklist({ label, done }: { label: string; done: boolean }) {
  return (
    <div className={`check-row ${done ? "done" : ""}`}>
      <span>{done ? <Check size={13} /> : <span />}</span>
      {label}
    </div>
  );
}
function AccountPage() {
  const [acc, setAcc] = useState<SellerAccount | null>(null);
  const [iban, setIban] = useState("");
  const [card, setCard] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    sellerApi
      .getAccount()
      .then((a) => {
        setAcc(a);
        setIban(a.iban);
        setCard(a.card);
      })
      .catch((e) => setMsg(e instanceof Error ? e.message : "خطا در دریافت حساب"));
  }, []);
  const saveBank = async () => {
    setBusy(true);
    setMsg("");
    try {
      await sellerApi.updateAccount({ iban, card });
      setMsg("اطلاعات بانکی ذخیره شد.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "ذخیره انجام نشد.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <PageHeading
      title="حساب و تسویه"
      subtitle="اطلاعات بانکی و درآمد ارسال شما."
    >
      <section className="panel form-panel account-panel">
        <div className="panel-head">
          <div>
            <h2>اطلاعات صاحب فروشگاه</h2>
            <p>
              شماره شبا و کارت را می‌بینید و هر وقت خواستید تغییر می‌دهید.
            </p>
          </div>
          <span className="secure-label">
            <ShieldCheck size={14} /> امن
          </span>
        </div>
        <div className="form-grid">
          <Field label="نام و نام خانوادگی">
            <TextInput value={acc?.ownerName ?? ""} readOnly />
          </Field>
          <Field label="شماره موبایل">
            <TextInput dir="ltr" value={acc?.phone ?? ""} readOnly />
          </Field>
          <Field label="کد ملی">
            <TextInput value="ثبت‌شده و رمزگذاری‌شده" readOnly />
          </Field>
          <Field label="شماره شبا (قابل تغییر)">
            <TextInput
              dir="ltr"
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              placeholder="IR..."
            />
          </Field>
          <Field label="شماره کارت (قابل تغییر)">
            <TextInput
              dir="ltr"
              value={card}
              onChange={(e) => setCard(e.target.value)}
              placeholder="0000-0000-0000-0000"
            />
          </Field>
        </div>
        <div className="panel-actions">
          <button className="btn primary" disabled={busy} onClick={saveBank}>
            {busy ? "در حال ذخیره…" : "ذخیرهٔ اطلاعات بانکی"}
          </button>
          {msg && <span className="notice-inline">{msg}</span>}
        </div>
        <div className="settlement-card">
          <span>
            <Wallet size={20} />
          </span>
          <div>
            <strong>درآمد ارسال (خودم ارسال می‌کنم)</strong>
            <small>
              هزینهٔ پیک سفارش‌هایی که خودتان ارسال کرده‌اید به حساب شما
              می‌نشیند.
            </small>
          </div>
          <span className="paid-pill">
            {money(acc?.deliveryEarnings ?? 0)} تومان
          </span>
        </div>
        {(acc?.ledger?.length ?? 0) > 0 && (
          <div className="ledger-list">
            {acc?.ledger.map((row) => (
              <div key={`${row.order_id}-${row.created_at}`} className="ledger-row">
                <b>سفارش {row.order_id}</b>
                <span>{money(row.amount)} تومان</span>
                <small>{row.created_at.slice(0, 10)}</small>
              </div>
            ))}
          </div>
        )}
      </section>
    </PageHeading>
  );
}
function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="modal-head">
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="بستن">
            <X size={19} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

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
  type Product,
  type Promo,
  type Seller,
  type SellerOrder,
} from "./api";

type Page =
  | "overview"
  | "orders"
  | "products"
  | "discounts"
  | "store"
  | "account";
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
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  );
}
function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input ${props.className ?? ""}`} />;
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
}: {
  label: string;
  image: string;
  onChange: (url: string) => void;
  onFile?: (file: File) => void;
  square?: boolean;
}) {
  const onSelectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      onChange(URL.createObjectURL(file));
      onFile?.(file);
    }
  };
  return (
    <label
      className={`photo-picker ${square ? "photo-square" : ""} ${image ? "has-photo" : ""}`}
    >
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
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
    </label>
  );
}

export default function SellerApp() {
  const [page, setPage] = useState<Page>("overview");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [seller, setSeller] = useState<Seller | null>(null);
  const [authLoading, setAuthLoading] = useState(Boolean(sellerToken.get()));
  const [mobileNav, setMobileNav] = useState(false);
  const [notice, setNotice] = useState("");
  const [profile, setProfile] = useState<SellerProfile>(emptyProfile);
  const [stats, setStats] = useState<DashboardStats>(blankStats);
  const [products, setProducts] = useState<Product[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [sellerOrders, setSellerOrders] = useState<SellerOrder[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bank, setBank] = useState<Product[]>([]);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editDiscount, setEditDiscount] = useState("0");
  const [masterId, setMasterId] = useState(0);
  const [addProduct, setAddProduct] = useState(false);
  const [addPromo, setAddPromo] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [productForm, setProductForm] = useState({
    name: "",
    category: "dairy",
    price: "",
    stock: "",
    unit: "",
    image: "",
    file: null as File | null,
  });
  const [promoForm, setPromoForm] = useState({
    code: "",
    title: "",
    kind: "percent",
    amount: "",
    ends: "",
  });
  const shownProducts = useMemo(
    () => products.filter((p) => p.name.includes(query.trim())),
    [products, query],
  );

  const toast = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 3800);
  };
  const setProfileField = (key: keyof SellerProfile, value: string) =>
    setProfile((old) => ({ ...old, [key]: value }));
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
  const submitProduct = async (event: FormEvent) => {
    event.preventDefault();
    if (!masterId) return toast("یک کالا از بانک محصولات انتخاب کنید.");
    const body = { masterId, price: Number(productForm.price) };
    setBusy(true);
    try {
      const { product } = await sellerApi.addProduct(body);
      setProducts((old) => [product, ...old]);
      setStats((old) => ({
        ...old,
        products: old.products + 1,
        activeProducts: old.activeProducts + 1,
      }));
      setProductForm({
        name: "",
        category: "dairy",
        price: "",
        stock: "",
        unit: "",
        image: "",
        file: null,
      });
      setAddProduct(false);
      toast("محصول در پایگاه‌داده ثبت و به فروشگاه اضافه شد.");
    } catch (err) {
      toast(
        err instanceof SellerApiError ? err.message : "ثبت محصول انجام نشد.",
      );
    } finally {
      setBusy(false);
    }
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
        expiresAt: promoForm.ends ? `${promoForm.ends}T23:59:59.000Z` : null,
      });
      setPromos((old) => [promotion, ...old]);
      setPromoForm({
        code: "",
        title: "",
        kind: "percent",
        amount: "",
        ends: "",
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
      toast("وضعیت سفارش ذخیره شد.");
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
    navigator.geolocation.getCurrentPosition(
      (p) =>
        setProfile((old) => ({
          ...old,
          lat: p.coords.latitude.toFixed(6),
          lng: p.coords.longitude.toFixed(6),
        })),
      () => toast("دسترسی موقعیت داده نشد؛ نشانی را دستی وارد کنید."),
      { enableHighAccuracy: true },
    );
  };
  const saveStore = async () => {
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
      body.append(key === "shopName" ? "name" : key, profile[key]);
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
      <AuthScreen
        mode={authMode}
        setMode={setAuthMode}
        onLogin={submitLogin}
        onRegister={submitRegister}
        busy={busy}
      />
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
            />
          )}
          {page === "orders" && (
            <OrdersPage orders={sellerOrders} onStatus={updateOrder} />
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
              onSave={submitStoreForm}
              onLogo={(file) => setLogoFile(file)}
              busy={busy}
            />
          )}
          {page === "account" && <AccountPage profile={profile} />}
          <footer className="page-footer">
            <span>ناز مارکت · پنل فروشندگان</span>
            <span>اطلاعات متصل به پایگاه‌داده</span>
          </footer>
        </div>
      </main>
      {editProduct && (
        <Modal
          title="ویرایش قیمت و تخفیف"
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
          <form className="modal-form" onSubmit={submitProduct}>
            <Field label="محصول">
              <SelectInput
                required
                value={masterId}
                onChange={(e) => setMasterId(Number(e.target.value))}
              >
                <option value={0}>انتخاب کالا</option>
                {bank.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
            {bank.find((p) => p.id === masterId)?.imageUrl && (
              <img
                className="bank-preview"
                src={bank.find((p) => p.id === masterId)?.imageUrl}
                alt="محصول انتخاب‌شده"
              />
            )}
            <Field label="قیمت (تومان)">
              <TextInput
                required
                type="number"
                min="1"
                value={productForm.price}
                onChange={(e) =>
                  setProductForm({ ...productForm, price: e.target.value })
                }
              />
            </Field>
            <button className="btn primary" disabled={busy || !masterId}>
              افزودن به فروشگاه
            </button>
          </form>
        </Modal>
      )}

      {addPromo && (
        <Modal
          title="ساخت کد تخفیف"
          subtitle="کد در فروشگاه ذخیره می‌شود و از طریق کاتالوگ اعمال خواهد شد."
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
            <Field label="تاریخ پایان (اختیاری)">
              <TextInput
                type="date"
                value={promoForm.ends}
                onChange={(e) =>
                  setPromoForm({ ...promoForm, ends: e.target.value })
                }
              />
            </Field>
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
                    setLogin({ ...login, phone: e.target.value })
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
                      setRegister({ ...register, phone: e.target.value })
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
                      setRegister({ ...register, nationalId: e.target.value })
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
                        iban: e.target.value.toUpperCase(),
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
                />
              </div>
              <button
                type="submit"
                disabled={busy || !shopLogo}
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
}: {
  profile: SellerProfile;
  products: Product[];
  promos: Promo[];
  stats: DashboardStats;
  goTo: (p: Page) => void;
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
function OrdersPage({
  orders,
  onStatus,
}: {
  orders: SellerOrder[];
  onStatus: (order: SellerOrder, status: number) => void;
}) {
  const [filter, setFilter] = useState(0);
  const stages = [
    "ثبت سفارش",
    "در حال آماده‌سازی",
    "آماده تحویل به پیک",
    "تحویل به پیک موتوری",
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
      {orders.filter((o) => !filter || o.status === filter).length === 0 ? (
        <section className="panel">
          <EmptyState
            icon={ShoppingBag}
            title="سفارشی در این بخش نیست"
            text="سفارش‌های ثبت‌شده مشتریان به‌صورت خودکار در این قسمت نمایش داده می‌شوند."
          />
        </section>
      ) : (
        <div className="order-list">
          {orders
            .filter((o) => !filter || o.status === filter)
            .map((order) => (
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
                    {order.status === 0 ? "لغوشده" : stages[order.status - 1]}
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
                    <ShieldCheck size={14} /> دریافت و تحویل نهایی فقط توسط پیک
                    تأییدشده
                  </small>
                  {order.status === 1 && (
                    <button
                      className="btn primary small"
                      onClick={() => onStatus(order, 2)}
                    >
                      تأیید و شروع آماده‌سازی <ArrowLeft size={15} />
                    </button>
                  )}
                  {order.status === 2 && (
                    <button
                      className="btn primary small"
                      onClick={() => onStatus(order, 3)}
                    >
                      <Check size={15} /> آماده تحویل به پیک
                    </button>
                  )}
                  {order.status === 3 && (
                    <span className="status-pill status-3">
                      <Clock3 size={14} /> در انتظار دریافت پیک
                    </span>
                  )}
                  {order.status === 4 && (
                    <span className="status-pill status-4">در مسیر مشتری</span>
                  )}
                  {order.status === 5 && (
                    <span className="status-pill status-5">
                      <Check size={14} /> تحویل نهایی توسط پیک
                    </span>
                  )}
                </div>
              </article>
            ))}
        </div>
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
function DiscountsPage({
  promos,
  onAdd,
  onDelete,
}: {
  promos: Promo[];
  onAdd: () => void;
  onDelete: (id: number) => void;
}) {
  return (
    <PageHeading
      title="کدهای تخفیف"
      subtitle="کد تخفیف فروشگاه را ایجاد و مدیریت کنید."
    >
      <div className="toolbar">
        <div className="toolbar-note">
          <TicketPercent size={17} /> کدهای فعال برای مشتریان این فروشگاه قابل
          استفاده‌اند.
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
              <span className="promo-date">
                {p.expiresAt
                  ? new Date(p.expiresAt).toLocaleDateString("fa-IR")
                  : "بدون تاریخ پایان"}
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
  onSave,
  onLogo,
  busy,
}: {
  profile: SellerProfile;
  setProfile: (k: keyof SellerProfile, v: string) => void;
  onLocation: () => void;
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
          </div>
          <div className="form-grid">
            <Field label="ساعات کاری">
              <TextInput
                value={profile.hours}
                onChange={(e) => setProfile("hours", e.target.value)}
              />
            </Field>
            <Field label="هزینه ارسال (تومان)">
              <TextInput
                type="number"
                min="0"
                value={profile.fee}
                onChange={(e) => setProfile("fee", e.target.value)}
              />
            </Field>
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
function AccountPage({ profile }: { profile: SellerProfile }) {
  return (
    <PageHeading
      title="حساب و تسویه"
      subtitle="وضعیت اطلاعات حساب فروشندگی شما."
    >
      <section className="panel form-panel account-panel">
        <div className="panel-head">
          <div>
            <h2>اطلاعات صاحب فروشگاه</h2>
            <p>
              اطلاعات هویتی در زمان ثبت‌نام به‌شکل رمزگذاری‌شده ذخیره شده است.
            </p>
          </div>
          <span className="secure-label">
            <ShieldCheck size={14} /> امن
          </span>
        </div>
        <div className="form-grid">
          <Field label="نام و نام خانوادگی">
            <TextInput value={profile.name} readOnly />
          </Field>
          <Field label="شماره موبایل">
            <TextInput dir="ltr" value={profile.phone} readOnly />
          </Field>
          <Field label="کد ملی">
            <TextInput value="ثبت‌شده و رمزگذاری‌شده" readOnly />
          </Field>
          <Field label="شماره شبا">
            <TextInput value="ثبت‌شده و رمزگذاری‌شده" readOnly />
          </Field>
        </div>
        <div className="notice-inline">
          <ShieldCheck size={17} />
          <span>
            مقادیر کد ملی و شبا برای حفظ حریم خصوصی در پنل نمایش داده نمی‌شوند.
          </span>
        </div>
        <div className="settlement-card">
          <span>
            <Wallet size={20} />
          </span>
          <div>
            <strong>وضعیت تسویه</strong>
            <small>
              پرداخت و تسویهٔ آنلاین هنوز در این نسخه پیاده‌سازی نشده است.
            </small>
          </div>
          <span className="pending-pill">غیرفعال</span>
        </div>
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

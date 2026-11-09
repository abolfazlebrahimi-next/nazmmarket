import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ClipboardList, Home, Info, MapPin, Search, ShoppingCart, Store, TicketPercent, UserCheck, Users, Wallet } from "lucide-react";
import { Wordmark, load, pd, save } from "./components/ui";
import { api } from "./api/client";
import type { AppCtx, Sub, View } from "./ctx";
import type { Address, CartState, Order, Product, User } from "./data";
import { products, storeById } from "./data";
import AuthPage from "./pages/Auth";
import { AddressForm, AddressSelect } from "./pages/AddressFlow";
import { CartBody, CartDrawer, CheckoutView, DoneView } from "./pages/CartFlow";
import OrdersView from "./pages/Orders";
import { AccountSheetHost, AccountView } from "./pages/Account";
import { EasyPage, FavoritesPage, HomePage, MapPage, StoresPage } from "./pages/Home";
import { CategoryPage, ProductModal, ReplacePrompt, SearchPage, StorePage, StorePickerSheet } from "./pages/Store";

const defaultAddresses: Address[] = [
  { id: 1, title: "خانه", address: "نظرآباد، میرزا کوچک‌خان شمالی", detail: "کوچه ۱", phone: "۰۹۹۳۵۳۷۷۴۲۶", type: "home" },
];

const isDesktop = () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

export default function App() {
  const [user, setUser] = useState<User | null>(() => load<User | null>("naz_user", null));
  const [view, setView] = useState<View>("home");
  const [sub, setSub] = useState<Sub>(null);
  const [subReturn, setSubReturn] = useState<"home" | "checkout">("home");

  const [cart, setCart] = useState<CartState>(() => load("naz_cart", { storeId: null, items: {} }));
  const [favorites, setFavorites] = useState<number[]>(() => load("naz_favs", []));
  const [addresses, setAddresses] = useState<Address[]>(() => load("naz_addresses", defaultAddresses));
  const [selectedAddressId, setSelectedAddressId] = useState<number>(() => load("naz_address_id", 1));
  const [orders, setOrders] = useState<Order[]>(() => load("naz_orders", []));
  const [wallet, setWallet] = useState<number>(() => load("naz_wallet", 250000));
  const [proActive, setProActive] = useState<boolean>(() => load("naz_pro", false));
  const [appliedCode, setAppliedCode] = useState<string | null>(null);

  const [pickedPin, setPickedPin] = useState<{ lat: number; lng: number } | null>(null);
  const [pickedLabel, setPickedLabel] = useState("");
  const [productModal, setProductModal] = useState<Product | null>(null);
  const [storePicker, setStorePicker] = useState(false);
  const [replacePrompt, setReplacePrompt] = useState<{ product: Product; storeId: number } | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  const [cartDrawer, setCartDrawer] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => save("naz_cart", cart), [cart]);
  useEffect(() => save("naz_favs", favorites), [favorites]);
  useEffect(() => save("naz_addresses", addresses), [addresses]);
  useEffect(() => save("naz_address_id", selectedAddressId), [selectedAddressId]);
  useEffect(() => save("naz_orders", orders), [orders]);
  useEffect(() => save("naz_wallet", wallet), [wallet]);
  useEffect(() => save("naz_pro", proActive), [proActive]);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view, sub]);

  /* escape closes top-most layer */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (productModal) setProductModal(null);
      else if (storePicker) setStorePicker(false);
      else if (replacePrompt) setReplacePrompt(null);
      else if (sheet) setSheet(null);
      else if (cartDrawer) setCartDrawer(false);
      else if (sub) setSub(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [productModal, storePicker, replacePrompt, sheet, cartDrawer, sub]);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  };

  /* ---------- derived ---------- */
  const cartCount = useMemo(() => Object.values(cart.items).reduce((a, b) => a + b, 0), [cart]);
  const subtotal = useMemo(
    () => Object.entries(cart.items).reduce((sum, [id, qty]) => sum + productPrice(Number(id)) * qty, 0),
    [cart],
  );
  const cartStore = storeById(cart.storeId) ?? null;
  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) ?? addresses[0];

  const discountAmount = useMemo(() => {
    if (!appliedCode) return 0;
    if (appliedCode === "NAZ60") return Math.min(60000, subtotal);
    if (appliedCode === "NAZ10") return Math.min(Math.round(subtotal * 0.1), 50000);
    if (appliedCode === "NAZARABAD") return subtotal >= 400000 ? 25000 : 0;
    return 0;
  }, [appliedCode, subtotal]);

  const deliveryFee = cartCount === 0 ? 0 : subtotal >= 400000 ? 0 : (cartStore?.fee ?? 35000);
  const payable = Math.max(0, subtotal - discountAmount + deliveryFee);

  /* ---------- actions ---------- */
  const qtyOf = (id: number) => cart.items[id] ?? 0;

  const handleAdd = (p: Product, fromStoreId?: number) => {
    if (cartCount > 0 && fromStoreId && cart.storeId && fromStoreId !== cart.storeId) {
      setReplacePrompt({ product: p, storeId: fromStoreId });
      return;
    }
    setCart((c) => ({ storeId: c.storeId ?? fromStoreId ?? null, items: { ...c.items, [p.id]: (c.items[p.id] ?? 0) + 1 } }));
    if (cartCount === 0) showToast(`${p.name} به سبد اضافه شد`);
  };

  const handleDec = (id: number) =>
    setCart((c) => {
      const items = { ...c.items };
      if ((items[id] ?? 0) <= 1) delete items[id];
      else items[id] -= 1;
      return { storeId: Object.keys(items).length === 0 ? null : c.storeId, items };
    });

  const clearCart = () => {
    setCart({ storeId: null, items: {} });
    setAppliedCode(null);
  };

  const toggleFav = (id: number) => {
    setFavorites((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
    showToast(favorites.includes(id) ? "از علاقه‌مندی‌ها حذف شد" : "به علاقه‌مندی‌ها اضافه شد");
  };

  const applyCode = async (code: string) => {
    const code0 = code.trim().toUpperCase();
    if (!code0) return;
    const res = await api.promos.apply(code0, subtotal);
    if (!res.applied) return showToast(code0 === "NAZARABAD" ? "این کد برای خرید بالای ۴۰۰ هزار تومان است" : "کد تخفیف معتبر نیست");
    setAppliedCode(code0);
    showToast("کد تخفیف اعمال شد");
  };

  const placeOrder = async () => {
    if (!selectedAddress) return showToast("ابتدا آدرس تحویل را انتخاب کنید");
    if (!cart.storeId) {
      setStorePicker(true);
      return showToast("ابتدا فروشگاه را انتخاب کنید");
    }
    const order: Order = {
      id: `NM-${2841 + orders.length}`,
      storeId: cart.storeId,
      storeName: cartStore?.name ?? "فروشگاه",
      items: Object.entries(cart.items).map(([id, qty]) => ({ id: Number(id), name: productName(Number(id)), qty, price: productPrice(Number(id)) })),
      total: payable,
      addressTitle: selectedAddress.title,
      slot: "ارسال فوری",
      status: 1,
      time: new Date().toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }),
    };
    await api.orders.place(order);
    setOrders((o) => [order, ...o]);
    setCart({ storeId: null, items: {} });
    setAppliedCode(null);
    setSub({ name: "done", order });
  };

  const reorder = (o: Order) => {
    const items: Record<number, number> = {};
    o.items.forEach((i) => (items[i.id] = i.qty));
    setCart({ storeId: o.storeId, items });
    showToast("اقلام سفارش قبلی به سبد اضافه شد");
    if (isDesktop()) setCartDrawer(true);
    else setView("cart");
  };

  const go = (v: View) => {
    setMenuOpen(false);
    if (v === "cart" && isDesktop()) {
      setCartDrawer(true);
      return;
    }
    setView(v);
    setSub(null);
  };

  const openAddress = (ret: "home" | "checkout") => {
    setSubReturn(ret);
    setSub({ name: "address" });
  };

  const c: AppCtx = {
    user,
    logout: () => {
      setUser(null);
      setMenuOpen(false);
      try {
        localStorage.removeItem("naz_user");
      } catch { /* ignore */ }
      showToast("با موفقیت خارج شدید");
    },
    view,
    go,
    sub,
    openSub: (s) => {
      setMenuOpen(false);
      setSub(s);
    },
    closeSub: () => setSub(null),
    openAddress,
    subReturn,
    qtyOf,
    handleAdd,
    handleDec,
    clearCart,
    cardHandlers: (fromStoreId?: number) => ({
      qtyOf,
      onAdd: (p) => handleAdd(p, fromStoreId),
      onDec: handleDec,
      onOpen: (p) => setProductModal(p),
      isFav: (id) => favorites.includes(id),
      onFav: toggleFav,
    }),
    favorites,
    isFav: (id) => favorites.includes(id),
    toggleFav,
    addresses,
    setAddresses,
    selectedAddressId,
    setSelectedAddressId,
    selectedAddress,
    pickedPin,
    setPickedPin,
    pickedLabel,
    setPickedLabel,
    cart,
    cartCount,
    subtotal,
    cartStore,
    appliedCode,
    setAppliedCode,
    discountAmount,
    deliveryFee,
    payable,
    applyCode,
    placeOrder,
    reorder,
    orders,
    wallet,
    setWallet,
    proActive,
    setProActive,
    productModal,
    openProduct: (p) => setProductModal(p),
    closeProduct: () => setProductModal(null),
    storePicker,
    openStorePicker: () => setStorePicker(true),
    closeStorePicker: () => setStorePicker(false),
    replacePrompt,
    confirmReplace: () => {
      if (!replacePrompt) return;
      setCart({ storeId: replacePrompt.storeId, items: { [replacePrompt.product.id]: 1 } });
      setReplacePrompt(null);
      showToast("سبد جدید ساخته شد");
    },
    closeReplace: () => setReplacePrompt(null),
    pickStore: (id) => setCart((cc) => ({ ...cc, storeId: id })),
    sheet,
    setSheet,
    cartDrawer,
    setCartDrawer,
    toast: showToast,
  };

  /* ---------- auth gate ---------- */
  if (!user) {
    return <AuthPage onLogin={(u) => { setUser(u); save("naz_user", u); showToast(`خوش آمدید، ${u.firstName}!`); }} />;
  }

  /* ---------- content ---------- */
  let content: React.ReactNode;
  if (sub?.name === "checkout") content = <CheckoutView c={c} />;
  else if (sub?.name === "done") content = <DoneView c={c} order={sub.order} />;
  else if (sub?.name === "store") content = <StorePage c={c} storeId={sub.id} />;
  else if (sub?.name === "category") content = <CategoryPage c={c} catId={sub.id} />;
  else if (sub?.name === "search") content = <SearchPage c={c} />;
  else if (sub?.name === "favorites") content = <FavoritesPage c={c} />;
  else if (sub?.name === "map") content = <MapPage c={c} />;
  else if (sub?.name === "stores") content = <StoresPage c={c} />;
  else if (view === "easy") content = <EasyPage c={c} />;
  else if (view === "orders") content = <OrdersView c={c} />;
  else if (view === "account") content = <AccountView c={c} />;
  else if (view === "cart")
    content = (
      <div className="fade-rise mx-auto min-h-dvh w-full max-w-3xl pb-36">
        <div className="sticky top-0 z-30 border-b border-line bg-white/92 backdrop-blur">
          <div className="flex items-center justify-between px-4 pt-3.5">
            <h2 className="text-[17px] font-black text-ink">سبدها</h2>
            <button type="button" onClick={() => openAddress("home")} className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1.5 text-[11px] font-extrabold shadow-sm">
              <ChevronDown className="h-3.5 w-3.5" /> ارسال به {selectedAddress?.title ?? "خانه"}
            </button>
          </div>
          <p className="truncate px-4 pb-3 pt-1.5 text-[11px] font-medium text-muted">
            شهرستان نظرآباد، {selectedAddress?.address ?? ""}، {selectedAddress?.detail ?? ""}
          </p>
        </div>
        <CartBody c={c} />
      </div>
    );
  else content = <HomePage c={c} />;

  return (
    <div className="min-h-dvh bg-app">
      {/* desktop header */}
      <header className="sticky top-0 z-50 hidden border-b border-line bg-white/95 backdrop-blur lg:block">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center gap-4 px-6">
          <button type="button" onClick={() => go("home")} aria-label="صفحه اصلی" className="shrink-0 transition hover:opacity-80">
            <Wordmark twoLine size="text-[19px]" />
          </button>

          <nav className="hidden shrink-0 items-center gap-1 xl:flex" aria-label="ناوبری اصلی">
            <button type="button" onClick={() => c.openSub({ name: "stores" })} className="rounded-lg px-3.5 py-2 text-[13px] font-bold text-ink/70 transition hover:bg-[#f4f3f0] hover:text-ink">
              فروشگاه‌ها
            </button>
            <button type="button" onClick={() => go("easy")} className={`rounded-lg px-3.5 py-2 text-[13px] font-bold transition hover:bg-[#f4f3f0] ${view === "easy" ? "text-brand" : "text-ink/70 hover:text-ink"}`}>
              خرید راحت
            </button>
            <button type="button" onClick={() => go("orders")} className={`rounded-lg px-3.5 py-2 text-[13px] font-bold transition hover:bg-[#f4f3f0] ${view === "orders" ? "text-brand" : "text-ink/70 hover:text-ink"}`}>
              سفارش‌ها
            </button>
            <button type="button" onClick={() => c.setSheet("codes")} className="rounded-lg px-3.5 py-2 text-[13px] font-bold text-ink/70 transition hover:bg-[#f4f3f0] hover:text-ink">
              کدهای تخفیف
            </button>
          </nav>

          <div className="mr-auto flex min-w-0 flex-1 items-center justify-end gap-2 lg:pr-4">
            <button type="button" onClick={() => c.openSub({ name: "search" })} className="hidden h-11 min-w-0 flex-1 items-center gap-2 rounded-2xl bg-[#f4f3f0] px-4 text-[12.5px] font-medium text-muted transition hover:bg-line max-w-xl md:flex">
              <Search className="h-4.5 w-4.5 shrink-0" />
              <span className="truncate">جستجو بین کالا و برند و فروشگاه</span>
            </button>
            <button
              type="button"
              onClick={() => openAddress("home")}
              className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-line bg-white px-3.5 text-[11.5px] font-extrabold text-ink transition hover:border-brand/50"
            >
              <MapPin className="h-4 w-4 text-brand" />
              <span className="max-w-36 truncate">{selectedAddress ? `ارسال به ${selectedAddress.title}` : "موقعیت خود را انتخاب کنید"}</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>

            <button type="button" onClick={() => setCartDrawer(true)} aria-label="سبد خرید" className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition hover:bg-[#f4f3f0] active:scale-90">
              <ShoppingCart className="h-6 w-6 text-ink" />
              {cartCount > 0 && <span className="pop-in absolute -top-0.5 left-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#eb2d20] px-1 text-[10px] font-black text-white">{pd(cartCount)}</span>}
            </button>

            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen}
                aria-label="منوی حساب کاربری"
                className={`flex h-11 w-11 items-center justify-center rounded-full border-2 transition ${menuOpen ? "border-brand bg-brand-soft" : "border-line bg-brand-soft hover:border-brand/50"}`}
              >
                <span className="text-[12px] font-black text-brand">{(user.firstName || "م").slice(0, 1)}</span>
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="dropdown-in absolute left-0 top-[58px] z-50 w-64 rounded-2xl border border-line bg-white p-2 shadow-2xl">
                    <div className="flex items-center gap-3 rounded-xl bg-[#faf9f6] p-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[13px] font-black text-brand">{(user.firstName || "م").slice(0, 1)}</span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-black text-ink">{user.firstName} {user.lastName}</p>
                        <p className="mt-0.5 text-[10.5px] font-medium text-muted" dir="ltr" style={{ textAlign: "right" }}>{user.phone ? pd(user.phone) : "حساب مهمان"}</p>
                      </div>
                    </div>
                    <div className="mt-1.5 space-y-0.5">
                      {([
                        { icon: UserCheck, label: "احراز هویت", fn: () => c.setSheet("verify") },
                        { icon: TicketPercent, label: "کدهای تخفیف من", fn: () => c.setSheet("codes") },
                        { icon: Wallet, label: "کیف پول", fn: () => c.setSheet("wallet") },
                        { icon: ClipboardList, label: "سفارش‌های من", fn: () => go("orders") },
                        { icon: Store, label: "فروشگاه‌های اطراف", fn: () => c.openSub({ name: "stores" }) },
                        { icon: Info, label: "قوانین و مقررات", fn: () => c.setSheet("rules") },
                      ] as const).map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            item.fn();
                            setMenuOpen(false);
                          }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-right text-[12.5px] font-bold text-ink transition hover:bg-brand-soft"
                        >
                          <item.icon className="h-4 w-4 text-muted" /> {item.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={c.logout}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-right text-[12.5px] font-bold text-red-600 transition hover:bg-red-50"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                          <path d="M16 17l5-5-5-5" />
                          <path d="M21 12H9" />
                        </svg>
                        خروج
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main>{content}</main>

      {/* footer */}
      <footer className="mt-4 border-t border-line bg-white lg:mt-8">
        <div className="mx-auto max-w-7xl px-5 pb-28 pt-8 lg:px-8 lg:pb-10">
          <div className="grid gap-8 md:grid-cols-[1.3fr_1fr_1fr]">
            <div>
              <Wordmark twoLine />
              <p className="mt-3 max-w-sm text-[12px] font-medium leading-6 text-muted">
                خرید سوپرمارکتی فوری از سوپرمارکت‌های محلی شهرستان نظرآباد — از خانه سفارش دهید، تا ۴۵ دقیقه دیگر تحویل بگیرید.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {["نظرآباد", "تنکمان", "سیدجمال‌الدین"].map((a) => (
                  <span key={a} className="rounded-full bg-brand-soft px-2.5 py-1 text-[10px] font-extrabold text-brand-dark">{a}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[12px] font-black text-ink">ناز مارکت</p>
              <ul className="mt-3 space-y-2.5">
                {([
                  { label: "قوانین و مقررات", fn: () => c.setSheet("rules") },
                  { label: "حریم خصوصی", fn: () => c.setSheet("privacy") },
                  { label: "پشتیبانی", fn: () => c.setSheet("support") },
                  { label: "کدهای تخفیف", fn: () => c.setSheet("codes") },
                ] as const).map((l) => (
                  <li key={l.label}>
                    <button type="button" onClick={l.fn} className="text-[12px] font-medium text-muted transition hover:text-brand">
                      {l.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted">نسخه: ۱.۴۰.۳۸-at</p>
              <p className="mt-2 text-[11px] font-medium leading-6 text-muted">© ۱۴۰ ناز مارکت — تمام حقوق محفوظ است.</p>
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-[11px] font-black text-ink transition hover:border-brand hover:text-brand"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 19V5" /><path d="M5 12l7-7 7 7" /></svg>
                بازگشت به بالا
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* mobile bottom nav */}
      {!sub && (
        <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[430px] border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="ناوبری اصلی">
          <div className="grid h-[68px] grid-cols-5">
            {([
              { key: "home", label: "خانه", icon: Home },
              { key: "easy", label: "خرید راحت", icon: Search, badge: 1 },
              { key: "cart", label: "سبد خرید", icon: ShoppingCart, badge: cartCount },
              { key: "orders", label: "سفارش‌ها", icon: ClipboardList },
              { key: "account", label: "حساب کاربری", icon: Users },
            ] as { key: View; label: string; icon: typeof Home; badge?: number }[]).map((item) => {
              const active = view === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => go(item.key)}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex flex-col items-center justify-center gap-1 text-[10px] font-extrabold transition active:scale-95 ${active ? "text-brand" : "text-[#a8a49e]"}`}
                >
                  <span className="relative">
                    <item.icon className="h-6 w-6" strokeWidth={active ? 2.3 : 1.8} />
                    {!!item.badge && (
                      <span className="pop-in absolute -left-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#eb2d20] px-1 text-[8.5px] font-black text-white">{pd(item.badge)}</span>
                    )}
                  </span>
                  {item.label}
                  {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-brand" />}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* address overlays */}
      {sub?.name === "address" && (
        <div className="fixed inset-0 z-[80] flex items-stretch justify-center bg-ink/50 backdrop-blur-[2px] lg:items-center lg:p-6" role="dialog" aria-modal="true" aria-label="انتخاب آدرس">
          <div className="relative flex w-full max-w-[430px] flex-col bg-white app-scroll lg:h-[min(690px,90dvh)] lg:max-w-2xl lg:overflow-hidden lg:rounded-[24px] lg:shadow-2xl">
            <AddressSelect c={c} />
          </div>
        </div>
      )}
      {sub?.name === "address-form" && (
        <div className="fixed inset-0 z-[80] flex items-stretch justify-center bg-ink/50 backdrop-blur-[2px] lg:items-center lg:p-6" role="dialog" aria-modal="true" aria-label="جزئیات آدرس">
          <div className="relative flex w-full max-w-[430px] flex-col bg-white lg:h-[min(720px,92dvh)] lg:max-w-xl lg:overflow-y-auto lg:rounded-[24px] lg:shadow-2xl app-scroll">
            <AddressForm c={c} />
          </div>
        </div>
      )}

      {/* global overlays */}
      <ProductModal c={c} />
      {storePicker && <StorePickerSheet c={c} />}
      <ReplacePrompt c={c} />
      <AccountSheetHost c={c} />
      {cartDrawer && <CartDrawer c={c} />}

      {toast && (
        <div role="status" className="toast-in fixed bottom-24 left-1/2 z-[95] flex w-max max-w-[88vw] items-center gap-2 rounded-full bg-ink px-4 py-3 text-[11.5px] font-black text-white shadow-2xl lg:bottom-6">
          <span className="truncate">{toast}</span>
        </div>
      )}
    </div>
  );
}

/* product lookups */
function productPrice(id: number): number {
  return products.find((p) => p.id === id)?.price ?? 0;
}
function productName(id: number): string {
  return products.find((p) => p.id === id)?.name ?? "";
}

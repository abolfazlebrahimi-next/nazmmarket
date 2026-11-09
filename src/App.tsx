import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ClipboardList,
  Home,
  Info,
  LoaderCircle,
  LogOut,
  MapPin,
  Search,
  ShoppingCart,
  Store,
  TicketPercent,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { Wordmark, load, pd, save } from "./components/ui";
import { ApiError, api, tokenStore } from "./api/client";
import type { ServerState } from "./api/client";
import type { AppCtx, Sub, View } from "./ctx";
import type { Address, CartState, Order, Product, User } from "./data";
import { hydrateCatalog, products, storeById } from "./data";
import AuthPage from "./pages/Auth";
import { AddressForm, AddressSelect } from "./pages/AddressFlow";
import { CartBody, CartDrawer, CheckoutView, DoneView } from "./pages/CartFlow";
import OrdersView from "./pages/Orders";
import { AccountDetailPage, AccountSheetHost, AccountView } from "./pages/Account";
import { EasyPage, FavoritesPage, HomePage, MapPage, StoresPage } from "./pages/Home";
import { CategoryPage, ProductModal, ReplacePrompt, SearchPage, StorePage, StorePickerSheet } from "./pages/Store";

const isDesktop = () => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;

/** Address identity without database ids — used to avoid pointless sync loops. */
const addrSig = (list: Address[]) =>
  JSON.stringify(list.map((a) => [a.title, a.address, a.detail, a.phone, a.type, a.lat ?? null, a.lng ?? null]));

export default function App() {
  const [token, setToken] = useState<string | null>(() => tokenStore.get());
  const [user, setUser] = useState<User | null>(() => load<User | null>("naz_user", null));
  const [booting, setBooting] = useState(true);
  const [apiOnline, setApiOnline] = useState(true);
  const [, setCatalogTick] = useState(0);

  const [view, setView] = useState<View>("home");
  const [sub, setSub] = useState<Sub>(null);
  const [subReturn, setSubReturn] = useState<"home" | "checkout">("home");

  const [cart, setCart] = useState<CartState>(() => load("naz_cart", { storeId: null, items: {} }));
  const [favorites, setFavorites] = useState<number[]>(() => load("naz_favs", []));
  const [addresses, setAddresses] = useState<Address[]>(() => load<Address[]>("naz_addresses", []));
  const [selectedAddressId, setSelectedAddressId] = useState<number>(() => load("naz_address_id", 0));
  const [orders, setOrders] = useState<Order[]>(() => load("naz_orders", []));
  const [wallet, setWallet] = useState<number>(() => load("naz_wallet", 0));
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

  /** last payload pushed to the server, to keep the sync effects quiet */
  const synced = useRef({ cart: "", favs: "", addrs: "", ready: false });
  const latest = useRef({ cart, favorites, addresses });
  latest.current = { cart, favorites, addresses };

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  };

  /* ---------------- boot: catalog + session hydration ---------------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const catalog = await api.catalog();
        if (!alive) return;
        hydrateCatalog(catalog);
        setCatalogTick((t) => t + 1);
      } catch {
        if (alive) setApiOnline(false);
      }

      const savedToken = tokenStore.get();
      if (savedToken) {
        try {
          const state = await api.state();
          if (!alive) return;
          applyServerState(state);
        } catch (err) {
          if (!alive) return;
          if (err instanceof ApiError && err.status === 401) {
            tokenStore.set(null);
            setToken(null);
            setUser(null);
            try {
              localStorage.removeItem("naz_user");
            } catch {
              /* ignore */
            }
          } else {
            setApiOnline(false);
          }
        }
      }
      if (alive) setBooting(false);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyServerState(state: ServerState) {
    const serverCart = state.cart ?? { storeId: null, items: {} };
    const serverItems = Object.keys(serverCart.items ?? {}).length;
    const localCart = latest.current.cart;
    const localItems = Object.keys(localCart.items ?? {}).length;

    /* a guest cart / wishlist is carried over into the account on first login */
    const nextCart = serverItems === 0 && localItems > 0 ? localCart : serverCart;
    const serverFavs = state.favorites ?? [];
    const nextFavs = serverFavs.length === 0 && latest.current.favorites.length > 0
      ? latest.current.favorites
      : serverFavs;

    const serverAddrs = state.addresses ?? [];
    const nextAddrs = serverAddrs.length === 0 && latest.current.addresses.length > 0
      ? latest.current.addresses
      : serverAddrs;

    setUser(state.user);
    setCart(nextCart);
    setFavorites(nextFavs);
    setAddresses(nextAddrs);
    setOrders(state.orders ?? []);
    setWallet(state.wallet ?? 0);
    synced.current = {
      cart: JSON.stringify({ storeId: nextCart.storeId, items: nextCart.items }),
      favs: [...nextFavs].sort((a, b) => a - b).join(","),
      addrs: addrSig(serverAddrs),
      ready: true,
    };
    save("naz_user", state.user);
  }

  /* ---------------- local persistence ---------------- */
  useEffect(() => save("naz_cart", cart), [cart]);
  useEffect(() => save("naz_favs", favorites), [favorites]);
  useEffect(() => save("naz_addresses", addresses), [addresses]);
  useEffect(() => save("naz_address_id", selectedAddressId), [selectedAddressId]);
  useEffect(() => save("naz_orders", orders), [orders]);
  useEffect(() => save("naz_wallet", wallet), [wallet]);

  /* ---------------- server sync (logged-in only) ---------------- */
  const canSync = Boolean(token) && apiOnline;

  useEffect(() => {
    if (!canSync || !synced.current.ready) return;
    const sig = JSON.stringify({ storeId: cart.storeId, items: cart.items });
    if (synced.current.cart === sig) return;
    const timer = window.setTimeout(() => {
      synced.current.cart = sig;
      api.cart.save(cart).catch(() => setApiOnline(false));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [cart, canSync]);

  useEffect(() => {
    if (!canSync || !synced.current.ready) return;
    const sig = [...favorites].sort((a, b) => a - b).join(",");
    if (synced.current.favs === sig) return;
    synced.current.favs = sig;
    api.favorites.save(favorites).catch(() => setApiOnline(false));
  }, [favorites, canSync]);

  useEffect(() => {
    if (!canSync || !synced.current.ready) return;
    const sig = addrSig(addresses);
    if (synced.current.addrs === sig) return;
    synced.current.addrs = sig;
    api.addresses
      .save(addresses)
      .then((res) => {
        const nextSig = addrSig(res.addresses);
        const sameAddress = (a: Address, b: Address) =>
          a.title === b.title && a.address === b.address && a.detail === b.detail && a.phone === b.phone &&
          a.type === b.type && (a.lat ?? null) === (b.lat ?? null) && (a.lng ?? null) === (b.lng ?? null);
        const selected = addresses.find((a) => a.id === selectedAddressId);
        const canonicalSelected = selected && res.addresses.find((a) => sameAddress(a, selected));
        if (canonicalSelected) setSelectedAddressId(canonicalSelected.id);
        synced.current.addrs = nextSig;
        if (JSON.stringify(res.addresses) !== JSON.stringify(addresses)) setAddresses(res.addresses);
      })
      .catch(() => setApiOnline(false));
  }, [addresses, canSync, selectedAddressId]);

  /* keep the selected address valid */
  useEffect(() => {
    if (addresses.length === 0) return;
    if (!addresses.some((a) => a.id === selectedAddressId)) setSelectedAddressId(addresses[0].id);
  }, [addresses, selectedAddressId]);

  /* scroll to top on navigation + escape closes top-most layer */
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view, sub]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (productModal) setProductModal(null);
      else if (storePicker) setStorePicker(false);
      else if (replacePrompt) setReplacePrompt(null);
      else if (sheet) setSheet(null);
      else if (cartDrawer) setCartDrawer(false);
      else if (menuOpen) setMenuOpen(false);
      else if (sub) setSub(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [productModal, storePicker, replacePrompt, sheet, cartDrawer, sub, menuOpen]);

  /* ---------------- derived ---------------- */
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

  /* ---------------- actions ---------------- */
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
    if (token && apiOnline) {
      try {
        const res = await api.promos.apply(code0, subtotal);
        if (!res.applied) return showToast(res.message ?? "کد تخفیف معتبر نیست");
        setAppliedCode(code0);
        showToast(res.message ?? "کد تخفیف اعمال شد");
        return;
      } catch (err) {
        if (err instanceof ApiError && err.status !== 0) {
          return showToast(err.message);
        }
      }
    }
    // offline / guest fallback
    if (code0 === "NAZ60") setAppliedCode(code0);
    else if (code0 === "NAZ10") setAppliedCode(code0);
    else if (code0 === "NAZARABAD" && subtotal >= 400000) setAppliedCode(code0);
    else return showToast("کد تخفیف معتبر نیست");
    showToast("کد تخفیف اعمال شد");
  };

  const placeOrder = async (extra?: { slot?: string; payment?: "online" | "cash" }) => {
    if (!selectedAddress) return showToast("ابتدا آدرس تحویل را انتخاب کنید");
    if (!cart.storeId || cartCount === 0) {
      setStorePicker(true);
      return showToast("ابتدا فروشگاه را انتخاب کنید");
    }

    if (token && apiOnline) {
      try {
        const { order } = await api.orders.place({
          storeId: cart.storeId,
          items: cart.items,
          addressId: selectedAddress.id,
          addressTitle: selectedAddress.title,
          addressText: `${selectedAddress.address}، ${selectedAddress.detail}`,
          slot: extra?.slot ?? "ارسال فوری",
          payment: extra?.payment ?? "online",
          promoCode: appliedCode,
        });
        setOrders((o) => [order, ...o]);
        setCart({ storeId: null, items: {} });
        setAppliedCode(null);
        setSub({ name: "done", order });
        return;
      } catch (err) {
        showToast(err instanceof ApiError ? err.message : "ثبت سفارش ناموفق بود");
        return;
      }
    }

    const order: Order = {
      id: `NM-${2841 + orders.length}`,
      storeId: cart.storeId,
      storeName: cartStore?.name ?? "فروشگاه",
      items: Object.entries(cart.items).map(([id, qty]) => ({
        id: Number(id),
        name: productName(Number(id)),
        qty,
        price: productPrice(Number(id)),
      })),
      subtotal,
      discount: discountAmount,
      delivery: deliveryFee,
      total: payable,
      addressTitle: selectedAddress.title,
      slot: extra?.slot ?? "ارسال فوری",
      payment: extra?.payment ?? "online",
      promoCode: appliedCode,
      status: 1,
      time: new Date().toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }),
    };
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

  const doLogout = async () => {
    try {
      if (token) await api.auth.logout();
    } catch {
      /* offline logout still clears the local session */
    }
    tokenStore.set(null);
    setToken(null);
    setUser(null);
    setMenuOpen(false);
    synced.current.ready = false;
    try {
      localStorage.removeItem("naz_user");
    } catch {
      /* ignore */
    }
    showToast(token ? "با موفقیت خارج شدید" : "برای ادامه وارد حساب شوید");
  };

  const c: AppCtx = {
    user,
    isGuest: !token,
    logout: doLogout,
    updateUser: (u: User) => {
      setUser(u);
      save("naz_user", u);
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
    if (booting && token) return <Splash />;
    return (
      <AuthPage
        onAuth={(res) => {
          const isGuest = !res.token;
          tokenStore.set(isGuest ? null : res.token);
          setToken(isGuest ? null : res.token);
          setUser(res.user);
          save("naz_user", res.user);
          if (isGuest) {
            showToast("حالت مهمان: اطلاعات فقط روی این دستگاه ذخیره می‌شود");
          } else {
            showToast(`خوش آمدید${res.user.firstName ? `، ${res.user.firstName}` : ""}!`);
            api
              .state()
              .then(applyServerState)
              .catch(() => setApiOnline(false));
          }
        }}
      />
    );
  }

  if (booting) return <Splash />;

  /* ---------- content ---------- */
  let content: React.ReactNode;
  if (sub?.name === "checkout") content = <CheckoutView c={c} />;
  else if (sub?.name === "done") content = <DoneView c={c} order={sub.order} />;
  else if (sub?.name === "store") content = <StorePage c={c} storeId={sub.id} />;
  else if (sub?.name === "category") content = <CategoryPage c={c} catId={sub.id} />;
  else if (sub?.name === "search") content = <SearchPage c={c} />;
  else if (sub?.name === "favorites") content = <FavoritesPage c={c} />;
  else if (sub?.name === "account-detail") content = <AccountDetailPage c={c} kind={sub.id} />;
  else if (sub?.name === "map") content = <MapPage c={c} />;
  else if (sub?.name === "stores") content = <StoresPage c={c} />;
  else if (view === "easy") content = <EasyPage c={c} />;
  else if (view === "orders") content = <OrdersView c={c} />;
  else if (view === "account") content = <AccountView c={c} />;
  else if (view === "cart")
    content = (
      <div className="fade-rise mx-auto min-h-dvh w-full max-w-3xl pb-36">
        <div className="sticky top-0 z-30 border-b border-line bg-white/92 px-4 py-3.5 backdrop-blur md:top-16">
          <h2 className="text-[16px] font-black text-ink">سبد خرید</h2>
        </div>
        <CartBody c={c} />
      </div>
    );
  else content = <HomePage c={c} />;

  const navItems: { key: View; label: string; active: boolean }[] = [
    { key: "home", label: "خانه", active: view === "home" && !sub },
    { key: "easy", label: "خرید راحت", active: view === "easy" },
    { key: "orders", label: "سفارش‌ها", active: view === "orders" },
  ];

  return (
    <div className="min-h-dvh bg-app">
      {/* ---------- one header for every screen size ---------- */}
      <header
        className={`${sub ? "hidden md:block" : "block"} z-50 border-b border-line bg-white/95 backdrop-blur md:sticky md:top-0`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 md:px-6">
          <button type="button" onClick={() => go("home")} aria-label="صفحه اصلی" className="shrink-0 transition hover:opacity-80">
            <Wordmark size="text-[20px]" />
          </button>

          <nav className="hidden items-center gap-0.5 md:flex" aria-label="ناوبری اصلی">
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => go(item.key)}
                aria-current={item.active ? "page" : undefined}
                className={`rounded-xl px-3 py-2 text-[12.5px] font-bold transition ${
                  item.active ? "bg-brand-soft text-brand-dark" : "text-ink/70 hover:bg-[#f4f3f0] hover:text-ink"
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => c.openSub({ name: "stores" })}
              className={`rounded-xl px-3 py-2 text-[12.5px] font-bold transition ${
                sub?.name === "stores" ? "bg-brand-soft text-brand-dark" : "text-ink/70 hover:bg-[#f4f3f0] hover:text-ink"
              }`}
            >
              فروشگاه‌ها
            </button>
          </nav>

          <div className="mr-auto flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => c.openSub({ name: "search" })}
              className="hidden h-10 min-w-0 max-w-md flex-1 items-center gap-2 rounded-xl bg-[#f4f3f0] px-3.5 text-[12px] font-medium text-muted transition hover:bg-line md:flex"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="truncate">جستجو بین کالا، برند و فروشگاه</span>
            </button>

            <button
              type="button"
              onClick={() => openAddress("home")}
              className="hidden h-10 shrink-0 items-center gap-1.5 rounded-xl border border-line bg-white px-3 text-[11.5px] font-extrabold text-ink transition hover:border-brand/50 lg:flex"
            >
              <MapPin className="h-3.5 w-3.5 text-brand" />
              <span className="max-w-28 truncate">{selectedAddress?.title ?? "انتخاب آدرس"}</span>
              <ChevronDown className="h-3 w-3 text-muted" />
            </button>

            <button
              type="button"
              onClick={() => go("cart")}
              aria-label="سبد خرید"
              className="relative hidden h-10 items-center gap-2 rounded-xl bg-ink px-3.5 text-[11.5px] font-black text-white transition hover:brightness-110 md:flex"
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="tabular-nums">{pd(cartCount)}</span>
            </button>

            <button
              type="button"
              onClick={() => openAddress("home")}
              aria-label="تغییر آدرس"
              className="flex h-8 max-w-[72px] items-center gap-1 rounded-lg bg-brand-soft px-2 text-[10px] font-bold text-brand-dark lg:hidden"
            >
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{selectedAddress?.title ?? "آدرس"}</span>
            </button>
            <button
              type="button"
              onClick={() => c.openSub({ name: "search" })}
              aria-label="جستجو"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f4f3f0] text-ink md:hidden"
            >
              <Search className="h-4 w-4" />
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen}
                aria-label="منوی حساب کاربری"
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition ${
                  menuOpen ? "border-brand bg-brand-soft" : "border-line bg-brand-soft hover:border-brand/50"
                }`}
              >
                <span className="text-[12px] font-black text-brand">
                  {(user.firstName || "م").slice(0, 1)}
                </span>
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="dropdown-in absolute left-0 top-12 z-50 w-64 rounded-2xl border border-line bg-white p-2 shadow-2xl">
                    <div className="flex items-center gap-3 rounded-xl bg-[#faf9f6] p-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[13px] font-black text-brand">
                        {(user.firstName || "م").slice(0, 1)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-black text-ink">
                          {[user.firstName, user.lastName].filter(Boolean).join(" ") || "کاربر ناز"}
                        </p>
                        <p className="mt-0.5 text-[10.5px] font-medium text-muted" dir="ltr" style={{ textAlign: "right" }}>
                          {user.phone ? pd(user.phone) : "حساب مهمان"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-1.5 space-y-0.5">
                      {([
                        { icon: UserRound, label: "حساب کاربری", fn: () => go("account") },
                        { icon: ClipboardList, label: "سفارش‌های من", fn: () => go("orders") },
                        { icon: Wallet, label: "کیف پول", fn: () => c.setSheet("wallet") },
                        { icon: TicketPercent, label: "کدهای تخفیف من", fn: () => c.openSub({ name: "account-detail", id: "codes" }) },
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
                        onClick={doLogout}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-right text-[12.5px] font-bold text-red-600 transition hover:bg-red-50"
                      >
                        <LogOut className="h-4 w-4" /> {token ? "خروج از حساب" : "ورود به حساب"}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

      </header>

      {!apiOnline && (
        <div className="bg-amber-50 px-4 py-2 text-center text-[10.5px] font-bold text-amber-800">
          اتصال به سرور برقرار نیست — اطلاعات موقتاً روی همین دستگاه ذخیره می‌شود.
        </div>
      )}

      <main className={`${sub ? "pb-0" : "pb-24 md:pb-0"}`}>{content}</main>

      {/* footer */}
      {!sub && (
        <footer className="mt-4 border-t border-line bg-white">
          <div className="mx-auto max-w-7xl px-5 pb-24 pt-8 md:pb-10 lg:px-8">
            <div className="grid gap-8 md:grid-cols-[1.3fr_1fr_1fr]">
              <div>
                <Wordmark size="text-[20px]" />
                <p className="mt-3 max-w-sm text-[12px] font-medium leading-6 text-muted">
                  خرید سوپرمارکتی فوری از سوپرمارکت‌های محلی شهرستان نظرآباد — از خانه سفارش دهید و تا ۴۵ دقیقه دیگر تحویل بگیرید.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {["نظرآباد", "محمد آباد", "علی آباد", "سیدجمالدین", "تنکمان"].map((a) => (
                    <span key={a} className="rounded-full bg-brand-soft px-2.5 py-1 text-[10px] font-extrabold text-brand-dark">
                      {a}
                    </span>
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
                    { label: "کدهای تخفیف", fn: () => c.openSub({ name: "account-detail", id: "codes" }) },
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
                <p className="text-[11px] font-medium text-muted">نسخه: ۲.۰.۰ · متصل به سرور ناز</p>
                <p className="mt-2 text-[11px] font-medium leading-6 text-muted">© ۱۴۰۴ ناز مارکت — تمام حقوق محفوظ است.</p>
              </div>
            </div>
          </div>
        </footer>
      )}

      {/* ---------- mobile bottom nav only ---------- */}
      {!sub && (
        <nav
          className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
          aria-label="ناوبری اصلی"
        >
          <div className="grid h-14 grid-cols-5">
            {([
              { key: "home", label: "خانه", icon: Home },
              { key: "easy", label: "خرید راحت", icon: Search },
              { key: "cart", label: "سبد خرید", icon: ShoppingCart, badge: cartCount },
              { key: "orders", label: "سفارش‌ها", icon: ClipboardList },
              { key: "account", label: "حساب", icon: Users },
            ] as { key: View; label: string; icon: typeof Home; badge?: number }[]).map((item) => {
              const active = view === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => go(item.key)}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex flex-col items-center justify-center gap-0.5 text-[9px] font-semibold transition active:scale-95 ${
                    active ? "text-brand" : "text-[#a8a49e]"
                  }`}
                >
                  <span className="relative">
                    <item.icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.7} />
                    {!!item.badge && (
                      <span className="pop-in absolute -left-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#eb2d20] px-1 text-[8.5px] font-black text-white">
                        {pd(item.badge)}
                      </span>
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
        <div className="fixed inset-0 z-[80] flex items-stretch justify-center bg-ink/50 backdrop-blur-[2px] md:items-center md:p-6" role="dialog" aria-modal="true" aria-label="انتخاب آدرس">
          <div className="relative flex w-full max-w-[430px] flex-col bg-white app-scroll md:h-[min(690px,90dvh)] md:max-w-2xl md:overflow-hidden md:rounded-[24px] md:shadow-2xl">
            <AddressSelect c={c} />
          </div>
        </div>
      )}
      {sub?.name === "address-form" && (
        <div className="fixed inset-0 z-[80] flex items-stretch justify-center bg-ink/50 backdrop-blur-[2px] md:items-center md:p-6" role="dialog" aria-modal="true" aria-label="جزئیات آدرس">
          <div className="relative flex w-full max-w-[430px] flex-col bg-white app-scroll md:h-[min(720px,92dvh)] md:max-w-xl md:overflow-y-auto md:rounded-[24px] md:shadow-2xl">
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
        <div
          role="status"
          className="toast-in fixed bottom-24 left-1/2 z-[95] flex w-max max-w-[88vw] items-center gap-2 rounded-full bg-ink px-4 py-3 text-[11.5px] font-black text-white shadow-2xl md:bottom-6"
        >
          <span className="truncate">{toast}</span>
        </div>
      )}
    </div>
  );
}

function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-app">
      <Wordmark twoLine size="text-[28px]" />
      <LoaderCircle className="h-5 w-5 animate-spin text-brand" />
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

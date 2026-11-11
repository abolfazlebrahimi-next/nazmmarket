import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ClipboardList,
  Home,
  Info,
  LogOut,
  MapPin,
  Search,
  ShoppingCart,
  Store,
  TicketPercent,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Wordmark, load, pd, save } from "./components/ui";
import { ApiError, api, tokenStore } from "./api/client";
import type { ServerState } from "./api/client";
import type { AppCtx, Sub, View } from "./ctx";
import type { Address, CartState, Order, Product, User } from "./data";
import { hydrateCatalog, products, storeById, stores } from "./data";
import { readDiscountCode } from "./discountCodes";
import type { DiscountCode } from "./discountCodes";
import AuthPage from "./pages/Auth";
import { AddressForm, AddressSelect } from "./pages/AddressFlow";
import { CartBody, CartDrawer, CheckoutView, DoneView } from "./pages/CartFlow";
import OrdersView from "./pages/Orders";
import {
  AccountDetailPage,
  AccountSheetHost,
  AccountView,
} from "./pages/Account";
import {
  EasyPage,
  FavoritesPage,
  HomePage,
  MapPage,
  StoresPage,
} from "./pages/Home";
import {
  CategoryPage,
  ProductModal,
  ReplacePrompt,
  SearchPage,
  StorePage,
  StorePickerSheet,
} from "./pages/Store";

const isDesktop = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(min-width: 768px)").matches;

/** Address identity without database ids — used to avoid pointless sync loops. */
const addrSig = (list: Address[]) =>
  JSON.stringify(
    list.map((a) => [
      a.title,
      a.address,
      a.detail,
      a.phone,
      a.type,
      a.lat ?? null,
      a.lng ?? null,
    ]),
  );

export default function App() {
  const [token, setToken] = useState<string | null>(() => tokenStore.get());
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [apiOnline, setApiOnline] = useState(true);
  const [, setCatalogTick] = useState(0);

  const [view, setView] = useState<View>("home");
  const [sub, setSub] = useState<Sub>(null);
  const [subReturn, setSubReturn] = useState<"home" | "checkout">("home");

  const [cart, setCart] = useState<CartState>(() =>
    load("naz_cart", { storeId: null, items: {} }),
  );
  const [favorites, setFavorites] = useState<number[]>(() =>
    load("naz_favs", []),
  );
  const [addresses, setAddresses] = useState<Address[]>(() =>
    load<Address[]>("naz_addresses", []),
  );
  const [selectedAddressId, setSelectedAddressId] = useState<number>(() =>
    load("naz_address_id", 0),
  );
  const [orders, setOrders] = useState<Order[]>([]);
  const [firstOrderEligible, setFirstOrderEligible] = useState(false);
  const [firstOrderProductId, setFirstOrderProductId] = useState<number | null>(
    null,
  );
  const [wallet, setWallet] = useState<number>(0);
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [appliedPromo, setAppliedPromo] = useState<DiscountCode | null>(null);

  const [pickedPin, setPickedPin] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [pickedLabel, setPickedLabel] = useState("");
  const [productModal, setProductModal] = useState<Product | null>(null);
  const [storePicker, setStorePicker] = useState(false);
  const [replacePrompt, setReplacePrompt] = useState<{
    product: Product;
    storeId: number;
  } | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  const [cartDrawer, setCartDrawer] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  /** Shown as an overlay when a guest tries to reach a login-only action (checkout). */
  const [showAuth, setShowAuth] = useState(false);
  /** View to return to after a successful guest login (e.g. "checkout"). */
  const [postLogin, setPostLogin] = useState<View | "checkout" | null>(null);

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
        setCart((current) => {
          if (!stores.some((store) => store.id === current.storeId))
            return { storeId: null, items: {} };
          const validItems = Object.fromEntries(
            Object.entries(current.items).filter(([id, qty]) => {
              const product = products.find((item) => item.id === Number(id));
              return (
                product?.active &&
                product.storeId === current.storeId &&
                Number(qty) > 0
              );
            }),
          );
          return {
            storeId: Object.keys(validItems).length ? current.storeId : null,
            items: validItems,
          };
        });
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
    const candidateCart =
      serverItems === 0 && localItems > 0 ? localCart : serverCart;
    const nextItems = stores.some((store) => store.id === candidateCart.storeId)
      ? Object.fromEntries(
          Object.entries(candidateCart.items ?? {}).filter(([id, qty]) => {
            const product = products.find((item) => item.id === Number(id));
            return (
              product?.active &&
              product.storeId === candidateCart.storeId &&
              Number(qty) > 0
            );
          }),
        )
      : {};
    const nextCart = {
      storeId: Object.keys(nextItems).length ? candidateCart.storeId : null,
      items: nextItems,
    };
    const serverFavs = state.favorites ?? [];
    const nextFavs =
      serverFavs.length === 0 && latest.current.favorites.length > 0
        ? latest.current.favorites
        : serverFavs;

    const serverAddrs = state.addresses ?? [];
    const nextAddrs =
      serverAddrs.length === 0 && latest.current.addresses.length > 0
        ? latest.current.addresses
        : serverAddrs;

    setUser(state.user);
    setCart(nextCart);
    setFavorites(nextFavs);
    setAddresses(nextAddrs);
    setOrders(state.orders ?? []);
    setFirstOrderEligible(Boolean(state.firstOrderEligible));
    setFirstOrderProductId(null);
    setWallet(state.wallet ?? 0);
    synced.current = {
      cart: JSON.stringify({
        storeId: nextCart.storeId,
        items: nextCart.items,
      }),
      favs: [...nextFavs].sort((a, b) => a - b).join(","),
      addrs: addrSig(serverAddrs),
      ready: true,
    };
    save("naz_user", state.user);
  }

  /* Refresh real purchase history and current availability in easy buy. */
  useEffect(() => {
    if (
      (view !== "orders" && view !== "easy" && sub?.name !== "order-history") ||
      !token
    )
      return;
    let alive = true;
    const refresh = () =>
      Promise.all([
        api.orders.list(),
        view === "easy" ? api.catalog() : Promise.resolve(null),
      ])
        .then(([{ orders: latestOrders }, catalog]) => {
          if (!alive) return;
          setOrders(latestOrders);
          if (latestOrders.length) setFirstOrderEligible(false);
          if (catalog) {
            hydrateCatalog(catalog);
            setCatalogTick((t) => t + 1);
          }
        })
        .catch(() => {
          if (alive) setApiOnline(false);
        });
    void refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [view, sub?.name, token]);

  /* ---------------- local persistence ---------------- */
  useEffect(() => save("naz_cart", cart), [cart]);
  useEffect(() => save("naz_favs", favorites), [favorites]);
  useEffect(() => save("naz_addresses", addresses), [addresses]);
  useEffect(
    () => save("naz_address_id", selectedAddressId),
    [selectedAddressId],
  );

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
          a.title === b.title &&
          a.address === b.address &&
          a.detail === b.detail &&
          a.phone === b.phone &&
          a.type === b.type &&
          (a.lat ?? null) === (b.lat ?? null) &&
          (a.lng ?? null) === (b.lng ?? null);
        const selected = addresses.find((a) => a.id === selectedAddressId);
        const canonicalSelected =
          selected && res.addresses.find((a) => sameAddress(a, selected));
        if (canonicalSelected) setSelectedAddressId(canonicalSelected.id);
        synced.current.addrs = nextSig;
        if (JSON.stringify(res.addresses) !== JSON.stringify(addresses))
          setAddresses(res.addresses);
      })
      .catch(() => setApiOnline(false));
  }, [addresses, canSync, selectedAddressId]);

  /* keep the selected address valid */
  useEffect(() => {
    if (addresses.length === 0) return;
    if (!addresses.some((a) => a.id === selectedAddressId))
      setSelectedAddressId(addresses[0].id);
  }, [addresses, selectedAddressId]);

  // Mobile has no visual back header: preserve internal screens in browser /
  // PWA history so system-back and the browser swipe return within the app.
  const routeSnapshot = { view, sub, productId: productModal?.id ?? null };
  const routeRef = useRef(routeSnapshot);
  routeRef.current = routeSnapshot;
  const routeInitialized = useRef(false),
    restoringRoute = useRef(false);
  useEffect(() => {
    const state = { ...window.history.state, nazRoute: routeSnapshot };
    if (!routeInitialized.current) {
      routeInitialized.current = true;
      window.history.replaceState(state, "");
      return;
    }
    if (restoringRoute.current) {
      restoringRoute.current = false;
      return;
    }
    if (
      JSON.stringify(window.history.state?.nazRoute) !==
      JSON.stringify(routeSnapshot)
    )
      window.history.pushState(state, "");
  }, [view, sub, productModal?.id]);
  useEffect(() => {
    const pop = (e: PopStateEvent) => {
      const route = e.state?.nazRoute as typeof routeSnapshot | undefined;
      if (
        !route ||
        !["home", "easy", "cart", "orders", "account"].includes(route.view)
      )
        return;
      if (JSON.stringify(route) === JSON.stringify(routeRef.current)) return;
      restoringRoute.current = true;
      setView(route.view);
      setSub(route.sub ?? null);
      setProductModal(
        route.productId
          ? (products.find((p) => p.id === route.productId) ?? null)
          : null,
      );
      setMenuOpen(false);
      setSheet(null);
      setCartDrawer(false);
      setStorePicker(false);
      setReplacePrompt(null);
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);

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
  }, [
    productModal,
    storePicker,
    replacePrompt,
    sheet,
    cartDrawer,
    sub,
    menuOpen,
  ]);

  /* ---------------- derived ---------------- */
  const cartCount = useMemo(
    () => Object.values(cart.items).reduce((a, b) => a + b, 0),
    [cart],
  );
  const subtotal = useMemo(
    () =>
      Object.entries(cart.items).reduce(
        (sum, [id, qty]) => sum + productPrice(Number(id)) * qty,
        0,
      ),
    [cart],
  );
  const cartStore = storeById(cart.storeId) ?? null;
  const selectedAddress =
    addresses.find((a) => a.id === selectedAddressId) ?? addresses[0];

  useEffect(() => {
    if (!firstOrderEligible) return;
    if (firstOrderProductId && (cart.items[firstOrderProductId] ?? 0) > 0)
      return;
    const candidate = products.find(
      (p) => p.category === "drinks" && (cart.items[p.id] ?? 0) > 0,
    );
    setFirstOrderProductId(candidate?.id ?? null);
  }, [cart, firstOrderEligible, firstOrderProductId]);
  const firstOrderDiscount = useMemo(() => {
    if (
      !firstOrderEligible ||
      !firstOrderProductId ||
      (cart.items[firstOrderProductId] ?? 0) < 1
    )
      return 0;
    const product = products.find((p) => p.id === firstOrderProductId);
    return product?.category === "drinks" ? Math.floor(product.price / 2) : 0;
  }, [firstOrderEligible, firstOrderProductId, cart]);
  /**
   * What the typed code alone is worth. The totals used to print `discountAmount`
   * here, which quietly included the first-order offer and made the code look
   * more generous than it is; the server keeps its own split and recomputes all
   * of this at checkout.
   */
  const codeDiscount = useMemo(() => {
    if (!appliedCode || !appliedPromo || subtotal < appliedPromo.minSubtotal)
      return 0;
    const raw =
      appliedPromo.kind === "percent"
        ? Math.round((subtotal * appliedPromo.amount) / 100)
        : appliedPromo.amount;
    return Math.min(
      subtotal,
      appliedPromo.maxDiscount > 0
        ? Math.min(raw, appliedPromo.maxDiscount)
        : raw,
    );
  }, [appliedCode, appliedPromo, subtotal]);
  const discountAmount = useMemo(
    () => Math.min(subtotal, codeDiscount + firstOrderDiscount),
    [subtotal, codeDiscount, firstOrderDiscount],
  );

  const [deliveryQuote, setDeliveryQuote] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    setDeliveryQuote(null);
    if (!token || !cart.storeId || !cartCount) return;
    api
      .deliveryQuote({
        storeId: cart.storeId,
        addressId: selectedAddress?.id,
        items: cart.items,
      })
      .then((r) => {
        if (live) setDeliveryQuote(r.quote.fee);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [
    token,
    cart,
    selectedAddress?.id,
    selectedAddress?.lat,
    selectedAddress?.lng,
  ]);
  const deliveryFee = cartCount === 0 ? 0 : (deliveryQuote ?? 50000);
  const payable = Math.max(0, subtotal - discountAmount + deliveryFee);

  /* ---------------- actions ---------------- */
  const qtyOf = (id: number) => cart.items[id] ?? 0;

  const handleAdd = (p: Product, fromStoreId?: number) => {
    if (p.active === false || (p.stock != null && qtyOf(p.id) >= p.stock))
      return showToast("موجودی بیشتری از این کالا در دسترس نیست.");
    fromStoreId = fromStoreId ?? p.storeId;
    if (storeById(fromStoreId ?? null)?.isOpen === false)
      return showToast("این فروشگاه موقتا بسته است و فعلا سفارش جدید نمی‌پذیرد.");
    if (
      cartCount > 0 &&
      fromStoreId &&
      cart.storeId &&
      fromStoreId !== cart.storeId
    ) {
      setReplacePrompt({ product: p, storeId: fromStoreId });
      return;
    }
    setCart((c) => ({
      storeId: Object.keys(c.items).length
        ? c.storeId
        : (fromStoreId ?? c.storeId ?? null),
      items: { ...c.items, [p.id]: (c.items[p.id] ?? 0) + 1 },
    }));
    if (firstOrderEligible && !firstOrderProductId && p.category === "drinks")
      setFirstOrderProductId(p.id);
    if (cartCount === 0) showToast(`${p.name} به سبد اضافه شد`);
  };

  const handleDec = (id: number) => {
    if (firstOrderProductId === id && qtyOf(id) <= 1)
      setFirstOrderProductId(null);
    setCart((c) => {
      const items = { ...c.items };
      if ((items[id] ?? 0) <= 1) delete items[id];
      else items[id] -= 1;
      return {
        storeId: Object.keys(items).length === 0 ? null : c.storeId,
        items,
      };
    });
  };

  const clearCart = () => {
    setCart({ storeId: null, items: {} });
    setAppliedCode(null);
    setAppliedPromo(null);
    setFirstOrderProductId(null);
  };

  const toggleFav = (id: number) => {
    setFavorites((f) =>
      f.includes(id) ? f.filter((x) => x !== id) : [...f, id],
    );
    showToast(
      favorites.includes(id)
        ? "از علاقه‌مندی‌ها حذف شد"
        : "به علاقه‌مندی‌ها اضافه شد",
    );
  };

  const applyCode = async (code: string) => {
    const code0 = code.trim().toUpperCase();
    if (!code0) return;
    if (!token)
      return showToast("برای استفاده از کد تخفیف ابتدا وارد حساب شوید.");
    if (!apiOnline)
      return showToast("اتصال سرور برقرار نیست؛ کد تخفیف بررسی نشد.");
    if (!cart.storeId) return showToast("ابتدا فروشگاه را انتخاب کنید.");
    try {
      const res = await api.promos.apply(code0, subtotal, cart.storeId);
      if (!res.applied) {
        setAppliedCode(null);
        setAppliedPromo(null);
        return showToast(res.message ?? "کد تخفیف معتبر نیست");
      }
      setAppliedCode(code0);
      setAppliedPromo(res.promo ? readDiscountCode(res.promo) : null);
      showToast(res.message ?? "کد تخفیف فروشگاه اعمال شد");
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "بررسی کد تخفیف ناموفق بود.",
      );
    }
  };

  const placeOrder = async (extra?: {
    slot?: string;
    payment?: "online" | "cash" | "wallet";
  }) => {
    if (!token) return showToast("برای ثبت واقعی سفارش، ابتدا وارد حساب شوید.");
    if (!apiOnline) return showToast("سرور در دسترس نیست؛ سفارش ثبت نشد.");
    if (!selectedAddress) return showToast("ابتدا آدرس تحویل را انتخاب کنید");
    if (!cart.storeId || cartCount === 0) {
      setStorePicker(true);
      return showToast("ابتدا فروشگاه را انتخاب کنید");
    }
    if (storeById(cart.storeId)?.isOpen === false)
      return showToast("این فروشگاه موقتا بسته است و فعلا سفارش جدید نمی‌پذیرد.");
    try {
      const { order } = await api.orders.place({
        storeId: cart.storeId,
        items: cart.items,
        addressId: selectedAddress.id,
        addressTitle: selectedAddress.title,
        addressText: `${selectedAddress.address}، ${selectedAddress.detail}`,
        slot: extra?.slot ?? "ارسال فوری",
        payment: extra?.payment ?? "cash",
        promoCode: appliedCode,
        firstOrderProductId: firstOrderEligible ? firstOrderProductId : null,
      });
      setOrders((o) => [order, ...o]);
      if ((extra?.payment ?? "cash") === "wallet")
        setWallet((w) => Math.max(0, w - (order.total ?? 0)));
      setFirstOrderEligible(false);
      setFirstOrderProductId(null);
      setCart({ storeId: null, items: {} });
      setAppliedCode(null);
      setAppliedPromo(null);
      setSub({ name: "done", order });
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "ثبت سفارش ناموفق بود");
    }
  };

  const reorder = (o: Order) => {
    const items: Record<number, number> = {};
    o.items.forEach((i) => (items[i.id] = i.qty));
    setCart({ storeId: o.storeId, items });
    showToast("اقلام سفارش قبلی به سبد اضافه شد");
    if (isDesktop()) setCartDrawer(true);
    else setView("cart");
  };

  const refreshOrders = async () => {
    try {
      const { orders: latest } = await api.orders.list();
      setOrders(latest);
    } catch {
      /* keep the last list; the next poll retries */
    }
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
    // The × in the card clears the code, so the matched row has to go with it.
    setAppliedCode: (next: string | null) => {
      setAppliedCode(next);
      if (!next) setAppliedPromo(null);
    },
    appliedPromo,
    codeDiscount,
    discountAmount,
    deliveryFee,
    payable,
    applyCode,
    placeOrder,
    reorder,
    orders,
    refreshOrders,
    firstOrderEligible,
    firstOrderProductId,
    setFirstOrderProductId,
    firstOrderDiscount,
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
      setCart({
        storeId: replacePrompt.storeId,
        items: { [replacePrompt.product.id]: 1 },
      });
      setFirstOrderProductId(
        firstOrderEligible && replacePrompt.product.category === "drinks"
          ? replacePrompt.product.id
          : null,
      );
      setAppliedCode(null);
      setAppliedPromo(null);
      setReplacePrompt(null);
      showToast("سبد جدید ساخته شد");
    },
    closeReplace: () => setReplacePrompt(null),
    pickStore: (id) => {
      if (cart.storeId !== id) {
        setAppliedCode(null);
        setAppliedPromo(null);
        setFirstOrderProductId(null);
      }
      setCart((cc) => ({ ...cc, storeId: id }));
    },
    sheet,
    setSheet,
    cartDrawer,
    setCartDrawer,
    toast: showToast,
    /** Opens the login/register overlay; after success returns to `nextView`. */
    requireLogin: requestLogin,
  };

  /* ---------- auth gate ---------- */
  if (booting) return <Splash />;

  function requestLogin(nextView: View | "checkout" | null = null) {
    setShowAuth(true);
    setPostLogin(nextView);
  }

  const handleAuth = (res: { token: string; user: User }) => {
    tokenStore.set(res.token);
    setToken(res.token);
    setUser(res.user);
    save("naz_user", res.user);
    showToast(
      `خوش آمدید${res.user.firstName ? `، ${res.user.firstName}` : ""}!`,
    );
    Promise.all([api.state(), api.catalog()])
      .then(([state, catalog]) => {
        hydrateCatalog(catalog);
        setCart((current) => {
          if (!stores.some((store) => store.id === current.storeId))
            return { storeId: null, items: {} };
          const validItems = Object.fromEntries(
            Object.entries(current.items).filter(([id, qty]) => {
              const product = products.find(
                (item) => item.id === Number(id),
              );
              return (
                product?.active &&
                product.storeId === current.storeId &&
                Number(qty) > 0
              );
            }),
          );
          return {
            storeId: Object.keys(validItems).length
              ? current.storeId
              : null,
            items: validItems,
          };
        });
        setCatalogTick((t) => t + 1);
        applyServerState(state);
      })
      .catch(() => setApiOnline(false));
    setShowAuth(false);
    const next = postLogin;
    setPostLogin(null);
    if (next === "checkout") {
      c.openSub({ name: "checkout" });
    } else if (next) {
      c.go(next);
    }
  };

  /* ---------- content ---------- */
  let content: React.ReactNode;
  if (sub?.name === "checkout") content = <CheckoutView c={c} />;
  else if (sub?.name === "done") content = <DoneView c={c} order={sub.order} />;
  else if (sub?.name === "store")
    content = <StorePage c={c} storeId={sub.id} />;
  else if (sub?.name === "category")
    content = <CategoryPage c={c} catId={sub.id} />;
  else if (sub?.name === "search") content = <SearchPage c={c} />;
  else if (sub?.name === "favorites") content = <FavoritesPage c={c} />;
  else if (sub?.name === "order-history")
    content = <OrdersView c={c} historyOnly />;
  else if (sub?.name === "account-detail")
    content = <AccountDetailPage c={c} kind={sub.id} />;
  else if (sub?.name === "map") content = <MapPage c={c} />;
  else if (sub?.name === "stores") content = <StoresPage c={c} />;
  else if (view === "easy") content = <EasyPage c={c} />;
  else if (view === "orders") content = <OrdersView c={c} />;
  else if (view === "account") content = <AccountView c={c} />;
  else if (view === "cart")
    content = (
      <div className="fade-rise mx-auto w-full max-w-3xl pb-6">
        <div className="px-4 pt-5 pb-2">
          <h2 className="text-[16px] font-black text-ink">سبد خرید</h2>
        </div>
        <CartBody c={c} />
      </div>
    );
  else content = <HomePage c={c} />;

  const navItems: { key: View; label: string; active: boolean }[] = [
    { key: "home", label: "خانه", active: !sub && view === "home" },
    { key: "easy", label: "خرید راحت", active: !sub && view === "easy" },
    { key: "orders", label: "سفارش‌ها", active: !sub && view === "orders" },
  ];

  /* Login/register is its own full page — never a popup over the store. */
  if (showAuth) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowAuth(false)}
          aria-label="بازگشت به فروشگاه"
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink shadow-lg transition active:scale-90"
        >
          <X className="h-5 w-5" />
        </button>
        <AuthPage onAuth={handleAuth} />
      </div>
    );
  }

  return (
    <div
      className={`min-h-dvh bg-app ${view === "home" && !sub ? "market-home-layout" : ""} ${view === "easy" && !sub ? "easy-buy-layout" : ""}`}
    >
      {/* ---------- one header for every screen size ---------- */}
      <header
        className={`${sub ? "hidden md:block" : "block"} mobile-app-header ${view === "home" && !sub ? "market-home-header" : ""} relative z-[60] border-b border-line bg-white/95 backdrop-blur md:sticky md:top-0`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 md:px-6">
          <button
            type="button"
            onClick={() => go("home")}
            aria-label="صفحه اصلی"
            className="shrink-0 transition hover:opacity-80"
          >
            <Wordmark size="text-[20px]" />
          </button>

          <nav
            className="hidden items-center gap-0.5 md:flex"
            aria-label="ناوبری اصلی"
          >
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => go(item.key)}
                aria-current={item.active ? "page" : undefined}
                className={`rounded-xl px-3 py-2 text-[11.5px] font-bold transition ${
                  item.active
                    ? "bg-brand-soft text-brand-dark"
                    : "text-ink/70 hover:bg-[#f4f3f0] hover:text-ink"
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => c.openSub({ name: "stores" })}
              aria-current={sub?.name === "stores" ? "page" : undefined}
              className={`rounded-xl px-3 py-2 text-[11.5px] font-bold transition ${
                sub?.name === "stores"
                  ? "bg-brand-soft text-brand-dark"
                  : "text-ink/70 hover:bg-[#f4f3f0] hover:text-ink"
              }`}
            >
              فروشگاه‌ها
            </button>
          </nav>

          <div className="mr-auto flex min-w-0 items-center gap-2 mobile-app-actions">
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
              <span className="max-w-28 truncate">
                {selectedAddress?.title ?? "انتخاب آدرس"}
              </span>
              <ChevronDown className="h-3 w-3 text-muted" />
            </button>

            <button
              type="button"
              onClick={() => go("cart")}
              aria-label="سبد خرید"
              className="relative hidden h-10 items-center gap-2 rounded-xl bg-brand-soft px-3.5 text-[11.5px] font-black text-brand transition hover:bg-brand hover:text-white md:flex"
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
              <span className="truncate">
                {selectedAddress?.title ?? "آدرس"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => c.openSub({ name: "search" })}
              aria-label="جستجو"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f4f3f0] text-ink md:hidden"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={`mobile-header-cart${cartCount ? " has-items" : ""}`}
              aria-label={`سبد خرید، ${pd(cartCount)} کالا`}
              onClick={() => go("cart")}
            >
              <ShoppingCart size={16} />
              {!!cartCount && <span>{pd(cartCount)}</span>}
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen}
                aria-label="منوی حساب کاربری"
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition ${
                  menuOpen
                    ? "border-brand bg-brand-soft"
                    : "border-line bg-brand-soft hover:border-brand/50"
                }`}
              >
                <span className="text-[12px] font-black text-brand">
                  {(user?.firstName || "م").slice(0, 1)}
                </span>
              </button>
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="dropdown-in fixed inset-x-3 top-[4.75rem] z-[70] w-auto rounded-2xl border border-line bg-white p-2 shadow-2xl md:absolute md:inset-x-auto md:left-0 md:top-12 md:w-64">
                    <div className="flex items-center gap-3 rounded-xl bg-[#faf9f6] p-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[13px] font-black text-brand">
                        {(user?.firstName || "م").slice(0, 1)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-black text-ink">
                          {[user?.firstName, user?.lastName]
                            .filter(Boolean)
                            .join(" ") || "کاربر ناز"}
                        </p>
                        <p
                          className="mt-0.5 text-[10.5px] font-medium text-muted"
                          dir="ltr"
                          style={{ textAlign: "right" }}
                        >
                          {user?.phone ? pd(user.phone) : "حساب مهمان"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-1.5 space-y-0.5">
                      {(
                        [
                          {
                            icon: UserRound,
                            label: "حساب کاربری",
                            fn: () => go("account"),
                          },
                          {
                            icon: ClipboardList,
                            label: "سفارش‌های من",
                            fn: () => go("orders"),
                          },
                          {
                            icon: Wallet,
                            label: "کیف پول",
                            fn: () => c.setSheet("wallet"),
                          },
                          {
                            icon: TicketPercent,
                            label: "کدهای تخفیف من",
                            fn: () =>
                              c.openSub({
                                name: "account-detail",
                                id: "codes",
                              }),
                          },
                          {
                            icon: Store,
                            label: "فروشگاه‌های اطراف",
                            fn: () => c.openSub({ name: "stores" }),
                          },
                          {
                            icon: Info,
                            label: "قوانین و مقررات",
                            fn: () => c.setSheet("rules"),
                          },
                        ] as const
                      ).map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            item.fn();
                            setMenuOpen(false);
                          }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-right text-[12.5px] font-bold text-ink transition hover:bg-brand-soft"
                        >
                          <item.icon className="h-4 w-4 text-muted" />{" "}
                          {item.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={token ? doLogout : () => requestLogin()}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-right text-[12.5px] font-bold transition ${
                          token
                            ? "text-red-600 hover:bg-red-50"
                            : "text-brand hover:bg-brand-soft"
                        }`}
                      >
                        <LogOut className="h-4 w-4" />{" "}
                        {token ? "خروج از حساب" : "ورود / ثبت‌نام"}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        {view === "home" && !sub && (
          <div className="market-mobile-search">
            <button
              type="button"
              aria-label="جستجو"
              onClick={() => c.openSub({ name: "search" })}
            >
              <Search size={21} />
              <span>جست‌وجوی کالا یا فروشگاه در نازمارکت</span>
            </button>
          </div>
        )}
      </header>

      {!apiOnline && (
        <div className="bg-amber-50 px-4 py-2 text-center text-[10.5px] font-bold text-amber-800">
          اتصال به سرور برقرار نیست — اطلاعات موقتاً روی همین دستگاه ذخیره
          می‌شود.
        </div>
      )}

      {/* Minimum breathing room between page content and the footer/bottom nav
          so short screens (empty cart/orders) never hug the chrome. */}
      <main className="min-h-[52vh] w-full min-w-0 overflow-x-clip pb-16 md:pb-20">
        {content}
      </main>

      {/* footer */}
      {!sub && (
        <footer className="market-footer hidden border-t border-line bg-white md:block">
          <div className="market-footer-grid mx-auto max-w-7xl px-6 py-5 lg:px-8">
            <div className="market-footer-brand">
              <Wordmark className="!text-[22px]" />
              <p className="mt-2 text-[12px] font-semibold text-ink">
                خرید سوپرمارکتی فوری از سوپرمارکت‌های محلی و زنجیره‌ای
              </p>
              <p className="mt-3 text-[10px] font-medium text-muted">
                © ۱۴۰۵ نازمارکت · همهٔ حقوق محفوظ است
              </p>
            </div>
            <div className="market-footer-links">
              <strong>نازمارکت</strong>
              <button type="button" onClick={() => c.setSheet("rules")}>
                قوانین و مقررات
              </button>
              <button type="button" onClick={() => c.setSheet("privacy")}>
                حریم خصوصی
              </button>
              <button type="button" onClick={() => c.setSheet("support")}>
                پشتیبانی
              </button>
              <small>نسخهٔ ۲.۰.۰</small>
            </div>
            <div className="market-footer-service">
              <MapPin size={24} />
              <strong>پوشش ارسال</strong>
              <span>شهرستان نظرآباد</span>
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
            {(
              [
                { key: "home", label: "خانه", icon: Home },
                { key: "easy", label: "خرید راحت", icon: Search },
                {
                  key: "cart",
                  label: "سبد خرید",
                  icon: ShoppingCart,
                  badge: cartCount,
                },
                { key: "orders", label: "سفارش‌ها", icon: ClipboardList },
                { key: "account", label: "حساب", icon: Users },
              ] as {
                key: View;
                label: string;
                icon: typeof Home;
                badge?: number;
              }[]
            ).map((item) => {
              const active = view === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => go(item.key)}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex flex-col items-center justify-center gap-0.5 text-[7.5px] leading-none font-medium transition active:scale-95 ${
                    active ? "text-brand" : "text-[#a8a49e]"
                  }`}
                >
                  <span className="relative">
                    <item.icon
                      className="h-[18px] w-[18px]"
                      strokeWidth={active ? 2.2 : 1.7}
                    />
                    {!!item.badge && (
                      <span className="pop-in absolute -left-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#eb2d20] px-1 text-[8.5px] font-black text-white">
                        {pd(item.badge)}
                      </span>
                    )}
                  </span>
                  {item.label}
                  {active && (
                    <span className="absolute top-0 h-0.5 w-8 rounded-full bg-brand" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* address overlays */}
      {sub?.name === "address" && (
        <div
          className="fixed inset-0 z-[80] flex items-stretch justify-center bg-ink/50 backdrop-blur-[2px] md:items-center md:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="انتخاب آدرس"
        >
          <div className="relative flex h-full w-full max-w-[430px] flex-col overflow-y-auto overscroll-contain bg-white app-scroll md:h-[min(690px,90dvh)] md:max-w-2xl md:overflow-hidden md:rounded-[24px] md:shadow-2xl">
            <AddressSelect c={c} />
          </div>
        </div>
      )}
      {sub?.name === "address-form" && (
        <div
          className="fixed inset-0 z-[80] flex items-stretch justify-center bg-ink/50 backdrop-blur-[2px] md:items-center md:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="جزئیات آدرس"
        >
          <div className="relative flex h-full w-full max-w-[430px] flex-col overflow-y-auto overscroll-contain bg-white app-scroll md:h-[min(720px,92dvh)] md:max-w-xl md:overflow-y-auto md:rounded-[24px] md:shadow-2xl">
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

function SkeletonBlock({ className }: { className: string }) {
  return (
    <span aria-hidden="true" className={`skeleton-shimmer ${className}`} />
  );
}

function Splash() {
  return (
    <div
      className="loading-screen"
      role="status"
      aria-label="در حال بارگذاری فروشگاه"
    >
      <header className="loading-header">
        <Wordmark />
        <div className="loading-top-actions">
          <SkeletonBlock className="h-9 w-9 rounded-full" />
          <SkeletonBlock className="h-9 w-9 rounded-full" />
        </div>
      </header>
      <main className="loading-content">
        <SkeletonBlock className="loading-banner" />
        <div className="loading-categories">
          {Array.from({ length: 8 }, (_, index) => (
            <div className="loading-category" key={index}>
              <SkeletonBlock className="rounded-[17px]" />
              <SkeletonBlock className="rounded-full" />
            </div>
          ))}
        </div>
        {Array.from({ length: 4 }, (_, row) => (
          <section className="loading-shelf" key={row}>
            <SkeletonBlock className="loading-shelf-title" />
            <div className="loading-shelf-row">
              {Array.from({ length: 6 }, (_, card) => (
                <div className="loading-product" key={card}>
                  <SkeletonBlock className="loading-product-image" />
                  <SkeletonBlock className="loading-product-line rounded-full" />
                  <SkeletonBlock className="loading-product-price rounded-full" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>
      <div className="loading-footer hidden md:block" aria-hidden="true" />
      <nav className="loading-mobile-nav md:hidden" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <SkeletonBlock key={index} className="rounded-full" />
        ))}
      </nav>
    </div>
  );
}

/* product lookups */
function productPrice(id: number): number {
  return products.find((p) => p.id === id)?.price ?? 0;
}

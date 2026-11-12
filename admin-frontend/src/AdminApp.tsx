import Operations from "./Operations";
import { askConfirm } from "./confirm";
import Promotions from "./Promotions";
import Customers from "./Customers";
import { useEffect, useState, type FormEvent } from "react";
import {
  LayoutDashboard,
  Boxes,
  Bike,
  Store,
  Users,
  ShoppingBag,
  LogOut,
  RefreshCw,
  Plus,
  Search,
  ShieldCheck,
  X,
  Pencil,
  Menu,
  Wallet,
  TicketPercent,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatJalali } from "../../shared/persianDate";

type NavItem = [string, string, LucideIcon];
type Product = {
  id: number;
  name: string;
  description: string;
  category: string;
  unit: string;
  image_url: string;
  weight_kg?: number;
  base_price: number;
  max_discount: number;
  active: number;
};
type Courier = {
  id: number;
  full_name: string;
  phone: string;
  plate: string;
  vehicle_info: string;
  verification_status: string;
  rejection_reason: string;
};
type Row = Record<string, any>;
const statuses = [
  "لغوشده",
  "ثبت سفارش",
  "در حال آماده‌سازی",
  "آماده تحویل به سفیر",
  "تحویل به سفیر",
  "تکمیل سفارش",
];
const verification: Record<string, string> = {
  unsubmitted: "مدارک ارسال نشده",
  pending: "در انتظار بررسی",
  approved: "تأییدشده",
  rejected: "ردشده",
  needs_correction: "نیازمند اصلاح مدارک",
};
const pageHints: Record<string, string> = {
  dashboard: "نمای کلی عملکرد امروز",
  orders: "پیگیری و مداخله در چرخهٔ سفارش",
  users: "مشتریان، شماره تماس و سابقهٔ خرید",
  promotions: "کدهای تخفیف سراسری و اختصاصی",
  products: "بانک مرکزی کالاها",
  stores: "تأیید و کنترل فروشگاه‌ها",
  couriers: "بررسی مدارک و فعال‌سازی سفیرها",
  operations: "کارمزد، برداشت‌ها و پشتیبانی",
};
type StatGroup = { title: string; note: string; keys: string[]; hero?: string[] };
const statGroups: StatGroup[] = [
  {
    title: "فروش و مالی",
    note: "مبالغ ثبت‌شده در سفارش‌های تکمیل‌شده",
    keys: [
      "sales",
      "dailySales",
      "monthlySales",
      "commissionRevenue",
      "netProfit",
      "discounts",
      "promoSpend",
    ],
    hero: ["sales", "netProfit"],
  },
  {
    title: "مشتریان",
    note: "بر اساس ورود در ۳۰ روز اخیر",
    keys: [
      "users",
      "activeUsers",
      "inactiveUsers",
      "customersWithOrders",
      "firstTimeCustomers",
    ],
    hero: ["users"],
  },
  {
    title: "فروشندگان و کالا",
    note: "حساب، فروشگاه تأییدشده و بانک کالا",
    keys: ["sellers", "activeSellers", "inactiveSellers", "stores", "products"],
    hero: ["activeSellers"],
  },
  {
    title: "ارسال و کدهای تخفیف",
    note: "وضعیت سفیرها و مصرف کدها",
    keys: [
      "couriers",
      "approvedCouriers",
      "pendingCouriers",
      "rejectedCouriers",
      "correctionCouriers",
      "promoCodes",
      "activePromoCodes",
      "promoRedemptions",
    ],
    hero: ["pendingCouriers"],
  },
];
const categories = [
  ["drinks", "نوشیدنی"],
  ["dairy", "لبنیات"],
  ["snacks", "تنقلات"],
  ["grocery", "خواربار"],
  ["fresh", "میوه و سبزی"],
  ["protein", "پروتئینی"],
  ["bakery", "نان و کیک"],
  ["hygiene", "بهداشتی"],
  ["other", "سایر"],
];
const money = (n: any) => new Intl.NumberFormat("fa-IR").format(Number(n) || 0);
const labels: Record<string, string> = {
  netProfit: "سود خالص عملیاتی ثبت‌شده (تومان)",
  courierCosts: "هزینه سفیر (تومان)",
  operatingExpenses: "هزینه‌های عملیاتی (تومان)",
  commissionRevenue: "درآمد کارمزد (تومان)",
  promoCodes: "کدهای تخفیف سراسری",
  activePromoCodes: "کدهای فعال",
  promoRedemptions: "مصرف کدهای تخفیف",
  promoSpend: "یارانهٔ کدهای تخفیف (تومان)",
  customersWithOrders: "مشتریان دارای سفارش",
  firstTimeCustomers: "کاربران بدون سفارش",
  users: "کل کاربران",
  activeUsers: "کاربران فعال",
  inactiveUsers: "کاربران غیرفعال",
  sellers: "کل فروشندگان",
  activeSellers: "فروشندگان فعال",
  inactiveSellers: "فروشندگان غیرفعال",
  couriers: "کل سفیرها",
  pendingCouriers: "در انتظار احراز هویت",
  approvedCouriers: "سفیر تأییدشده",
  rejectedCouriers: "سفیر ردشده",
  correctionCouriers: "نیازمند اصلاح مدارک",
  products: "بانک محصولات",
  stores: "فروشگاه‌ها",
  orders: "کل سفارش‌ها",
  sales: "فروش کل (تومان)",
  dailySales: "فروش روزانه (تومان)",
  monthlySales: "فروش ماهانه (تومان)",
  discounts: "تخفیف اعمال‌شده (تومان)",
  status0: "سفارش لغوشده",
  status1: "سفارش ثبت‌شده",
  status2: "در حال آماده‌سازی",
  status3: "آماده تحویل",
  status4: "در حال ارسال",
  status5: "سفارش تکمیل‌شده",
};
/* One expiry per dead session: the dashboard fires several requests at once and
   each 401 would otherwise re-render the login card and log another failed
   resource, which is what made the panel look broken. */
let expiring = false;
function expireAdminSession(message: string) {
  sessionStorage.removeItem("naz_admin");
  if (expiring) return;
  expiring = true;
  window.dispatchEvent(new CustomEvent("admin-expired", { detail: message }));
}
function adminToken() {
  return sessionStorage.getItem("naz_admin");
}
/* A request sent without a token can only be answered with 401. Refusing it
   here keeps the console clean and shows the login form instead. */
async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const token = adminToken();
  if (!token && path !== "/login") {
    const message = "برای دیدن این بخش، اول وارد حساب مدیر شوید.";
    expireAdminSession(message);
    throw new Error(message);
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch("/api/admin" + path, { ...init, headers });
  } catch {
    throw new Error("ارتباط با سرور مدیریت برقرار نشد؛ دوباره تلاش کنید.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error?.message;
    if (res.status === 401 && path != "/login")
      expireAdminSession(
        typeof message === "string" && message.trim()
          ? message
          : "نشست مدیریت تمام شده است؛ دوباره وارد شوید.",
      );
    throw new Error(
      typeof message === "string" && message.trim()
        ? message
        : "درخواست مدیریت انجام نشد؛ اطلاعات را بررسی و دوباره تلاش کنید.",
    );
  }
  return data;
}
export default function AdminApp() {
  const [logged, setLogged] = useState(!!sessionStorage.getItem("naz_admin"));
  const [page, setPage] = useState("dashboard"),
    [data, setData] = useState<Row>({
      stats: {},
      orders: [],
      users: [],
      stores: [],
      sellerReport: [],
      courierReport: [],
    }),
    [products, setProducts] = useState<Product[]>([]),
    [couriers, setCouriers] = useState<Courier[]>([]);
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [editing, setEditing] = useState<Product | null | undefined>(undefined),
    [events, setEvents] = useState<Row[] | null>(null),
    [document, setDocument] = useState(""),
    [courierProfile, setCourierProfile] = useState<Row | null>(null);
  const [tableRows, setTableRows] = useState<Row[]>([]),
    [tableTotal, setTableTotal] = useState(0),
    [tablePage, setTablePage] = useState(1),
    // Placeholders hold the table's height on the first paint; later refreshes
    // keep the rows already on screen, so nothing moves under the cursor.
    [tableLoading, setTableLoading] = useState(true);
  const [review, setReview] = useState<Courier | null>(null),
    [reason, setReason] = useState(""),
    [navOpen, setNavOpen] = useState(false);
  async function load() {
    setBusy(true);
    setError("");
    try {
      const [d, p, c] = await Promise.all([
        api("/dashboard"),
        api("/products"),
        api("/couriers"),
      ]);
      setData(d);
      setProducts(p.products);
      setCouriers(c.couriers);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const expire = (event: Event) => {
      setLogged(false);
      const detail = (event as CustomEvent).detail;
      if (typeof detail === "string" && detail) setError(detail);
    };
    window.addEventListener("admin-expired", expire);
    return () => window.removeEventListener("admin-expired", expire);
  }, []);
  useEffect(() => {
    if (!logged) return;
    void load();
    const id = setInterval(() => void load(), 60000);
    return () => clearInterval(id);
  }, [logged]);
  useEffect(() => {
    setTablePage(1);
  }, [page, query, filter]);
  useEffect(() => {
    if (!logged || page !== "orders") return;
    let live = true;
    const read = () =>
      api(
        `/${page}?page=${tablePage}&q=${encodeURIComponent(query)}&status=${filter}`,
      )
        .then((r) => {
          if (live) {
            setTableRows(r.rows);
            setTableTotal(r.total);
          }
        })
        .catch((e) => {
          if (live) setError(e.message);
        })
        .finally(() => {
          if (live) setTableLoading(false);
        });
    const timer = setTimeout(() => void read(), 250),
      refresh = setInterval(() => void read(), 30000);
    return () => {
      live = false;
      clearTimeout(timer);
      clearInterval(refresh);
    };
  }, [logged, page, query, filter, tablePage]);
  useEffect(
    () => () => {
      if (document) URL.revokeObjectURL(document);
    },
    [document],
  );
  async function action(path: string, body: Row) {
    setBusy(true);
    try {
      await api(path, { method: "PATCH", body: JSON.stringify(body) });
      setNotice("تغییرات با موفقیت ذخیره شد.");
      await load();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function saveProduct(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await api(editing ? `/products/${editing.id}` : "/products", {
        method: editing ? "PUT" : "POST",
        body,
      });
      setEditing(undefined);
      setNotice("محصول و اطلاعات فروشگاه‌ها به‌روز شد.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const match = (r: unknown) =>
    JSON.stringify(r).toLowerCase().includes(query.toLowerCase());
  const navGroups: { title: string; items: NavItem[] }[] = [
    {
      title: "نظارت",
      items: [
        ["dashboard", "نمای کلی", LayoutDashboard],
        ["orders", "سفارش‌ها", ShoppingBag],
        ["users", "کاربران", Users],
      ],
    },
    {
      title: "رشد فروش",
      items: [
        ["promotions", "کدهای تخفیف", TicketPercent],
        ["products", "بانک محصولات", Boxes],
        ["stores", "فروشندگان", Store],
      ],
    },
    {
      title: "عملیات",
      items: [
        ["couriers", "احراز هویت سفیر", Bike],
        ["operations", "مالی و پشتیبانی", ShieldCheck],
      ],
    },
  ];
  const nav: NavItem[] = navGroups.flatMap((group) => group.items);
  /* A dashboard that has not answered yet shows placeholders, not zeros: «۰»
     would read as a dead marketplace for the second it takes to load. */
  const ready = Object.keys(data.stats).length > 0;
  if (!logged)
    return (
      <main className="login-wrap">
        <form
          className="login-card"
          onSubmit={async (e) => {
            e.preventDefault();
            const b = new FormData(e.currentTarget);
            setBusy(true);
            try {
              const r = await api("/login", {
                method: "POST",
                body: JSON.stringify(Object.fromEntries(b)),
              });
              sessionStorage.setItem("naz_admin", r.token);
              expiring = false;
              setLogged(true);
              setError("");
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <span className="brand-icon">
            <ShieldCheck />
          </span>
          <p className="eyebrow">NAZMARKET / CONTROL CENTER</p>
          <h1>مدیریت یکپارچه نازمارکت</h1>
          <p>ورود مخصوص مدیر مجاز سامانه</p>
          <label className="naz-floating-field">
            <span className="naz-floating-label">نام کاربری</span>
            <input
              name="username"
              required
              autoComplete="username"
              placeholder=" "
            />
          </label>
          <label className="naz-floating-field">
            <span className="naz-floating-label">رمز عبور</span>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder=" "
            />
          </label>
          {error && (
            <p className="alert error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "در حال ورود…" : "ورود به پنل مدیریت"}
          </button>
        </form>
      </main>
    );
  return (
    <div className={`admin-shell${navOpen ? " nav-open" : ""}`}>
      <button
        type="button"
        className="nav-scrim"
        aria-label="بستن منو"
        onClick={() => setNavOpen(false)}
      />
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">
            <ShieldCheck />
          </span>
          <div>
            <b>نازمارکت</b>
            <small>مرکز کنترل و مدیریت</small>
          </div>
          <button
            type="button"
            className="nav-close"
            aria-label="بستن منو"
            onClick={() => setNavOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <nav>
          {navGroups.map((group) => (
            <div className="nav-group" key={group.title}>
              <p className="eyebrow">{group.title}</p>
              {group.items.map(([id, label, Icon]) => (
                <button
                  key={id}
                  className={page === id ? "selected" : ""}
                  onClick={() => {
                    setPage(id);
                    setQuery("");
                    setFilter("all");
                    setNavOpen(false);
                  }}
                >
                  <Icon size={19} />
                  {label}
                  {id === "couriers" && data.stats.pendingCouriers > 0 && (
                    <span className="count">
                      {money(data.stats.pendingCouriers)}
                    </span>
                  )}
                  {id === "orders" && data.stats.status1 > 0 && (
                    <span className="count count-soft">
                      {money(data.stats.status1)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <ShieldCheck size={18} />
          <span>
            دسترسی امن مدیر اصلی<small>اطلاعات واقعی سامانه</small>
          </span>
        </div>
        <button
          className="logout"
          onClick={async () => {
            try {
              await api("/logout", { method: "POST" });
            } finally {
              sessionStorage.removeItem("naz_admin");
              setLogged(false);
            }
          }}
        >
          <LogOut size={17} /> خروج از حساب
        </button>
      </aside>
      <main className="content">
        <header className="topbar">
          <span className="topbar-left">
            <button
              type="button"
              className="nav-toggle"
              aria-label="باز کردن منو"
              onClick={() => setNavOpen(true)}
            >
              <Menu size={19} />
            </button>
            <i className="online-dot" /> داده‌های زندهٔ سامانه
            <em>{formatJalali(new Date())}</em>
          </span>
          <span className="topbar-actions">
            <small>به‌روزرسانی خودکار هر ۶۰ ثانیه</small>
            <button disabled={busy} onClick={() => void load()}>
              <RefreshCw size={16} className={busy ? "spin" : ""} />{" "}
              {/* the label never changes: only the icon spins, so the header row
                  keeps its width while the panel polls */}
              به‌روزرسانی
            </button>
          </span>
        </header>
        <div className="page-head">
          <div>
            <p className="eyebrow">{pageHints[page] ?? "کنترل، نظارت و هماهنگی"}</p>
            <h1>{nav.find((n) => n[0] === page)?.[1]}</h1>
          </div>
          {page === "products" && (
            <button className="primary" onClick={() => setEditing(null)}>
              <Plus size={18} /> محصول جدید
            </button>
          )}
        </div>
        {notice && (
          <div className="alert success" role="status">
            {notice}
            <button onClick={() => setNotice("")}>
              <X size={16} />
            </button>
          </div>
        )}
        {error && (
          <div className="alert error" role="alert">
            {error}
          </div>
        )}
        {page === "promotions" ? (
          <Promotions api={api} />
        ) : page === "dashboard" ? (
          <>
            <div className="focus-strip">
              {([
                ["dailySales", "فروش امروز", Wallet],
                ["monthlySales", "فروش این ماه", TrendingUp],
                ["status1", "سفارش در جریان", ShoppingBag],
                ["pendingCouriers", "در انتظار احراز سفیر", Bike],
              ] as [string, string, LucideIcon][]).map(([key, title, Icon]) => {
                const I = Icon;
                return (
                  <article className="focus" key={key}>
                    <span className="focus-icon">
                      <I size={18} />
                    </span>
                    <div>
                      <span>{String(title)}</span>
                      <strong>
                        {ready ? (
                          money(data.stats[key])
                        ) : (
                          <i className="skeleton-num" aria-hidden="true" />
                        )}
                      </strong>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="pipeline">
              {statuses.map((label, index) => (
                <article className={`pipe stage-${index}`} key={label}>
                  <header>
                    <span>{label}</span>
                    <strong>
                      {ready ? (
                        money(data.stats["status" + index])
                      ) : (
                        <i className="skeleton-num" aria-hidden="true" />
                      )}
                    </strong>
                  </header>
                  <i>
                    <b
                      style={{
                        width: `${Math.min(
                          100,
                          (Number(data.stats["status" + index] || 0) /
                            Math.max(1, Number(data.stats.orders || 0))) *
                            100,
                        )}%`,
                      }}
                    />
                  </i>
                </article>
              ))}
            </div>
            <div className="stat-groups">
              {statGroups.map((group) => (
                <section className="panel" key={group.title}>
                  <h2>{group.title}</h2>
                  <div className="stats-grid">
                    {group.keys.map((key) => (
                      <article
                        className={`stat ${group.hero?.includes(key) ? "highlight" : ""}`}
                        key={key}
                      >
                        <span>{labels[key] || key}</span>
                        <strong>{money(data.stats[key])}</strong>
                        <small>{group.note}</small>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            <p className="definition">
              {data.activeDefinition ?? (
                <i className="skeleton-line" aria-hidden="true" />
              )}
            </p>
            <div className="report-grid">
              <section className="panel">
                <h2>عملکرد فروشندگان</h2>
                <Table
                  loading={!ready}
                  headings={["فروشگاه", "سفارش", "فروش تکمیل‌شده"]}
                  rows={data.sellerReport.map((r: Row) => [
                    r.name,
                    money(r.orders),
                    money(r.sales) + " تومان",
                  ])}
                />
              </section>
              <section className="panel">
                <h2>عملکرد سفیرها</h2>
                <Table
                  loading={!ready}
                  headings={["سفیر", "دریافت‌شده", "تحویل نهایی"]}
                  rows={data.courierReport.map((r: Row) => [
                    r.full_name,
                    money(r.orders),
                    money(r.completed),
                  ])}
                />
              </section>
            </div>
          </>
        ) : page === "operations" ? (
          <Operations api={api} />
        ) : (
          <>
            <div className="toolbar">
              <label className="search">
                <Search size={18} />
                <input
                  placeholder="جست‌وجو در اطلاعات…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              {page === "couriers" && (
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">تمام وضعیت‌ها</option>
                  {Object.entries(verification).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
              {page === "orders" && (
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">تمام سفارش‌ها</option>
                  {statuses.map((s, i) => (
                    <option key={i} value={i}>
                      {s}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {page === "products" && (
              <div className="products-grid">
                {products.filter(match).map((p) => (
                  <article className="product-card" key={p.id}>
                    <div className="product-visual">
                      <img src={p.image_url} alt={p.name} loading="lazy" />
                      <span
                        className={`badge ${p.active ? "approved" : "rejected"}`}
                      >
                        {p.active ? "فعال" : "غیرفعال"}
                      </span>
                    </div>
                    <div className="product-copy">
                      <small>
                        {categories.find((c) => c[0] === p.category)?.[1]}
                      </small>
                      <h3>{p.name}</h3>
                      <p>
                        {p.unit} · وزن {p.weight_kg ?? 0.5} کیلوگرم
                      </p>
                      <strong>
                        {money(p.base_price)} <small>تومان</small>
                      </strong>
                      <div className="card-actions">
                        <button onClick={() => setEditing(p)}>
                          <Pencil size={15} /> ویرایش
                        </button>
                        <button
                          disabled={busy}
                          onClick={() =>
                            void action(`/products/${p.id}`, {
                              active: !p.active,
                            })
                          }
                        >
                          {p.active ? "غیرفعال کردن" : "فعال کردن"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
                {!products.filter(match).length && (
                  <Empty text="محصولی در بانک پیدا نشد. محصول واقعی ثبت کنید." />
                )}
              </div>
            )}
            {page === "couriers" && (
              <div className="courier-grid">
                {couriers
                  .filter(
                    (c) =>
                      match(c) &&
                      (filter === "all" || c.verification_status === filter),
                  )
                  .map((c) => (
                    <article className="panel courier-card" key={c.id}>
                      <div className="card-heading">
                        <span className="avatar">
                          <Bike />
                        </span>
                        <div>
                          <h3>{c.full_name}</h3>
                          <a href={`tel:${c.phone}`}>{c.phone}</a>
                        </div>
                        <span className={`badge ${c.verification_status}`}>
                          {verification[c.verification_status]}
                        </span>
                      </div>
                      <dl>
                        <dt>شماره پلاک</dt>
                        <dd>{c.plate || "ارسال نشده"}</dd>
                        <dt>اطلاعات وسیله</dt>
                        <dd>{c.vehicle_info || "—"}</dd>
                      </dl>
                      {c.rejection_reason && (
                        <p className="alert error">{c.rejection_reason}</p>
                      )}
                      {c.verification_status !== "unsubmitted" && (
                        <div className="document-links">
                          {[
                            ["portrait", "تصویر پرسنلی"],
                            ["vehicleDocument", "مدارک موتور"],
                            ["national", "کارت ملی"],
                            ["motor", "موتور"],
                            ["motor-1", "عکس دوم موتور"],
                            ["motor-2", "عکس سوم موتور"],
                            ["motor-3", "عکس چهارم موتور"],
                            ["plate", "پلاک"],
                            ["license", "گواهینامه"],
                          ].map(([kind, label]) => (
                            <button
                              key={kind}
                              onClick={async () => {
                                try {
                                  const documentToken = adminToken();
                                  const r = documentToken
                                    ? await fetch(
                                        `/api/admin/couriers/${c.id}/documents/${kind}`,
                                        {
                                          headers: {
                                            Authorization: `Bearer ${documentToken}`,
                                          },
                                        },
                                      )
                                    : null;
                                  if (!r) {
                                    expireAdminSession(
                                      "نشست مدیریت تمام شده است؛ دوباره وارد شوید.",
                                    );
                                    return;
                                  }
                                  if (!r.ok) {
                                    const body = await r
                                      .json()
                                      .catch(() => null);
                                    throw new Error(
                                      body?.error?.message ||
                                        (r.status === 404
                                          ? "این تصویر ارسال نشده یا فایل آن روی سرور موجود نیست."
                                          : "مدرک قابل دریافت نیست."),
                                    );
                                  }
                                  setDocument(
                                    URL.createObjectURL(await r.blob()),
                                  );
                                } catch (err) {
                                  setError((err as Error).message);
                                }
                              }}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                      {c.verification_status !== "unsubmitted" && (
                        <button
                          onClick={async () => {
                            try {
                              const r = await api(`/couriers/${c.id}/profile`);
                              setCourierProfile({
                                ...r.profile,
                                fullName: c.full_name,
                                empty: !r.profile,
                              });
                            } catch (e) {
                              setError((e as Error).message);
                            }
                          }}
                        >
                          مشاهده اطلاعات هویتی و موتور
                        </button>
                      )}
                      {c.verification_status === "pending" && (
                        <button
                          className="primary full"
                          onClick={() => {
                            setReview(c);
                            setReason("");
                          }}
                        >
                          بررسی و ثبت نتیجه
                        </button>
                      )}
                    </article>
                  ))}
                {!couriers.filter(
                  (c) =>
                    match(c) &&
                    (filter === "all" || c.verification_status === filter),
                ).length && (
                  <Empty text="درخواستی با این مشخصات ثبت نشده است." />
                )}
              </div>
            )}
            {page === "orders" && (
              <section className="panel">
                <Table
                  loading={tableLoading}
                  headings={[
                    "شناسه",
                    "فروشگاه",
                    "مبلغ",
                    "وضعیت",
                    "پیگیری",
                    "بازیابی تحویل",
                  ]}
                  rows={tableRows.map((o: Row) => [
                    o.id,
                    o.storeName,
                    money(o.total) + " تومان",
                    <span className={`badge stage-${o.status}`}>
                      {statuses[o.status]}
                    </span>,
                    <button
                      onClick={async () => {
                        try {
                          setEvents(
                            (await api(`/orders/${o.id}/events`)).events,
                          );
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      تاریخچه
                    </button>,
                    o.status === 4 ? (
                      <button
                        disabled={busy}
                        onClick={async () => {
                          if (
                            await askConfirm(
                              "کد تحویل قبلی باطل شود؟ کد جدید فقط در حساب مشتری نمایش داده می‌شود.",
                              "بله، بازنشانی شود",
                            )
                          )
                            await action(
                              `/orders/${o.id}/reset-delivery-code`,
                              {},
                            );
                        }}
                      >
                        بازنشانی کد تحویل
                      </button>
                    ) : (
                      "—"
                    ),
                  ])}
                />
                <p className="definition">
                  جست‌وجو و فیلتر در تمام سفارش‌های سامانه
                </p>
              </section>
            )}
            {page === "users" && <Customers api={api} />}
            {page === "stores" && (
              <section className="panel">
                <Table
                  headings={["فروشگاه", "نشانی", "وضعیت", "مدیریت"]}
                  rows={data.stores.filter(match).map((s: Row) => [
                    s.name,
                    s.address,
                    <span
                      className={`badge ${s.is_active ? "approved" : "pending"}`}
                    >
                      {s.is_active ? "فعال" : "غیرفعال / در انتظار تأیید"}
                    </span>,
                    <button
                      disabled={busy}
                      onClick={() =>
                        void action(`/stores/${s.id}`, { active: !s.is_active })
                      }
                    >
                      {s.is_active ? "غیرفعال کردن" : "تأیید و فعال‌سازی"}
                    </button>,
                  ])}
                />
              </section>
            )}
            {["orders", "users"].includes(page) && (
              <div className="pagination">
                <button
                  disabled={tablePage === 1}
                  onClick={() => setTablePage((p) => p - 1)}
                >
                  صفحه قبل
                </button>
                <span>
                  صفحه {money(tablePage)} از{" "}
                  {money(Math.max(1, Math.ceil(tableTotal / 30)))} ·{" "}
                  {money(tableTotal)} نتیجه
                </span>
                <button
                  disabled={tablePage * 30 >= tableTotal}
                  onClick={() => setTablePage((p) => p + 1)}
                >
                  صفحه بعد
                </button>
              </div>
            )}
          </>
        )}
        <footer>
          نازمارکت · مدیریت مرکزی فروش و ارسال · به‌روزرسانی خودکار هر ۶۰ ثانیه
        </footer>
      </main>
      {editing !== undefined && (
        <Modal
          title={editing ? "ویرایش محصول مرکزی" : "افزودن محصول به بانک"}
          onClose={() => setEditing(undefined)}
        >
          <form className="product-form" onSubmit={saveProduct}>
            <label className="naz-floating-field">
              <span className="naz-floating-label">نام محصول</span>
              <input
                name="name"
                placeholder=" "
                defaultValue={editing?.name}
                required
                maxLength={180}
              />
            </label>
            <label className="naz-floating-field">
              <span className="naz-floating-label">دسته‌بندی</span>
              <select
                name="category"
                defaultValue={editing?.category || "drinks"}
              >
                {categories.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="naz-floating-field">
              <span className="naz-floating-label">توضیحات</span>
              <textarea
                name="description"
                placeholder="توضیحات محصول را بنویسید"
                defaultValue={editing?.description}
                maxLength={5000}
              />
            </label>
            <div className="form-grid">
              <label className="naz-floating-field">
                <span className="naz-floating-label">واحد فروش</span>
                <input name="unit" placeholder=" " defaultValue={editing?.unit} />
              </label>
              <label className="naz-floating-field">
                <span className="naz-floating-label">قیمت پایه (تومان)</span>
                <input
                  name="base_price"
                  type="number"
                  placeholder=" "
                  min="1"
                  required
                  defaultValue={editing?.base_price || ""}
                />
              </label>
              <label className="naz-floating-field">
                <span className="naz-floating-label">وزن هر واحد (کیلوگرم)</span>
                <input
                  name="weight_kg"
                  type="number"
                  placeholder=" "
                  min="0.01"
                  required
                  step="0.1"
                  defaultValue={editing?.weight_kg ?? 0.5}
                />
              </label>
              <label className="naz-floating-field">
                <span className="naz-floating-label">حداکثر تخفیف مجاز (%)</span>
                <input
                  name="max_discount"
                  type="number"
                  placeholder=" "
                  min="0"
                  max="90"
                  required
                  defaultValue={editing?.max_discount ?? 50}
                />
              </label>
            </div>
            <label className="naz-floating-field">
              <span className="naz-floating-label">تصویر محصول</span>
              <input
                name="image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required={!editing}
              />
              <small>
                تصویر بدون برش، با حاشیه سفید به مربع ۱:۱ تبدیل می‌شود؛ حداکثر ۵
                مگابایت.
              </small>
            </label>
            {editing && (
              <img
                className="edit-preview"
                src={editing.image_url}
                alt={editing.name}
              />
            )}
            <button className="primary" disabled={busy}>
              ذخیره و همگام‌سازی فروشگاه‌ها
            </button>
          </form>
        </Modal>
      )}
      {review && (
        <Modal
          title={`بررسی مدارک ${review.full_name}`}
          onClose={() => setReview(null)}
        >
          <label className="naz-floating-field">
            <span className="naz-floating-label">دلیل رد یا درخواست اصلاح</span>
            <textarea
              value={reason}
              placeholder="توضیح لازم را بنویسید"
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
            />
            <small>برای رد یا درخواست اصلاح، ثبت دلیل الزامی است.</small>
          </label>
          <div className="review-actions">
            {[
              ["approved", "تأیید مدارک"],
              ["needs_correction", "نیازمند اصلاح"],
              ["rejected", "رد درخواست"],
            ].map(([status, label]) => (
              <button
                className={status === "approved" ? "primary" : "secondary"}
                key={status}
                disabled={busy || (status !== "approved" && !reason.trim())}
                onClick={async () => {
                  if (
                    await action(`/couriers/${review.id}/review`, {
                      status,
                      reason,
                    })
                  )
                    setReview(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </Modal>
      )}
      {events && (
        <Modal title="تاریخچه تغییرات سفارش" onClose={() => setEvents(null)}>
          <ol className="timeline">
            {events.map((e) => (
              <li key={e.id}>
                <strong>{statuses[e.status]}</strong>
                <span>
                  {
                    (
                      {
                        customer: "مشتری",
                        seller: "فروشنده",
                        courier: "سفیر",
                        migration: "انتقال اطلاعات",
                      } as Row
                    )[e.actor_role]
                  }{" "}
                  · {new Date(e.created_at).toLocaleString("fa-IR")}
                </span>
              </li>
            ))}
          </ol>
          {!events.length && <Empty text="تاریخچه‌ای ثبت نشده است." />}
        </Modal>
      )}
      {courierProfile && (
        <Modal
          title={`اطلاعات محرمانهٔ ${courierProfile.fullName}`}
          onClose={() => setCourierProfile(null)}
        >
          {courierProfile.empty ? (
            <p>
              اطلاعات تکمیلی در پروندهٔ قدیمی ثبت نشده؛ در صورت نیاز درخواست
              اصلاح مدارک بدهید.
            </p>
          ) : (
            <dl>
              <dt>کد ملی</dt>
              <dd>{courierProfile.nationalId}</dd>
              <dt>تاریخ تولد</dt>
              <dd>{courierProfile.birthDate}</dd>
              <dt>موتور</dt>
              <dd>
                {courierProfile.brand} · {courierProfile.model} ·{" "}
                {courierProfile.color}
              </dd>
            </dl>
          )}
        </Modal>
      )}
      {document && (
        <Modal title="مدرک محرمانه سفیر" onClose={() => setDocument("")}>
          <img className="document-view" src={document} alt="مدرک احراز هویت" />
          <p className="definition">
            این مدرک فقط برای بررسی هویت و برای مدیر مجاز نمایش داده می‌شود.
          </p>
        </Modal>
      )}
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <Boxes size={32} />
      <h3>اطلاعاتی برای نمایش نیست</h3>
      <p>{text}</p>
    </div>
  );
}
function Table({
  headings,
  rows,
  loading = false,
}: {
  headings: string[];
  rows: React.ReactNode[][];
  /** Rows of the same height as the real ones, until the first response lands. */
  loading?: boolean;
}) {
  return (
    <div className="table-scroll" aria-busy={loading || undefined}>
      <table>
        <thead>
          <tr>
            {headings.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && !rows.length
            ? [0, 1, 2, 3].map((i) => (
                <tr className="table-skeleton-row" key={`s${i}`} aria-hidden="true">
                  {headings.map((h, j) => (
                    <td key={`${h}${j}`}>
                      <i className={`skeleton-bar${j === 0 ? " wide" : ""}`} />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j}>{c}</td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
      {!rows.length && <Empty text="نتیجه‌ای برای این بخش وجود ندارد." />}
    </div>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="modal-backdrop"
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
        <header>
          <h2>{title}</h2>
          <button aria-label="بستن" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

import Operations from "./Operations";
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
} from "lucide-react";
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
  "آماده تحویل به پیک",
  "تحویل به پیک موتوری",
  "تکمیل سفارش",
];
const verification: Record<string, string> = {
  unsubmitted: "مدارک ارسال نشده",
  pending: "در انتظار بررسی",
  approved: "تأییدشده",
  rejected: "ردشده",
  needs_correction: "نیازمند اصلاح مدارک",
};
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
  courierCosts: "هزینه پیک (تومان)",
  operatingExpenses: "هزینه‌های عملیاتی (تومان)",
  commissionRevenue: "درآمد کارمزد (تومان)",
  users: "کل کاربران",
  activeUsers: "کاربران فعال",
  inactiveUsers: "کاربران غیرفعال",
  sellers: "کل فروشندگان",
  activeSellers: "فروشندگان فعال",
  inactiveSellers: "فروشندگان غیرفعال",
  couriers: "کل پیک‌ها",
  pendingCouriers: "در انتظار احراز هویت",
  approvedCouriers: "پیک تأییدشده",
  rejectedCouriers: "پیک ردشده",
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
async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const token = sessionStorage.getItem("naz_admin");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch("/api/admin" + path, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && path != "/login") {
      sessionStorage.removeItem("naz_admin");
      window.dispatchEvent(new Event("admin-expired"));
    }
    throw new Error(data?.error?.message || "درخواست انجام نشد.");
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
    [document, setDocument] = useState("");
  const [tableRows, setTableRows] = useState<Row[]>([]),
    [tableTotal, setTableTotal] = useState(0),
    [tablePage, setTablePage] = useState(1);
  const [review, setReview] = useState<Courier | null>(null),
    [reason, setReason] = useState("");
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
    const expire = () => setLogged(false);
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
    if (!logged || !["orders", "users"].includes(page)) return;
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
  const nav = [
    ["dashboard", "نمای کلی", LayoutDashboard],
    ["operations", "مالی و پشتیبانی", ShieldCheck],
    ["products", "بانک محصولات", Boxes],
    ["couriers", "احراز هویت پیک", Bike],
    ["orders", "سفارش‌ها", ShoppingBag],
    ["stores", "فروشندگان", Store],
    ["users", "کاربران", Users],
  ] as const;
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
          <label>
            نام کاربری
            <input name="username" required autoComplete="username" />
          </label>
          <label>
            رمز عبور
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
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
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">
            <ShieldCheck />
          </span>
          <div>
            <b>نازمارکت</b>
            <small>مرکز کنترل و مدیریت</small>
          </div>
        </div>
        <p className="eyebrow">فضای مدیریت</p>
        <nav>
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              className={page === id ? "selected" : ""}
              onClick={() => {
                setPage(id);
                setQuery("");
                setFilter("all");
              }}
            >
              <Icon size={19} />
              {label}
              {id === "couriers" && data.stats.pendingCouriers > 0 && (
                <span className="count">
                  {money(data.stats.pendingCouriers)}
                </span>
              )}
            </button>
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
          <span>
            <i className="online-dot" /> پنل مدیریت اصلی
          </span>
          <button disabled={busy} onClick={() => void load()}>
            <RefreshCw size={16} className={busy ? "spin" : ""} />{" "}
            {busy ? "به‌روزرسانی…" : "به‌روزرسانی"}
          </button>
        </header>
        <div className="page-head">
          <div>
            <p className="eyebrow">کنترل، نظارت و هماهنگی</p>
            <h1>{nav.find((n) => n[0] === page)?.[1]}</h1>
            <p>مدیریت فروش، محصولات و ارسال؛ در یک فضای یکپارچه</p>
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
        {page === "dashboard" ? (
          <>
            <div className="stats-grid">
              {Object.entries(data.stats).map(([key, value]) => (
                <article
                  className={`stat ${["sales", "orders", "users", "pendingCouriers"].includes(key) ? "highlight" : ""}`}
                  key={key}
                >
                  <span>{labels[key] || key}</span>
                  <strong>{money(value)}</strong>
                  <small>بر اساس داده‌های ثبت‌شده</small>
                </article>
              ))}
            </div>
            <p className="definition">{data.activeDefinition}</p>
            <div className="report-grid">
              <section className="panel">
                <h2>عملکرد فروشندگان</h2>
                <Table
                  headings={["فروشگاه", "سفارش", "فروش تکمیل‌شده"]}
                  rows={data.sellerReport.map((r: Row) => [
                    r.name,
                    money(r.orders),
                    money(r.sales) + " تومان",
                  ])}
                />
              </section>
              <section className="panel">
                <h2>عملکرد پیک‌ها</h2>
                <Table
                  headings={["پیک", "دریافت‌شده", "تحویل نهایی"]}
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
                                  const r = await fetch(
                                    `/api/admin/couriers/${c.id}/documents/${kind}`,
                                    {
                                      headers: {
                                        Authorization: `Bearer ${sessionStorage.getItem("naz_admin")}`,
                                      },
                                    },
                                  );
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
                            window.confirm(
                              "کد تحویل قبلی باطل شود؟ کد جدید فقط در حساب مشتری نمایش داده می‌شود.",
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
            {page === "users" && (
              <section className="panel">
                <Table
                  headings={["نام", "موبایل", "تاریخ عضویت", "وضعیت"]}
                  rows={tableRows.map((u: Row) => [
                    `${u.first_name} ${u.last_name}`,
                    u.phone,
                    new Date(u.created_at).toLocaleDateString("fa-IR"),
                    <span
                      className={`badge ${u.active ? "approved" : "rejected"}`}
                    >
                      {u.active ? "فعال" : "غیرفعال"}
                    </span>,
                  ])}
                />
                <p className="definition">وضعیت بر مبنای ورود در ۳۰ روز اخیر</p>
              </section>
            )}
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
            <label>
              نام محصول
              <input
                name="name"
                defaultValue={editing?.name}
                required
                maxLength={180}
              />
            </label>
            <label>
              دسته‌بندی
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
            <label>
              توضیحات
              <textarea
                name="description"
                defaultValue={editing?.description}
                maxLength={5000}
              />
            </label>
            <div className="form-grid">
              <label>
                واحد فروش
                <input name="unit" defaultValue={editing?.unit} />
              </label>
              <label>
                قیمت پایه (تومان)
                <input
                  name="base_price"
                  type="number"
                  min="1"
                  required
                  defaultValue={editing?.base_price || ""}
                />
              </label>
              <label>
                وزن هر واحد (کیلوگرم)
                <input
                  name="weight_kg"
                  type="number"
                  min="0.01"
                  required
                  step="0.1"
                  defaultValue={editing?.weight_kg ?? 0.5}
                />
              </label>
              <label>
                حداکثر تخفیف مجاز (%)
                <input
                  name="max_discount"
                  type="number"
                  min="0"
                  max="90"
                  required
                  defaultValue={editing?.max_discount ?? 50}
                />
              </label>
            </div>
            <label>
              تصویر محصول
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
          <label>
            دلیل رد یا درخواست اصلاح
            <textarea
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
            />
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
                        courier: "پیک موتوری",
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
      {document && (
        <Modal title="مدرک محرمانه پیک" onClose={() => setDocument("")}>
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
}: {
  headings: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {headings.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
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

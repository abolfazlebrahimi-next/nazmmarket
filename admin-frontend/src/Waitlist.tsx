import { useEffect, useMemo, useState } from "react";
import {
  Bike,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  RefreshCw,
  Search,
  Store,
  UserPlus,
  Users,
  X,
} from "lucide-react";

type RoleKey = "customer" | "seller" | "courier";
type UserRecord = {
  key: string;
  type: string;
  phone: string;
  firstName: string;
  lastName: string;
};
type Api = (path: string, init?: RequestInit) => Promise<unknown>;
type Props = { api: Api };

const PAGE_SIZE = 30;
const ROLE_LABEL: Record<RoleKey, string> = {
  customer: "مشتری",
  seller: "فروشنده",
  courier: "پیک",
};
function roleKey(type: string): RoleKey | null {
  const value = type.trim().toLocaleLowerCase();
  if (value === "customer" || value === "مشتری") return "customer";
  if (value === "seller" || value === "فروشنده" || value === "فرشنده") return "seller";
  if (value === "courier" || value === "پیک") return "courier";
  return null;
}

function roleLabel(type: string) {
  const key = roleKey(type);
  return key ? ROLE_LABEL[key] : type || "—";
}

function extractRecords(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of ["users", "rows", "data"]) {
      if (Array.isArray(record[key])) return record[key] as unknown[];
    }
    if (record.data && typeof record.data === "object") {
      const nested = record.data as Record<string, unknown>;
      for (const key of ["users", "rows"]) {
        if (Array.isArray(nested[key])) return nested[key] as unknown[];
      }
    }
  }
  throw new Error("پاسخ /api/users شامل فهرست کاربران نیست.");
}

function textField(record: Record<string, unknown>, camel: string, snake: string) {
  const value = record[camel] ?? record[snake];
  return value === null || value === undefined ? "" : String(value);
}

function normalizeRecords(payload: unknown): UserRecord[] {
  return extractRecords(payload).map((value, index) => {
    if (!value || typeof value !== "object")
      throw new Error(`ساختار ردیف ${index + 1} در /api/users معتبر نیست.`);
    const record = value as Record<string, unknown>;
    if (record.type === null || record.type === undefined || record.phone === null || record.phone === undefined)
      throw new Error(`فیلد نوع یا شماره تماس در ردیف ${index + 1} موجود نیست.`);
    const type = String(record.type);
    const phone = String(record.phone);
    return {
      key: `${String(record.id ?? "")}:${type}:${phone}:${index}`,
      type,
      phone,
      firstName: textField(record, "firstName", "first_name"),
      lastName: textField(record, "lastName", "last_name"),
    };
  });
}

function persianCount(value: number) {
  return new Intl.NumberFormat("fa-IR").format(value);
}

function csvCell(value: string) {
  let text = String(value ?? "");
  if (/^[\u0000-\u0020]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export default function Waitlist({ api }: Props) {
  const [records, setRecords] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [queryDraft, setQueryDraft] = useState("");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [sort, setSort] = useState("name-asc");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [detail, setDetail] = useState<UserRecord | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(queryDraft.trim()), 200);
    return () => window.clearTimeout(timer);
  }, [queryDraft]);

  useEffect(() => {
    setPage(1);
  }, [query, role, sort, records]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    api("/users")
      .then((payload) => {
        if (live) setRecords(normalizeRecords(payload));
      })
      .catch((reason) => {
        if (live) setError((reason as Error).message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [api, refreshKey]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDetail(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  const visibleRecords = useMemo(() => {
    const normalizedQuery = query.toLocaleLowerCase();
    const filtered = records.filter((record) => {
      const roleMatch = role === "all" || roleKey(record.type) === role;
      const searchMatch = !normalizedQuery ||
        [record.firstName, record.lastName, record.phone, roleLabel(record.type)]
          .join(" ")
          .toLocaleLowerCase()
          .includes(normalizedQuery);
      return roleMatch && searchMatch;
    });
    return filtered.sort((a, b) => {
      if (sort === "phone-asc") return a.phone.localeCompare(b.phone, "fa");
      if (sort === "phone-desc") return b.phone.localeCompare(a.phone, "fa");
      const aName = `${a.firstName} ${a.lastName}`.trim();
      const bName = `${b.firstName} ${b.lastName}`.trim();
      const result = aName.localeCompare(bName, "fa");
      return sort === "name-desc" ? -result : result;
    });
  }, [records, query, role, sort]);

  const stats = useMemo(
    () => ({
      total: records.length,
      customers: records.filter((record) => roleKey(record.type) === "customer").length,
      sellers: records.filter((record) => roleKey(record.type) === "seller").length,
      couriers: records.filter((record) => roleKey(record.type) === "courier").length,
    }),
    [records],
  );
  const pageCount = Math.max(1, Math.ceil(visibleRecords.length / PAGE_SIZE));
  const first = visibleRecords.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const last = Math.min(page * PAGE_SIZE, visibleRecords.length);
  const pageRecords = visibleRecords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function exportCsv() {
    setDownloading(true);
    setNotice("");
    try {
      const header = ["نوع", "نام", "نام خانوادگی", "شماره تماس"];
      const lines = [
        header.map(csvCell).join(","),
        ...visibleRecords.map((record) =>
          [roleLabel(record.type), record.firstName, record.lastName, record.phone]
            .map(csvCell)
            .join(","),
        ),
      ];
      const blob = new Blob(["\uFEFF", lines.join("\r\n")], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "waitlist-users.csv";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("خروجی CSV از داده‌های دریافتی از API آماده شد.");
    } finally {
      setDownloading(false);
    }
  }

  const statCards = [
    ["total", "تعداد دریافتی از API", Users],
    ["customers", "مشتریان", UserPlus],
    ["sellers", "فروشندگان", Store],
    ["couriers", "پیک‌ها", Bike],
  ] as const;

  return (
    <div className="waitlist-page">
      <section className="waitlist-stat-grid" aria-label="آمار داده‌های دریافتی از API کاربران">
        {statCards.map(([key, title, Icon]) => (
          <article className="waitlist-stat-card" key={key}>
            <span className="waitlist-stat-icon"><Icon size={18} /></span>
            <div>
              <span className="waitlist-stat-title">{title}</span>
              <strong>
                {loading && !records.length ? <i className="waitlist-skeleton" aria-hidden="true" /> : persianCount(stats[key])}
              </strong>
            </div>
          </article>
        ))}
      </section>

      <section className="panel directory waitlist-directory">
        <header className="panel-head waitlist-panel-head">
          <div>
            <h2><ClipboardList size={18} /> لیست انتظار <span>{persianCount(visibleRecords.length)} نتیجه</span></h2>
            <p className="waitlist-caption">منبع داده: GET /api/users؛ جست‌وجو و فیلتر روی پاسخ همین API انجام می‌شود.</p>
          </div>
          <div className="waitlist-actions">
            <button type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading}>
              <RefreshCw size={15} className={loading ? "spin" : ""} /> بارگذاری مجدد
            </button>
            <button type="button" onClick={exportCsv} disabled={downloading || !visibleRecords.length}>
              <Download size={15} /> {downloading ? "در حال آماده‌سازی…" : "خروجی CSV"}
            </button>
          </div>
        </header>

        <div className="waitlist-filters">
          <label className="search waitlist-search">
            <Search size={16} />
            <input
              type="search"
              value={queryDraft}
              aria-label="جست‌وجو در نام و شماره تماس"
              placeholder="نام یا شماره تماس…"
              onChange={(event) => setQueryDraft(event.target.value)}
            />
          </label>
          <label className="waitlist-filter">
            <span>نوع کاربر</span>
            <select value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="all">همهٔ انواع</option>
              <option value="customer">مشتری</option>
              <option value="seller">فروشنده</option>
              <option value="courier">پیک</option>
            </select>
          </label>
          <label className="waitlist-filter">
            <span>مرتب‌سازی</span>
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="name-asc">نام، الف تا ی</option>
              <option value="name-desc">نام، ی تا الف</option>
              <option value="phone-asc">شماره تماس، صعودی</option>
              <option value="phone-desc">شماره تماس، نزولی</option>
            </select>
          </label>
        </div>

        {notice && <p className="waitlist-notice" role="status">{notice}<button type="button" onClick={() => setNotice("")} aria-label="بستن پیام"><X size={15} /></button></p>}
        {error && <div className="alert error waitlist-error" role="alert">دریافت فهرست از <code>/api/users</code> ناموفق بود: {error}</div>}
        {loading && records.length > 0 && <p className="waitlist-loading-note" role="status"><RefreshCw size={14} className="spin" /> در حال دریافت دوبارهٔ فهرست…</p>}

        <div className="table-scroll waitlist-table-scroll" aria-busy={loading}>
          <table className="waitlist-table">
            <thead><tr><th>نوع</th><th>نام</th><th>نام خانوادگی</th><th>شماره تماس</th><th>جزئیات</th></tr></thead>
            <tbody>
              {pageRecords.map((record) => (
                <tr key={record.key}>
                  <td><span className={`waitlist-role role-${roleKey(record.type) ?? "other"}`}>{roleLabel(record.type)}</span></td>
                  <td>{record.firstName || "—"}</td>
                  <td>{record.lastName || "—"}</td>
                  <td dir="ltr" className="mono waitlist-phone">{record.phone}</td>
                  <td><button type="button" className="waitlist-view-button" onClick={() => setDetail(record)}>مشاهده</button></td>
                </tr>
              ))}
              {loading && records.length === 0 && <tr><td colSpan={5}><p className="loading waitlist-initial-loading"><RefreshCw size={16} className="spin" /> در حال دریافت از /api/users…</p></td></tr>}
              {!loading && !error && pageRecords.length === 0 && <tr><td colSpan={5}><div className="empty waitlist-empty"><UserPlus size={28} /><h3>موردی پیدا نشد</h3><p>عبارت جست‌وجو یا نوع انتخاب‌شده را تغییر دهید.</p></div></td></tr>}
            </tbody>
          </table>
        </div>

        <footer className="pager waitlist-pager">
          <span>نمایش {persianCount(first)} تا {persianCount(last)} از {persianCount(visibleRecords.length)} نتیجهٔ دریافتی از API</span>
          <div>
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronRight size={16} /> قبلی</button>
            <b>صفحه {persianCount(page)} از {persianCount(pageCount)}</b>
            <button type="button" disabled={page >= pageCount || loading} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>بعدی <ChevronLeft size={16} /></button>
          </div>
        </footer>
      </section>

      {detail && (
        <div className="modal-backdrop waitlist-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetail(null); }}>
          <section className="modal modal-wide waitlist-detail-modal" role="dialog" aria-modal="true" aria-labelledby="waitlist-detail-title">
            <header>
              <div><p className="eyebrow">جزئیات دریافتی از API</p><h2 id="waitlist-detail-title">{[detail.firstName, detail.lastName].filter(Boolean).join(" ") || "نام ثبت نشده"}</h2></div>
              <button type="button" onClick={() => setDetail(null)} aria-label="بستن جزئیات"><X size={18} /></button>
            </header>
            <dl className="waitlist-detail-grid">
              <div><dt>نوع</dt><dd>{roleLabel(detail.type)}</dd></div>
              <div><dt>نام</dt><dd>{detail.firstName || "—"}</dd></div>
              <div><dt>نام خانوادگی</dt><dd>{detail.lastName || "—"}</dd></div>
              <div><dt>شماره تماس</dt><dd dir="ltr" className="mono">{detail.phone}</dd></div>
            </dl>
            <p className="waitlist-detail-note">این جزئیات فقط از فیلدهای موجود در پاسخ /api/users نمایش داده می‌شوند.</p>
            <div className="modal-actions"><button type="button" onClick={() => setDetail(null)}>بستن</button></div>
          </section>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Bike,
  CalendarDays,
  PhoneCall,
  ChevronLeft,
  ChevronRight,
  CircleX,
  ClipboardList,
  Clock3,
  Download,
  Eye,
  RefreshCw,
  Search,
  Store,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { formatJalali, toPersianDigits } from "../../shared/persianDate";

type Role = "customer" | "seller" | "courier";
type Status = "registered" | "contacted" | "approved" | "rejected";
type WaitlistEntry = {
  id: string;
  role: Role;
  firstName: string;
  lastName: string;
  phone: string;
  status: Status;
  createdAt: string | null;
  updatedAt: string | null;
};
type WaitlistStats = {
  total: number;
  customers: number;
  sellers: number;
  couriers: number;
  newToday: number;
  approved: number;
  pendingReview: number;
  contacted: number;
  rejected: number;
};
type Api = (path: string, init?: RequestInit) => Promise<any>;
type Download = (path: string) => Promise<{ blob: Blob; filename: string }>;

type Props = { api: Api; download: Download };

const ROLE_LABEL: Record<Role, string> = {
  customer: "مشتری",
  seller: "فروشنده",
  courier: "پیک",
};
const STATUS_LABEL: Record<Status, string> = {
  registered: "ثبت‌نام جدید",
  contacted: "تماس گرفته شده",
  approved: "تأیید شده",
  rejected: "رد شده",
};
const STATUS_OPTIONS: Array<[Status, string]> = [
  ["registered", STATUS_LABEL.registered],
  ["contacted", STATUS_LABEL.contacted],
  ["approved", STATUS_LABEL.approved],
  ["rejected", STATUS_LABEL.rejected],
];
const PAGE_SIZE = 30;

const countLabel = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number)
    ? toPersianDigits(number.toLocaleString("fa-IR"))
    : "—";
};
const dateLabel = (value: string | null, withTime = false) => {
  const formatted = formatJalali(value, withTime);
  return formatted || "—";
};
const personName = (entry: WaitlistEntry) =>
  [entry.firstName, entry.lastName].filter(Boolean).join(" ") || "—";

function queryString({
  page,
  q,
  role,
  status,
  sort,
}: {
  page?: number;
  q: string;
  role: string;
  status: string;
  sort: string;
}) {
  const params = new URLSearchParams({ q, role, status, sort });
  if (page !== undefined) {
    params.set("page", String(page));
    params.set("size", String(PAGE_SIZE));
  }
  return params.toString();
}

export default function Waitlist({ api, download }: Props) {
  const [rows, setRows] = useState<WaitlistEntry[]>([]);
  const [stats, setStats] = useState<WaitlistStats | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [size, setSize] = useState(PAGE_SIZE);
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");
  const [loadingRows, setLoadingRows] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [listError, setListError] = useState("");
  const [exportError, setExportError] = useState("");
  const [statsError, setStatsError] = useState("");
  const [notice, setNotice] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WaitlistEntry | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [statusDraft, setStatusDraft] = useState<Status | "">("");
  const [savingStatus, setSavingStatus] = useState(false);
  const detailRequest = useRef(0);
  const activeFilterKey = `${search}\u0000${role}\u0000${status}\u0000${sort}`;
  const lastFilterKey = useRef(activeFilterKey);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchDraft.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  useEffect(() => {
    setPage(1);
  }, [search, role, status, sort]);

  useEffect(() => {
    let live = true;
    setLoadingStats(true);
    setStatsError("");
    api("/waitlist/stats")
      .then((result) => {
        if (!result?.stats || typeof result.stats !== "object")
          throw new Error("ساختار پاسخ آمار لیست انتظار معتبر نیست.");
        if (live) setStats(result.stats as WaitlistStats);
      })
      .catch((error) => {
        if (live) setStatsError((error as Error).message);
      })
      .finally(() => {
        if (live) setLoadingStats(false);
      });
    return () => {
      live = false;
    };
  }, [api, refreshKey]);

  useEffect(() => {
    let live = true;
    setLoadingRows(true);
    setListError("");
    if (lastFilterKey.current !== activeFilterKey) {
      lastFilterKey.current = activeFilterKey;
      setRows([]);
      setTotal(null);
    }
    const params = queryString({ page, q: search, role, status, sort });
    api(`/waitlist?${params}`)
      .then((result) => {
        if (!Array.isArray(result?.rows) || !Number.isFinite(Number(result?.total)))
          throw new Error("ساختار پاسخ فهرست ثبت‌نام‌ها معتبر نیست.");
        if (!live) return;
        setRows(result.rows as WaitlistEntry[]);
        setTotal(Number(result.total));
        setSize(Number(result.size) > 0 ? Number(result.size) : PAGE_SIZE);
      })
      .catch((error) => {
        if (live) setListError((error as Error).message);
      })
      .finally(() => {
        if (live) setLoadingRows(false);
      });
    return () => {
      live = false;
    };
  }, [api, page, search, role, status, sort, activeFilterKey, refreshKey]);

  useEffect(() => {
    if (!detailId) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDetail();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [detailId]);

  const pageCount = Math.max(1, Math.ceil((total ?? 0) / size));
  const firstResult = total ? (page - 1) * size + 1 : 0;
  const lastResult = Math.min(page * size, total ?? 0);

  const statCards = useMemo(
    () =>
      [
        ["total", "کل ثبت‌نام‌شدگان", Users],
        ["customers", "مشتریان", UserPlus],
        ["sellers", "فروشندگان", Store],
        ["couriers", "پیک‌ها", Bike],
        ["newToday", "ثبت‌نام‌های امروز", CalendarDays],
        ["approved", "افراد تأییدشده", BadgeCheck],
        ["pendingReview", "در انتظار بررسی", Clock3],
        ["contacted", "تماس گرفته شده", PhoneCall],
        ["rejected", "افراد ردشده", CircleX],
      ] as const,
    [],
  );

  function closeDetail() {
    detailRequest.current += 1;
    setDetailId(null);
    setDetail(null);
    setDetailError("");
    setStatusDraft("");
  }

  async function showDetails(row: WaitlistEntry) {
    const requestId = ++detailRequest.current;
    setDetailId(row.id);
    setDetail(null);
    setDetailLoading(true);
    setDetailError("");
    try {
      const result = await api(`/waitlist/${encodeURIComponent(row.id)}`);
      if (!result?.entry) throw new Error("جزئیات این ثبت‌نام در پاسخ سرور نیست.");
      if (requestId !== detailRequest.current) return;
      setDetail(result.entry as WaitlistEntry);
      setStatusDraft(result.entry.status as Status);
    } catch (error) {
      if (requestId === detailRequest.current)
        setDetailError((error as Error).message);
    } finally {
      if (requestId === detailRequest.current) setDetailLoading(false);
    }
  }

  async function saveStatus() {
    if (!detail || !statusDraft || statusDraft === detail.status) return;
    setSavingStatus(true);
    setDetailError("");
    try {
      const result = await api(`/waitlist/${encodeURIComponent(detail.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: statusDraft }),
      });
      if (!result?.entry) throw new Error("سرور وضعیت به‌روزشده را برنگرداند.");
      setDetail(result.entry as WaitlistEntry);
      setStatusDraft(result.entry.status as Status);
      setNotice("وضعیت ثبت‌نام به‌روزرسانی شد.");
      setRefreshKey((key) => key + 1);
    } catch (error) {
      setDetailError((error as Error).message);
    } finally {
      setSavingStatus(false);
    }
  }

  async function exportCsv() {
    setExporting(true);
    setNotice("");
    setExportError("");
    try {
      const params = queryString({ q: search, role, status, sort });
      const file = await download(`/waitlist/export?${params}`);
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.filename || "nazarabadshop-waitlist.csv";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      setNotice("خروجی CSV بر اساس فیلترهای انتخاب‌شده دانلود شد.");
    } catch (error) {
      setExportError((error as Error).message);
    } finally {
      setExporting(false);
    }
  }

  const statsValue = (key: keyof WaitlistStats) => {
    if (loadingStats && !stats) return <i className="waitlist-skeleton" aria-hidden="true" />;
    return countLabel(stats?.[key]);
  };

  return (
    <div className="waitlist-page">
      <section className="waitlist-stat-grid" aria-label="آمار لیست انتظار">
        {statCards.map(([key, title, Icon]) => (
          <article className="waitlist-stat-card" key={key}>
            <span className="waitlist-stat-icon">
              <Icon size={18} />
            </span>
            <div>
              <span className="waitlist-stat-title">{title}</span>
              <strong>{statsValue(key)}</strong>
            </div>
          </article>
        ))}
      </section>
      {statsError && (
        <p className="alert error" role="alert">
          دریافت آمار ناموفق بود: {statsError}
        </p>
      )}

      <section className="panel directory waitlist-directory">
        <header className="panel-head waitlist-panel-head">
          <div>
            <h2>
              <ClipboardList size={18} /> ثبت‌نام‌ها
              <span>{total === null ? "—" : `${countLabel(total)} نتیجه`}</span>
            </h2>
            <p className="waitlist-caption">
              جست‌وجو و فیلتر روی سرور انجام می‌شود؛ مبنای «امروز» UTC است و آخرین ویرایش مربوط به وضعیت پیگیری است، نه پروفایل منبع.
            </p>
          </div>
          <div className="waitlist-actions">
            <button
              type="button"
              onClick={() => setRefreshKey((key) => key + 1)}
              disabled={loadingRows || loadingStats}
            >
              <RefreshCw
                size={15}
                className={loadingRows || loadingStats ? "spin" : ""}
              />
              بارگذاری مجدد
            </button>
            <button type="button" onClick={() => void exportCsv()} disabled={exporting}>
              <Download size={15} className={exporting ? "spin" : ""} />
              {exporting ? "در حال آماده‌سازی…" : "خروجی CSV"}
            </button>
          </div>
        </header>

        <div className="waitlist-filters">
          <label className="search waitlist-search">
            <Search size={16} />
            <input
              type="search"
              value={searchDraft}
              aria-label="جست‌وجو در نام و شماره موبایل"
              placeholder="نام، نام خانوادگی یا شماره موبایل…"
              onChange={(event) => setSearchDraft(event.target.value)}
            />
          </label>
          <label className="waitlist-filter">
            <span>نقش</span>
            <select value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="all">همهٔ نقش‌ها</option>
              <option value="customer">مشتری</option>
              <option value="seller">فروشنده</option>
              <option value="courier">پیک</option>
            </select>
          </label>
          <label className="waitlist-filter">
            <span>وضعیت ثبت‌نام</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">همهٔ وضعیت‌ها</option>
              {STATUS_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="waitlist-filter">
            <span>تاریخ ثبت‌نام</span>
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="newest">جدیدترین ابتدا</option>
              <option value="oldest">قدیمی‌ترین ابتدا</option>
            </select>
          </label>
        </div>

        {notice && (
          <p className="waitlist-notice" role="status">
            {notice}
            <button type="button" aria-label="بستن پیام" onClick={() => setNotice("")}>
              <X size={15} />
            </button>
          </p>
        )}
        {listError && (
          <p className="alert error waitlist-error" role="alert">
            دریافت اطلاعات لیست انتظار ناموفق بود: {listError}
          </p>
        )}
        {exportError && (
          <p className="alert error waitlist-error" role="alert">
            دانلود خروجی CSV ناموفق بود: {exportError}
          </p>
        )}
        {loadingRows && rows.length > 0 && (
          <p className="waitlist-loading-note" role="status">
            <RefreshCw size={14} className="spin" /> در حال به‌روزرسانی فهرست…
          </p>
        )}

        <div className="table-scroll waitlist-table-scroll" aria-busy={loadingRows}>
          <table className="waitlist-table">
            <thead>
              <tr>
                <th>شناسه</th>
                <th>نام</th>
                <th>نام خانوادگی</th>
                <th>شماره موبایل</th>
                <th>نقش</th>
                <th>وضعیت</th>
                <th>تاریخ ثبت‌نام</th>
                <th>آخرین ویرایش وضعیت</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => (
                <tr key={entry.id}>
                  <td className="waitlist-id-cell">
                    <button type="button" onClick={() => void showDetails(entry)}>
                      {toPersianDigits(entry.id)}
                    </button>
                  </td>
                  <td>{entry.firstName || "—"}</td>
                  <td>{entry.lastName || "—"}</td>
                  <td dir="ltr" className="mono waitlist-phone">
                    {entry.phone || "—"}
                  </td>
                  <td>
                    <span className={`waitlist-role role-${entry.role}`}>
                      {ROLE_LABEL[entry.role] ?? "—"}
                    </span>
                  </td>
                  <td>
                    <span className={`badge waitlist-status status-${entry.status}`}>
                      {STATUS_LABEL[entry.status] ?? "—"}
                    </span>
                  </td>
                  <td className="date-cell">{dateLabel(entry.createdAt, true)}</td>
                  <td className="date-cell">{dateLabel(entry.updatedAt, true)}</td>
                  <td>
                    <button
                      type="button"
                      className="waitlist-view-button"
                      onClick={() => void showDetails(entry)}
                      aria-label={`مشاهده جزئیات ثبت‌نام ${entry.id}`}
                    >
                      <Eye size={15} /> مشاهده
                    </button>
                  </td>
                </tr>
              ))}
              {loadingRows && rows.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <p className="loading waitlist-initial-loading">
                      <RefreshCw size={16} className="spin" /> در حال دریافت ثبت‌نام‌ها از سرور…
                    </p>
                  </td>
                </tr>
              )}
              {!loadingRows && !listError && rows.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <div className="empty waitlist-empty">
                      <UserPlus size={28} />
                      <h3>ثبت‌نامی پیدا نشد</h3>
                      <p>عبارت جست‌وجو یا فیلترهای انتخاب‌شده را تغییر دهید.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="pager waitlist-pager">
          <span>
            نمایش {countLabel(firstResult)} تا {countLabel(lastResult)} از {countLabel(total)} نتیجه
          </span>
          <div>
            <button
              type="button"
              disabled={page <= 1 || loadingRows}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronRight size={16} /> قبلی
            </button>
            <b>
              صفحه {countLabel(page)} از {countLabel(pageCount)}
            </b>
            <button
              type="button"
              disabled={page >= pageCount || loadingRows}
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
            >
              بعدی <ChevronLeft size={16} />
            </button>
          </div>
        </footer>
      </section>

      {detailId !== null && (
        <div
          className="modal-backdrop waitlist-modal-backdrop"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) closeDetail();
          }}
        >
          <section className="modal modal-wide waitlist-detail-modal" role="dialog" aria-modal="true" aria-labelledby="waitlist-detail-title">
            <header>
              <div>
                <p className="eyebrow">جزئیات ثبت‌نام</p>
                <h2 id="waitlist-detail-title">
                  {detail ? personName(detail) : "در حال دریافت اطلاعات"}
                </h2>
              </div>
              <button type="button" onClick={closeDetail} aria-label="بستن جزئیات">
                <X size={18} />
              </button>
            </header>
            {detailLoading && <p className="loading">در حال دریافت جزئیات از API…</p>}
            {detailError && (
              <p className="alert error" role="alert">
                {detailError}
              </p>
            )}
            {detail && (
              <>
                <dl className="waitlist-detail-grid">
                  <div>
                    <dt>شناسه کاربر</dt>
                    <dd>{toPersianDigits(detail.id)}</dd>
                  </div>
                  <div>
                    <dt>نام</dt>
                    <dd>{detail.firstName || "—"}</dd>
                  </div>
                  <div>
                    <dt>نام خانوادگی</dt>
                    <dd>{detail.lastName || "—"}</dd>
                  </div>
                  <div>
                    <dt>شماره موبایل</dt>
                    <dd dir="ltr" className="mono">{detail.phone || "—"}</dd>
                  </div>
                  <div>
                    <dt>نقش</dt>
                    <dd>{ROLE_LABEL[detail.role] ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>وضعیت ثبت‌نام</dt>
                    <dd>
                      <span className={`badge waitlist-status status-${detail.status}`}>
                        {STATUS_LABEL[detail.status] ?? "—"}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt>تاریخ ایجاد</dt>
                    <dd>{dateLabel(detail.createdAt, true)}</dd>
                  </div>
                  <div>
                    <dt>آخرین ویرایش وضعیت</dt>
                    <dd>{dateLabel(detail.updatedAt, true)}</dd>
                  </div>
                </dl>
                <div className="waitlist-status-editor">
                  <label>
                    <span>تغییر وضعیت پیگیری</span>
                    <select
                      value={statusDraft}
                      disabled={savingStatus || detailLoading}
                      onChange={(event) => setStatusDraft(event.target.value as Status)}
                    >
                      {STATUS_OPTIONS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p>
                    این وضعیت در لیست انتظار ذخیره می‌شود و جایگزین وضعیت احراز هویت حساب پیک یا فروشنده نیست.
                  </p>
                </div>
                <div className="modal-actions">
                  <button type="button" onClick={closeDetail}>
                    بستن
                  </button>
                  <button
                    type="button"
                    className="primary"
                    disabled={
                      savingStatus ||
                      detailLoading ||
                      !statusDraft ||
                      statusDraft === detail.status
                    }
                    onClick={() => void saveStatus()}
                  >
                    {savingStatus ? "در حال ذخیره…" : "ذخیره وضعیت"}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

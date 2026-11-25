import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Bike,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  LogOut,
  RefreshCw,
  Search,
  Store,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { formatJalali, toPersianDigits } from "../../shared/persianDate";
import { askConfirm } from "./confirm";
import {
  hasWaitlistSession,
  waitlistApi,
  type WaitlistPage,
  type WaitlistRole,
  type WaitlistStats,
  type WaitlistStatus,
  type WaitlistUser,
} from "./waitlistApi";

const PER_PAGE = 30;
const SESSION_EXPIRED_EVENT = "waitlist-php-session-expired";
const ROLE_LABEL: Record<WaitlistRole, string> = {
  customer: "مشتری",
  seller: "فروشنده",
  courier: "پیک",
};
const STATUS_LABEL: Record<WaitlistStatus, string> = {
  registered: "ثبت‌نام‌شده",
  contacted: "تماس‌گرفته‌شده",
  approved: "تأییدشده",
  rejected: "ردشده",
};
const STATUS_OPTIONS: Array<[WaitlistStatus, string]> = Object.entries(STATUS_LABEL) as Array<[
  WaitlistStatus,
  string,
]>;
const ROLE_OPTIONS: Array<[WaitlistRole, string]> = Object.entries(ROLE_LABEL) as Array<[
  WaitlistRole,
  string,
]>;

type PageSummary = { page: number; perPage: number; total: number | null; lastPage: number };

function numberFromMeta(meta: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value)))
      return Number(value);
  }
  return null;
}

function summarizePage(meta: Record<string, unknown>, requestedPage: number): PageSummary {
  const nested = meta.pagination && typeof meta.pagination === "object" && !Array.isArray(meta.pagination)
    ? meta.pagination as Record<string, unknown>
    : meta;
  const page = numberFromMeta(nested, ["current_page", "page"]) ?? requestedPage;
  const perPage = numberFromMeta(nested, ["per_page", "page_size"]) ?? PER_PAGE;
  const total = numberFromMeta(nested, ["total", "total_count"]);
  const lastPage = numberFromMeta(nested, ["last_page", "total_pages"]) ??
    (total === null || perPage < 1 ? null : Math.max(1, Math.ceil(total / perPage)));
  if (lastPage === null)
    throw new Error("response.meta باید اطلاعات صفحه‌بندی مانند current_page، per_page و last_page یا total را داشته باشد.");
  return { page, perPage, total, lastPage };
}

function countLabel(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : toPersianDigits(value.toLocaleString("fa-IR"));
}

function dateLabel(value: string | null | undefined) {
  return value ? formatJalali(value, true) || "—" : "—";
}

function fullName(user: Pick<WaitlistUser, "first_name" | "last_name">) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || "—";
}

export default function Waitlist() {
  const [authenticated, setAuthenticated] = useState(() => hasWaitlistSession());
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  const [rows, setRows] = useState<WaitlistUser[]>([]);
  const [stats, setStats] = useState<WaitlistStats | null>(null);
  const [pageInfo, setPageInfo] = useState<PageSummary>({ page: 1, perPage: PER_PAGE, total: 0, lastPage: 1 });
  const [page, setPage] = useState(1);
  const [queryDraft, setQueryDraft] = useState("");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [loadingRows, setLoadingRows] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [listError, setListError] = useState("");
  const [statsError, setStatsError] = useState("");
  const [detailId, setDetailId] = useState<string | number | null>(null);
  const [detail, setDetail] = useState<WaitlistUser | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [draft, setDraft] = useState<Pick<WaitlistUser, "first_name" | "last_name" | "phone" | "role" | "status"> | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [exportError, setExportError] = useState("");
  const detailRequestId = useRef(0);

  useEffect(() => {
    const expire = () => {
      setAuthenticated(false);
      setRows([]);
      setStats(null);
      setDetailId(null);
      setDetail(null);
      setDraft(null);
      setLoginError("نشست مستقل هاست منقضی یا نامعتبر شد؛ دوباره وارد شوید.");
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, expire);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expire);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(queryDraft.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [queryDraft]);

  useEffect(() => {
    setPage(1);
  }, [query, role, status, sort, order]);

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    setStatsError("");
    try {
      const result = await waitlistApi.stats();
      setStats(result);
    } catch (error) {
      setStatsError((error as Error).message);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    let live = true;
    setLoadingRows(true);
    setListError("");
    waitlistApi.list({
      page,
      per_page: PER_PAGE,
      q: query,
      role,
      status,
      sort,
      order,
    })
      .then((result: WaitlistPage) => {
        if (!live) return;
        const summary = summarizePage(result.meta, page);
        setRows(result.items);
        setPageInfo(summary);
        setPage(summary.page);
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
  }, [authenticated, page, query, role, status, sort, order, refreshKey]);

  useEffect(() => {
    if (!authenticated) return;
    void loadStats();
  }, [authenticated, refreshKey, loadStats]);

  useEffect(() => {
    if (detailId === null) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDetail();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [detailId]);

  const pageCount = Math.max(1, pageInfo.lastPage);
  const firstResult = rows.length ? (pageInfo.page - 1) * pageInfo.perPage + 1 : 0;
  const lastResult = rows.length ? firstResult + rows.length - 1 : 0;

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginBusy(true);
    setLoginError("");
    try {
      await waitlistApi.login(username.trim(), password);
      setPassword("");
      setAuthenticated(true);
      setPage(1);
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setLoginError((error as Error).message);
    } finally {
      setPassword("");
      setLoginBusy(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await waitlistApi.logout();
    } finally {
      setAuthenticated(false);
      setRows([]);
      setStats(null);
      setDetail(null);
      setDraft(null);
      setLoggingOut(false);
    }
  }

  function closeDetail() {
    detailRequestId.current += 1;
    setDetailId(null);
    setDetail(null);
    setDraft(null);
    setDetailError("");
  }

  async function showDetails(user: WaitlistUser) {
    const requestId = ++detailRequestId.current;
    setDetailId(user.id);
    setDetail(null);
    setDraft(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      const result = await waitlistApi.detail(user.id);
      if (requestId !== detailRequestId.current) return;
      setDetail(result);
      setDraft({
        first_name: result.first_name,
        last_name: result.last_name,
        phone: result.phone,
        role: result.role,
        status: result.status,
      });
    } catch (error) {
      if (requestId === detailRequestId.current)
        setDetailError((error as Error).message);
    } finally {
      if (requestId === detailRequestId.current) setDetailLoading(false);
    }
  }

  async function reload() {
    setActionMessage("");
    setRefreshKey((value) => value + 1);
  }

  async function saveDetail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || !draft) return;
    setSaving(true);
    setDetailError("");
    setActionMessage("");
    try {
      await waitlistApi.update(detail.id, draft);
      closeDetail();
      setActionMessage("تغییرات با موفقیت در API هاست ذخیره شد.");
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setDetailError((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteDetail() {
    if (!detail) return;
    const confirmed = await askConfirm(
      `ثبت‌نام ${fullName(detail)} با شمارهٔ ${detail.phone} حذف شود؟`,
      "بله، حذف شود",
    );
    if (!confirmed) return;
    setDeleting(true);
    setDetailError("");
    setActionMessage("");
    try {
      await waitlistApi.remove(detail.id);
      closeDetail();
      setActionMessage("ثبت‌نام از فهرست هاست حذف شد.");
      if (rows.length <= 1 && page > 1) setPage((current) => Math.max(1, current - 1));
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setDetailError((error as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  async function exportCsv() {
    setExporting(true);
    setExportError("");
    setActionMessage("");
    try {
      const file = await waitlistApi.exportCsv();
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.filename || "waitlist.csv";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setActionMessage("فایل CSV مستقیماً از API هاست دریافت شد.");
    } catch (error) {
      setExportError((error as Error).message);
    } finally {
      setExporting(false);
    }
  }

  const statCards = useMemo(
    () => [
      ["total", "کل ثبت‌نام‌ها", Users],
      ["customers", "مشتریان", UserPlus],
      ["sellers", "فروشندگان", Store],
      ["couriers", "پیک‌ها", Bike],
    ] as const,
    [],
  );

  if (!authenticated) {
    return (
      <div className="waitlist-page">
        <section className="waitlist-auth-wrap">
          <form className="panel waitlist-auth-card" onSubmit={handleLogin}>
            <span className="waitlist-auth-icon"><ClipboardList size={23} /></span>
            <p className="eyebrow">PHP HOST / WAITLIST API</p>
            <h2>ورود مستقل به لیست انتظار</h2>
            <p className="waitlist-auth-copy">این نشست جدا از ورود پنل Node.js است و فقط برای API لیست انتظار هاست استفاده می‌شود.</p>
            <label className="naz-floating-field">
              <span className="naz-floating-label">نام کاربری مدیر هاست</span>
              <input
                name="waitlist-username"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                placeholder=" "
              />
            </label>
            <label className="naz-floating-field">
              <span className="naz-floating-label">رمز عبور</span>
              <input
                name="waitlist-password"
                type="password"
                autoComplete="off"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                placeholder=" "
              />
            </label>
            {loginError && <p className="alert error" role="alert">{loginError}</p>}
            <button className="primary" disabled={loginBusy}>
              {loginBusy ? "در حال ورود…" : "ورود به لیست انتظار"}
            </button>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="waitlist-page">
      <section className="waitlist-stat-grid" aria-label="آمار لیست انتظار هاست">
        {statCards.map(([key, title, Icon]) => (
          <article className="waitlist-stat-card" key={key}>
            <span className="waitlist-stat-icon"><Icon size={18} /></span>
            <div>
              <span className="waitlist-stat-title">{title}</span>
              <strong>
                {loadingStats && !stats ? <i className="waitlist-skeleton" aria-hidden="true" /> : countLabel(stats?.[key])}
              </strong>
            </div>
          </article>
        ))}
      </section>
      {statsError && <p className="alert error waitlist-error" role="alert">دریافت آمار از API هاست ناموفق بود: {statsError}</p>}

      <section className="panel directory waitlist-directory">
        <header className="panel-head waitlist-panel-head">
          <div>
            <h2><ClipboardList size={18} /> ثبت‌نام‌های لیست انتظار <span>{countLabel(pageInfo.total)} نتیجه</span></h2>
            <p className="waitlist-caption">منبع داده فقط API هاست Nazarabad Shop است؛ نشست این صفحه از ورود پنل مستقل است.</p>
          </div>
          <div className="waitlist-actions">
            <button type="button" onClick={() => void reload()} disabled={loadingRows || loadingStats}>
              <RefreshCw size={15} className={loadingRows || loadingStats ? "spin" : ""} /> بارگذاری مجدد
            </button>
            <button type="button" onClick={() => void exportCsv()} disabled={exporting}>
              <Download size={15} className={exporting ? "spin" : ""} /> {exporting ? "در حال دریافت…" : "خروجی CSV هاست"}
            </button>
            <button type="button" onClick={() => void handleLogout()} disabled={loggingOut}>
              <LogOut size={15} /> {loggingOut ? "در حال خروج…" : "خروج از نشست هاست"}
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
              placeholder="نام، شماره تماس…"
              onChange={(event) => setQueryDraft(event.target.value)}
            />
          </label>
          <label className="waitlist-filter">
            <span>نوع کاربر</span>
            <select value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="all">همهٔ انواع</option>
              {ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="waitlist-filter">
            <span>وضعیت ثبت‌نام</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">همهٔ وضعیت‌ها</option>
              {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="waitlist-filter">
            <span>مرتب‌سازی بر اساس</span>
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="created_at">تاریخ ثبت‌نام</option>
              <option value="first_name">نام</option>
              <option value="role">نوع کاربر</option>
              <option value="status">وضعیت</option>
            </select>
          </label>
          <label className="waitlist-filter">
            <span>ترتیب</span>
            <select value={order} onChange={(event) => setOrder(event.target.value as "asc" | "desc")}>
              <option value="desc">نزولی</option>
              <option value="asc">صعودی</option>
            </select>
          </label>
        </div>

        {actionMessage && <p className="waitlist-notice" role="status">{actionMessage}<button type="button" aria-label="بستن پیام" onClick={() => setActionMessage("")}><X size={15} /></button></p>}
        {exportError && <p className="alert error waitlist-error" role="alert">دریافت CSV ناموفق بود: {exportError}</p>}
        {listError && <div className="alert error waitlist-error" role="alert">دریافت فهرست از API هاست ناموفق بود: {listError}</div>}
        {loadingRows && rows.length > 0 && <p className="waitlist-loading-note" role="status"><RefreshCw size={14} className="spin" /> در حال به‌روزرسانی فهرست…</p>}

        <div className="table-scroll waitlist-table-scroll" aria-busy={loadingRows}>
          <table className="waitlist-table">
            <thead>
              <tr><th>نوع کاربر</th><th>نام</th><th>نام خانوادگی</th><th>شماره تماس</th><th>وضعیت ثبت‌نام</th><th>تاریخ ثبت‌نام</th><th>عملیات</th></tr>
            </thead>
            <tbody>
              {rows.map((user) => (
                <tr key={String(user.id)}>
                  <td><span className={`waitlist-role role-${user.role}`}>{ROLE_LABEL[user.role]}</span></td>
                  <td>{user.first_name || "—"}</td>
                  <td>{user.last_name || "—"}</td>
                  <td dir="ltr" className="mono waitlist-phone">{user.phone}</td>
                  <td><span className={`badge waitlist-status status-${user.status}`}>{STATUS_LABEL[user.status]}</span></td>
                  <td className="date-cell">{dateLabel(user.created_at)}</td>
                  <td><button type="button" className="waitlist-view-button" onClick={() => void showDetails(user)}>جزئیات</button></td>
                </tr>
              ))}
              {loadingRows && rows.length === 0 && <tr><td colSpan={7}><p className="loading waitlist-initial-loading"><RefreshCw size={16} className="spin" /> در حال دریافت از API هاست…</p></td></tr>}
              {!loadingRows && !listError && rows.length === 0 && <tr><td colSpan={7}><div className="empty waitlist-empty"><UserPlus size={28} /><h3>ثبت‌نامی پیدا نشد</h3><p>با فیلترها یا عبارت جست‌وجو نتیجه‌ای از API دریافت نشد.</p></div></td></tr>}
            </tbody>
          </table>
        </div>

        <footer className="pager waitlist-pager">
          <span>نمایش {countLabel(firstResult)} تا {countLabel(lastResult)} از {countLabel(pageInfo.total)} ثبت‌نام</span>
          <div>
            <button type="button" disabled={page <= 1 || loadingRows} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronRight size={16} /> قبلی</button>
            <b>صفحه {countLabel(pageInfo.page)} از {countLabel(pageCount)}</b>
            <button type="button" disabled={page >= pageCount || loadingRows} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>بعدی <ChevronLeft size={16} /></button>
          </div>
        </footer>
      </section>

      {detailId !== null && (
        <div className="modal-backdrop waitlist-modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) closeDetail(); }}>
          <section className="modal modal-wide waitlist-detail-modal" role="dialog" aria-modal="true" aria-labelledby="waitlist-detail-title">
            <header>
              <div><p className="eyebrow">جزئیات ثبت‌نام هاست</p><h2 id="waitlist-detail-title">{detail ? fullName(detail) : "در حال دریافت اطلاعات"}</h2></div>
              <button type="button" onClick={closeDetail} aria-label="بستن جزئیات"><X size={18} /></button>
            </header>
            {detailLoading && <p className="loading">در حال دریافت جزئیات از PHP API…</p>}
            {detailError && <p className="alert error" role="alert">{detailError}</p>}
            {detail && draft && (
              <form onSubmit={saveDetail}>
                <dl className="waitlist-detail-grid">
                  <div><dt>شناسه</dt><dd>{toPersianDigits(String(detail.id))}</dd></div>
                  <div><dt>تاریخ ثبت‌نام</dt><dd>{dateLabel(detail.created_at)}</dd></div>
                </dl>
                <div className="waitlist-edit-grid">
                  <label><span>نام</span><input value={draft.first_name} onChange={(event) => setDraft({ ...draft, first_name: event.target.value })} /></label>
                  <label><span>نام خانوادگی</span><input value={draft.last_name} onChange={(event) => setDraft({ ...draft, last_name: event.target.value })} /></label>
                  <label><span>شماره تماس</span><input dir="ltr" inputMode="tel" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></label>
                  <label><span>نوع کاربر</span><select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value as WaitlistRole })}>{ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label><span>وضعیت ثبت‌نام</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as WaitlistStatus })}>{STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label><span>آخرین ویرایش</span><input value={dateLabel(detail.updated_at)} readOnly /></label>
                </div>
                <div className="modal-actions waitlist-modal-actions">
                  <button type="button" className="waitlist-delete-button" onClick={() => void deleteDetail()} disabled={deleting || saving}>{deleting ? "در حال حذف…" : "حذف ثبت‌نام"}</button>
                  <span />
                  <button type="button" onClick={closeDetail} disabled={saving || deleting}>بستن</button>
                  <button type="submit" className="primary" disabled={saving || deleting}>{saving ? "در حال ذخیره…" : "ذخیره تغییرات"}</button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

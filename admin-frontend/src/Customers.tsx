import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  UserRoundPlus,
  Users,
} from "lucide-react";
import {
  formatJalali,
  formatJalaliDay,
  toPersianDigits,
} from "../../shared/persianDate";

type Row = Record<string, any>;
type Api = (path: string, init?: RequestInit) => Promise<any>;

const money = (n: unknown) =>
  toPersianDigits(Number(n ?? 0).toLocaleString("fa-IR"));
const label = (name: Row) =>
  `${name.first_name ?? ""} ${name.last_name ?? ""}`.trim() || "بدون نام";
const orderBy: Record<string, string> = {
  newest: "newest",
  oldest: "oldest",
  orders: "orders",
  spend: "spend",
  codes: "codes",
};

/** The directory's whole server-side query, so no control is ever left out. */
const query = ({
  page,
  search,
  orders,
  codes,
  sort,
}: {
  page: number;
  search: string;
  orders: string;
  codes: string;
  sort: string;
}) =>
  new URLSearchParams({
    page: String(page),
    q: search,
    orders,
    codes,
    sort: orderBy[sort] ?? "newest",
  }).toString();

/**
 * The full customer list: who signed up, how many orders they placed, how much
 * they spent and when they last bought. Search, filter and sort run on the
 * server so the list stays complete rather than only the first page.
 */
export default function Customers({ api }: { api: Api }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(30);
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState("all"),
    [codes, setCodes] = useState("all");
  const [sort, setSort] = useState("newest");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true),
    [exportCapped, setExportCapped] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    api(`/users?${query({ page, search, orders, codes, sort })}`)
      .then((r) => {
        if (!live) return;
        setRows(r.rows ?? []);
        setTotal(Number(r.total ?? 0));
        setSize(Number(r.size ?? 30));
        setError("");
      })
      .catch((e) => {
        if (live) setError((e as Error).message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [api, page, search, orders, codes, sort]);
  useEffect(() => setPage(1), [search, orders, codes, sort]);

  const summary = useMemo(
    () => ({
      buyers: rows.filter((r) => Number(r.orders) > 0).length,
      spend: rows.reduce((sum, r) => sum + Number(r.spend ?? 0), 0),
      codeUses: rows.reduce((sum, r) => sum + Number(r.codeUses ?? 0), 0),
    }),
    [rows],
  );
  const pages = Math.max(1, Math.ceil(total / size));

  const exportCsv = async () => {
    // The server pages 30 rows at a time, so walk the same query to the end of
    // the current filter; the export is therefore the whole list, not a slice.
    const list: Row[] = [];
    try {
      for (let p = 1; p <= 200; p++) {
        const r = await api(`/users?${query({ page: p, search, orders, codes, sort })}`);
        list.push(...(r.rows ?? []));
        if (list.length >= Number(r.total ?? 0) || (r.rows ?? []).length === 0)
          break;
      }
    } catch {
      /* fall back to the page on screen */
    }
    const out = list.length ? list : rows;
    // 200 pages of 30 is the ceiling; say so instead of shipping a short file.
    setExportCapped(out.length < total);
    const csv = [
      [
        "نام",
        "موبایل",
        "سفارش‌ها",
        "مبلغ (تومان)",
        "کدهای مصرفی",
        "یارانهٔ کد (تومان)",
        "آخرین سفارش",
        "عضویت",
        "وضعیت",
      ],
      ...out.map((u) => [
        label(u),
        u.phone,
        String(Number(u.orders ?? 0)),
        String(Number(u.spend ?? 0)),
        String(Number(u.codeUses ?? 0)),
        String(Number(u.codeDiscount ?? 0)),
        u.lastOrder ? formatJalali(u.lastOrder) : "",
        formatJalaliDay(u.created_at),
        u.active ? "فعال" : "غیرفعال",
      ]),
    ]
      .map((line) => line.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `nazmmarket-customers-${toPersianDigits(out.length)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <section className="panel directory">
      <header className="panel-head">
        <h2>
          <Users size={17} /> فهرست مشتریان
          <span>{toPersianDigits(total)} نفر</span>
        </h2>
        <div className="panel-actions">
          <small>
            {toPersianDigits(summary.buyers)} مشتری دارای سفارش در این صفحه ·{" "}
            {money(summary.spend)} تومان خرید تکمیل‌شده ·{" "}
            {toPersianDigits(summary.codeUses)} کد تخفیف مصرف‌شده
          </small>
          <button
            onClick={() => void exportCsv()}
            title={`خروجی همین جست‌وجو، تا ${toPersianDigits(6000)} نفر`}
          >
            <Download size={15} /> خروجی CSV
          </button>
        </div>
      </header>

      <div className="directory-tools">
        <label className="search">
          <Search size={16} />
          <input
            value={search}
            placeholder="نام، نام خانوادگی یا موبایل…"
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="segmented small">
          {[
            ["all", "همه"],
            ["with", "دارای سفارش"],
            ["without", "بدون سفارش"],
          ].map(([id, text]) => (
            <button
              key={id}
              type="button"
              className={orders === id ? "on" : ""}
              onClick={() => setOrders(id)}
            >
              {text}
            </button>
          ))}
        </div>
        <div className="segmented small">
          {[
            ["all", "همهٔ کدها"],
            ["used", "کد مصرف کرده"],
            ["unused", "بدون مصرف کد"],
          ].map(([id, text]) => (
            <button
              key={id}
              type="button"
              className={codes === id ? "on" : ""}
              onClick={() => setCodes(id)}
            >
              {text}
            </button>
          ))}
        </div>
        <div className="segmented small">
          {[
            ["newest", "جدیدترین عضو"],
            ["oldest", "قدیمی‌ترین عضو"],
            ["orders", "بیشترین سفارش"],
            ["spend", "بیشترین خرید"],
            ["codes", "بیشترین کد"],
          ].map(([id, text]) => (
            <button
              key={id}
              type="button"
              className={sort === id ? "on" : ""}
              onClick={() => setSort(id)}
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      {exportCapped && (
        <p className="alert" role="status">
          خروجی CSV به {toPersianDigits(6000)} نفر نخست این فهرست محدود شد؛
          برای بقیه عبارت جست‌وجو را دقیق‌تر کنید.
        </p>
      )}

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>مشتری</th>
              <th>موبایل</th>
              <th>سفارش‌ها</th>
              <th>مبلغ خرید</th>
              <th>کدهای مصرفی</th>
              <th>آخرین سفارش</th>
              <th>عضویت</th>
              <th>موجودی کیف‌پول</th>
              <th>وضعیت</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td>
                  <b>{label(u)}</b>
                  <small>شناسه {toPersianDigits(u.id)}</small>
                </td>
                <td dir="ltr" className="mono">
                  {u.phone}
                </td>
                <td>
                  <strong>{toPersianDigits(Number(u.orders ?? 0))}</strong>
                </td>
                <td>
                  {Number(u.spend ?? 0) > 0
                    ? `${money(u.spend)} تومان`
                    : "—"}
                </td>
                <td>
                  {Number(u.codeUses ?? 0) > 0 ? (
                    <>
                      <strong>{toPersianDigits(Number(u.codeUses))} کد</strong>
                      <small>یارانه {money(u.codeDiscount)}</small>
                    </>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  {u.lastOrder ? (
                    <span className="date-cell">{formatJalali(u.lastOrder, true)}</span>
                  ) : (
                    <span className="muted">هنوز خرید نکرده</span>
                  )}
                </td>
                <td className="date-cell">{formatJalaliDay(u.created_at)}</td>
                <td>{Number(u.wallet ?? 0) > 0 ? `${money(u.wallet)} تومان` : "—"}</td>
                <td>
                  <span className={`badge ${u.active ? "approved" : "pending"}`}>
                    {u.active ? "فعال" : "غیرفعال"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && !loading && (
          <div className="empty">
            <UserRoundPlus size={28} />
            <h3>مشتری‌ای با این مشخصات پیدا نشد</h3>
            <p>عبارت جست‌وجو یا فیلتر را تغییر دهید.</p>
          </div>
        )}
        {loading && !rows.length && <p className="loading">در حال بارگذاری…</p>}
      </div>

      {pages > 1 && (
        <footer className="pager">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronRight size={16} /> قبلی
          </button>
          <span>
            صفحه {toPersianDigits(page)} از {toPersianDigits(pages)}
          </span>
          <button
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            بعدی <ChevronLeft size={16} />
          </button>
        </footer>
      )}
      <p className="definition">
        «فعال» یعنی کاربر در ۳۰ روز اخیر وارد شده است. مبلغ خرید، جمع سبد
        سفارش‌های تکمیل‌شده است و هزینهٔ ارسال هم در آن محاسبه می‌شود.
        «کدهای مصرفی» هر دو خانوادهٔ کد (فروشگاه و سراسری) را می‌شمارد؛ مبلغ آن،
        جمع تخفیفی است که روی سفارش همان مشتری اعمال شده و با لغو سفارش به صفر
        بازمی‌گردد.
      </p>
    </section>
  );
}

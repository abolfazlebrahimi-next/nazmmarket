import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, History, RefreshCw } from "lucide-react";
import { api, money } from "./api";
type Row = Record<string, any>;
export default function TripHistory() {
  const [rows, setRows] = useState<Row[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [q, setQ] = useState(""),
    [status, setStatus] = useState("all"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<Row | null>(null),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    const timer = setTimeout(() => {
      api(
        "/history?" +
          new URLSearchParams({ page: String(page), q, status, from, to }),
      )
        .then((r) => {
          if (live) {
            setRows(r.rows);
            setTotal(r.total);
            setError("");
          }
        })
        .catch((e) => {
          if (live) setError(e.message);
        })
        .finally(() => {
          if (live) setLoading(false);
        });
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [page, q, status, from, to, retry]);
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>
          <History size={20} />
          تاریخچهٔ سفرها
        </h2>
        <small>{money(total)} سفر</small>
      </div>
      <div className="history-filters">
        <label className="naz-floating-field history-filter-field">
          <span className="naz-floating-label">شماره سفارش</span>
          <input
            placeholder="مثلاً ۱۲۳۴۵۶"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="naz-floating-field history-filter-field">
          <span className="naz-floating-label">وضعیت سفر</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">همهٔ سفرهای گذشته</option>
            <option value="completed">موفق</option>
            <option value="cancelled">لغوشده</option>
            <option value="failed">ناموفق</option>
          </select>
        </label>
        <label className="naz-floating-field history-filter-field">
          <span className="naz-floating-label">از تاریخ</span>
          <input
            type="date"
            placeholder=" "
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="naz-floating-field history-filter-field">
          <span className="naz-floating-label">تا تاریخ</span>
          <input
            type="date"
            placeholder=" "
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>
      {loading ? (
        <p role="status" className="muted">
          در حال دریافت تاریخچه…
        </p>
      ) : error ? (
        <p className="alert error" role="alert">
          {error}
          <button onClick={() => setRetry((n) => n + 1)}>
            <RefreshCw size={15} />
            تلاش مجدد
          </button>
        </p>
      ) : !rows.length ? (
        <p className="empty">سفری با این فیلترها پیدا نشد.</p>
      ) : (
        <div className="history-table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th>سفارش / فروشگاه</th>
                <th>تاریخ</th>
                <th>کرایه</th>
                <th>کمیسیون</th>
                <th>خالص</th>
                <th>وضعیت</th>
                <th>جزئیات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <b dir="ltr">{r.id}</b>
                    <small>{r.store_name}</small>
                  </td>
                  <td>{new Date(r.claimed_at).toLocaleDateString("fa-IR")}</td>
                  <td>{money(r.gross_amount ?? r.courier_fee)}</td>
                  <td>{money(r.commission_amount)}</td>
                  <td className="net-amount">{money(r.amount)}</td>
                  <td>
                    {r.completed_at
                      ? "موفق"
                      : r.trip_status === "cancelled"
                        ? "لغوشده"
                        : "ناموفق"}
                  </td>
                  <td>
                    <button onClick={() => setSelected(r)}>مشاهده</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="history-pagination">
        <button
          disabled={page <= 1 || loading}
          onClick={() => setPage((p) => p - 1)}
        >
          <ChevronRight size={15} />
          قبلی
        </button>
        <span>
          صفحهٔ {money(page)} از {money(Math.max(1, Math.ceil(total / 20)))}
        </span>
        <button
          disabled={page * 20 >= total || loading}
          onClick={() => setPage((p) => p + 1)}
        >
          بعدی
          <ChevronLeft size={15} />
        </button>
      </div>
      {selected && (
        <section className="review-box">
          <div className="section-heading">
            <h3>جزئیات {selected.id}</h3>
            <button onClick={() => setSelected(null)}>بستن</button>
          </div>
          <p>فروشگاه: {selected.store_name}</p>
          <p>مقصد: {selected.address_text}</p>
          <p>پذیرش: {new Date(selected.claimed_at).toLocaleString("fa-IR")}</p>
          <p>
            تحویل:{" "}
            {selected.completed_at
              ? new Date(selected.completed_at).toLocaleString("fa-IR")
              : "ثبت نشده"}
          </p>
          {selected.completed_at && (
            <p>
              مدت سفر:{" "}
              {money(
                Math.max(
                  0,
                  Math.round(
                    (Date.parse(selected.completed_at) -
                      Date.parse(selected.claimed_at)) /
                      60000,
                  ),
                ),
              )}{" "}
              دقیقه
            </p>
          )}
          <small>مبالغ به تومان · زمان مطابق دستگاه شما</small>
        </section>
      )}
    </section>
  );
}

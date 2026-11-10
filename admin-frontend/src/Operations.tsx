import { useEffect, useState, type FormEvent } from "react";
type Row = Record<string, any>;
export default function Operations({
  api,
}: {
  api: (p: string, i?: RequestInit) => Promise<any>;
}) {
  const [data, setData] = useState<Row>({
      settings: { weather: "normal", commissionPercent: 0 },
      withdrawals: [],
      tickets: [],
      expenses: [],
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [messages, setMessages] = useState<Row[]>([]),
    [ticket, setTicket] = useState(0);
  async function load() {
    try {
      setData(await api("/operations"));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function send(p: string, body: Row, method = "POST") {
    setBusy(true);
    try {
      await api(p, { method, body: JSON.stringify(body) });
      setError("");
      await load();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function form(
    e: FormEvent<HTMLFormElement>,
    p: string,
    method = "POST",
  ) {
    e.preventDefault();
    await send(p, Object.fromEntries(new FormData(e.currentTarget)), method);
  }
  return (
    <div className="report-grid">
      {error && <p className="alert error">{error}</p>}
      <section className="panel">
        <h2>تعرفه و کارمزد</h2>
        <form
          className="product-form"
          onSubmit={(e) => void form(e, "/settings", "PUT")}
          key={JSON.stringify(data.settings)}
        >
          <label>
            شرایط جوی (تنظیم مدیر، نه سرویس هواشناسی)
            <select name="weather" defaultValue={data.settings.weather}>
              <option value="normal">عادی · ۵۰ تا ۸۰ هزار تومان</option>
              <option value="rain">بارانی · تا ۱۰۰ هزار تومان</option>
              <option value="snow">برفی · تا ۱۰۰ هزار تومان</option>
            </select>
          </label>
          <label>
            کارمزد پلتفرم از فروش (%)
            <input
              required
              type="number"
              name="commissionPercent"
              min="0"
              max="30"
              step="0.1"
              defaultValue={data.settings.commissionPercent}
            />
          </label>
          <label>
            کمیسیون از کرایهٔ پیک (%)
            <input
              name="courierCommissionPercent"
              type="number"
              required
              min="0"
              max="30"
              step="0.1"
              defaultValue={data.settings.courierCommissionPercent ?? 0}
            />
          </label>
          <button disabled={busy} className="primary">
            ذخیره برای سفارش‌های جدید
          </button>
        </form>
        <p className="definition">
          سود عملیاتی = کارمزد + کرایه دریافتی − دستمزد پیک − یارانه خرید اول −
          هزینه ثبت‌شده. مالیات و هزینه ثبت‌نشده در این عدد نیست. کارمزد پیش‌فرض
          صفر است.
        </p>
      </section>
      <section className="panel">
        <h2>ثبت هزینه عملیاتی</h2>
        <form
          className="product-form"
          onSubmit={(e) => void form(e, "/expenses")}
        >
          <label>
            شرح هزینه
            <input name="description" required />
          </label>
          <label>
            مبلغ (تومان)
            <input name="amount" required type="number" min="1" />
          </label>
          <button disabled={busy}>ثبت هزینه واقعی</button>
        </form>
        {data.expenses.map((r: Row) => (
          <p key={r.id}>
            {r.description} · {Number(r.amount).toLocaleString("fa-IR")} تومان
          </p>
        ))}
      </section>
      <section className="panel">
        <h2>درخواست‌های برداشت پیک</h2>
        {data.withdrawals.length === 0 && <p>درخواستی ثبت نشده است.</p>}
        {data.withdrawals.map((w: Row) => (
          <article className="finance-row" key={w.id}>
            <b>
              {w.full_name} · {Number(w.amount).toLocaleString("fa-IR")} تومان
            </b>
            <small>
              {w.iban} ·{" "}
              {w.status === "pending"
                ? "در انتظار پرداخت"
                : w.status === "paid"
                  ? "پرداخت ثبت‌شده"
                  : "ردشده"}
            </small>
            {w.status === "pending" && (
              <form
                className="product-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  await send(
                    `/withdrawals/${w.id}`,
                    Object.fromEntries(f),
                    "PATCH",
                  );
                }}
              >
                <select name="status">
                  <option value="paid">ثبت پرداخت بانکی انجام‌شده</option>
                  <option value="rejected">رد درخواست</option>
                </select>
                <input name="reference" placeholder="شناسه پرداخت بانکی" />
                <input name="reason" placeholder="دلیل رد" />
                <button disabled={busy}>ثبت نتیجه</button>
              </form>
            )}
          </article>
        ))}
      </section>
      <section className="panel">
        <h2>تیکت پیک‌ها</h2>
        {!data.tickets.length && <p>تیکتی ثبت نشده است.</p>}
        {data.tickets.map((t: Row) => (
          <button
            className="ticket-line"
            key={t.id}
            onClick={async () => {
              setTicket(t.id);
              try {
                setMessages((await api(`/tickets/${t.id}`)).messages);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {t.subject} · {t.full_name} · {t.status}
          </button>
        ))}
        {ticket > 0 && (
          <>
            <div className="messages">
              {messages.map((m) => (
                <p key={m.id}>
                  <b>{m.role === "admin" ? "مدیریت" : "پیک"}:</b> {m.body}
                </p>
              ))}
            </div>
            <form
              className="product-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                if (
                  await send(`/tickets/${ticket}/messages`, {
                    body: f.get("body"),
                    close: f.get("close") === "on",
                  })
                )
                  setMessages((await api(`/tickets/${ticket}`)).messages);
              }}
            >
              <textarea name="body" required placeholder="پاسخ به پیک" />
              <label>
                <input name="close" type="checkbox" /> بستن پس از پاسخ
              </label>
              <button disabled={busy}>ارسال پاسخ</button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

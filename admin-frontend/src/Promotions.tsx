import { useEffect, useMemo, useState, type FormEvent } from "react";
import { askConfirm } from "./confirm";
import {
  BadgePercent,
  Pencil,
  Plus,
  Search,
  Ticket,
  Trash2,
  Users,
} from "lucide-react";
import PersianDateField from "./PersianDateField";
import {
  formatJalali,
  formatJalaliDay,
  toPersianDigits,
} from "../../shared/persianDate";

type Row = Record<string, any>;
type Api = (path: string, init?: RequestInit) => Promise<any>;

type Code = {
  id: number;
  code: string;
  title: string;
  desc: string;
  kind: "percent" | "fixed";
  amount: number;
  minSubtotal: number;
  maxDiscount: number;
  active: boolean;
  maxUses: number;
  usageCount: number;
  used: number;
  spent: number;
  audience: "all" | "users";
  startsAt: string | null;
  expiresAt?: string | null;
  targets: { id: number; name: string; phone: string }[];
  targetCount: number;
};

const emptyDraft = {
  code: "",
  title: "",
  description: "",
  kind: "percent",
  amount: "10",
  minSubtotal: "0",
  maxDiscount: "0",
  audience: "all",
  maxUses: "0",
  startsAt: "",
  expiresAt: "",
};

const value = (n: unknown) => Number(n ?? 0);
const money = (n: number) => toPersianDigits(value(n).toLocaleString("fa-IR"));

/**
 * Platform discount codes: one form for a broadcast code and for a code handed
 * to selected customers only. Redemption is single-use per account.
 */
export default function Promotions({ api }: { api: Api }) {
  const [rows, setRows] = useState<Code[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<null | { id?: number }>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [picked, setPicked] = useState<{ id: number; name: string; phone: string }[]>([]);
  const [people, setPeople] = useState<Row[]>([]);
  const [peopleQuery, setPeopleQuery] = useState("");
  // The expanded code shows who spent it; one row open at a time keeps the
  // table scannable.
  const [expanded, setExpanded] = useState<number | null>(null);
  const [spentBy, setSpentBy] = useState<Row[]>([]);
  const [spentTotal, setSpentTotal] = useState(0);
  const [loadingSpent, setLoadingSpent] = useState(false);

  async function load() {
    try {
      const r = await api("/operations/promos");
      setRows(r.promos ?? []);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!editor || draft.audience !== "users") return;
    const timer = setTimeout(() => {
      api(`/operations/promo-customers?q=${encodeURIComponent(peopleQuery)}`)
        .then((r) => setPeople(r.customers ?? []))
        .catch(() => setPeople([]));
    }, 220);
    return () => clearTimeout(timer);
  }, [editor, peopleQuery, draft.audience]);

  const summary = useMemo(
    () => ({
      codes: rows.length,
      active: rows.filter((r) => r.active).length,
      redemptions: rows.reduce((sum, r) => sum + value(r.used), 0),
      spent: rows.reduce((sum, r) => sum + value(r.spent), 0),
    }),
    [rows],
  );

  const openNew = () => {
    setDraft(emptyDraft);
    setPicked([]);
    setPeopleQuery("");
    setEditor({});
  };
  const openEdit = (row: Code) => {
    setDraft({
      code: row.code,
      title: row.title,
      description: row.desc ?? "",
      kind: row.kind,
      amount: String(row.amount),
      minSubtotal: String(row.minSubtotal),
      maxDiscount: String(row.maxDiscount),
      audience: row.audience,
      maxUses: String(row.maxUses),
      startsAt: row.startsAt ? row.startsAt.slice(0, 10) : "",
      expiresAt: row.expiresAt ? row.expiresAt.slice(0, 10) : "",
    });
    setPicked(row.targets ?? []);
    setEditor({ id: row.id });
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(editor?.id ? `/operations/promos/${editor.id}` : "/operations/promos", {
        method: editor?.id ? "PATCH" : "POST",
        body: JSON.stringify({
          ...draft,
          amount: Math.floor(Number(draft.amount)),
          minSubtotal: Math.floor(Number(draft.minSubtotal || 0)),
          maxDiscount: Math.floor(Number(draft.maxDiscount || 0)),
          maxUses: Math.floor(Number(draft.maxUses || 0)),
          startsAt: draft.startsAt || null,
          expiresAt: draft.expiresAt || null,
          userIds: draft.audience === "users" ? picked.map((p) => p.id) : [],
        }),
      });
      setEditor(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(row: Code) {
    setBusy(true);
    try {
      await api(`/operations/promos/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !row.active }),
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(row: Code) {
    if (!(await askConfirm(`کد «${row.code}» حذف شود؟`, "بله، حذف شود")))
      return;
    setBusy(true);
    try {
      await api(`/operations/promos/${row.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  async function toggleSpent(row: Code) {
    if (expanded === row.id) {
      setExpanded(null);
      return;
    }
    setExpanded(row.id);
    setSpentBy([]);
    setSpentTotal(0);
    setLoadingSpent(true);
    try {
      const r = await api(`/operations/promos/${row.id}/redemptions`);
      setSpentBy(r.redemptions ?? []);
      setSpentTotal(Number(r.total ?? 0));
      setError("");
    } catch (e) {
      setError((e as Error).message);
      setExpanded(null);
    } finally {
      setLoadingSpent(false);
    }
  }

  return (
    <>
      <div className="mini-stats">
        <article>
          <span>کل کدها</span>
          <strong>{toPersianDigits(summary.codes)}</strong>
        </article>
        <article>
          <span>فعال</span>
          <strong>{toPersianDigits(summary.active)}</strong>
        </article>
        <article>
          <span>مصرف‌شده</span>
          <strong>{toPersianDigits(summary.redemptions)}</strong>
        </article>
        <article>
          <span>یارانه کدها (تومان)</span>
          <strong>{money(summary.spent)}</strong>
        </article>
      </div>

      <div className="toolbar">
        <p className="toolbar-note">
          <Ticket size={16} /> هر مشتری یک کد را فقط یک بار می‌تواند مصرف کند؛
          سقف کلی کد اختیاری است.
        </p>
        <button className="primary" onClick={openNew}>
          <Plus size={17} /> کد تخفیف جدید
        </button>
      </div>

      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}

      {!rows.length && !error && (
        <div className="empty">
          <BadgePercent size={30} />
          <h3>هنوز کد تخفیف سراسری ثبت نشده</h3>
          <p>
            می‌توانید کدی برای همهٔ مشتریان یا فقط برای مشتریان انتخابی بسازید.
          </p>
          <button className="primary" onClick={openNew}>
            <Plus size={16} /> ساخت اولین کد
          </button>
        </div>
      )}

      {!!rows.length && (
        <section className="panel">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>کد و عنوان</th>
                  <th>تخفیف</th>
                  <th>مخاطب</th>
                  <th>سقف مصرف</th>
                  <th>مهلت</th>
                  <th>وضعیت</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className={expanded === row.id ? "is-open" : ""}>
                    <td>
                      <b className="code-tag">{row.code}</b>
                      <small>{row.title}</small>
                    </td>
                    <td>
                      {row.kind === "percent"
                        ? `${toPersianDigits(row.amount)}٪`
                        : `${money(row.amount)} تومان`}
                      <small>
                        {row.minSubtotal
                          ? `حداقل سبد ${money(row.minSubtotal)}`
                          : "بدون حداقل سبد"}
                        {row.maxDiscount
                          ? ` · سقف ${money(row.maxDiscount)}`
                          : ""}
                      </small>
                    </td>
                    <td>
                      {row.audience === "all" ? (
                        <span className="chip chip-green">همهٔ مشتریان</span>
                      ) : (
                        <span className="chip">
                          <Users size={13} /> {toPersianDigits(row.targetCount)}{" "}
                          مشتری
                        </span>
                      )}
                      {row.audience === "users" && !!row.targets?.length && (
                        <small className="target-names">
                          {row.targets
                            .slice(0, 3)
                            .map((t) => t.name || t.phone)
                            .join("، ")}
                          {row.targets.length > 3
                            ? ` و ${toPersianDigits(row.targets.length - 3)} نفر دیگر`
                            : ""}
                        </small>
                      )}
                    </td>
                    <td>
                      <strong>
                        {toPersianDigits(row.used)} /{" "}
                        {row.maxUses ? toPersianDigits(row.maxUses) : "∞"}
                      </strong>
                      <small>
                        {row.maxUses
                          ? `باقی‌مانده ${toPersianDigits(Math.max(0, row.maxUses - value(row.used)))}`
                          : "بدون سقف کلی"}
                      </small>
                    </td>
                    <td>
                      <small className="date-cell">
                        {row.startsAt
                          ? `شروع ${formatJalaliDay(row.startsAt)}`
                          : "از الان"}
                      </small>
                      <small className="date-cell">
                        {row.expiresAt
                          ? `پایان ${formatJalaliDay(row.expiresAt)}`
                          : "بدون انقضا"}
                      </small>
                    </td>
                    <td>
                      <span
                        className={`badge ${row.active ? "approved" : "rejected"}`}
                      >
                        {row.active ? "فعال" : "غیرفعال"}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          disabled={busy}
                          onClick={() => void toggle(row)}
                        >
                          {row.active ? "توقف" : "فعال‌سازی"}
                        </button>
                        {!!row.used && (
                          <button
                            onClick={() => void toggleSpent(row)}
                            aria-expanded={expanded === row.id}
                          >
                            <Users size={14} />
                            {expanded === row.id
                              ? "بستن مشتری‌ها"
                              : `مشتری‌ها (${toPersianDigits(row.used)})`}
                          </button>
                        )}
                        <button disabled={busy} onClick={() => openEdit(row)}>
                          <Pencil size={14} /> ویرایش
                        </button>
                        <button
                          className="danger"
                          disabled={busy || value(row.used) > 0}
                          title={
                            value(row.used) > 0
                              ? "کد مصرف‌شده فقط غیرفعال می‌شود"
                              : undefined
                          }
                          onClick={() => void remove(row)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {expanded !== null && (
                  <tr className="promo-detail" key={`detail-${expanded}`}>
                    <td colSpan={7}>
                      {loadingSpent ? (
                        <p className="loading">در حال خواندن مصرف‌کنندگان…</p>
                      ) : !spentBy.length ? (
                        <p className="muted">مصرفی برای این کد ثبت نشده است.</p>
                      ) : (
                        <>
                          <ul className="redeem-list">
                            {spentBy.map((r) => (
                              <li
                                className="redeem-row"
                                key={`${r.orderId}:${r.customer?.id}`}
                              >
                                <span className="redeem-who">
                                  <b>{r.customer?.name}</b>
                                  <small dir="ltr">{r.customer?.phone}</small>
                                </span>
                                <span className="redeem-order" dir="ltr">
                                  {r.orderId}
                                </span>
                                <span className="redeem-date">
                                  {formatJalali(r.createdAt, true)}
                                </span>
                                <strong>{money(r.discount)} تومان</strong>
                              </li>
                            ))}
                          </ul>
                          {spentTotal > spentBy.length && (
                            <p className="muted">
                              {toPersianDigits(spentBy.length)} مورد اخیر از{" "}
                              {toPersianDigits(spentTotal)} مصرف نمایش داده می‌شود.
                            </p>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {editor && (
        <div className="modal-backdrop" onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditor(null);
          }}>
          <section className="modal modal-wide" role="dialog" aria-modal="true">
            <header>
              <h2>{editor.id ? "ویرایش کد تخفیف" : "کد تخفیف جدید"}</h2>
              <button onClick={() => setEditor(null)}>بستن</button>
            </header>
            <form className="promo-form" onSubmit={(e) => void submit(e)}>
              <div className="form-grid">
                <label>
                  کد تخفیف
                  <input
                    value={draft.code}
                    dir="ltr"
                    maxLength={40}
                    placeholder="NAZ1405"
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""),
                      })
                    }
                    required
                  />
                </label>
                <label>
                  عنوان
                  <input
                    value={draft.title}
                    maxLength={180}
                    placeholder="تخفیف ویژهٔ مشتریان"
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    required
                  />
                </label>
              </div>
              <label>
                توضیح کوتاه (در اپلیکیشن مشتری نمایش داده می‌شود)
                <input
                  value={draft.description}
                  maxLength={255}
                  onChange={(e) =>
                    setDraft({ ...draft, description: e.target.value })
                  }
                />
              </label>
              <div className="form-grid">
                <label>
                  نوع تخفیف
                  <select
                    value={draft.kind}
                    onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
                  >
                    <option value="percent">درصدی</option>
                    <option value="fixed">مبلغ ثابت (تومان)</option>
                  </select>
                </label>
                <label>
                  {draft.kind === "percent" ? "درصد" : "مبلغ (تومان)"}
                  <input
                    type="number"
                    min="1"
                    max={draft.kind === "percent" ? 100 : undefined}
                    value={draft.amount}
                    onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                    required
                  />
                </label>
                <label>
                  حداقل مبلغ سبد
                  <input
                    type="number"
                    min="0"
                    value={draft.minSubtotal}
                    onChange={(e) =>
                      setDraft({ ...draft, minSubtotal: e.target.value })
                    }
                  />
                </label>
                <label>
                  سقف تخفیف (۰ = بدون سقف)
                  <input
                    type="number"
                    min="0"
                    value={draft.maxDiscount}
                    onChange={(e) =>
                      setDraft({ ...draft, maxDiscount: e.target.value })
                    }
                  />
                </label>
                <label>
                  سقف کل مصرف (۰ = بدون سقف)
                  <input
                    type="number"
                    min="0"
                    value={draft.maxUses}
                    onChange={(e) => setDraft({ ...draft, maxUses: e.target.value })}
                  />
                </label>
                <div>
                  <span className="field-title">تاریخ شروع (شمسی)</span>
                  <PersianDateField
                    value={draft.startsAt}
                    onChange={(iso) => setDraft({ ...draft, startsAt: iso ?? "" })}
                  />
                </div>
                <div>
                  <span className="field-title">تاریخ پایان (شمسی)</span>
                  <PersianDateField
                    value={draft.expiresAt}
                    minIso={draft.startsAt || today}
                    onChange={(iso) => setDraft({ ...draft, expiresAt: iso ?? "" })}
                  />
                </div>
              </div>

              <div className="audience">
                <span className="field-title">مخاطبان کد</span>
                <div className="segmented">
                  <button
                    type="button"
                    className={draft.audience === "all" ? "on" : ""}
                    onClick={() => setDraft({ ...draft, audience: "all" })}
                  >
                    همهٔ مشتریان
                  </button>
                  <button
                    type="button"
                    className={draft.audience === "users" ? "on" : ""}
                    onClick={() => setDraft({ ...draft, audience: "users" })}
                  >
                    فقط مشتریان انتخابی
                  </button>
                </div>
                {draft.audience === "users" && (
                  <div className="picker">
                    <label className="search">
                      <Search size={16} />
                      <input
                        value={peopleQuery}
                        placeholder="جست‌وجو با نام یا شماره موبایل…"
                        onChange={(e) => setPeopleQuery(e.target.value)}
                      />
                    </label>
                    <div className="picker-list">
                      {people.map((person) => {
                        const on = picked.some((p) => p.id === Number(person.id));
                        return (
                          <button
                            type="button"
                            key={person.id}
                            className={on ? "on" : ""}
                            onClick={() =>
                              setPicked((old) =>
                                on
                                  ? old.filter((p) => p.id !== Number(person.id))
                                  : [
                                      ...old,
                                      {
                                        id: Number(person.id),
                                        name:
                                          `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() ||
                                          "بدون نام",
                                        phone: person.phone,
                                      },
                                    ],
                              )
                            }
                          >
                            <span>
                              <b>
                                {`${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() ||
                                  "بدون نام"}
                              </b>
                              <small dir="ltr">{person.phone}</small>
                            </span>
                            <em>
                              {toPersianDigits(Number(person.orders ?? 0))} سفارش
                            </em>
                          </button>
                        );
                      })}
                      {!people.length && (
                        <p className="picker-empty">مشتری‌ای با این عبارت پیدا نشد.</p>
                      )}
                    </div>
                    <p className="picked">
                      {picked.length
                        ? `${toPersianDigits(picked.length)} مشتری انتخاب شده — کد فقط در حساب این‌ها اعمال می‌شود.`
                        : "هنوز کسی انتخاب نشده است."}
                    </p>
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setEditor(null)}>
                  انصراف
                </button>
                <button className="primary" type="submit" disabled={busy}>
                  {busy ? "در حال ذخیره…" : "ذخیرهٔ کد تخفیف"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

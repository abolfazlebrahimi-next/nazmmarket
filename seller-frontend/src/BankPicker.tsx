import { useMemo, useState } from "react";
import { Check, Search, ShoppingBag } from "lucide-react";
import type { Product } from "./api";
const categories = [
  ["drinks", "نوشیدنی"],
  ["dairy", "لبنیات"],
  ["snacks", "تنقلات"],
  ["grocery", "خواربار"],
  ["fresh", "میوه و سبزی"],
  ["protein", "پروتئینی"],
  ["bakery", "نان و شیرینی"],
  ["hygiene", "بهداشتی"],
  ["other", "سایر"],
];
export default function BankPicker({
  bank,
  existing,
  busy,
  onAdd,
}: {
  bank: Product[];
  existing: Product[];
  busy: boolean;
  onAdd: (ids: number[]) => Promise<void>;
}) {
  const [category, setCategory] = useState(""),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState<number[]>([]);
  const owned = new Set(existing.map((p) => p.masterId));
  const visible = useMemo(
    () =>
      bank.filter(
        (p) =>
          (!category || p.category === category) &&
          p.name.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()),
      ),
    [bank, category, query],
  );
  return (
    <div className="bank-picker">
      <div className="bank-intro">
        <ShoppingBag size={22} />
        <div>
          <strong>اول موضوع، بعد انتخاب کالا</strong>
          <p>
            کالاها با موجودی صفر اضافه می‌شوند. قیمت و موجودی هر کدام را در
            فروشگاه خودتان ویرایش کنید.
          </p>
        </div>
      </div>
      <div className="bank-toolbar">
        <select
          className="input"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">انتخاب موضوع…</option>
          {categories.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <div className="search-box">
          <Search size={16} />
          <input
            placeholder="جست‌وجوی نام محصول…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      {!category ? (
        <div className="bank-empty">
          برای دیدن محصولات، یک موضوع انتخاب کنید.
        </div>
      ) : (
        <>
          <div className="bank-select-tools">
            <button
              className="btn secondary small"
              onClick={() =>
                setSelected([
                  ...new Set([
                    ...selected,
                    ...visible.filter((p) => !owned.has(p.id)).map((p) => p.id),
                  ]),
                ])
              }
            >
              انتخاب همه نتایج
            </button>
            <button className="text-action" onClick={() => setSelected([])}>
              پاک کردن انتخاب‌ها
            </button>
            <small>{selected.length} کالا انتخاب‌شده</small>
          </div>
          <div className="bank-grid">
            {visible.map((p) => (
              <label
                className={`bank-tile ${selected.includes(p.id) ? "checked" : ""} ${owned.has(p.id) ? "owned" : ""}`}
                key={p.id}
              >
                <input
                  type="checkbox"
                  disabled={owned.has(p.id) || busy}
                  checked={owned.has(p.id) || selected.includes(p.id)}
                  onChange={(e) =>
                    setSelected((old) =>
                      e.target.checked
                        ? [...old, p.id]
                        : old.filter((id) => id !== p.id),
                    )
                  }
                />
                <span className="bank-check">
                  <Check size={13} />
                </span>
                <img src={p.imageUrl} alt={p.name} loading="lazy" />
                <strong>{p.name}</strong>
                <small>
                  {owned.has(p.id) ? "در فروشگاه شما موجود است" : p.unit}
                </small>
              </label>
            ))}
          </div>
          {visible.length === 0 && (
            <div className="bank-empty">کالایی با این جست‌وجو پیدا نشد.</div>
          )}
        </>
      )}
      <div className="bank-footer">
        <span>{selected.length} کالا برای افزودن</span>
        <button
          className="btn primary"
          disabled={busy || selected.length === 0 || selected.length > 100}
          onClick={() => void onAdd(selected)}
        >
          {busy ? "در حال افزودن…" : "افزودن گروهی به فروشگاه"}
        </button>
      </div>
    </div>
  );
}

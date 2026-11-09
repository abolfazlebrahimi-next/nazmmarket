import { BadgeCheck, Clock3, Flame, Heart, Minus, Plus, Star, TicketPercent, Trash2, X, Zap } from "lucide-react";
import type { ReactNode } from "react";
import type { Product, Store as StoreType } from "../data";
import { discountOf, faNum } from "../data";
import type { CardHandlers } from "../ctx";

export const pd = (v: string | number) => String(v).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
export const toEn = (v: string) => v.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
export const pad2 = (v: number) => String(v).padStart(2, "0");

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function Wordmark({ twoLine = false, size = "text-[20px]", className = "" }: { twoLine?: boolean; size?: string; className?: string }) {
  if (twoLine)
    return (
      <span className={`${size} font-black leading-[1.1] text-brand ${className}`}>
        ناز!<br />
        مارکت
      </span>
    );
  return <span className={`text-[18px] font-black tracking-tight text-brand ${className}`}>ناز! مارکت</span>;
}

export function QtyStepper({ qty, onInc, onDec, small = false }: { qty: number; onInc: () => void; onDec: () => void; small?: boolean }) {
  const btn = small ? "h-7 w-7" : "h-9 w-9";
  return (
    <div className={`inline-flex items-center gap-1 rounded-full border border-line bg-white shadow-sm ${small ? "p-0.5" : "p-1"}`} dir="ltr">
      <button type="button" onClick={onDec} aria-label="کم کردن" className={`${btn} flex items-center justify-center rounded-full text-ink transition hover:bg-brand-soft hover:text-brand active:scale-90`}>
        {qty <= 1 ? <Trash2 className={small ? "h-3.5 w-3.5" : "h-4 w-4"} /> : <Minus className={small ? "h-3.5 w-3.5" : "h-4 w-4"} />}
      </button>
      <span className={`min-w-5 text-center font-extrabold ${small ? "text-xs" : "text-sm"}`}>{pd(qty)}</span>
      <button type="button" onClick={onInc} aria-label="افزودن" className={`${btn} flex items-center justify-center rounded-full text-ink transition hover:bg-brand-soft hover:text-brand active:scale-90`}>
        <Plus className={small ? "h-3.5 w-3.5" : "h-4 w-4"} />
      </button>
    </div>
  );
}

export function ProductVisual({ product, size = "md" }: { product: Product; size?: "md" | "lg" }) {
  const Icon = product.icon;
  return (
    <div className={`relative flex items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br ${product.bg} ${size === "lg" ? "h-52" : "h-24"}`}>
      <div className="absolute -left-5 -top-6 h-20 w-20 rounded-full bg-white/25" />
      <div className="absolute -bottom-8 -right-4 h-24 w-24 rounded-full bg-white/20" />
      <Icon className={`${size === "lg" ? "h-24 w-24" : "h-11 w-11"} relative drop-shadow-sm ${product.iconColor}`} strokeWidth={1.4} />
      {discountOf(product) > 0 && (
        <span className="absolute right-2 top-2 inline-flex items-center gap-0.5 rounded-lg bg-brand px-1.5 py-1 text-[10px] font-black text-white shadow">
          <Flame className="h-3 w-3 fill-current" /> ٪{pd(discountOf(product))}
        </span>
      )}
    </div>
  );
}

export function ProductCard({ product, h, width }: { product: Product; h: CardHandlers; width?: string }) {
  const qty = h.qtyOf(product.id);
  return (
    <div className={`${width ?? ""} group relative flex shrink-0 snap-start flex-col rounded-3xl border border-line bg-white p-2 shadow-[0_6px_18px_-12px_rgba(30,20,10,0.35)] transition-transform duration-300 hover:-translate-y-1`}>
      <button type="button" onClick={() => h.onOpen(product)} className="text-right" aria-label={product.name}>
        <ProductVisual product={product} />
      </button>
      <button
        type="button"
        onClick={() => h.onFav(product.id)}
        aria-label="افزودن به علاقه‌مندی‌ها"
        className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow backdrop-blur transition active:scale-90"
      >
        <Heart className={`h-3.5 w-3.5 ${h.isFav(product.id) ? "fill-[#f43f5e] text-[#f43f5e]" : "text-muted"}`} />
      </button>
      <div className="flex flex-1 flex-col px-1 pb-1 pt-2">
        <button type="button" onClick={() => h.onOpen(product)} className="line-clamp-2 min-h-9 text-right text-[11px] font-bold leading-4.5 text-ink">
          {product.name}
        </button>
        <div className="mt-auto pt-1.5">
          {product.oldPrice && <p className="text-[10px] font-medium text-[#b6b1aa] line-through">{faNum(product.oldPrice)}</p>}
          <div className="flex items-end justify-between gap-1">
            <p className="text-[12px] font-black text-ink">
              {faNum(product.price)} <span className="text-[9px] font-bold text-muted">تومان</span>
            </p>
            {qty === 0 ? (
              <button
                type="button"
                onClick={() => h.onAdd(product)}
                aria-label={`افزودن ${product.name} به سبد`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-white text-ink shadow-sm transition hover:border-brand hover:bg-brand hover:text-white active:scale-90"
              >
                <Plus className="h-4 w-4" strokeWidth={2.6} />
              </button>
            ) : (
              <QtyStepper small qty={qty} onInc={() => h.onAdd(product)} onDec={() => h.onDec(product.id)} />
            )}
          </div>
          {product.tag && <p className="mt-1.5 w-fit rounded-md bg-brand px-1.5 py-0.5 text-[9px] font-black text-white">{product.tag}</p>}
        </div>
      </div>
    </div>
  );
}

export function StoreCard({ store, onOpen }: { store: StoreType; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="flex w-full gap-3 border-b border-line bg-white p-4 text-right transition last:border-0 hover:bg-[#fffaf6] active:bg-brand-soft/50">
      <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] bg-gradient-to-br ${store.gradient} text-base font-black text-white shadow-md`}>
        {store.initial}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-extrabold text-ink">{store.name}</span>
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium text-muted">
          {store.isNew ? (
            <span className="font-bold text-ink">جدید</span>
          ) : (
            <span className="inline-flex items-center gap-0.5 font-bold text-ink">
              <Star className="h-3 w-3 fill-[#ffb020] text-[#ffb020]" /> {pd((store.rating ?? 0).toFixed(1))}
            </span>
          )}
          <span className="text-line">|</span>
          <span>تا {pd(store.minutes)} دقیقه</span>
          <span className="text-line">|</span>
          <span>ارسال {faNum(store.fee)} · با مشتری</span>
        </span>
        <span className="mt-1 block truncate text-[10px] text-muted">{store.area}</span>
        <span className="mt-2 flex flex-wrap gap-1.5">
          {store.tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-md bg-[#f4f3f0] px-1.5 py-1 text-[9px] font-bold text-[#55524e]">
              {t.includes("تضمین") ? <BadgeCheck className="h-3 w-3 text-mint" /> : t.includes("توربو") ? <Zap className="h-3 w-3 fill-[#ffb020] text-[#ffb020]" /> : <Clock3 className="h-3 w-3 text-brand" />}
              {t}
            </span>
          ))}
          {store.offText && (
            <span className="inline-flex items-center gap-1 rounded-md bg-[#f4f3f0] px-1.5 py-1 text-[9px] font-bold text-[#55524e]">
              <TicketPercent className="h-3 w-3 text-brand" /> {store.offText}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center lg:items-center lg:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="بستن" onClick={onClose} className="fade-in absolute inset-0 bg-ink/45 backdrop-blur-[2px]" />
      <div className="sheet-up relative max-h-[86dvh] w-full max-w-[430px] overflow-y-auto rounded-t-[26px] bg-white px-5 pb-8 pt-3 app-scroll lg:max-w-lg lg:rounded-[24px]">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line md:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-black text-ink">{title}</h3>
          <button type="button" onClick={onClose} aria-label="بستن" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f4f3f0] text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Modal({ onClose, children, label }: { onClose: () => void; children: ReactNode; label: string }) {
  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-5" role="dialog" aria-modal="true" aria-label={label}>
      <button type="button" aria-label="بستن" onClick={onClose} className="fade-in absolute inset-0 bg-ink/50 backdrop-blur-[2px]" />
      <div className="modal-in relative w-full max-w-[420px] rounded-[26px] bg-white p-4 shadow-2xl">{children}</div>
    </div>
  );
}

export function ScreenHeader({ title, onBack, end }: { title: string; onBack: () => void; end?: ReactNode }) {
  return (
    <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-white/92 px-4 py-3 backdrop-blur md:top-16">
      <button type="button" onClick={onBack} aria-label="بازگشت" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f3f0] text-ink transition active:scale-90">
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
      <h2 className="flex-1 truncate text-[15px] font-black text-ink">{title}</h2>
      {end}
    </div>
  );
}

export function Empty({ icon: Icon, title, desc, actionLabel, onAction }: { icon: typeof X; title: string; desc: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="px-6 py-16 text-center sm:py-24">
      <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#f4f3f0]">
        <Icon className="h-9 w-9 text-muted" />
      </span>
      <p className="mt-4 text-[14px] font-black text-ink">{title}</p>
      <p className="mx-auto mt-1.5 max-w-64 text-[11px] font-medium leading-5 text-muted">{desc}</p>
      {actionLabel && onAction && (
        <button type="button" onClick={onAction} className="mt-5 rounded-2xl bg-brand px-5 py-3 text-[12px] font-black text-white shadow-lg shadow-brand/30 transition active:scale-95">
          {actionLabel}
        </button>
      )}
    </div>
  );
}

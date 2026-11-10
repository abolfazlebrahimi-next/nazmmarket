import { useMemo, useState } from "react";
import {
  Bike,
  CheckCircle2,
  Search,
  ShoppingBasket,
  Star,
  Store,
  TicketPercent,
  Truck,
  X,
} from "lucide-react";
import {
  BackButton,
  ProductCard,
  ProductVisual,
  QtyStepper,
  ScreenHeader,
  StoreCard,
  Empty,
  pd,
} from "../components/ui";
import type { AppCtx } from "../ctx";
import { categories, faNum, products, storeById, stores } from "../data";

/* ---------------- Store page ---------------- */
export function StorePage({ c, storeId }: { c: AppCtx; storeId: number }) {
  const [cat, setCat] = useState("all");
  const store = storeById(storeId)!;
  const storeProducts = products.filter((p) => p.storeId === storeId);
  const visible =
    cat === "all"
      ? storeProducts
      : storeProducts.filter((p) => p.category === cat);
  const storeCats = categories.filter(
    (ct) => ct.id === "all" || storeProducts.some((p) => p.category === ct.id),
  );

  return (
    <div
      className={`fade-rise mx-auto w-full max-w-6xl ${c.cartCount > 0 ? "pb-24" : "pb-6"}`}
    >
      <div className="relative px-4 pb-3 pt-16">
        <div className="absolute inset-x-4 top-3 flex items-center justify-between">
          <BackButton onBack={() => c.closeSub()} className="back-on-cover" />
          <button
            type="button"
            onClick={() => c.openSub({ name: "search" })}
            aria-label="جستجو"
            className="back-button back-on-cover"
          >
            <Search size={20} />
          </button>
        </div>
        <div className="relative flex items-center gap-3 text-ink">
          <span className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-[20px] bg-white text-lg font-black text-brand shadow-md">
            {store.logoUrl ? (
              <img
                src={store.logoUrl}
                alt={`لوگوی ${store.name}`}
                className="h-full w-full object-contain p-1"
              />
            ) : (
              store.initial
            )}
          </span>
          <div>
            <h1 className="flex items-center gap-1.5 text-[16px] font-black">
              {store.name}
            </h1>
            <p className="mt-1 text-[11px] font-medium text-muted">
              {store.area} · شهرستان نظرآباد
            </p>
          </div>
        </div>
      </div>
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto border-b border-line bg-white px-4 py-3">
        {[
          {
            icon: Star,
            text: store.isNew ? "جدید" : pd((store.rating ?? 0).toFixed(1)),
          },
          { icon: Bike, text: `تا ${pd(store.minutes)} دقیقه` },
          { icon: Truck, text: "کرایه عادی ۵۰–۸۰ هزار تومان" },
          { icon: ShoppingBasket, text: `حداقل سبد ${faNum(store.minBasket)}` },
          {
            icon: Store,
            text: store.type === "hypermarket" ? "هایپرمارکت" : "سوپرمارکت",
          },
        ].map((chip, i) => (
          <span
            key={i}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#f4f3f0] px-2.5 py-1.5 text-[10px] font-extrabold text-ink"
          >
            <chip.icon className="h-3.5 w-3.5 text-brand" /> {chip.text}
          </span>
        ))}
      </div>
      <div className="no-scrollbar sticky top-0 z-20 flex gap-2 overflow-x-auto border-b border-line bg-white/95 px-4 py-2.5 backdrop-blur md:top-16">
        {storeCats.map((ct) => (
          <button
            key={ct.id}
            type="button"
            onClick={() => setCat(ct.id)}
            aria-pressed={cat === ct.id}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-extrabold transition ${cat === ct.id ? "bg-ink text-white" : "bg-[#f4f3f0] text-muted hover:text-ink"}`}
          >
            {ct.name}
          </button>
        ))}
      </div>
      <div
        key={cat}
        className="fade-rise grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      >
        {visible.map((p) => (
          <ProductCard key={p.id} product={p} h={c.cardHandlers(store.id)} />
        ))}
      </div>
      {c.cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] md:bottom-6 z-40 mx-auto w-full max-w-[430px] px-4">
          <button
            type="button"
            onClick={() => c.go("cart")}
            className="flex w-full items-center justify-between rounded-2xl bg-ink px-4 py-3.5 text-white shadow-2xl transition active:scale-[0.99]"
          >
            <span className="flex items-center gap-2 text-[12px] font-black">
              <span className="flex h-6 min-w-6 items-center justify-center rounded-lg bg-brand px-1 text-[11px]">
                {pd(c.cartCount)}
              </span>
              مشاهده سبد خرید
            </span>
            <span className="text-[13px] font-black">
              {faNum(c.subtotal)} تومان
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Category page ---------------- */
export function CategoryPage({ c, catId }: { c: AppCtx; catId: string }) {
  const cat = categories.find((ct) => ct.id === catId);
  const list = products.filter((p) => p.category === catId);
  return (
    <div className="fade-rise mx-auto w-full max-w-6xl pb-6">
      <ScreenHeader title={cat?.name ?? ""} onBack={() => c.closeSub()} />
      <div className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {list.map((p) => (
          <ProductCard key={p.id} product={p} h={c.cardHandlers()} />
        ))}
      </div>
    </div>
  );
}

/* ---------------- Search ---------------- */
export function SearchPage({ c }: { c: AppCtx }) {
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const t = q.trim();
    return t
      ? {
          products: products.filter((p) => p.name.includes(t)),
          stores: stores.filter(
            (s) => s.name.includes(t) || s.area.includes(t),
          ),
        }
      : null;
  }, [q]);

  return (
    <div className="search-page fade-rise mx-auto w-full max-w-6xl pb-6">
      <div className="search-toolbar z-30 flex items-center gap-2 bg-white px-4 py-3">
        <BackButton onBack={() => c.closeSub()} />
        <div className="search-field">
          <Search className="h-4.5 w-4.5 shrink-0 text-muted" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جست‌وجوی کالا یا فروشگاه"
            className="search-input"
            type="search"
            aria-label="جستجوی کالا یا فروشگاه"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="پاک کردن"
              className="shrink-0 text-muted"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {!results && (
        <div className="p-4">
          <p className="text-[12px] font-black text-ink">
            جستجوهای پرتکرار در نظرآباد
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              "شیر تازه",
              "نان سنگک",
              "تخم‌مرغ",
              "نوشابه",
              "برنج ایرانی",
              "چیپس",
              "مرغ تازه",
              "پرتقال",
            ].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setQ(t)}
                className="rounded-full border border-line bg-white px-3 py-2 text-[11px] font-bold text-ink transition hover:border-brand/50 active:scale-95"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {results && (
        <div>
          {results.stores.length > 0 && (
            <div className="mx-4 border-y border-line bg-white">
              {results.stores.map((s) => (
                <StoreCard
                  key={s.id}
                  store={s}
                  onOpen={() => c.openSub({ name: "store", id: s.id })}
                />
              ))}
            </div>
          )}
          <p className="px-4 pb-2 pt-4 text-[12px] font-black text-ink">
            کالاها ({pd(results.products.length)})
          </p>
          <div className="grid grid-cols-2 gap-2.5 px-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {results.products.map((p) => (
              <ProductCard key={p.id} product={p} h={c.cardHandlers()} />
            ))}
          </div>
          {results.products.length === 0 && results.stores.length === 0 && (
            <Empty
              icon={Search}
              title="نتیجه‌ای پیدا نشد"
              desc="عبارت دیگری را امتحان کنید؛ مثلاً «شیر» یا «نان»"
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- Product modal ---------------- */
export function ProductModal({ c }: { c: AppCtx }) {
  const p = c.productModal;
  if (!p) return null;
  const qty = c.qtyOf(p.id);
  const suggestions = products
    .filter((item) => item.category === p.category && item.id !== p.id)
    .slice(0, 8);
  const addAction =
    qty === 0 ? (
      <button
        type="button"
        onClick={() => c.handleAdd(p)}
        className="rounded-2xl bg-brand px-5 py-3 text-[12px] font-black text-white transition active:scale-95"
      >
        افزودن به سبد خرید
      </button>
    ) : (
      <QtyStepper
        qty={qty}
        onInc={() => c.handleAdd(p)}
        onDec={() => c.handleDec(p.id)}
      />
    );

  return (
    <div
      className="fixed inset-0 z-[85] bg-white md:flex md:items-center md:justify-center md:bg-ink/50 md:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={p.name}
    >
      <button
        type="button"
        aria-label="بستن"
        onClick={c.closeProduct}
        className="fade-in absolute inset-0 hidden bg-ink/50 backdrop-blur-[2px] md:block"
      />
      <div className="relative flex h-full w-full flex-col bg-white md:h-auto md:max-h-[90dvh] md:max-w-[430px] md:overflow-y-auto md:rounded-[26px] md:p-4 md:shadow-2xl">
        <div className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur md:hidden">
          <BackButton onBack={c.closeProduct} />
          <span className="flex-1 truncate text-[13px] font-black text-ink">
            جزئیات کالا
          </span>
          <button
            type="button"
            onClick={() => c.toggleFav(p.id)}
            aria-label="علاقه‌مندی"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f4f3f0]"
          >
            <HeartIcon filled={c.isFav(p.id)} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto pb-5 md:overflow-visible md:pb-0">
          <div className="relative mx-4 mt-4 md:mx-0 md:mt-0">
            <ProductVisual product={p} size="lg" />
            <button
              type="button"
              onClick={c.closeProduct}
              aria-label="بستن"
              className="absolute right-3 top-3 hidden h-9 w-9 items-center justify-center rounded-full bg-white shadow-md md:flex"
            >
              <X className="h-4.5 w-4.5" />
            </button>
            <button
              type="button"
              onClick={() => c.toggleFav(p.id)}
              aria-label="علاقه‌مندی"
              className="absolute left-3 top-3 hidden h-9 w-9 items-center justify-center rounded-full bg-white shadow-md md:flex"
            >
              <HeartIcon filled={c.isFav(p.id)} />
            </button>
          </div>
          <div className="px-5 pt-4 md:px-1">
            <h3 className="text-[16px] font-black leading-7 text-ink">
              {p.name}
            </h3>
            <p className="mt-1 text-[11px] font-medium text-muted">
              {p.unit} · موجود در فروشگاه‌های نظرآباد
            </p>
            {p.description && (
              <p className="mt-3 whitespace-pre-wrap text-[12px] leading-7 text-muted">
                {p.description}
              </p>
            )}
            {p.tag && (
              <p className="mt-2.5 w-fit rounded-lg bg-brand-soft px-2 py-1 text-[10px] font-black text-brand-dark">
                {p.tag}
              </p>
            )}
            <div className="mt-4 hidden items-center justify-between border-t border-dashed border-line pt-4 md:flex">
              <div>
                {p.oldPrice && (
                  <p className="text-[11px] font-medium text-[#b6b1aa] line-through">
                    {faNum(p.oldPrice)}
                  </p>
                )}
                <p className="text-[16px] font-black text-ink">
                  {faNum(p.price)}{" "}
                  <span className="text-[10px] font-bold text-muted">
                    تومان
                  </span>
                </p>
              </div>
              {addAction}
            </div>
          </div>
          <section className="mt-6 md:hidden">
            <div className="flex items-center justify-between px-4">
              <h4 className="text-[13px] font-black text-ink">
                محصولات پیشنهادی
              </h4>
              <span className="text-[10px] font-medium text-muted">
                از همین دسته
              </span>
            </div>
            <div className="no-scrollbar mt-3 flex gap-2.5 overflow-x-auto px-4 pb-2">
              {suggestions.map((item) => (
                <ProductCard
                  key={item.id}
                  product={item}
                  h={c.cardHandlers()}
                  width="w-[148px]"
                />
              ))}
            </div>
          </section>
        </div>
        <div className="sticky bottom-0 z-20 flex shrink-0 items-center justify-between gap-3 border-t border-line bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
          <div>
            {p.oldPrice && (
              <p className="text-[10px] text-muted line-through">
                {faNum(p.oldPrice)}
              </p>
            )}
            <p className="text-[14px] font-black text-ink">
              {faNum(p.price)}{" "}
              <span className="text-[9px] text-muted">تومان</span>
            </p>
          </div>
          {qty === 0 ? (
            addAction
          ) : (
            <QtyStepper
              qty={qty}
              onInc={() => c.handleAdd(p)}
              onDec={() => c.handleDec(p.id)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4.5 w-4.5`}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      style={{ color: filled ? "#f43f5e" : "#1c1b1a" }}
    >
      <path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3.4 1-4.5 2.5C10.9 4 9.3 3 7.5 3A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z" />
    </svg>
  );
}

/* ---------------- Store picker sheet ---------------- */
export function StorePickerSheet({ c }: { c: AppCtx }) {
  return (
    <div
      className="fixed inset-0 z-[84] flex items-end justify-center lg:items-center lg:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="انتخاب فروشگاه"
    >
      <button
        type="button"
        aria-label="بستن"
        onClick={c.closeStorePicker}
        className="fade-in absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
      />
      <div className="sheet-up relative max-h-[86dvh] w-full max-w-[430px] overflow-y-auto rounded-t-[26px] bg-white px-5 pb-8 pt-3 app-scroll lg:max-w-lg lg:rounded-[24px]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line md:hidden" />
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-base font-black text-ink">انتخاب فروشگاه</h3>
          <button
            type="button"
            onClick={c.closeStorePicker}
            aria-label="بستن"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f4f3f0]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-3 text-[11px] font-medium text-muted">
          کالاهای سبد شما از فروشگاه انتخابی آماده و ارسال می‌شوند.
        </p>
        <div className="space-y-2">
          {stores.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                c.pickStore(s.id);
                c.closeStorePicker();
                c.toast(`فروشگاه «${s.name}» انتخاب شد`);
              }}
              className={`flex w-full items-center gap-3 rounded-3xl border p-3 text-right transition active:scale-[0.99] ${c.cart.storeId === s.id ? "border-brand bg-brand-soft/60" : "border-line hover:border-brand/40"}`}
            >
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${s.gradient} text-[12px] font-black text-white`}
              >
                {s.initial}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-black text-ink">
                  {s.name}
                </span>
                <span className="mt-0.5 block text-[10px] font-medium text-muted">
                  تا {pd(s.minutes)} دقیقه · ارسال {faNum(s.fee)} تومان با مشتری
                  · {s.area}
                </span>
              </span>
              {c.cart.storeId === s.id && (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-brand" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Replace cart prompt ---------------- */
export function ReplacePrompt({ c }: { c: AppCtx }) {
  const rp = c.replacePrompt;
  if (!rp) return null;
  const store = storeById(rp.storeId);
  return (
    <div
      className="fixed inset-0 z-[86] flex items-center justify-center p-6"
      role="alertdialog"
      aria-modal="true"
      aria-label="تغییر فروشگاه سبد خرید"
    >
      <button
        type="button"
        aria-label="انصراف"
        onClick={c.closeReplace}
        className="fade-in absolute inset-0 bg-ink/50 backdrop-blur-[2px]"
      />
      <div className="modal-in relative w-full max-w-[350px] rounded-[26px] bg-white p-5 text-center shadow-2xl">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand">
          <ShoppingBasket className="h-7 w-7" />
        </span>
        <h3 className="mt-4 text-[15px] font-black text-ink">
          سبد خریدتان از فروشگاه دیگری است
        </h3>
        <p className="mx-auto mt-2 max-w-64 text-[11.5px] font-medium leading-6 text-muted">
          برای افزودن کالا از «{store?.name}»، سبد فعلی حذف و سبد جدید ساخته
          می‌شود.
        </p>
        <div className="mt-5 space-y-2">
          <button
            type="button"
            onClick={c.confirmReplace}
            className="w-full rounded-2xl bg-brand py-3.5 text-[13px] font-black text-white transition active:scale-[0.99]"
          >
            حذف سبد و افزودن کالا
          </button>
          <button
            type="button"
            onClick={c.closeReplace}
            className="w-full rounded-2xl bg-[#f4f3f0] py-3.5 text-[13px] font-black text-ink transition active:scale-[0.99]"
          >
            انصراف
          </button>
        </div>
        <p className="mt-3 flex items-center justify-center gap-1 text-[10px] font-semibold text-muted">
          <TicketPercent className="h-3 w-3" /> کدهای تخفیف در سبد جدید باقی
          نمی‌مانند
        </p>
      </div>
    </div>
  );
}

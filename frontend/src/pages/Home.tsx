import { useState } from "react";
import {
  BadgeCheck,
  ChevronLeft,
  History,
  Heart,
  MapPin,
  Navigation,
  ShoppingBasket,
  Store,
  Timer,
  X,
  Zap,
} from "lucide-react";
import {
  Empty,
  ProductCard,
  ProductVisual,
  ScreenHeader,
  StoreCard,
  pd,
} from "../components/ui";
import MapPicker from "../components/MapPicker";
import type { AppCtx } from "../ctx";
import { categories, faNum, products, stores } from "../data";

export function HomePage({ c }: { c: AppCtx }) {
  const [storeFilter, setStoreFilter] = useState<"all" | "hyper" | "date">(
    "all",
  );
  const filteredStores = stores.filter((s) => {
    if (storeFilter === "hyper") return s.type === "hypermarket";
    if (storeFilter === "date") return s.tags.some((t) => t.includes("تضمین"));
    return true;
  });

  const openStore = (id: number) => c.openSub({ name: "store", id });
  const section = "mx-auto w-full max-w-6xl px-4 md:px-6";

  return (
    <div className="fade-rise mx-auto min-h-dvh w-full max-w-7xl pb-4 md:pb-10">
      {/* shortcut tiles */}
      <div className={`${section} mt-3`}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <button
            type="button"
            onClick={() => {
              setStoreFilter("all");
              c.openSub({ name: "stores" });
            }}
            className="relative overflow-hidden rounded-3xl bg-[#eaf4ee] p-3.5 text-right transition active:scale-[0.98] md:hover:brightness-[0.98]"
          >
            <span className="floaty block w-fit rounded-2xl bg-white p-2.5 shadow-sm">
              <ShoppingBasket className="h-7 w-7 text-brand" />
            </span>
            <span className="absolute left-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white">
              <Zap className="h-3 w-3 fill-current" />
            </span>
            <p className="mt-2.5 text-[13px] font-black text-ink">سوپرمارکت</p>
            <p className="text-[10px] font-semibold text-muted">ارسال فوری</p>
          </button>
          <button
            type="button"
            onClick={() => {
              setStoreFilter("hyper");
              c.openSub({ name: "stores" });
            }}
            className="relative overflow-hidden rounded-3xl bg-[#e8f1fb] p-3.5 text-right transition active:scale-[0.98] md:hover:brightness-[0.98]"
          >
            <span className="floaty block w-fit rounded-2xl bg-white p-2.5 shadow-sm">
              <Store className="h-7 w-7 text-[#3b6ea5]" />
            </span>
            <span className="absolute left-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#3b6ea5] text-white">
              <Timer className="h-3 w-3" />
            </span>
            <p className="mt-2.5 text-[13px] font-black text-ink">هایپرمارکت</p>
            <p className="text-[10px] font-semibold text-muted">
              ارسال زمان‌بندی‌شده
            </p>
          </button>
          <button
            type="button"
            onClick={() => c.openSub({ name: "map" })}
            className="relative hidden overflow-hidden rounded-3xl bg-[#e8f7f0] p-3.5 text-right transition active:scale-[0.98] md:block md:hover:brightness-[0.98]"
          >
            <span className="floaty block w-fit rounded-2xl bg-white p-2.5 shadow-sm">
              <MapPin className="h-7 w-7 text-mint" />
            </span>
            <p className="mt-2.5 text-[13px] font-black text-ink">
              محدوده ارسال
            </p>
            <p className="text-[10px] font-semibold text-muted">
              شهرستان نظرآباد
            </p>
          </button>
        </div>
      </div>

      {/* categories — chips on mobile, compact grid on desktop */}
      <div className={`${section} mt-4`}>
        <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1 md:flex-wrap md:gap-x-6 md:gap-y-4 md:overflow-visible md:pb-0">
          {categories.slice(1).map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => c.openSub({ name: "category", id: cat.id })}
              className="group flex w-[68px] shrink-0 flex-col items-center gap-1.5 transition active:scale-95 md:w-[72px]"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-white shadow-[0_6px_16px_-12px_rgba(30,20,10,0.4)] transition duration-300 group-hover:-translate-y-0.5 group-hover:border-brand/40 md:h-14 md:w-14">
                <cat.icon className="h-6 w-6 text-brand" strokeWidth={1.7} />
              </span>
              <span className="max-w-[68px] text-center text-[9.5px] font-bold leading-3.5 text-ink md:text-[10px]">
                {cat.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {c.firstOrderEligible &&
        products.some((p) => p.category === "drinks") && (
          <section className={`${section} mt-6`}>
            <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4">
              <h2 className="text-[16px] font-black text-mint">
                خرید اولی‌ها · ۵۰٪ تخفیف واقعی
              </h2>
              <p className="mt-1 text-[11px] font-bold leading-6 text-ink">
                فقط یک عدد نوشیدنی در اولین سفارش شما؛ بقیهٔ تعداد و کالاها با
                قیمت معمول محاسبه می‌شوند.
              </p>
              <div className="no-scrollbar mt-4 flex gap-3 overflow-x-auto pb-2">
                {products
                  .filter((p) => p.category === "drinks")
                  .map((p) => (
                    <div className="w-40 shrink-0" key={p.id}>
                      <ProductCard product={p} h={c.cardHandlers(p.storeId)} />
                      <p className="mt-2 text-center text-[11px] font-black text-mint">
                        قیمت یک عدد با پیشنهاد:{" "}
                        {faNum(p.price - Math.floor(p.price / 2))} تومان
                      </p>
                      <button
                        type="button"
                        className="mt-2 w-full rounded-xl bg-mint p-2 text-[10px] font-black text-white"
                        onClick={() => {
                          if (!c.qtyOf(p.id)) c.handleAdd(p, p.storeId);
                          if (!c.cart.storeId || c.cart.storeId === p.storeId)
                            c.setFirstOrderProductId(p.id);
                        }}
                      >
                        انتخاب برای تخفیف یک عدد
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </section>
        )}

      <section className={`${section} mt-7`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[17px] font-black text-ink">محصولات برای شما</h2>
          <span className="text-[10px] font-bold text-muted">
            قیمت و موجودی فروشگاه‌ها
          </span>
        </div>
        {products.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {products.map((p) => (
              <div className="min-w-0" key={p.id}>
                <ProductCard product={p} h={c.cardHandlers(p.storeId)} />
                <button
                  className="mt-2 w-full truncate text-center text-[10px] font-bold text-muted"
                  onClick={() =>
                    p.storeId && c.openSub({ name: "store", id: p.storeId })
                  }
                >
                  {stores.find((st) => st.id === p.storeId)?.name}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-line bg-white p-8 text-center text-[12px] text-muted">
            هنوز کالای دارای موجودی از فروشگاه‌های فعال ثبت نشده است.
          </div>
        )}
      </section>

      {/* stores */}
      <div className={`${section} mt-6`}>
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {(
            [
              { key: "all", label: "همه فروشگاه‌ها", icon: Store },
              { key: "hyper", label: "هایپرمارکت", icon: ShoppingBasket },
              { key: "date", label: "تضمین تاریخ", icon: BadgeCheck },
            ] as const
          ).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStoreFilter(f.key as typeof storeFilter)}
              aria-pressed={storeFilter === f.key}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-[11px] font-extrabold transition active:scale-95 ${
                storeFilter === f.key
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-white text-ink"
              }`}
            >
              <f.icon className="h-3.5 w-3.5" /> {f.label}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-hidden border-y border-line bg-white md:grid md:grid-cols-2 md:rounded-[22px] md:border">
          {filteredStores.length === 0 ? (
            <div className="col-span-full p-8 text-center text-sm font-semibold text-muted">
              هنوز فروشگاه فعالی در این محدوده ثبت نشده است.
            </div>
          ) : (
            filteredStores.map((s, i) => (
              <div key={s.id} className={i >= 4 ? "hidden md:block" : ""}>
                <StoreCard store={s} onOpen={() => openStore(s.id)} />
              </div>
            ))
          )}
        </div>

        <button
          type="button"
          onClick={() => c.openSub({ name: "stores" })}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-[#f4f3f0] py-3.5 text-[12px] font-black text-ink transition hover:bg-line active:scale-[0.99]"
        >
          مشاهده همه فروشگاه‌ها <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ---------------- All stores ---------------- */
export function StoresPage({ c }: { c: AppCtx }) {
  const [filter, setFilter] = useState<"all" | "hyper" | "date" | "turbo">(
    "all",
  );
  const list = stores.filter((s) => {
    if (filter === "hyper") return s.type === "hypermarket";
    if (filter === "date") return s.tags.some((t) => t.includes("تضمین"));
    if (filter === "turbo") return s.tags.some((t) => t.includes("توربو"));
    return true;
  });
  return (
    <div className="fade-rise mx-auto min-h-dvh w-full max-w-4xl pb-24 md:pb-12">
      <ScreenHeader title="فروشگاه‌ها" onBack={() => c.closeSub()} />
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
        {(
          [
            { key: "all", label: "همه فروشگاه‌ها", icon: Store },
            { key: "hyper", label: "هایپرمارکت", icon: ShoppingBasket },
            { key: "date", label: "تضمین تاریخ", icon: BadgeCheck },
            { key: "turbo", label: "ارسال توربو", icon: Zap },
          ] as const
        ).map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-[11px] font-extrabold transition active:scale-95 ${filter === f.key ? "border-ink bg-ink text-white" : "border-line bg-white text-ink"}`}
          >
            <f.icon className="h-3.5 w-3.5" /> {f.label}
          </button>
        ))}
      </div>
      <div className="px-4">
        <div className="overflow-hidden rounded-[22px] border border-line bg-white lg:grid lg:grid-cols-2">
          {list.length === 0 ? (
            <div className="p-10 text-center text-sm font-semibold text-muted">
              هنوز فروشگاه فعالی در این محدوده ثبت نشده است.
            </div>
          ) : (
            list.map((s) => (
              <StoreCard
                key={s.id}
                store={s}
                onOpen={() => c.openSub({ name: "store", id: s.id })}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Favorites ---------------- */
export function FavoritesPage({ c }: { c: AppCtx }) {
  const favs = products.filter((p) => c.favorites.includes(p.id));
  return (
    <div className="fade-rise mx-auto min-h-dvh w-full max-w-4xl pb-24 md:pb-12">
      <ScreenHeader
        title="کالاهای مورد علاقه‌ی من"
        onBack={() => c.closeSub()}
      />
      {favs.length === 0 ? (
        <Empty
          icon={Heart}
          title="هنوز کالایی را پسند نکرده‌اید"
          desc="با زدن قلب روی هر کالا، آن را اینجا ذخیره کنید تا سریع‌تر پیدایش کنید."
          actionLabel="شروع خرید"
          onAction={() => c.closeSub()}
        />
      ) : (
        <div className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-3 lg:grid-cols-4">
          {favs.map((p) => (
            <ProductCard key={p.id} product={p} h={c.cardHandlers()} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Map / exact location ---------------- */
export function MapPage({ c }: { c: AppCtx }) {
  return (
    <div className="fade-rise mx-auto min-h-dvh w-full max-w-3xl pb-24 md:pb-12">
      <ScreenHeader title="انتخاب لوکیشن دقیق" onBack={() => c.closeSub()} />
      <div className="p-4">
        <div className="relative rounded-[26px] border border-line">
          <MapPicker
            marker={c.pickedPin}
            onPick={(p) => {
              c.setPickedPin(p);
              c.setPickedLabel(`${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`);
            }}
            height="h-[46dvh] lg:h-[420px]"
          />
        </div>

        {c.pickedPin && (
          <div className="fade-rise mt-3 flex items-center gap-3 rounded-2xl border border-brand/30 bg-brand-soft/70 p-3.5">
            <MapPin className="h-5 w-5 shrink-0 fill-brand text-brand" />
            <p className="flex-1 text-[12px] font-extrabold text-ink">
              نقطه‌ی انتخابی ثبت شد — با ادامه دادن، این لوکیشن در آدرس شما
              ذخیره می‌شود.
            </p>
            <button
              type="button"
              onClick={() => c.setPickedPin(null)}
              aria-label="حذف نقطه"
              className="text-muted transition hover:text-brand"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        )}

        <div className="mt-4 rounded-[26px] border border-line bg-white p-4">
          <p className="flex items-center gap-2 text-[14px] font-black text-ink">
            <Navigation className="h-4.5 w-4.5 text-brand" /> مناطق تحت پوشش
            ارسال
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              "شهر نظرآباد",
              "بیجارآباد",
              "سیدجمال‌الدین",
              "محله الغدیر",
              "خیابان شهید مطهری",
              "شهرک صنعتی",
            ].map((a) => (
              <span
                key={a}
                className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1.5 text-[10px] font-extrabold text-brand-dark"
              >
                <MapPin className="h-3 w-3" /> {a}
              </span>
            ))}
          </div>
          <p className="mt-3 text-[11px] font-medium leading-6 text-muted">
            سفارش‌های داخل محدوده، در کمتر از ۴۵ دقیقه تحویل می‌شود. با کلیک روی
            نقشه، لوکیشن دقیق خانه یا محل کار خود را علامت بزنید تا دقیقاً
            همان‌جا تحویل بگیرید.
          </p>
        </div>

        <button
          type="button"
          onClick={() => c.openSub({ name: "address" })}
          className="mt-4 w-full rounded-2xl bg-brand py-4 text-[14px] font-black text-white shadow-lg shadow-brand/30 transition active:scale-[0.99]"
        >
          ادامه — انتخاب آدرس تحویل
        </button>
      </div>
    </div>
  );
}

/* ---------------- Easy buy ---------------- */
export function EasyPage({ c }: { c: AppCtx }) {
  const frequent = products.filter((p) => p.frequent);
  const lastOrder = c.orders[0];
  return (
    <div className="fade-rise mx-auto min-h-dvh w-full max-w-3xl pb-24 md:pb-12">
      <div className="px-4 pt-6">
        <h3 className="text-[14px] font-black text-ink">
          دسترسی سریع به دسته‌ها
        </h3>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {categories.slice(1, 9).map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => c.openSub({ name: "category", id: cat.id })}
              className="flex flex-col items-center gap-1.5 rounded-3xl border border-line bg-white py-3.5 transition hover:border-brand/40 active:scale-95"
            >
              <cat.icon className="h-6 w-6 text-brand" strokeWidth={1.7} />
              <span className="px-1 text-center text-[9px] font-bold leading-3.5 text-ink">
                {cat.name}
              </span>
            </button>
          ))}
        </div>
      </div>
      {lastOrder && (
        <div className="px-4 pt-4">
          <div className="flex items-center gap-3 rounded-3xl bg-ink p-4 text-white">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10">
              <History className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-black">خرید مجدد آخرین سفارش</p>
              <p className="mt-0.5 truncate text-[10px] font-medium text-white/55">
                {lastOrder.storeName} · {faNum(lastOrder.total)} تومان
              </p>
            </div>
            <button
              type="button"
              onClick={() => c.reorder(lastOrder)}
              className="shrink-0 rounded-xl bg-brand px-3.5 py-2.5 text-[11px] font-black text-white"
            >
              افزودن همه
            </button>
          </div>
        </div>
      )}
      <div className="px-4 pt-5">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-black text-ink">پرتکرارهای شما</h3>
          <button
            type="button"
            onClick={() => {
              frequent.forEach((p) => c.handleAdd(p));
              c.toast("همه کالاهای پرتکرار به سبد اضافه شد");
            }}
            className="text-[11px] font-black text-brand"
          >
            افزودن همه به سبد
          </button>
        </div>
        <div className="mt-3 divide-y divide-line rounded-3xl border border-line bg-white">
          {frequent.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-3">
              <button
                type="button"
                onClick={() => c.openProduct(p)}
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${p.bg}`}
              >
                <ProductVisual product={p} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-extrabold text-ink">
                  {p.name}
                </p>
                <p className="mt-0.5 text-[11px] font-black text-brand">
                  {faNum(p.price)} تومان
                </p>
              </div>
              {c.qtyOf(p.id) === 0 ? (
                <button
                  type="button"
                  onClick={() => c.handleAdd(p)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-line shadow-sm transition hover:border-brand hover:bg-brand hover:text-white active:scale-90"
                  aria-label={`افزودن ${p.name}`}
                >
                  <span className="text-lg font-black leading-none">+</span>
                </button>
              ) : (
                <div
                  className="flex items-center gap-2 rounded-full border border-line bg-white px-2 py-1"
                  dir="ltr"
                >
                  <button
                    type="button"
                    onClick={() => c.handleDec(p.id)}
                    className="text-ink transition hover:text-brand"
                    aria-label="کم کردن"
                  >
                    −
                  </button>
                  <span className="text-[12px] font-black">
                    {pd(c.qtyOf(p.id))}
                  </span>
                  <button
                    type="button"
                    onClick={() => c.handleAdd(p)}
                    className="text-ink transition hover:text-brand"
                    aria-label="افزودن"
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  ChevronLeft,
  CloudRainWind,
  Gift,
  History,
  Heart,
  MapPin,
  Navigation,
  ShoppingBasket,
  Sparkles,
  Store,
  Timer,
  X,
  Zap,
} from "lucide-react";
import { Empty, ProductCard, ScreenHeader, StoreCard, pd, pad2 } from "../components/ui";
import MapPicker from "../components/MapPicker";
import type { AppCtx } from "../ctx";
import { MAP_EMBED, brands, categories, faNum, products, stores } from "../data";

export function HomePage({ c }: { c: AppCtx }) {
  const [storeFilter, setStoreFilter] = useState<"all" | "hyper" | "date">("all");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const filteredStores = stores.filter((s) => {
    if (storeFilter === "hyper") return s.type === "hypermarket";
    if (storeFilter === "date") return s.tags.some((t) => t.includes("تضمین"));
    return true;
  });
  const amazing = useMemo(
    () => products.filter((p) => (p.oldPrice ? ((p.oldPrice - p.price) / p.oldPrice) * 100 : 0) >= 40),
    [],
  );

  const midnight = new Date();
  midnight.setHours(23, 59, 59, 999);
  const remain = Math.max(0, Math.floor((midnight.getTime() - now) / 1000));
  const cd = [Math.floor(remain / 3600), Math.floor((remain % 3600) / 60), remain % 60];

  const openStore = (id: number) => c.openSub({ name: "store", id });
  const section = "mx-auto w-full max-w-6xl px-4 md:px-6";

  return (
    <div className="fade-rise mx-auto min-h-dvh w-full max-w-7xl pb-4 md:pb-10">
      {/* weather */}
      <div className="pt-3 md:pt-4">
        <div className={`${section}`}>
          <div className="flex items-center gap-3 rounded-2xl bg-[#eef2f7] px-3.5 py-3 md:px-4 md:py-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#3b6ea5] text-white shadow md:h-11 md:w-11">
              <CloudRainWind className="h-5 w-5 md:h-6 md:w-6" />
            </span>
            <p className="flex-1 text-[11px] font-semibold leading-5 text-[#3d4b5c] md:text-[12.5px] md:leading-6">
              <strong className="font-black">شرایط نامساعد جوی</strong> عامل افزایش موقت هزینه و تأخیر در ارسال سفارش‌های شهرستان نظرآباد است.
            </p>
            <span className="hidden shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-[#3d4b5c] shadow-sm lg:flex">
              <MapPin className="h-3 w-3 text-brand" /> {c.selectedAddress?.title ?? "نظرآباد"}
            </span>
          </div>
        </div>
      </div>

      {/* shortcut tiles */}
      <div className={`${section} mt-3`}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <button
            type="button"
            onClick={() => { setStoreFilter("all"); c.openSub({ name: "stores" }); }}
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
            onClick={() => { setStoreFilter("hyper"); c.openSub({ name: "stores" }); }}
            className="relative overflow-hidden rounded-3xl bg-[#e8f1fb] p-3.5 text-right transition active:scale-[0.98] md:hover:brightness-[0.98]"
          >
            <span className="floaty block w-fit rounded-2xl bg-white p-2.5 shadow-sm">
              <Store className="h-7 w-7 text-[#3b6ea5]" />
            </span>
            <span className="absolute left-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#3b6ea5] text-white">
              <Timer className="h-3 w-3" />
            </span>
            <p className="mt-2.5 text-[13px] font-black text-ink">هایپرمارکت</p>
            <p className="text-[10px] font-semibold text-muted">ارسال زمان‌بندی‌شده</p>
          </button>
          <button
            type="button"
            onClick={() => c.openSub({ name: "map" })}
            className="relative hidden overflow-hidden rounded-3xl bg-[#e8f7f0] p-3.5 text-right transition active:scale-[0.98] md:block md:hover:brightness-[0.98]"
          >
            <span className="floaty block w-fit rounded-2xl bg-white p-2.5 shadow-sm">
              <MapPin className="h-7 w-7 text-mint" />
            </span>
            <p className="mt-2.5 text-[13px] font-black text-ink">محدوده ارسال</p>
            <p className="text-[10px] font-semibold text-muted">شهرستان نظرآباد</p>
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

      {/* amazing offers */}
      <div className="mx-auto mt-5 overflow-hidden bg-gradient-to-br from-[#16865b] to-[#26352e] pb-4 pt-3 md:mx-6 md:max-w-[calc(100%-3rem)] md:rounded-[28px]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 md:px-6">
          <p className="flex items-center gap-1.5 text-[15px] font-black text-white md:text-[16px]">
            <Sparkles className="h-5 w-5" /> ویژه خرید اول!
          </p>
          <div className="flex items-center gap-1.5" dir="ltr">
            {cd.map((v, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[13px] font-black text-brand shadow">
                  {pd(pad2(v))}
                </span>
                {i < 2 && <span className="font-black text-white">:</span>}
              </span>
            ))}
          </div>
        </div>
        <div className="no-scrollbar mx-auto mt-3 flex max-w-6xl snap-x gap-2.5 overflow-x-auto px-4 pb-1 md:px-6">
          {amazing.map((p) => (
            <ProductCard key={p.id} product={p} h={c.cardHandlers()} width="w-[140px] sm:w-[152px] md:w-[164px]" />
          ))}
        </div>
      </div>

      {/* stores */}
      <div className={`${section} mt-6`}>
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-black text-ink md:text-[17px]">{pd(filteredStores.length)} فروشگاه اطراف شما</h2>
          <button
            type="button"
            onClick={() => c.openSub({ name: "stores" })}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f4f3f0] transition hover:bg-line active:scale-90"
            aria-label="مشاهده همه فروشگاه‌ها"
          >
            <ChevronLeft className="h-4 w-4 text-ink" />
          </button>
        </div>

        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {([
            { key: "all", label: "همه فروشگاه‌ها", icon: Store },
            { key: "hyper", label: "هایپرمارکت", icon: ShoppingBasket },
            { key: "date", label: "تضمین تاریخ", icon: BadgeCheck },
          ] as const).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStoreFilter(f.key as typeof storeFilter)}
              aria-pressed={storeFilter === f.key}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-[11px] font-extrabold transition active:scale-95 ${
                storeFilter === f.key ? "border-ink bg-ink text-white" : "border-line bg-white text-ink"
              }`}
            >
              <f.icon className="h-3.5 w-3.5" /> {f.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#dcebe2] bg-[#f1f7f3] px-3 py-2 text-[#26352e] md:inline-flex">
          <Gift className="h-4 w-4 shrink-0 text-brand" />
          <p className="text-[10.5px] font-bold">ارسال رایگان و تخفیف خرید اول</p>
        </div>

        <div className="mt-3 overflow-hidden border-y border-line bg-white md:grid md:grid-cols-2 md:rounded-[22px] md:border">
          {filteredStores.map((s, i) => (
            <div key={s.id} className={i >= 4 ? "hidden md:block" : ""}>
              <StoreCard store={s} onOpen={() => openStore(s.id)} />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => c.openSub({ name: "stores" })}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-[#f4f3f0] py-3.5 text-[12px] font-black text-ink transition hover:bg-line active:scale-[0.99]"
        >
          مشاهده همه فروشگاه‌ها <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {/* brands */}
      <div className={`${section} mt-7`}>
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-black text-ink">برندهای محبوب</h3>
          <ChevronLeft className="h-4.5 w-4.5 text-muted" />
        </div>
        <div className="no-scrollbar mt-3 overflow-hidden" aria-label="برندهای محبوب">
          <div className="brand-marquee flex w-max items-center gap-8 py-1" dir="rtl">
          {[...brands, ...brands].map((b, i) => (
            <button
              key={`${b.name}-${i}`}
              type="button"
              onClick={() => c.openSub({ name: "search" })}
              className="shrink-0 text-[15px] font-black tracking-tight opacity-80 transition hover:opacity-100"
              style={{ color: b.color }}
            >
              {b.name}
            </button>
          ))}
          </div>
        </div>
      </div>

      {/* coverage map */}
      <div className={`${section} pt-6`}>
        <div className="overflow-hidden rounded-[26px] border border-line bg-white shadow-[0_10px_26px_-18px_rgba(30,20,10,0.45)]">
          <div className="flex items-center justify-between gap-3 p-4 pb-3">
            <div>
              <p className="flex items-center gap-1.5 text-[13.5px] font-black text-ink md:text-[14px]">
                <MapPin className="h-4.5 w-4.5 text-brand" /> محدوده‌ی فعال: شهرستان نظرآباد
              </p>
              <p className="mt-1 text-[11px] font-medium leading-5 text-muted">
                شهر نظرآباد، تنکمان، سیدجمال‌الدین و روستاهای اطراف
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-mint">
              <span className="relative flex h-2 w-2">
                <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-500 opacity-70" />
                <span className="relative h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              فعال
            </span>
          </div>
          <button
            type="button"
            onClick={() => c.openSub({ name: "map" })}
            className="relative block h-44 w-full md:h-56"
            aria-label="مشاهده نقشه نظرآباد"
          >
            <iframe
              title="نقشه شهرستان نظرآباد"
              src={MAP_EMBED}
              className="pointer-events-none h-full w-full border-0"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
            <span className="absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-ink/85 px-3.5 py-2 text-[11px] font-black text-white backdrop-blur">
              مشاهده نقشه و انتخاب لوکیشن دقیق
            </span>
          </button>
        </div>
      </div>

    </div>
  );
}

/* ---------------- All stores ---------------- */
export function StoresPage({ c }: { c: AppCtx }) {
  const [filter, setFilter] = useState<"all" | "hyper" | "date" | "turbo">("all");
  const list = stores.filter((s) => {
    if (filter === "hyper") return s.type === "hypermarket";
    if (filter === "date") return s.tags.some((t) => t.includes("تضمین"));
    if (filter === "turbo") return s.tags.some((t) => t.includes("توربو"));
    return true;
  });
  return (
    <div className="fade-rise mx-auto min-h-dvh w-full max-w-4xl pb-24 md:pb-12">
      <ScreenHeader title={`${pd(list.length)} فروشگاه اطراف شما`} onBack={() => c.closeSub()} />
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
        {([
          { key: "all", label: "همه فروشگاه‌ها", icon: Store },
          { key: "hyper", label: "هایپرمارکت", icon: ShoppingBasket },
          { key: "date", label: "تضمین تاریخ", icon: BadgeCheck },
          { key: "turbo", label: "ارسال توربو", icon: Zap },
        ] as const).map((f) => (
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
          {list.map((s) => (
            <StoreCard key={s.id} store={s} onOpen={() => c.openSub({ name: "store", id: s.id })} />
          ))}
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
      <ScreenHeader title="کالاهای مورد علاقه‌ی من" onBack={() => c.closeSub()} />
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
              نقطه‌ی انتخابی ثبت شد — با ادامه دادن، این لوکیشن در آدرس شما ذخیره می‌شود.
            </p>
            <button type="button" onClick={() => c.setPickedPin(null)} aria-label="حذف نقطه" className="text-muted transition hover:text-brand">
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        )}

        <div className="mt-4 rounded-[26px] border border-line bg-white p-4">
          <p className="flex items-center gap-2 text-[14px] font-black text-ink">
            <Navigation className="h-4.5 w-4.5 text-brand" /> مناطق تحت پوشش ارسال
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {["شهر نظرآباد", "تنکمان", "سیدجمال‌الدین", "محله الغدیر", "خیابان شهید مطهری", "شهرک صنعتی"].map((a) => (
              <span key={a} className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1.5 text-[10px] font-extrabold text-brand-dark">
                <MapPin className="h-3 w-3" /> {a}
              </span>
            ))}
          </div>
          <p className="mt-3 text-[11px] font-medium leading-6 text-muted">
            سفارش‌های داخل محدوده، در کمتر از ۴۵ دقیقه تحویل می‌شود. با کلیک روی نقشه، لوکیشن دقیق خانه یا محل کار خود را علامت بزنید تا دقیقاً همان‌جا تحویل بگیرید.
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
        <h3 className="text-[14px] font-black text-ink">دسترسی سریع به دسته‌ها</h3>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {categories.slice(1, 9).map((cat) => (
            <button key={cat.id} type="button" onClick={() => c.openSub({ name: "category", id: cat.id })} className="flex flex-col items-center gap-1.5 rounded-3xl border border-line bg-white py-3.5 transition hover:border-brand/40 active:scale-95">
              <cat.icon className="h-6 w-6 text-brand" strokeWidth={1.7} />
              <span className="px-1 text-center text-[9px] font-bold leading-3.5 text-ink">{cat.name}</span>
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
            <button type="button" onClick={() => c.reorder(lastOrder)} className="shrink-0 rounded-xl bg-brand px-3.5 py-2.5 text-[11px] font-black text-white">
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
              <button type="button" onClick={() => c.openProduct(p)} className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${p.bg}`}>
                <p.icon className={`h-6 w-6 ${p.iconColor}`} strokeWidth={1.6} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-extrabold text-ink">{p.name}</p>
                <p className="mt-0.5 text-[11px] font-black text-brand">{faNum(p.price)} تومان</p>
              </div>
              {c.qtyOf(p.id) === 0 ? (
                <button type="button" onClick={() => c.handleAdd(p)} className="flex h-9 w-9 items-center justify-center rounded-full border border-line shadow-sm transition hover:border-brand hover:bg-brand hover:text-white active:scale-90" aria-label={`افزودن ${p.name}`}>
                  <span className="text-lg font-black leading-none">+</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 rounded-full border border-line bg-white px-2 py-1" dir="ltr">
                  <button type="button" onClick={() => c.handleDec(p.id)} className="text-ink transition hover:text-brand" aria-label="کم کردن">−</button>
                  <span className="text-[12px] font-black">{pd(c.qtyOf(p.id))}</span>
                  <button type="button" onClick={() => c.handleAdd(p)} className="text-ink transition hover:text-brand" aria-label="افزودن">+</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

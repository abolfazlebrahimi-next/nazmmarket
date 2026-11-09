import { useEffect, useMemo, useState } from "react";
import {
  ArrowUp,
  BadgeCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CloudRainWind,
  Gift,
  History,
  Heart,
  MapPin,
  Navigation,
  Search,
  ShoppingBasket,
  ShoppingCart,
  Sparkles,
  Store,
  TicketPercent,
  Timer,
  X,
  Zap,
} from "lucide-react";
import { Empty, ProductCard, ScreenHeader, StoreCard, pd, pad2 } from "../components/ui";
import MapPicker from "../components/MapPicker";
import type { AppCtx } from "../ctx";
import { MAP_EMBED, categories, faNum, products, stores } from "../data";

const brands = [
  { name: "ناز مارکت", color: "#ff4d00" },
  { name: "دیلی مارکت", color: "#ef4444" },
  { name: "شهر مارکت", color: "#0d9488" },
  { name: "سبز نظرآباد", color: "#22c55e" },
  { name: "تنکمان", color: "#f59e0b" },
  { name: "بهاران", color: "#6366f1" },
];

export function HomePage({ c }: { c: AppCtx }) {
  const [storeFilter, setStoreFilter] = useState<"all" | "pro" | "hyper" | "date">("all");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const filteredStores = stores.filter((s) => {
    if (storeFilter === "pro") return s.pro;
    if (storeFilter === "hyper") return s.type === "hypermarket";
    if (storeFilter === "date") return s.tags.some((t) => t.includes("تضمین"));
    return true;
  });
  const amazing = useMemo(() => products.filter((p) => (p.oldPrice ? ((p.oldPrice - p.price) / p.oldPrice) * 100 : 0) >= 40), []);

  const midnight = new Date();
  midnight.setHours(23, 59, 59, 999);
  const remain = Math.max(0, Math.floor((midnight.getTime() - now) / 1000));
  const cd = [Math.floor(remain / 3600), Math.floor((remain % 3600) / 60), remain % 60];

  const openStore = (id: number) => c.openSub({ name: "store", id });

  return (
    <div className="fade-rise mx-auto min-h-dvh w-full max-w-6xl pb-32 lg:pb-12">
      {/* header (mobile style) */}
      <div className="sticky top-0 z-30 border-b border-line/70 bg-white/92 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 pt-3">
          <button type="button" onClick={() => c.openAddress("home")} className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1.5 text-[11px] font-extrabold shadow-sm transition active:scale-95">
            <ChevronDown className="h-3.5 w-3.5" /> ارسال به {c.selectedAddress?.title ?? "خانه"}
          </button>
          <p className="text-[19px] font-black leading-none tracking-tight text-brand">
            ناز<span className="text-ink">!</span> مارکت
          </p>
          <button type="button" onClick={() => c.go("cart")} aria-label="سبد خرید" className="relative flex h-9 w-9 items-center justify-center rounded-full transition active:scale-90">
            <ShoppingCart className="h-5.5 w-5.5 text-ink" />
            {c.cartCount > 0 && <span className="pop-in absolute -top-0.5 left-0 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-[#eb2d20] px-1 text-[9px] font-black text-white">{pd(c.cartCount)}</span>}
          </button>
        </div>
        <button type="button" onClick={() => c.openAddress("home")} className="block w-full truncate px-4 pb-1 pt-1.5 text-right text-[11px] font-medium text-muted">
          شهرستان نظرآباد، {c.selectedAddress?.address ?? ""}، {c.selectedAddress?.detail ?? ""}
        </button>
        <div className="px-4 pb-3 pt-1">
          <button type="button" onClick={() => c.openSub({ name: "search" })} className="flex h-11 w-full items-center gap-2 rounded-2xl bg-[#f4f3f0] px-3.5 text-[12px] font-medium text-muted transition active:scale-[0.99]">
            <Search className="h-4.5 w-4.5" /> جستجو در سوپرمارکت‌های نظرآباد
          </button>
        </div>
      </div>

      {/* weather */}
      <div className="px-4 pt-3 lg:hidden">
        <div className="flex items-center gap-3 rounded-2xl bg-[#eef2f7] px-3.5 py-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#3b6ea5] text-white shadow">
            <CloudRainWind className="h-5 w-5" />
          </span>
          <p className="text-[11px] font-semibold leading-5 text-[#3d4b5c]">
            <strong className="font-black">شرایط نامساعد جوی</strong> عامل افزایش موقت هزینه و تأخیر در ارسال سفارش‌های نظرآباد است.
          </p>
        </div>
      </div>
      {/* weather desktop */}
      <div className="mx-4 hidden pt-4 lg:block">
        <div className="mx-auto flex max-w-4xl items-center gap-3 rounded-2xl bg-[#eef2f7] px-4 py-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#3b6ea5] text-white shadow">
            <CloudRainWind className="h-6 w-6" />
          </span>
          <p className="text-[12.5px] font-semibold leading-6 text-[#3d4b5c]">
            <strong className="font-black">شرایط نامساعد جوی</strong> عامل افزایش موقت هزینه و تأخیر در ارسال سفارش‌های شهرستان نظرآباد است.
          </p>
          <span className="mr-auto hidden items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-[#3d4b5c] shadow-sm xl:flex">
            <MapPin className="h-3 w-3 text-brand" /> {c.selectedAddress?.title}
          </span>
        </div>
      </div>

      {/* two tiles */}
      <div className="grid grid-cols-2 gap-3 px-4 pt-3 lg:mx-4 lg:grid-cols-3 lg:max-w-4xl lg:px-0">
        <button type="button" onClick={() => { setStoreFilter("all"); c.openSub({ name: "stores" }); }} className="relative overflow-hidden rounded-3xl bg-[#fdf0e7] p-3.5 text-right transition active:scale-[0.98]">
          <span className="floaty block w-fit rounded-2xl bg-white p-2.5 shadow-sm">
            <ShoppingBasket className="h-7 w-7 text-brand" />
          </span>
          <span className="absolute left-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white">
            <Zap className="h-3 w-3 fill-current" />
          </span>
          <p className="mt-2.5 text-[13px] font-black text-ink">سوپرمارکت</p>
          <p className="text-[10px] font-semibold text-muted">ارسال فوری</p>
        </button>
        <button type="button" onClick={() => { setStoreFilter("hyper"); c.openSub({ name: "stores" }); }} className="relative overflow-hidden rounded-3xl bg-[#e8f1fb] p-3.5 text-right transition active:scale-[0.98]">
          <span className="floaty block w-fit rounded-2xl bg-white p-2.5 shadow-sm">
            <Store className="h-7 w-7 text-[#3b6ea5]" />
          </span>
          <span className="absolute left-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#3b6ea5] text-white">
            <Timer className="h-3 w-3" />
          </span>
          <p className="mt-2.5 text-[13px] font-black text-ink">هایپرمارکت</p>
          <p className="text-[10px] font-semibold text-muted">ارسال زمان‌بندی‌شده</p>
        </button>
        <button type="button" onClick={() => c.openSub({ name: "map" })} className="relative hidden overflow-hidden rounded-3xl bg-[#e8f7f0] p-3.5 text-right transition active:scale-[0.98] lg:block">
          <span className="floaty block w-fit rounded-2xl bg-white p-2.5 shadow-sm">
            <MapPin className="h-7 w-7 text-mint" />
          </span>
          <p className="mt-2.5 text-[13px] font-black text-ink">محدوده ارسال</p>
          <p className="text-[10px] font-semibold text-muted">شهرستان نظرآباد</p>
        </button>
      </div>

      {/* categories */}
      <div className="no-scrollbar mt-4 flex gap-3 overflow-x-auto px-4 pb-1 lg:mx-4 lg:max-w-4xl lg:grid lg:grid-cols-5 lg:gap-4 lg:overflow-visible lg:px-0">
        {categories.slice(1).map((cat) => (
          <button key={cat.id} type="button" onClick={() => c.openSub({ name: "category", id: cat.id })} className="group flex shrink-0 flex-col items-center gap-1.5 transition active:scale-95 lg:shrink">
            <span className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-line bg-white shadow-[0_6px_16px_-10px_rgba(30,20,10,0.4)] transition duration-300 group-hover:-translate-y-1 group-hover:border-brand/40 group-hover:shadow-[0_12px_24px_-12px_rgba(255,77,0,0.5)] lg:h-16 lg:w-16">
              <cat.icon className="h-6 w-6 text-brand lg:h-7 lg:w-7" strokeWidth={1.7} />
            </span>
            <span className="max-w-16 text-center text-[9.5px] font-bold leading-3.5 text-ink lg:text-[10.5px]">{cat.name}</span>
          </button>
        ))}
      </div>

      {/* amazing */}
      <div className="mt-5 bg-gradient-to-b from-brand to-[#ff7a33] pb-4 pt-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4">
          <p className="flex items-center gap-1.5 text-[16px] font-black text-white">
            <Sparkles className="h-5 w-5" /> ویژه خرید اول!
          </p>
          <div className="flex items-center gap-1.5" dir="ltr">
            {cd.map((v, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[13px] font-black text-brand shadow">{pd(pad2(v))}</span>
                {i < 2 && <span className="font-black text-white">:</span>}
              </span>
            ))}
          </div>
        </div>
        <div className="no-scrollbar mx-auto mt-3 flex max-w-6xl snap-x gap-2.5 overflow-x-auto px-4 pb-1">
          {amazing.map((p) => (
            <ProductCard key={p.id} product={p} h={c.cardHandlers()} width="w-[140px] sm:w-[158px]" />
          ))}
        </div>
      </div>

      {/* favorites strip */}
      <div className="px-4 pt-4 lg:mx-4 lg:max-w-4xl lg:px-0">
        <button type="button" onClick={() => c.openSub({ name: "favorites" })} className="flex w-full items-center gap-3 rounded-3xl border border-line bg-white p-3.5 text-right shadow-[0_8px_20px_-14px_rgba(30,20,10,0.4)] transition hover:border-brand/30 active:scale-[0.99]">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ffe9ee]">
            <Heart className="h-5 w-5 fill-[#f43f5e] text-[#f43f5e]" />
          </span>
          <span className="flex-1">
            <span className="block text-[13px] font-black text-ink">کالاهای مورد علاقه‌ی من</span>
            <span className="mt-0.5 block text-[11px] font-medium text-muted">{pd(c.favorites.length)} کالای مورد علاقه</span>
          </span>
          <ChevronLeft className="h-5 w-5 text-muted" />
        </button>
      </div>

      {/* stores */}
      <div className="mx-4 mt-6 lg:mx-4 lg:max-w-6xl lg:px-0">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-black text-ink">{pd(filteredStores.length)} فروشگاه اطراف شما</h2>
          <button type="button" onClick={() => c.openSub({ name: "stores" })} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f4f3f0] transition hover:bg-line active:scale-90" aria-label="مشاهده همه فروشگاه‌ها">
            <ChevronRight className="hidden h-4 w-4 text-ink lg:block" />
            <ChevronLeft className="h-4 w-4 text-ink lg:hidden" />
          </button>
        </div>

        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {([
            { key: "all", label: "همه فروشگاه‌ها", icon: Store },
            { key: "pro", label: "فروشگاه‌های پرو", icon: Sparkles, pro: true },
            { key: "hyper", label: "هایپرمارکت", icon: ShoppingBasket },
            { key: "date", label: "تضمین تاریخ", icon: BadgeCheck },
          ] as const).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStoreFilter(f.key as typeof storeFilter)}
              aria-pressed={storeFilter === f.key}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-[11px] font-extrabold transition active:scale-95 ${storeFilter === f.key ? "border-ink bg-ink text-white" : "border-line bg-white text-ink"}`}
            >
              <f.icon className="h-3.5 w-3.5" /> {f.label}
              {"pro" in f && f.pro && <span className="rounded bg-[#0e7c86] px-1 py-px text-[8px] font-black italic text-white">Pro</span>}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-[#57a773] px-4 py-3 text-white shadow-md">
          <Gift className="h-5 w-5 shrink-0" />
          <p className="text-[12px] font-black">ارسال رایگان + تخفیف ۶۰٬۰۰۰ تومانی ویژه خرید اول!</p>
        </div>

        <div className="mt-3 border-y border-line bg-white lg:hidden">
          {filteredStores.slice(0, 4).map((s) => (
            <StoreCard key={s.id} store={s} onOpen={() => openStore(s.id)} />
          ))}
        </div>
        <div className="mt-3 hidden overflow-hidden rounded-[22px] border border-line bg-white lg:grid lg:grid-cols-2">
          {filteredStores.map((s) => (
            <StoreCard key={s.id} store={s} onOpen={() => openStore(s.id)} />
          ))}
        </div>

        <button type="button" onClick={() => c.openSub({ name: "stores" })} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-[#f4f3f0] py-3.5 text-[12px] font-black text-ink transition hover:bg-line active:scale-[0.99]">
          مشاهده همه فروشگاه‌ها <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {/* brands */}
      <div className="mx-4 mt-7 lg:mx-4 lg:max-w-4xl lg:px-0">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-black text-ink">برندهای محبوب</h3>
          <ChevronLeft className="h-4.5 w-4.5 text-muted" />
        </div>
        <div className="no-scrollbar mt-3 flex items-center gap-4 overflow-x-auto pb-1 lg:justify-between lg:gap-2">
          {brands.map((b) => (
            <button key={b.name} type="button" onClick={() => c.openSub({ name: "search" })} className="shrink-0 text-[15px] font-black tracking-tight opacity-80 transition hover:opacity-100" style={{ color: b.color }}>
              {b.name}
            </button>
          ))}
        </div>
      </div>

      {/* coverage map */}
      <div className="px-4 pt-6 lg:mx-4 lg:max-w-4xl lg:px-0">
        <div className="overflow-hidden rounded-[26px] border border-line bg-white shadow-[0_10px_26px_-16px_rgba(30,20,10,0.45)]">
          <div className="flex items-center justify-between p-4 pb-3">
            <div>
              <p className="flex items-center gap-1.5 text-[14px] font-black text-ink">
                <MapPin className="h-4.5 w-4.5 text-brand" /> محدوده‌ی فعال: شهرستان نظرآباد
              </p>
              <p className="mt-1 text-[11px] font-medium leading-5 text-muted">شهر نظرآباد، تنکمان، سیدجمال‌الدین و روستاهای اطراف</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-mint">
              <span className="relative flex h-2 w-2">
                <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-500 opacity-70" />
                <span className="relative h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              فعال
            </span>
          </div>
          <button type="button" onClick={() => c.openSub({ name: "map" })} className="relative block h-44 w-full lg:h-56" aria-label="مشاهده نقشه نظرآباد">
            <iframe title="نقشه شهرستان نظرآباد" src={MAP_EMBED} className="pointer-events-none h-full w-full border-0" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
            <span className="absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-ink/85 px-3.5 py-2 text-[11px] font-black text-white backdrop-blur">مشاهده نقشه و انتخاب لوکیشن دقیق</span>
          </button>
        </div>
      </div>

      <BackToTop />
    </div>
  );
}

function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 500);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!show) return null;
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fade-rise fixed bottom-24 left-4 z-40 flex items-center gap-2 rounded-2xl border border-line bg-white/95 px-3.5 py-2.5 text-[11px] font-black text-ink shadow-lg backdrop-blur transition hover:border-brand hover:text-brand lg:bottom-6"
    >
      <ArrowUp className="h-4 w-4" /> بازگشت به بالا
    </button>
  );
}

/* ---------------- All stores ---------------- */
export function StoresPage({ c }: { c: AppCtx }) {
  const [filter, setFilter] = useState<"all" | "pro" | "hyper" | "date" | "turbo">("all");
  const list = stores.filter((s) => {
    if (filter === "pro") return s.pro;
    if (filter === "hyper") return s.type === "hypermarket";
    if (filter === "date") return s.tags.some((t) => t.includes("تضمین"));
    if (filter === "turbo") return s.tags.some((t) => t.includes("توربو"));
    return true;
  });
  return (
    <div className="fade-rise mx-auto min-h-dvh w-full max-w-4xl pb-32 lg:pb-12">
      <ScreenHeader title={`${pd(list.length)} فروشگاه اطراف شما`} onBack={() => c.closeSub()} />
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
        {([
          { key: "all", label: "همه فروشگاه‌ها", icon: Store },
          { key: "pro", label: "فروشگاه‌های پرو", icon: Sparkles },
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
    <div className="fade-rise mx-auto min-h-dvh w-full max-w-4xl pb-32 lg:pb-12">
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
    <div className="fade-rise mx-auto min-h-dvh w-full max-w-3xl pb-32 lg:pb-12">
      <ScreenHeader title="انتخاب لوکیشن دقیق" onBack={() => c.closeSub()} />
      <div className="p-4">
        <div className="overflow-hidden rounded-[26px] border border-line shadow-lg">
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
    <div className="fade-rise mx-auto min-h-dvh w-full max-w-3xl pb-32 lg:pb-12">
      <div className="sticky top-0 z-30 border-b border-line bg-white/92 px-4 py-3.5 backdrop-blur lg:top-[72px]">
        <h2 className="text-[16px] font-black text-ink">خرید راحت</h2>
        <p className="mt-0.5 text-[11px] font-medium text-muted">کالاهای پرتکرار شما در نظرآباد، آماده‌ی افزودن سریع</p>
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
      <div className="px-4 pt-5">
        <button type="button" onClick={() => c.openSub({ name: "search" })} className="flex w-full items-center gap-2 rounded-2xl bg-[#f4f3f0] px-3.5 py-3.5 text-[12px] font-medium text-muted transition active:scale-[0.99]">
          <Search className="h-4.5 w-4.5" /> جستجوی سریع کالا
        </button>
      </div>
      <div className="px-4 pt-6">
        <button type="button" onClick={() => c.setSheet("codes")} className="flex w-full items-center justify-between rounded-2xl border border-dashed border-brand/40 bg-brand-soft/50 px-4 py-3.5 transition active:scale-[0.99]">
          <span className="flex items-center gap-2 text-[12px] font-black text-brand-dark">
            <TicketPercent className="h-4.5 w-4.5" /> کدهای تخفیف من
          </span>
          <ChevronLeft className="h-4 w-4 text-brand" />
        </button>
      </div>
    </div>
  );
}

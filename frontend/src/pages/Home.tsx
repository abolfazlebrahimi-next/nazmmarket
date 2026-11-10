import { amazingDeals, energizingDrinks } from "../campaigns";
import ProductRail from "../components/ProductRail";
import { previousPurchases } from "../personalization";
import { useState } from "react";
import {
  BadgeCheck,
  ChevronLeft,
  Heart,
  MapPin,
  Navigation,
  ShoppingBasket,
  Store,
  X,
  Zap,
} from "lucide-react";
import {
  Empty,
  ProductCard,
  ScreenHeader,
  StoreCard,
  pd,
} from "../components/ui";
import MapPicker from "../components/MapPicker";
import type { AppCtx } from "../ctx";
import { categories, products, stores } from "../data";

export function HomePage({ c }: { c: AppCtx }) {
  const [storeFilter, setStoreFilter] = useState<"all" | "hyper">("all");
  const available = products.filter(
    (p) => p.active !== false && Number(p.stock) > 0,
  );
  const offerProducts = available.filter((p) => p.category === "drinks");
  const amazing = amazingDeals(available);
  const drinks = energizingDrinks(available);
  const rows = categories
    .filter((cat) => cat.id !== "all")
    .map((cat) => ({
      cat,
      items: available.filter((p) => p.category === cat.id),
    }))
    .filter((row) => row.items.length);
  const filteredStores = stores.filter(
    (s) => storeFilter === "all" || s.type === "hypermarket",
  );
  const selectOffer = (p: (typeof products)[number]) => {
    if (c.cartCount > 0 && c.cart.storeId && c.cart.storeId !== p.storeId) {
      c.handleAdd(p, p.storeId);
      return;
    }
    if (!c.qtyOf(p.id)) c.handleAdd(p, p.storeId);
    c.setFirstOrderProductId(p.id);
  };
  return (
    <div className="market-home">
      {c.firstOrderEligible && offerProducts.length > 0 && (
        <button
          type="button"
          className="first-order-banner"
          onClick={() =>
            document.getElementById("first-order-products")?.scrollIntoView({
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                .matches
                ? "auto"
                : "smooth",
              block: "start",
            })
          }
        >
          <div>
            <span className="campaign-eyebrow">ویژهٔ خرید اول شما</span>
            <h1>اولین خرید، شیرین‌تر!</h1>
            <p>یک عدد نوشیدنی، با نصف قیمت</p>
            <span className="campaign-link">
              انتخاب پیشنهاد خرید اول <ChevronLeft size={16} />
            </span>
          </div>
          <span className="campaign-percent">
            ۵۰<small>٪ تخفیف</small>
          </span>
        </button>
      )}
      <div
        className="market-category-shortcuts no-scrollbar"
        aria-label="دسته‌بندی کالاها"
      >
        {categories.slice(1).map((cat) => (
          <button
            type="button"
            key={cat.id}
            onClick={() => c.openSub({ name: "category", id: cat.id })}
          >
            <span>
              <cat.icon size={25} strokeWidth={1.5} />
            </span>
            <small>{cat.name}</small>
          </button>
        ))}
      </div>
      {c.firstOrderEligible && offerProducts.length > 0 && (
        <div id="first-order-products">
          <ProductRail title="خرید اولی‌ها؛ یک عدد با ۵۰٪ تخفیف" tone="offer">
            {offerProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                h={c.cardHandlers(p.storeId)}
                firstOrderOffer={{
                  selected: c.firstOrderProductId === p.id && c.qtyOf(p.id) > 0,
                  onSelect: () => selectOffer(p),
                }}
              />
            ))}
          </ProductRail>
          <p className="campaign-terms">
            فقط یک واحد از یک نوشیدنی در اولین سفارش؛ تعداد اضافه و سایر کالاها
            با قیمت عادی فروشگاه محاسبه می‌شوند. تخفیف نهایی در سرور بررسی
            می‌شود.
          </p>
        </div>
      )}
      {!!amazing.length && (
        <ProductRail title="تخفیف‌های شگفت‌انگیز" tone="deal">
          {amazing.map((p) => (
            <ProductCard key={p.id} product={p} h={c.cardHandlers(p.storeId)} />
          ))}
        </ProductRail>
      )}
      {rows.map(({ cat, items }) => (
        <ProductRail
          key={cat.id}
          title={cat.name}
          onAll={() => c.openSub({ name: "category", id: cat.id })}
        >
          {items.map((p) => (
            <ProductCard key={p.id} product={p} h={c.cardHandlers(p.storeId)} />
          ))}
        </ProductRail>
      ))}
      {!!drinks.length && (
        <ProductRail title="بزن روشن شی" tone="blue">
          {drinks.map((p) => (
            <ProductCard key={p.id} product={p} h={c.cardHandlers(p.storeId)} />
          ))}
        </ProductRail>
      )}
      {!available.length && (
        <div className="market-empty">
          هنوز کالای موجودی از فروشگاه‌های فعال ثبت نشده است.
        </div>
      )}
      <button
        type="button"
        className="market-favorites"
        onClick={() => c.openSub({ name: "favorites" })}
      >
        <span className="favorite-emblem">
          <Heart size={25} />
        </span>
        <span>
          <strong>کالاهای مورد علاقهٔ من</strong>
          <small>{pd(c.favorites.length)} کالای مورد علاقه</small>
        </span>
        <ChevronLeft size={20} />
      </button>
      <section className="market-stores">
        <div className="market-shelf-heading">
          <h2>فروشگاه‌های اطراف شما</h2>
          <button
            type="button"
            className="shelf-all"
            aria-label="مشاهده همهٔ فروشگاه‌ها"
            onClick={() => c.openSub({ name: "stores" })}
          >
            <ChevronLeft size={20} />
          </button>
        </div>
        <div className="market-store-filters">
          <button
            type="button"
            aria-pressed={storeFilter === "all"}
            onClick={() => setStoreFilter("all")}
          >
            همهٔ فروشگاه‌ها
          </button>
          <button
            type="button"
            aria-pressed={storeFilter === "hyper"}
            onClick={() => setStoreFilter("hyper")}
          >
            هایپرمارکت
          </button>
        </div>
        <div className="market-store-list">
          {filteredStores.slice(0, 4).map((store) => (
            <StoreCard
              key={store.id}
              store={store}
              onOpen={() => c.openSub({ name: "store", id: store.id })}
            />
          ))}
          {!filteredStores.length && (
            <p className="market-empty">فروشگاه فعالی در این بخش موجود نیست.</p>
          )}
        </div>
        <button
          type="button"
          className="market-all-stores"
          onClick={() => c.openSub({ name: "stores" })}
        >
          مشاهدهٔ همهٔ فروشگاه‌ها <ChevronLeft size={18} />
        </button>
      </section>
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
    <div className="fade-rise mx-auto w-full max-w-4xl pb-6">
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
    <div className="fade-rise mx-auto w-full max-w-4xl pb-6">
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
    <div className="fade-rise mx-auto w-full max-w-3xl pb-6">
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
  const purchased = previousPurchases(c.orders, products, 8);
  return (
    <div className="market-home easy-buy-page">
      <section className="easy-buy-categories">
        <h2>دسترسی سریع به دسته‌ها</h2>
        <div>
          {categories.slice(1).map((cat) => (
            <button
              type="button"
              key={cat.id}
              onClick={() => c.openSub({ name: "category", id: cat.id })}
            >
              <cat.icon size={25} />
              <span>{cat.name}</span>
            </button>
          ))}
        </div>
      </section>
      {purchased.length ? (
        <ProductRail title="از خریدهای قبلی شما">
          {purchased.map((p) => (
            <ProductCard key={p.id} product={p} h={c.cardHandlers(p.storeId)} />
          ))}
        </ProductRail>
      ) : (
        <div className="market-empty">
          پس از اولین خرید تکمیل‌شده، کالاهای موجودِ خریدهای قبلی شما اینجا
          نمایش داده می‌شوند.
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import {
  Banknote,
  Bike,
  Check,
  ChevronLeft,
  Gift,
  ShoppingCart,
  Store,
  TicketPercent,
  Timer,
  Trash2,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import {
  BackButton,
  ScreenHeader,
  Empty,
  QtyStepper,
  ProductVisual,
  StoreAvatar,
  pd,
} from "../components/ui";
import { codeFamilyLabel, codeOwner } from "../discountCodes";
import type { Order } from "../data";
import type { AppCtx } from "../ctx";
import { discountOf, faNum, firstOffers, productById, stores } from "../data";

const fa = faNum;

/**
 * What the customer actually agreed to, printed from the row the server wrote —
 * not from the basket in memory. Legacy rows without a split only report the
 * total discount, so nothing here can claim a share the order does not record.
 */
function Receipt({ order }: { order: Order }) {
  const discount = Number(order.discount ?? 0);
  const platform = Number(order.platformDiscount ?? 0);
  const seller = Number(order.sellerDiscount ?? 0);
  const firstOffer = Number(order.firstOfferDiscount ?? 0);
  const split =
    platform + seller + firstOffer > 0 &&
    platform + seller + firstOffer <= discount;
  const parts = [
    platform > 0 ? `سهم نازمارکت ${fa(platform)}` : "",
    seller > 0 ? `سهم فروشگاه ${fa(seller)}` : "",
    firstOffer > 0 ? `پیشنهاد خرید اول ${fa(firstOffer)}` : "",
  ].filter(Boolean);
  return (
    <dl className="mx-auto mt-6 w-full max-w-xs space-y-1.5 rounded-3xl border border-line bg-white p-4 text-[11.5px] font-bold shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <dt className="text-muted">جمع کالاها</dt>
        <dd className="text-ink">{fa(Number(order.subtotal ?? 0))} تومان</dd>
      </div>
      {discount > 0 && (
        <div className="flex items-center justify-between gap-3">
          <dt className="text-mint">
            تخفیف
            {!!order.promoCode && ` (کد ${order.promoCode})`}
          </dt>
          <dd className="text-mint">− {fa(discount)} تومان</dd>
        </div>
      )}
      {discount > 0 && split && (
        // <dl> only allows dt/dd (or div) children, so the note is a div.
        <div className="text-[10px] font-medium leading-5 text-muted">
          {parts.join(" · ")}
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <dt className="text-muted">هزینه ارسال</dt>
        <dd className="text-ink">
          {Number(order.delivery ?? 0) > 0
            ? `${fa(Number(order.delivery))} تومان`
            : "رایگان"}
        </dd>
      </div>
      <div className="mt-1 flex items-center justify-between gap-3 border-t border-dashed border-line pt-2">
        <dt className="text-ink">قابل پرداخت</dt>
        <dd className="text-[13px] font-black text-ink">
          {fa(Number(order.total ?? 0))} تومان
        </dd>
      </div>
    </dl>
  );
}

/* ---------------- Cart (mobile full view + desktop drawer body) ---------------- */
/**
 * One wording for both summary tables: which family paid for the discount.
 * Without a matched row the code's owner is unknown, so the label stays neutral
 * rather than blaming the seller for a discount nobody claimed yet.
 */
const discountLabel = (c: AppCtx) =>
  [
    c.firstOrderDiscount > 0 ? "تخفیف خرید اول نوشیدنی" : "",
    !!c.appliedCode
      ? c.appliedPromo
        ? `کد ${codeOwner(c.appliedPromo)}`
        : "کد تخفیف"
      : "",
  ]
    .filter(Boolean)
    .join(" + ") || "تخفیف";

/* ---------------- Cart lines (Snapp-style rows) ---------------- */
function CartLine({
  c,
  product,
  qty,
}: {
  c: AppCtx;
  product: NonNullable<ReturnType<typeof productById>>;
  qty: number;
}) {
  const isOfferLine =
    c.firstOrderProductId === product.id && c.firstOrderDiscount > 0;
  const offer = firstOffers.find((o) => o.productId === product.id);
  const disc = discountOf(product);
  const lineGross = product.price * qty;
  const lineNet = isOfferLine ? lineGross - c.firstOrderDiscount : lineGross;
  return (
    <div className="flex items-center gap-3 border-b border-line py-3 last:border-b-0">
      <div className="h-[58px] w-[58px] shrink-0">
        <ProductVisual product={product} hideDiscount />
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[11px] font-black leading-5 text-ink">
          {product.name}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {/* قیمت واقعی اعمال‌شده: برای کالای «خرید اول» با تخفیف یک واحد */}
          <span className="text-[12px] font-black text-ink">
            {fa(lineNet)} تومان
          </span>
          {(isOfferLine || Number(product.oldPrice ?? 0) > product.price) && (
            <del className="text-[9px] font-bold text-muted">
              {fa(isOfferLine ? lineGross : Number(product.oldPrice) * qty)}
            </del>
          )}
          {isOfferLine && offer ? (
            <span className="rounded-lg bg-brand-soft px-1.5 py-0.5 text-[8.5px] font-black text-brand-dark">
              {pd(offer.percent)}٪ خرید اول
            </span>
          ) : (
            disc > 0 && (
              <span className="rounded-lg bg-brand-soft px-1.5 py-0.5 text-[8.5px] font-black text-brand-dark">
                {pd(disc)}٪
              </span>
            )
          )}
        </div>
        {isOfferLine && (
          <p className="mt-0.5 text-[9px] font-black text-mint">
            خرید اول: {fa(c.firstOrderDiscount)} تومان تخفیف
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          aria-label={`حذف ${product.name}`}
          onClick={() => {
            for (let i = 0; i < qty; i++) c.handleDec(product.id);
            c.toast(`${product.name} از سبد حذف شد`);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full text-red-500 transition hover:bg-red-50 active:scale-90"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <QtyStepper
          small
          qty={qty}
          onInc={() => c.handleAdd(product, c.cart.storeId ?? undefined)}
          onDec={() => c.handleDec(product.id)}
        />
      </div>
    </div>
  );
}

export function CartBody({
  c,
  compact = false,
}: {
  c: AppCtx;
  compact?: boolean;
}) {
  const items = Object.entries(c.cart.items)
    .map(([id, qty]) => {
      const p = productById(Number(id));
      return p ? { product: p, qty } : null;
    })
    .filter(
      (
        x,
      ): x is {
        product: NonNullable<ReturnType<typeof productById>>;
        qty: number;
      } => x !== null,
    );

  if (c.cartCount === 0) {
    return (
      <Empty
        // Centred on every surface — the phone cart page used to pin this to
        // the top-inline corner and it read as "stuck in the right".
        align="center"
        icon={ShoppingCart}
        title="سبد خریدی ندارید!"
        desc="کالاهای مورد نیاز خود را از فروشگاه‌های نظرآباد به سبد اضافه کنید."
        actionLabel="شروع خرید"
        onAction={() => {
          c.setCartDrawer(false);
          c.go("home");
        }}
      />
    );
  }

  const offer = firstOffers.find(
    (o) => o.productId === c.firstOrderProductId,
  );
  const minLeft =
    offer && c.firstOrderEligible && c.firstOrderDiscount === 0
      ? Math.max(0, offer.minBasket - c.subtotal)
      : 0;
  // حداقل خریدِ خودِ فروشگاه؛ تا رسیدن به آن، خرید از همان فروشگاه کامل می‌شود.
  const storeMinLeft = c.cartStore
    ? Math.max(0, c.cartStore.minBasket - c.subtotal)
    : 0;

  return (
    <div
      className={
        compact
          ? "flex min-h-0 flex-1 flex-col"
          : "mx-auto w-full max-w-2xl px-4 pb-6 pt-4"
      }
    >
      {/* فروشگاه */}
      <div className="flex items-center gap-2.5 border-b border-line px-4 pb-3 pt-1">
        <button
          type="button"
          onClick={() => {
            if (!c.cartStore) return;
            const store = c.cartStore;
            c.setCartDrawer(false);
            c.openSub({ name: "store", id: store.id });
          }}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-right"
        >
          {c.cartStore ? (
            <StoreAvatar
              store={c.cartStore}
              className="h-10 w-10 rounded-2xl text-[11px]"
            />
          ) : (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#f4f3f0]">
              <Store className="h-5 w-5 text-[#a8a49e]" />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-black text-ink">
              {c.cartStore ? c.cartStore.name : "در انتظار انتخاب فروشگاه"}
            </span>
            <span className="mt-0.5 block text-[10px] font-medium text-muted">
              {pd(c.cartCount)} کالا
            </span>
          </span>
          <ChevronLeft className="h-4 w-4 shrink-0 text-muted" />
        </button>
        <button
          type="button"
          onClick={() => {
            c.clearCart();
            c.toast("سبد خرید حذف شد");
          }}
          aria-label="حذف سبد"
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-red-50 hover:text-red-500"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* کالاها */}
      <div className="min-h-0 flex-1 overflow-y-auto app-scroll px-4">
        {items.map(({ product, qty }) => (
          <CartLine key={product.id} c={c} product={product} qty={qty} />
        ))}
        {minLeft > 0 && offer && (
          <p className="my-3 rounded-2xl bg-brand-soft px-3.5 py-2.5 text-[10px] font-bold leading-5 text-brand-dark">
            برای فعال شدن «خرید اول»، {fa(minLeft)} تومان دیگر از همین فروشگاه به
            سبد اضافه کنید (حداقل خرید {fa(offer.minBasket)} تومان).
          </p>
        )}
      </div>

      {/* جمع و تکمیل خرید */}
      <div className="border-t border-line px-4 py-3.5">
        {c.firstOrderDiscount > 0 && (
          <div className="mb-1.5 flex items-center justify-between text-[10.5px] font-bold text-mint">
            <span>تخفیف خرید اول</span>
            <span>− {fa(c.firstOrderDiscount)} تومان</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-muted">
            جمع مبلغ سبد خرید
          </span>
          <span className="text-[14.5px] font-black text-ink">
            {fa(Math.max(0, c.subtotal - c.firstOrderDiscount))} تومان
          </span>
        </div>
        {storeMinLeft > 0 && c.cartStore && (
          <div className="mt-2.5">
            <div className="flex items-center justify-between text-[10.5px] font-bold">
              <span className="text-mint">
                حداقل خرید: {fa(c.cartStore.minBasket)} تومان
              </span>
              <span className="text-ink">
                باقی‌مانده: {fa(storeMinLeft)} تومان
              </span>
            </div>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[#f0ece7]">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{
                  width: `${Math.min(100, (c.subtotal / Math.max(1, c.cartStore.minBasket)) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            c.setCartDrawer(false);
            if (!c.user) return c.requireLogin("checkout");
            c.openSub({ name: "checkout" });
          }}
          disabled={!c.cartStore || storeMinLeft > 0}
          className="mt-3 w-full rounded-2xl bg-brand py-3.5 text-[13px] font-black text-white shadow-lg shadow-brand/30 transition enabled:active:scale-[0.99] disabled:bg-[#a9cbb8] disabled:shadow-none"
        >
          تکمیل خرید
        </button>
      </div>
    </div>
  );
}

/* ---------------- Checkout: سبد ← فروشگاه ← آدرس ← پایان خرید ---------------- */
type CheckoutStep = "store" | "address" | "done";

/** زنجیرهٔ مراحل خرید، هم‌شکل قدم‌های پیگیری سفارش. */
function CheckoutChain({
  steps,
  activeIndex,
}: {
  steps: { key: string; label: string }[];
  activeIndex: number;
}) {
  return (
    <div className="flex items-center" dir="rtl">
      {steps.map((step, i) => (
        <div key={step.key} className="flex flex-1 items-center last:flex-none">
          <div className="flex flex-col items-center gap-1.5">
            <span
              className={`relative flex h-6 w-6 items-center justify-center rounded-full text-white ${i < activeIndex ? "bg-mint" : i === activeIndex ? "bg-brand" : "bg-[#ddd9d3]"}`}
            >
              {i < activeIndex ? (
                <Check className="relative h-3 w-3" strokeWidth={3.5} />
              ) : (
                <span className="relative text-[9px] font-black">
                  {pd(i + 1)}
                </span>
              )}
            </span>
            <span
              className={`text-center text-[8.5px] font-bold sm:text-[9.5px] ${i <= activeIndex ? "text-ink" : "text-muted"}`}
            >
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <span
              className={`mx-1 mb-4 h-0.5 flex-1 rounded-full ${i < activeIndex ? "bg-mint" : "bg-[#eeece9]"}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function CheckoutView({ c }: { c: AppCtx }) {
  const needsStore = !c.cart.storeId;
  const [step, setStep] = useState<CheckoutStep>(
    needsStore ? "store" : "address",
  );
  const [slot, setSlot] = useState("now");
  const [payment, setPayment] = useState<"online" | "cash" | "wallet">("cash");
  const [codeInput, setCodeInput] = useState("");
  const [placing, setPlacing] = useState(false);
  const pickup = c.orderDeliveryMode === "pickup";

  const items = Object.entries(c.cart.items)
    .map(([id, qty]) => {
      const p = productById(Number(id));
      return p ? { product: p, qty } : null;
    })
    .filter(Boolean) as {
    product: NonNullable<ReturnType<typeof productById>>;
    qty: number;
  }[];

  const chain = [
    { key: "cart", label: "سبد خرید" },
    ...(needsStore ? [{ key: "store", label: "فروشگاه" }] : []),
    { key: "address", label: "آدرس" },
    { key: "done", label: "پایان خرید" },
  ];
  const activeIndex = Math.max(
    0,
    chain.findIndex((s) => s.key === step),
  );

  const submit = async () => {
    if (!c.user) return c.requireLogin("checkout");
    if (!pickup && !c.selectedAddress)
      return c.toast("ابتدا آدرس تحویل را انتخاب کنید");
    if (!c.cart.storeId) {
      c.openStorePicker();
      return c.toast("ابتدا فروشگاه را انتخاب کنید");
    }
    if (payment === "wallet" && c.wallet < c.payable)
      return c.toast(
        "موجودی کیف پول کافی نیست؛ روش پرداخت دیگری را انتخاب کنید.",
      );
    setPlacing(true);
    await c.placeOrder({
      slot: slot === "now" ? (pickup ? "دریافت حضوری" : "ارسال فوری") : slot,
      payment,
      deliveryMode: c.orderDeliveryMode,
    });
    setPlacing(false);
  };

  return (
    <div className="fade-rise w-full min-w-0 max-w-full overflow-x-clip pb-6">
      <ScreenHeader title="تکمیل خرید" onBack={() => c.closeSub()} />

      <div className="mx-auto w-full max-w-2xl px-4 pt-2">
        {/* زنجیرهٔ مراحل */}
        <div className="rounded-3xl border border-line bg-white px-3 py-4">
          <CheckoutChain steps={chain} activeIndex={activeIndex} />
        </div>

        {/* ---------- مرحلهٔ فروشگاه (فقط وقتی سبد فروشگاه ندارد) ---------- */}
        {step === "store" && (
          <div className="mt-3 rounded-3xl border border-line bg-white p-4">
            <p className="text-[13px] font-black text-ink">انتخاب فروشگاه</p>
            <p className="mt-1 text-[10.5px] font-medium leading-5 text-muted">
              سبد شما هنوز به فروشگاهی وصل نیست؛ فروشگاه مدنظر را انتخاب کنید.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {stores.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    c.pickStore(s.id);
                    setStep("address");
                  }}
                  className="flex items-center gap-3 rounded-2xl border border-line p-3 text-right transition hover:border-brand/50 active:scale-[0.99]"
                >
                  <StoreAvatar
                    store={s}
                    className="h-10 w-10 rounded-2xl text-[11px]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-black text-ink">
                      {s.name}
                    </p>
                    <p className="truncate text-[10px] font-medium text-muted">
                      {s.area} · تا {pd(s.minutes)} دقیقه
                    </p>
                  </div>
                  <ChevronLeft className="h-4 w-4 shrink-0 text-muted" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ---------- مرحلهٔ آدرس و نحوهٔ تحویل ---------- */}
        {step === "address" && (
          <div className="mt-3 space-y-3">
            <div className="rounded-3xl border border-line bg-white p-4">
              <p className="text-[13px] font-black text-ink">نحوه تحویل</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => c.setOrderDeliveryMode("courier")}
                  aria-pressed={!pickup}
                  className={`rounded-2xl border p-3 text-right transition ${!pickup ? "border-brand bg-brand-soft" : "border-line"}`}
                >
                  <p className="flex items-center gap-1.5 text-[12px] font-black text-ink">
                    <Bike className="h-4 w-4 text-brand" /> ارسال با پیک
                  </p>
                  <p className="mt-1 text-[10px] font-medium text-muted">
                    تحویل درب منزل شما
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => c.setOrderDeliveryMode("pickup")}
                  aria-pressed={pickup}
                  className={`rounded-2xl border p-3 text-right transition ${pickup ? "border-brand bg-brand-soft" : "border-line"}`}
                >
                  <p className="flex items-center gap-1.5 text-[12px] font-black text-ink">
                    <Store className="h-4 w-4 text-brand" /> دریافت حضوری
                  </p>
                  <p className="mt-1 text-[10px] font-medium text-muted">
                    بدون هزینه ارسال
                  </p>
                </button>
              </div>

              {!pickup ? (
                <div className="mt-3 flex items-stretch gap-2">
                  <div className="min-w-0 flex-1 rounded-2xl border border-line p-3.5">
                    <p className="truncate text-[11.5px] font-black text-ink">
                      تحویل در: {c.selectedAddress?.title ?? "انتخاب آدرس"}
                    </p>
                    <p className="mt-1 text-[10px] font-medium leading-5 text-muted">
                      {c.selectedAddress
                        ? `${c.selectedAddress.address}، ${c.selectedAddress.detail} · ${c.selectedAddress.phone}`
                        : "آدرسی ثبت نشده است؛ «تغییر آدرس» را بزنید."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => c.openAddress("checkout")}
                    className="shrink-0 rounded-2xl border border-brand px-4 text-[11px] font-black text-brand transition active:scale-95"
                  >
                    تغییر آدرس
                  </button>
                </div>
              ) : (
                <div className="mt-3 rounded-2xl border border-line p-3.5">
                  <p className="text-[11.5px] font-black text-ink">
                    دریافت حضوری از فروشگاه
                  </p>
                  <p className="mt-1 text-[10px] font-medium leading-5 text-muted">
                    {c.cartStore?.name} · {c.cartStore?.address || c.cartStore?.area}
                  </p>
                  <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-[10px] font-bold text-emerald-700">
                    برای دریافت حضوری هزینه‌ای بابت ارسال گرفته نمی‌شود.
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-line bg-white p-4">
              <p className="flex items-center gap-2 text-[13px] font-black text-ink">
                <Timer className="h-4.5 w-4.5 text-brand" />{" "}
                {pickup ? "زمان مراجعه" : "زمان تحویل"}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSlot("now")}
                  aria-pressed={slot === "now"}
                  className={`rounded-2xl border p-3 text-right transition ${slot === "now" ? "border-brand bg-brand-soft" : "border-line"}`}
                >
                  <p className="flex items-center gap-1 text-[12px] font-black text-ink">
                    <Zap className="h-3.5 w-3.5 text-brand" />{" "}
                    {pickup ? "در اولین فرصت" : "ارسال فوری"}
                  </p>
                  <p className="mt-1 text-[10px] font-medium text-muted">
                    تا {pd(c.cartStore?.minutes ?? 45)} دقیقه دیگر
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setSlot("۱۲ تا ۱۴")}
                  aria-pressed={slot !== "now"}
                  className={`rounded-2xl border p-3 text-right transition ${slot !== "now" ? "border-brand bg-brand-soft" : "border-line"}`}
                >
                  <p className="flex items-center gap-1 text-[12px] font-black text-ink">
                    <Timer className="h-3.5 w-3.5 text-brand" /> زمان‌بندی‌شده
                  </p>
                  <p className="mt-1 text-[10px] font-medium text-muted">
                    انتخاب بازه
                  </p>
                </button>
              </div>
              {slot !== "now" && (
                <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {["۱۲ تا ۱۴", "۱۴ تا ۱۶", "۱۶ تا ۱۸", "۱۸ تا ۲۰"].map(
                    (s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSlot(s)}
                        className={`min-w-0 rounded-xl px-1 py-2 text-[11px] font-extrabold transition ${slot === s ? "bg-ink text-white" : "bg-[#f4f3f0] text-ink"}`}
                      >
                        {s}
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => c.setCartDrawer(true)}
                className="rounded-2xl bg-[#f4f3f0] px-4 py-3.5 text-[12px] font-black text-ink transition active:scale-[0.99]"
              >
                بازگشت به سبد
              </button>
              <button
                type="button"
                onClick={() => setStep("done")}
                className="flex-1 rounded-2xl bg-brand py-3.5 text-[13px] font-black text-white shadow-lg shadow-brand/30 transition active:scale-[0.99]"
              >
                ادامه: پایان خرید
              </button>
            </div>
          </div>
        )}

        {/* ---------- مرحلهٔ پایان خرید: فاکتور کامل ---------- */}
        {step === "done" && (
          <div className="mt-3 space-y-3">
            <div className="rounded-3xl border border-line bg-white p-4">
              <p className="text-[14px] font-black text-ink">فاکتور سفارش</p>
              <div className="mt-3 space-y-1.5 rounded-2xl bg-[#f8f7f4] p-3.5 text-[10.5px] font-bold leading-6 text-muted">
                <p>فروشگاه: {c.cartStore?.name}</p>
                <p>
                  {pickup
                    ? `دریافت حضوری از فروشگاه · ${c.cartStore?.address || c.cartStore?.area}`
                    : `ارسال با پیک به: ${c.selectedAddress ? `${c.selectedAddress.address}، ${c.selectedAddress.detail}` : "—"}`}
                </p>
                <p>
                  زمان:{" "}
                  {slot === "now"
                    ? pickup
                      ? "دریافت در اولین فرصت"
                      : "ارسال فوری"
                    : slot}
                </p>
              </div>

              <div className="mt-3 divide-y divide-dashed divide-line">
                {items.map(({ product, qty }) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between gap-2 py-2.5"
                  >
                    <p className="min-w-0 flex-1 truncate text-[11px] font-bold text-ink">
                      {product.name} × {pd(qty)}
                      {c.firstOrderProductId === product.id &&
                        c.firstOrderDiscount > 0 && (
                          <span className="mr-1 text-[9.5px] font-black text-mint">
                            · خرید اول
                          </span>
                        )}
                    </p>
                    <p className="shrink-0 text-[11px] font-black text-ink">
                      {fa(
                        product.price * qty -
                          (c.firstOrderProductId === product.id
                            ? c.firstOrderDiscount
                            : 0),
                      )}{" "}
                      تومان
                      {c.firstOrderProductId === product.id &&
                        c.firstOrderDiscount > 0 && (
                          <del className="mr-1 text-[9px] font-bold text-muted">
                            {fa(product.price * qty)}
                          </del>
                        )}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-3">
                {[
                  {
                    label: `جمع کالاها (${pd(c.cartCount)} کالا)`,
                    value: `${fa(c.subtotal)} تومان`,
                  },
                  ...(c.firstOrderDiscount > 0
                    ? [
                        {
                          label: "تخفیف خرید اول (یک عدد)",
                          value: `− ${fa(c.firstOrderDiscount)} تومان`,
                          green: true,
                        },
                      ]
                    : []),
                  ...(c.discountAmount > 0
                    ? [
                        {
                          label: discountLabel(c),
                          value: `− ${fa(c.discountAmount)} تومان`,
                          green: true,
                        },
                      ]
                    : []),
                  {
                    label: pickup
                      ? "هزینه ارسال (دریافت حضوری)"
                      : c.deliveryFee === 0
                        ? "هزینه ارسال"
                        : "ارسال (پرداخت با مشتری)",
                    value:
                      c.deliveryFee === 0
                        ? "رایگان"
                        : `${fa(c.deliveryFee)} تومان`,
                    green: c.deliveryFee === 0,
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between border-b border-dashed border-line py-2.5 text-[12px] font-bold"
                  >
                    <span className="text-muted">{row.label}</span>
                    <span
                      className={row.green ? "font-black text-mint" : "text-ink"}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-3">
                  <span className="text-[13px] font-black text-ink">
                    مبلغ قابل پرداخت
                  </span>
                  <span className="text-[17px] font-black text-brand">
                    {fa(c.payable)} تومان
                  </span>
                </div>
              </div>
            </div>

            {/* روش پرداخت */}
            <div className="rounded-3xl border border-line bg-white p-4">
              <p className="flex items-center gap-2 text-[13px] font-black text-ink">
                <Wallet className="h-4.5 w-4.5 text-brand" /> روش پرداخت
              </p>
              <div className="mt-3 space-y-2">
                {(
                  [
                    {
                      key: "cash",
                      label: pickup ? "پرداخت در فروشگاه" : "پرداخت در محل",
                      desc: pickup
                        ? "پرداخت هنگام دریافت سفارش از فروشگاه."
                        : "پرداخت به فروشنده هنگام تحویل؛ درگاه آنلاین هنوز فعال نیست.",
                      icon: Banknote,
                      disabled: false,
                    },
                    {
                      key: "wallet",
                      label: "پرداخت از کیف پول",
                      desc:
                        c.wallet >= c.payable
                          ? "پرداخت از موجودی کیف پول؛ اگر سفارش لغو شود، مبلغ به کیف پول برمی‌گردد."
                          : "موجودی کیف پول برای این سفارش کافی نیست.",
                      icon: Wallet,
                      disabled: c.wallet < c.payable,
                    },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    disabled={m.disabled}
                    onClick={() => setPayment(m.key)}
                    aria-pressed={payment === m.key}
                    className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-right transition disabled:opacity-50 ${payment === m.key ? "border-brand bg-brand-soft" : "border-line"}`}
                  >
                    <m.icon className="h-5 w-5 text-brand" />
                    <span className="flex-1">
                      <span className="block text-[12px] font-black text-ink">
                        {m.label}
                      </span>
                      <span className="text-[10px] font-medium text-muted">
                        {m.desc}
                      </span>
                    </span>
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${payment === m.key ? "border-brand bg-brand" : "border-line bg-white"}`}
                    >
                      {payment === m.key && (
                        <Check
                          className="h-3 w-3 text-white"
                          strokeWidth={3.5}
                        />
                      )}
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-2xl bg-[#f8f7f4] px-3 py-2.5">
                <Wallet className="h-4 w-4 text-mint" />
                <p className="text-[11px] font-bold text-ink">
                  موجودی کیف پول: {fa(c.wallet)} تومان
                </p>
              </div>
            </div>

            {/* کد تخفیف */}
            <div className="rounded-3xl border border-line bg-white p-4">
              <p className="flex items-center gap-2 text-[13px] font-black text-ink">
                <TicketPercent className="h-4.5 w-4.5 text-brand" /> کد تخفیف
              </p>
              {c.appliedCode ? (
                <div className="mt-3 flex items-start justify-between gap-3 rounded-2xl bg-emerald-50 px-3.5 py-3">
                  <div className="min-w-0">
                    <p className="text-[12px] font-black text-emerald-700">
                      {c.appliedCode} اعمال شد · {fa(c.codeDiscount)} تومان
                      تخفیف
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-emerald-700/80">
                      {!!c.appliedPromo && (
                        <span className="rounded-lg bg-white/70 px-1.5 py-0.5 text-[9px] font-black text-emerald-700">
                          {codeFamilyLabel(c.appliedPromo)}
                        </span>
                      )}
                      {c.appliedPromo?.scope === "platform"
                        ? "سهم نازمارکت؛ کارمزد فروشگاه دست‌نخورده می‌ماند."
                        : "کد توسط فروشگاه تعریف شده است."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => c.setAppliedCode(null)}
                    aria-label="حذف کد تخفیف"
                    className="shrink-0 text-emerald-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="mt-3 flex items-stretch gap-2">
                  <label className="naz-floating-field checkout-code-field min-w-0 flex-1">
                    <span className="naz-floating-label">کد تخفیف</span>
                    <input
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value)}
                      placeholder="مثلاً NAZ20"
                      dir="ltr"
                      aria-label="کد تخفیف"
                      className="min-w-0 w-full rounded-2xl border border-line px-3.5 py-3 text-left text-[12px] font-bold uppercase outline-none focus:border-brand"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      c.applyCode(codeInput);
                      setCodeInput("");
                    }}
                    className="shrink-0 rounded-2xl bg-ink px-6 text-[13px] font-black text-white transition active:scale-95"
                  >
                    اعمال کد تخفیف
                  </button>
                </div>
              )}
            </div>

            {/* ثبت */}
            <button
              type="button"
              onClick={submit}
              disabled={placing}
              className="w-full rounded-2xl bg-brand py-4 text-[14px] font-black text-white shadow-lg shadow-brand/40 transition enabled:active:scale-[0.99] disabled:opacity-60"
            >
              {placing ? "در حال ثبت سفارش..." : "ثبت سفارش"}
            </button>
            <button
              type="button"
              onClick={() => setStep("address")}
              className="w-full rounded-2xl bg-[#f4f3f0] py-3.5 text-[12px] font-black text-ink transition active:scale-[0.99]"
            >
              مرحله قبل
            </button>
            <p className="flex items-center justify-center gap-1.5 text-[10px] font-semibold text-muted">
              <Gift className="h-3.5 w-3.5 text-brand" /> سفارش شما فقط در محدوده
              شهرستان نظرآباد تحویل می‌شود
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Done ---------------- */
export function DoneView({ c, order }: { c: AppCtx; order: Order }) {
  return (
    <div className="fade-rise flex min-h-[360px] flex-col items-center justify-center px-6 py-16 text-center lg:min-h-0">
      <div className="relative h-24 w-24">
        <span
          className="absolute inset-0 rounded-full bg-emerald-100"
          style={{ animation: "success-ring 1.6s ease-out infinite" }}
        />
        <span className="relative flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xl">
          <Check className="h-11 w-11" strokeWidth={3} />
        </span>
      </div>
      <h2 className="mt-6 text-[19px] font-black text-ink">
        سفارش شما ثبت شد!
      </h2>
      <p className="mx-auto mt-2 max-w-80 text-[12px] font-medium leading-6 text-muted">
        سفارش شما در ساعت {pd(order.time)} ثبت شد و برای{" "}
        <strong className="text-ink">{order.storeName}</strong> فرستاده شد.
        پس از تأیید فروشگاه، زمان تحویل را به شما می‌گوییم.
      </p>
      <Receipt order={order} />
      <div className="mt-7 w-full max-w-xs space-y-2.5">
        <button
          type="button"
          onClick={() => {
            c.closeSub();
            c.go("orders");
          }}
          className="w-full rounded-2xl bg-brand py-4 text-[13px] font-black text-white shadow-lg shadow-brand/30 transition active:scale-[0.99]"
        >
          پیگیری سفارش
        </button>
        <BackButton
          onBack={() => {
            c.closeSub();
            c.go("home");
          }}
        />
      </div>
    </div>
  );
}

/* ---------------- Cart drawer: پنل کناری مانند تصویر مرجع ---------------- */
export function CartDrawer({ c }: { c: AppCtx }) {
  return (
    <div
      className="fixed inset-0 z-[75]"
      role="dialog"
      aria-modal="true"
      aria-label="سبد خرید"
    >
      <button
        type="button"
        aria-label="بستن سبد"
        onClick={() => c.setCartDrawer(false)}
        className="fade-in absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
      />
      <div className="drawer-in absolute inset-y-0 left-0 flex w-full max-w-[420px] flex-col border-r border-line bg-white shadow-2xl md:rounded-r-[28px]">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-[15px] font-black text-ink">سبد خرید</h3>
          <div className="flex items-center gap-2">
            <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-brand px-2 text-[11px] font-black text-white">
              {pd(c.cartCount)}
            </span>
            <button
              type="button"
              onClick={() => c.setCartDrawer(false)}
              aria-label="بستن"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f3f0] transition active:scale-90"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
        <CartBody c={c} compact />
      </div>
    </div>
  );
}

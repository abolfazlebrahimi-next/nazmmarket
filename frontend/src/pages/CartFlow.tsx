import { useState } from "react";
import {
  Banknote,
  Check,
  ChevronLeft,
  Gift,
  MapPin,
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
import { faNum, productById } from "../data";

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
        align="start"
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

  return (
    <div
      className={
        compact
          ? "flex flex-1 flex-col overflow-y-auto app-scroll"
          : "px-4 pt-4 pb-4"
      }
    >
      <div className={compact ? "flex-1 overflow-y-auto app-scroll px-4" : ""}>
        <div className="rounded-[26px] border border-line bg-white p-4 shadow-[0_10px_26px_-18px_rgba(30,20,10,0.4)]">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => {
                c.clearCart();
                c.toast("سبد خرید حذف شد");
              }}
              aria-label="حذف سبد"
              className="order-first flex h-8 w-8 items-center justify-center rounded-full text-ink transition hover:bg-red-50 hover:text-red-500"
            >
              <Trash2 className="h-4.5 w-4.5" />
            </button>
            <div className="flex-1">
              {c.cartStore ? (
                <>
                  <p className="text-[13px] font-black text-ink">
                    {c.cartStore.name}
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium text-muted">
                    {pd(c.cartCount)} کالا
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[13px] font-black text-ink">
                    در انتظار انتخاب فروشگاه
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium text-muted">
                    {pd(c.cartCount)} کالا
                  </p>
                </>
              )}
            </div>
            {c.cartStore ? (
              <StoreAvatar
                store={c.cartStore}
                className="h-12 w-12 rounded-2xl text-[12px]"
              />
            ) : (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f4f3f0]">
                <Store className="h-6 w-6 text-[#a8a49e]" />
              </span>
            )}
          </div>

          <div className="mt-4 space-y-2">
            {c.cartStore ? (
              <button
                type="button"
                onClick={() => {
                  c.setCartDrawer(false);
                  c.openSub({ name: "checkout" });
                }}
                className="w-full rounded-2xl bg-brand py-3.5 text-[13px] font-black text-white transition active:scale-[0.99]"
              >
                ادامه فرآیند خرید
              </button>
            ) : (
              <button
                type="button"
                onClick={c.openStorePicker}
                className="w-full rounded-2xl bg-brand py-3.5 text-[13px] font-black text-white transition active:scale-[0.99]"
              >
                جستجوی فروشگاه
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                c.setCartDrawer(false);
                c.go("home");
              }}
              className="w-full rounded-2xl bg-[#f4f3f0] py-3.5 text-[13px] font-black text-ink transition active:scale-[0.99]"
            >
              افزودن کالا
            </button>
          </div>
        </div>

        {!compact && (
          <>
            <div className="mt-4 divide-y divide-line rounded-[26px] border border-line bg-white">
              {items.map(({ product, qty }) => (
                <div key={product.id} className="flex items-center gap-3 p-3.5">
                  <span
                    className={`flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${product.bg}`}
                    style={{ height: 52, width: 52 }}
                  >
                    <ProductVisual product={product} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-extrabold text-ink">
                      {product.name}
                    </p>
                    <p className="mt-0.5 text-[10px] font-medium text-muted">
                      {product.unit} · {fa(product.price)} تومان
                      {c.firstOrderEligible &&
                      c.firstOrderProductId === product.id &&
                      c.firstOrderDiscount > 0 ? (
                        <span className="mr-1 font-black text-mint">
                          · یک عدد ۵۰٪ تخفیف
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <QtyStepper
                      small
                      qty={qty}
                      onInc={() =>
                        c.handleAdd(product, c.cart.storeId ?? undefined)
                      }
                      onDec={() => c.handleDec(product.id)}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-[26px] border border-line bg-white p-4">
              <div className="flex items-center justify-between text-[12px] font-bold">
                <span className="text-muted">جمع سبد خرید</span>
                <span className="font-black text-ink">
                  {fa(c.subtotal)} تومان
                </span>
              </div>
              {c.discountAmount > 0 && (
                <div className="mt-2 text-[12px] font-bold">
                  <div className="flex items-center justify-between">
                    <span className="text-mint">{discountLabel(c)}</span>
                    <span className="font-black text-mint">
                      − {fa(c.discountAmount)} تومان
                    </span>
                  </div>
                  {c.appliedPromo?.scope === "platform" && (
                    <p className="mt-1 text-[10px] font-medium text-muted">
                      {fa(c.codeDiscount)} تومان آن سهم نازمارکت است و از فروش
                      فروشگاه کم نمی‌شود.
                    </p>
                  )}
                </div>
              )}
              {c.firstOrderEligible && c.firstOrderDiscount === 0 && (
                <p className="mt-2 rounded-xl bg-brand-soft px-3 py-2 text-[10px] font-bold leading-5 text-brand-dark">
                  با افزودن نوشیدنی، یک واحد از همان نوشیدنی در اولین سفارش شما
                  ۵۰٪ تخفیف می‌گیرد.
                </p>
              )}
              <div className="mt-2 flex items-center justify-between text-[12px] font-bold">
                <span className="text-muted">هزینه ارسال</span>
                <span
                  className={
                    c.deliveryFee === 0 ? "font-black text-mint" : "text-ink"
                  }
                >
                  {c.deliveryFee === 0
                    ? "رایگان"
                    : `${fa(c.deliveryFee)} تومان`}
                </span>
              </div>
              <p className="mt-2 text-[10px] font-medium text-muted">
                {c.deliveryFee === 0
                  ? "هزینه ارسال این سفارش رایگان است."
                  : "هزینه ارسال فروشگاه را مشتری پرداخت می‌کند."}
              </p>
              <p className="mt-2 rounded-xl bg-[#f5f7f6] px-3 py-2 text-[10px] font-medium leading-6 text-muted">
                کرایه بر اساس مسافت تخمینی، وزن و شرایط جوی: عادی ۵۰ تا ۸۰ هزار
                تومان، باران و برف تا ۱۰۰ هزار تومان. مبلغ نهایی در سرور محاسبه
                می‌شود.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- Checkout (mobile + desktop two-column) ---------------- */
export function CheckoutView({ c }: { c: AppCtx }) {
  const [slot, setSlot] = useState("now");
  const [payment, setPayment] = useState<"online" | "cash">("cash");
  const [codeInput, setCodeInput] = useState("");
  const [placing, setPlacing] = useState(false);

  const rows = [
    {
      label: `جمع کالاها (${pd(c.cartCount)} کالا)`,
      value: `${fa(c.subtotal)} تومان`,
    },
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
      label: c.deliveryFee === 0 ? "هزینه ارسال" : "ارسال (پرداخت با مشتری)",
      value: c.deliveryFee === 0 ? "رایگان" : `${fa(c.deliveryFee)} تومان`,
      green: c.deliveryFee === 0,
    },
  ];

  const submit = async () => {
    if (!c.selectedAddress) return c.toast("ابتدا آدرس تحویل را انتخاب کنید");
    if (!c.cart.storeId) {
      c.openStorePicker();
      return c.toast("ابتدا فروشگاه را انتخاب کنید");
    }
    setPlacing(true);
    await c.placeOrder({ slot: slot === "now" ? "ارسال فوری" : slot, payment });
    setPlacing(false);
  };

  return (
    <div className="fade-rise w-full min-w-0 max-w-full overflow-x-clip pb-6">
      <ScreenHeader title="تکمیل خرید" onBack={() => c.closeSub()} />

      <div className="grid w-full min-w-0 grid-cols-1 gap-4 px-3 pt-4 sm:px-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,370px)] lg:gap-5 lg:px-6">
        {/* right column: steps */}
        <div className="min-w-0 space-y-3">
          <div className="rounded-3xl border border-line bg-white p-4">
            <p className="flex items-center gap-2 text-[13px] font-black text-ink">
              <MapPin className="h-4.5 w-4.5 text-brand" /> آدرس تحویل
            </p>
            <button
              type="button"
              onClick={() => c.openAddress("checkout")}
              className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-line p-3.5 text-right transition hover:border-brand/50 active:scale-[0.99]"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-black text-ink">
                  تحویل در: {c.selectedAddress?.title ?? "انتخاب آدرس"}
                </span>
                <span className="mt-0.5 block truncate text-[11px] font-medium text-muted">
                  {c.selectedAddress
                    ? `${c.selectedAddress.address}، ${c.selectedAddress.detail} · ${c.selectedAddress.phone}`
                    : "برای تعیین لوکیشن دقیق روی نقشه کلیک کنید"}
                </span>
              </span>
              <span className="shrink-0 text-[11px] font-black text-brand">
                تغییر
              </span>
            </button>
          </div>

          <div className="rounded-3xl border border-line bg-white p-4">
            <p className="flex items-center gap-2 text-[13px] font-black text-ink">
              <Store className="h-4.5 w-4.5 text-brand" /> فروشگاه
            </p>
            {c.cartStore ? (
              <div className="mt-3 flex items-center gap-3 rounded-2xl border border-line p-3.5">
                <StoreAvatar
                  store={c.cartStore}
                  className="h-11 w-11 rounded-2xl text-[12px]"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-black text-ink">
                    {c.cartStore.name}
                  </p>
                  <p className="mt-0.5 text-[10px] font-medium leading-5 text-muted">
                    تا {pd(c.cartStore.minutes)} دقیقه ·{" "}
                    {c.deliveryFee === 0
                      ? "ارسال این سفارش رایگان است"
                      : `هزینه ارسال ${fa(c.deliveryFee)} تومان، پرداخت با مشتری`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={c.openStorePicker}
                  className="shrink-0 text-[11px] font-black text-brand"
                >
                  تغییر
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={c.openStorePicker}
                className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-right"
              >
                <Store className="h-5 w-5 shrink-0 text-amber-600" />
                <span className="flex-1 text-[12px] font-extrabold text-amber-800">
                  برای تکمیل خرید، ابتدا فروشگاه را انتخاب کنید
                </span>
                <ChevronLeft className="h-4 w-4 text-amber-600" />
              </button>
            )}
          </div>

          <div className="rounded-3xl border border-line bg-white p-4">
            <p className="flex items-center gap-2 text-[13px] font-black text-ink">
              <Timer className="h-4.5 w-4.5 text-brand" /> زمان تحویل
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSlot("now")}
                aria-pressed={slot === "now"}
                className={`rounded-2xl border p-3 text-right transition ${slot === "now" ? "border-brand bg-brand-soft" : "border-line"}`}
              >
                <p className="flex items-center gap-1 text-[12px] font-black text-ink">
                  <Zap className="h-3.5 w-3.5 text-brand" /> ارسال فوری
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
                  انتخاب بازه تحویل
                </p>
              </button>
            </div>
            {slot !== "now" && (
              <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {["۱۲ تا ۱۴", "۱۴ تا ۱۶", "۱۶ تا ۱۸", "۱۸ تا ۲۰"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSlot(s)}
                    className={`min-w-0 rounded-xl px-1 py-2 text-[11px] font-extrabold transition ${slot === s ? "bg-ink text-white" : "bg-[#f4f3f0] text-ink"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-line bg-white p-4">
            <p className="flex items-center gap-2 text-[13px] font-black text-ink">
              <Wallet className="h-4.5 w-4.5 text-brand" /> روش پرداخت
            </p>
            <div className="mt-3 space-y-2">
              {(
                [
                  {
                    key: "cash",
                    label: "پرداخت در محل",
                    desc: "پرداخت به فروشنده هنگام تحویل؛ درگاه آنلاین هنوز فعال نیست.",
                    icon: Banknote,
                  },
                ] as const
              ).map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setPayment(m.key)}
                  aria-pressed={payment === m.key}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-right transition ${payment === m.key ? "border-brand bg-brand-soft" : "border-line"}`}
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
                      <Check className="h-3 w-3 text-white" strokeWidth={3.5} />
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

          <div className="rounded-3xl border border-line bg-white p-4">
            <p className="flex items-center gap-2 text-[13px] font-black text-ink">
              <TicketPercent className="h-4.5 w-4.5 text-brand" /> کد تخفیف
            </p>
            {c.appliedCode ? (
              <div className="mt-3 flex items-start justify-between gap-3 rounded-2xl bg-emerald-50 px-3.5 py-3">
                <div className="min-w-0">
                  <p className="text-[12px] font-black text-emerald-700">
                    {c.appliedCode} اعمال شد · {fa(c.codeDiscount)} تومان تخفیف
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
              <div className="mt-3 flex items-center gap-2">
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
                  className="shrink-0 rounded-2xl bg-ink px-4 text-[12px] font-black text-white transition active:scale-95"
                >
                  اعمال
                </button>
              </div>
            )}
          </div>
        </div>

        {/* left column: summary */}
        <div className="min-w-0">
          <div className="rounded-3xl border border-line bg-white p-4 sm:p-5 lg:sticky lg:top-6">
            <p className="text-[14px] font-black text-ink">خلاصه سفارش</p>
            <div className="mt-3">
              {rows.map((row) => (
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
            <button
              type="button"
              onClick={submit}
              disabled={placing}
              className="mt-5 w-full rounded-2xl bg-brand py-4 text-[14px] font-black text-white shadow-lg shadow-brand/40 transition enabled:active:scale-[0.99] disabled:opacity-60"
            >
              {placing ? "در حال ثبت سفارش..." : "ثبت سفارش"}
            </button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] font-semibold text-muted">
              <Gift className="h-3.5 w-3.5 text-brand" /> سفارش شما فقط در
              محدوده شهرستان نظرآباد تحویل می‌شود
            </p>
          </div>
        </div>
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
        سفارش{" "}
        <strong className="text-ink">{pd(order.id.replace("NM-", ""))}</strong>{" "}
        در پایگاه‌داده ثبت شد و منتظر تأیید فروشگاه است. پرداخت در محل انجام
        می‌شود؛ زمان و ارسال پس از تأیید فروشگاه هماهنگ خواهد شد.
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

/* ---------------- Desktop cart drawer ---------------- */
export function CartDrawer({ c }: { c: AppCtx }) {
  return (
    <div
      className="fixed inset-0 z-[75] lg:flex"
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
      <div className="drawer-in absolute inset-y-0 left-0 flex w-full max-w-[420px] flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-[16px] font-black text-ink">سبد خرید</h3>
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

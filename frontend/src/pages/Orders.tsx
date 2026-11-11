import { api } from "../api/client";
import { useState } from "react";
import {
  Check,
  ChevronLeft,
  ReceiptText,
  ShoppingBasket,
  Store,
  X,
} from "lucide-react";
import { Empty, pd, ScreenHeader } from "../components/ui";
import type { AppCtx } from "../ctx";
import type { Order } from "../data";
import { faNum } from "../data";

/**
 * What the customer is shown, in three steps. «ثبت سفارش» is a formality (the
 * card would open with a step already ticked) and «آماده تحویل» is the store's
 * own warehouse state, so both are folded away; the last step reads as the
 * handing-over, not as paperwork.
 */
const statusSteps = ["در حال آماده‌سازی", "تحویل به سفیر", "تقدیم به شما شده"];
const progressFor = (status: number) =>
  status >= 5 ? 2 : status >= 3 ? 1 : status >= 1 ? 0 : -1;
/** The short name on the pill, in the same three words as the steps. */
const statusLabel = (o: Order) =>
  o.status === 5
    ? "تقدیم به شما شده"
    : o.status === 0
      ? o.rejectedBy === "seller"
        ? "فروشگاه انجامش نداد"
        : "لغو شده"
      : o.status >= 3
        ? o.deliveryMode === "seller"
          ? "ارسال توسط فروشگاه"
          : "تحویل به سفیر"
        : "در حال آماده‌سازی";

function OrderCard({ c, o }: { c: AppCtx; o: Order }) {
  const [deliveryCode, setDeliveryCode] = useState(""),
    [codeError, setCodeError] = useState(""),
    [loadingCode, setLoadingCode] = useState(false);
  return (
    <div className="rounded-[26px] border border-line bg-white p-4 shadow-[0_10px_26px_-20px_rgba(30,20,10,0.5)] transition-shadow hover:shadow-[0_16px_36px_-20px_rgba(30,20,10,0.55)] sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-black text-ink sm:text-[14px]">
            {o.storeName}
          </p>
          <p className="mt-1 text-[10px] font-medium leading-5 text-muted sm:text-[10.5px]">
            سفارش در ساعت {o.time} ثبت شد · تحویل به {o.addressTitle}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${o.status === 5 ? "bg-emerald-50 text-mint" : o.status === 0 ? "bg-red-50 text-red-700" : "bg-brand-soft text-brand"}`}
        >
          {statusLabel(o)}
        </span>
      </div>

      {o.status === 0 && o.rejectedBy === "seller" && (
        <div className="mt-3 rounded-2xl border border-red-100 bg-red-50/70 p-3.5">
          <p className="flex items-center gap-2 text-[11.5px] font-black text-red-700">
            <X className="h-4 w-4 shrink-0" />
            {o.storeName} نتوانست این سفارش را انجام دهد
          </p>
          <p className="mt-1.5 text-[10.5px] font-medium leading-5 text-red-700/85">
            {o.rejectReason || "فروشگاه آن را رد کرد."}{" "}
            مبلغی از شما گرفته نشده و کد تخفیفی که مصرف کرده بودید به حسابتان
            برگشته است.
          </p>
          <button
            type="button"
            onClick={() => c.openSub({ name: "stores" })}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2 text-[11px] font-black text-white transition active:scale-95"
          >
            <Store className="h-3.5 w-3.5" />
            فروشگاه دیگری انتخاب کنید
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {o.status > 0 &&
        (() => {
          const progress = progressFor(o.status);
          const steps = statusSteps.map((step, i) =>
            i === 1 && o.deliveryMode === "seller" ? "ارسال فروشگاه" : step,
          );
          return (
            <div className="mt-4 flex items-center" dir="rtl">
              {steps.map((step, i) => (
                <div
                  key={step}
                  className="flex flex-1 items-center last:flex-none"
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <span
                      className={`relative flex h-6 w-6 items-center justify-center rounded-full text-white ${i <= progress ? "bg-mint" : "bg-[#ddd9d3]"}`}
                    >
                      {i < progress ? (
                        <Check
                          className="relative h-3 w-3"
                          strokeWidth={3.5}
                        />
                      ) : (
                        <span className="relative h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </span>
                    <span
                      className={`text-center text-[8.5px] font-bold sm:text-[9.5px] ${i <= progress ? "text-ink" : "text-muted"}`}
                    >
                      {step}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <span
                      className={`mx-1 mb-4 h-0.5 flex-1 rounded-full ${i < progress ? "bg-mint" : "bg-[#eeece9]"}`}
                    />
                  )}
                </div>
              ))}
            </div>
          );
        })()}

      {o.status === 4 && o.deliveryMode !== "seller" && (
        <section className="my-4 rounded-2xl border border-mint/20 bg-mint/5 p-4">
          <p className="text-xs font-bold">کد تحویل</p>
          <p className="my-2 text-[10px] text-muted">
            وقتی بسته را گرفتید، این کد را به سفیر بگویید.
          </p>
          {deliveryCode && (
            <p
              dir="ltr"
              className="text-center text-2xl font-black tracking-[0.4em]"
            >
              {deliveryCode}
            </p>
          )}
          <button
            className="mt-3 rounded-xl bg-mint px-4 py-2 text-xs font-bold text-white"
            disabled={loadingCode}
            onClick={async () => {
              setLoadingCode(true);
              try {
                setDeliveryCode((await api.orders.deliveryCode(o.id)).code);
                setCodeError("");
              } catch (e) {
                setCodeError((e as Error).message);
              } finally {
                setLoadingCode(false);
              }
            }}
          >
            {loadingCode
              ? "در حال دریافت…"
              : deliveryCode
                ? "کد تازه"
                : "نمایش کد تحویل"}
          </button>
          {codeError && (
            <p role="alert" className="mt-2 text-xs text-red-600">
              {codeError}
            </p>
          )}
        </section>
      )}
      {o.status === 4 && o.deliveryMode === "seller" && (
        <p className="my-4 rounded-2xl bg-mint/5 p-4 text-xs text-mint">
          بسته را خودِ فروشگاه می‌آورد؛ کد تحویل لازم نیست.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {o.items.slice(0, 4).map((i) => (
          <span
            key={i.id}
            className="max-w-40 truncate rounded-lg bg-[#f4f3f0] px-2 py-1 text-[9.5px] font-bold text-[#55524e]"
          >
            {i.name} × {pd(i.qty)}
          </span>
        ))}
        {o.items.length > 4 && (
          <span className="rounded-lg bg-[#f4f3f0] px-2 py-1 text-[9.5px] font-bold text-muted">
            +{pd(o.items.length - 4)} کالای دیگر
          </span>
        )}
      </div>

      <div className="mt-3.5 flex items-end justify-between gap-3 border-t border-dashed border-line pt-3">
        <p className="text-[10px] font-bold text-muted">قابل پرداخت</p>
        <div className="flex min-w-0 flex-col items-end">
          <p className="text-[14.5px] font-black text-ink sm:text-[15.5px]">
            {faNum(o.total)} تومان
          </p>
          {Number(o.discount ?? 0) > 0 && (
            <p className="mt-0.5 text-[9.5px] font-bold text-mint">
              {faNum(Number(o.discount))} تومان تخفیف
              {!!o.promoCode && ` با کد ${o.promoCode}`}
              {Number(o.platformDiscount ?? 0) > 0
                ? ` · ${faNum(Number(o.platformDiscount))} تومان سهم نازمارکت`
                : ""}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OrdersView({
  c,
  historyOnly = false,
}: {
  c: AppCtx;
  historyOnly?: boolean;
}) {
  const orders = c.orders.filter((o) =>
    historyOnly
      ? o.status === 0 || o.status === 5
      : o.status >= 1 && o.status <= 4,
  );
  return (
    <div className="fade-rise mx-auto w-full max-w-5xl px-4 pb-6 pt-5 md:pb-6">
      {historyOnly && (
        <ScreenHeader
          title="تاریخچه سفارش‌ها"
          onBack={() => c.closeSub()}
          hideOnDesktop
        />
      )}
      {orders.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {orders.map((o) => (
            <OrderCard key={o.id} c={c} o={o} />
          ))}
        </div>
      ) : (
        <Empty
          icon={historyOnly ? ReceiptText : ShoppingBasket}
          title={
            historyOnly ? "هنوز سفارشی در تاریخچه ندارید" : "سفارش فعالی ندارید"
          }
          desc="محصولات واقعی فروشگاه‌ها را در صفحه اصلی ببینید."
          actionLabel="دیدن محصولات"
          onAction={() => c.go("home")}
        />
      )}
    </div>
  );
}

import { api } from "../api/client";
import { useState } from "react";
import { Check, ReceiptText, ShoppingBasket } from "lucide-react";
import { BackButton, Empty, pd } from "../components/ui";
import type { AppCtx } from "../ctx";
import type { Order } from "../data";
import { faNum } from "../data";

const statusSteps = [
  "ثبت سفارش",
  "در حال آماده‌سازی",
  "آماده تحویل",
  "تحویل به سفیر",
  "تکمیل سفارش",
];
const statusLabel = (status: number) =>
  status === 0
    ? "لغوشده"
    : ([
        "",
        "ثبت سفارش",
        "در حال آماده‌سازی",
        "آماده تحویل",
        "تحویل به سفیر",
        "تکمیل‌شده",
      ][status] ?? "نامشخص");
const progressFor = (status: number) =>
  status >= 1 && status <= 5 ? status - 1 : -1;

function OrderCard({ c, o }: { c: AppCtx; o: Order }) {
  const [events, setEvents] = useState<
    { status: number; actor_role: string; created_at: string }[] | null
  >(null);
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
            سفارش ناز-{pd(o.id.replace("NM-", ""))} · ساعت {o.time} · تحویل در{" "}
            {o.addressTitle} ({o.slot})
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${o.status === 5 ? "bg-emerald-50 text-mint" : o.status === 0 ? "bg-red-50 text-red-700" : "bg-brand-soft text-brand"}`}
        >
          {o.deliveryMode === "seller" && o.status === 4
            ? "ارسال توسط فروشگاه"
            : statusLabel(o.status)}
        </span>
      </div>

      {o.status > 0 && (
        <div className="mt-4 flex items-center" dir="rtl">
          {statusSteps.map((step, i) => {
            const progress = progressFor(o.status);
            return (
              <div
                key={
                  o.deliveryMode === "seller" && i === 3
                    ? "ارسال فروشگاه"
                    : step
                }
                className="flex flex-1 items-center last:flex-none"
              >
                <div className="flex flex-col items-center gap-1.5">
                  <span
                    className={`relative flex h-6 w-6 items-center justify-center rounded-full text-white ${i <= progress ? "bg-mint" : "bg-[#ddd9d3]"}`}
                  >
                    {i < progress ? (
                      <Check className="relative h-3 w-3" strokeWidth={3.5} />
                    ) : (
                      <span className="relative h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </span>
                  <span
                    className={`text-center text-[8px] font-bold sm:text-[9px] ${i <= progress ? "text-ink" : "text-muted"}`}
                  >
                    {o.deliveryMode === "seller" && i === 3
                      ? "ارسال فروشگاه"
                      : step}
                  </span>
                </div>
                {i < statusSteps.length - 1 && (
                  <span
                    className={`mx-1 mb-4 h-0.5 flex-1 rounded-full ${i < progress ? "bg-mint" : "bg-[#eeece9]"}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {o.status === 4 && o.deliveryMode !== "seller" && (
        <section className="my-4 rounded-2xl border border-mint/20 bg-mint/5 p-4">
          <p className="text-xs font-bold">کد تأیید تحویل به سفیر</p>
          <p className="my-2 text-[10px] text-muted">
            این کد را فقط پس از دریافت بسته در اختیار سفیر قرار دهید.
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
                ? "تازه‌سازی کد تحویل"
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
          سفارش توسط فروشگاه ارسال می‌شود؛ نیازی به کد تحویل سفیر نیست.
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

      <button
        type="button"
        className="mt-4 text-[11px] font-black text-brand"
        onClick={async () => {
          if (events) {
            setEvents(null);
            return;
          }
          try {
            setEvents((await api.orders.events(o.id)).events);
          } catch (err) {
            c.toast((err as Error).message);
          }
        }}
      >
        {events ? "بستن تاریخچه" : "مشاهده تاریخچه سفارش"}
      </button>
      {events && (
        <ol className="mt-3 rounded-2xl bg-[#f7f9f7] p-3">
          {events.map((event, i) => (
            <li
              key={i}
              className="flex flex-wrap justify-between gap-2 border-b border-line py-2 text-[10px] last:border-0"
            >
              <strong>{statusLabel(event.status)}</strong>
              <span className="text-muted">
                {new Date(event.created_at).toLocaleString("fa-IR")}
              </span>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-3.5 flex items-center justify-between border-t border-dashed border-line pt-3">
        <p className="text-[12px] font-black text-ink sm:text-[13px]">
          {faNum(o.total)} تومان
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => c.setSheet("support")}
            className="rounded-xl bg-[#f4f3f0] px-3 py-2 text-[11px] font-black text-ink transition hover:bg-line"
          >
            پشتیبانی
          </button>
          <button
            type="button"
            onClick={() => c.reorder(o)}
            className="rounded-xl bg-brand px-3 py-2 text-[11px] font-black text-white transition active:scale-95"
          >
            خرید مجدد
          </button>
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
        <div className="screen-heading order-history-heading">
          <BackButton onBack={() => c.closeSub()} />
          <h1>تاریخچه سفارش‌ها</h1>
        </div>
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

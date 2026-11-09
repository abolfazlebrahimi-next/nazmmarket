import { api } from "../api/client";
import { useState } from "react";
import { Check, ReceiptText, ShoppingBasket } from "lucide-react";
import { Empty, pd } from "../components/ui";
import type { AppCtx } from "../ctx";
import type { Order } from "../data";
import { faNum } from "../data";

const statusSteps = [
  "ثبت سفارش",
  "در حال آماده‌سازی",
  "آماده تحویل",
  "تحویل به پیک",
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
        "تحویل به پیک",
        "تکمیل‌شده",
      ][status] ?? "نامشخص");
const progressFor = (status: number) =>
  status >= 1 && status <= 5 ? status - 1 : -1;

function OrderCard({ c, o }: { c: AppCtx; o: Order }) {
  const [events, setEvents] = useState<
    { status: number; actor_role: string; created_at: string }[] | null
  >(null);
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
          {statusLabel(o.status)}
        </span>
      </div>

      {o.status > 0 && (
        <div className="mt-4 flex items-center" dir="rtl">
          {statusSteps.map((step, i) => {
            const progress = progressFor(o.status);
            return (
              <div
                key={step}
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
                    {step}
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

export default function OrdersView({ c }: { c: AppCtx }) {
  const [tabO, setTabO] = useState<"active" | "history">("active");
  const active = c.orders.filter((o) => o.status >= 1 && o.status <= 4);
  const history = c.orders.filter((o) => o.status === 0 || o.status === 5);

  return (
    <div className="fade-rise mx-auto min-h-dvh w-full max-w-5xl pb-24 md:pb-16">
      <div className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur md:top-16">
        <div className="flex items-end justify-between px-5 pt-4">
          <div className="flex gap-6">
            {(
              [
                { key: "active", label: "در حال انجام", count: active.length },
                { key: "history", label: "تاریخچه", count: history.length },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTabO(t.key)}
                aria-pressed={tabO === t.key}
                className={`relative pb-3 pt-1 text-[14px] font-black transition lg:text-[15px] ${tabO === t.key ? "text-ink" : "text-muted hover:text-ink"}`}
              >
                {t.label} ({pd(t.count)})
                {tabO === t.key && (
                  <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-ink" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tabO === "active" ? (
        active.length === 0 ? (
          <Empty
            icon={ShoppingBasket}
            title="سفارش در حال انجام ندارید!"
            desc="کالاهای مورد نیاز خود را به سبد خرید اضافه کنید."
            actionLabel="شروع خرید"
            onAction={() => c.go("home")}
          />
        ) : (
          <div className="mx-auto grid max-w-3xl gap-3 p-4 sm:p-5">
            {active.map((o) => (
              <OrderCard key={o.id} c={c} o={o} />
            ))}
          </div>
        )
      ) : history.length === 0 ? (
        <Empty
          icon={ReceiptText}
          title="سفارشی در تاریخچه نیست"
          desc="سفارش‌های تکمیل‌شده شما اینجا نمایش داده می‌شود."
        />
      ) : (
        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
          {history.map((o) => (
            <OrderCard key={o.id} c={c} o={o} />
          ))}
        </div>
      )}

      {c.orders.length === 0 && (
        <div className="pb-6 text-center">
          <button
            type="button"
            onClick={() => c.go("home")}
            className="rounded-2xl bg-brand px-5 py-3 text-[12px] font-black text-white shadow-lg shadow-brand/30 transition active:scale-95"
          >
            مشاهده فروشگاه‌های نظرآباد
          </button>
        </div>
      )}
    </div>
  );
}

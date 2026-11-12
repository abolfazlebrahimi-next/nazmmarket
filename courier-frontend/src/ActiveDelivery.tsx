import NavigationChoice from "./NavigationChoice";
import { useEffect, useState } from "react";
import {
  Check,
  MapPin,
  Phone,
  ShieldCheck,
  Headphones,
  PackageCheck,
} from "lucide-react";
import { money } from "./api";
type Row = Record<string, any>;
export function OfferCountdown({
  expiresAt,
  onExpire,
}: {
  expiresAt?: string;
  onExpire: () => void;
}) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const s = Math.max(
        0,
        Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000),
      );
      setSeconds(s);
      if (!s) onExpire();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return expiresAt ? (
    <span
      className="offer-timer"
      role="timer"
      aria-label="زمان باقی‌ماندهٔ پذیرش"
    >
      {money(Math.floor(seconds / 60))}:{String(seconds % 60).padStart(2, "0")}{" "}
      باقی‌مانده
    </span>
  ) : null;
}
export function FinanceBreakdown({ order }: { order: Row }) {
  return (
    <div className="trip-finance">
      <div>
        <small>درآمد خالص شما از این سفارش</small>
        <b>{money(order.netEarnings ?? order.courierFee)} تومان</b>
      </div>
      <span>
        کرایه {money(order.grossFare ?? order.courierFee)} · کمیسیون{" "}
        {money(order.commission)}
      </span>
    </div>
  );
}
export default function ActiveDelivery({
  order: o,
  busy,
  act,
  support,
  origin,
}: {
  order: Row;
  busy: boolean;
  act: (o: Row, action: string, body?: Row) => Promise<void>;
  support: () => void;
  origin?: { lat: unknown; lng: unknown };
}) {
  const [code, setCode] = useState("");
  const stage =
    o.tripStatus === "accepted"
      ? 0
      : o.tripStatus === "arrived"
        ? 1
        : o.status === 5
          ? 3
          : 2;
  const titles = [
    "حرکت به فروشگاه",
    "دریافت بسته",
    "در مسیر مشتری",
    "تحویل نهایی",
  ];
  return (
    <article className="trip-card">
      <header className="trip-hero">
        <div>
          <small>سفارش {o.id}</small>
          <h2>سفر فعال شما</h2>
        </div>
        <span className="trip-stage-chip">
          مرحلهٔ {money(stage + 1)} از ۴ · {titles[stage]}
        </span>
      </header>

      <ol className="trip-progress" aria-label={`مرحلهٔ ${stage + 1} از ۴`}>
        {titles.map((t, i) => (
          <li
            key={t}
            className={`${i < stage ? "done" : i === stage ? "current" : ""}`}
          >
            <span className="trip-progress-dot">
              {i < stage ? <Check size={13} /> : money(i + 1)}
            </span>
            <small>{t}</small>
          </li>
        ))}
      </ol>

      <div className="trip-route">
        <div className="trip-route-item pickup">
          <i aria-hidden="true" />
          <section>
            <small>دریافت از فروشگاه</small>
            <b>{o.storeName}</b>
            <p>{o.storeAddress}</p>
          </section>
        </div>
        <div className="trip-route-line" aria-hidden="true" />
        <div className="trip-route-item drop">
          <i aria-hidden="true" />
          <section>
            <small>تحویل به مشتری</small>
            <b>{o.addressTitle}</b>
            <p>{o.addressText}</p>
          </section>
        </div>
      </div>

      <div className="trip-actions">
        {stage < 2 && o.storePhone && (
          <a href={`tel:${o.storePhone}`}>
            <Phone size={15} /> تماس فروشگاه
          </a>
        )}
        {stage >= 2 && o.customerPhone && (
          <a href={`tel:${o.customerPhone}`}>
            <Phone size={15} /> تماس مشتری
          </a>
        )}
        {stage < 2 ? (
          <NavigationChoice
            destination={{ lat: o.storeLat, lng: o.storeLng }}
            origin={origin}
            label="فروشگاه"
          />
        ) : (
          <NavigationChoice
            destination={{ lat: o.destinationLat, lng: o.destinationLng }}
            origin={origin}
            label="مقصد"
          />
        )}
        <button type="button" className="trip-support" onClick={support}>
          <Headphones size={15} /> گزارش مشکل
        </button>
      </div>

      <FinanceBreakdown order={o} />

      {stage === 0 && (
        <button
          disabled={busy}
          className="trip-main-action"
          onClick={() => void act(o, "arrive")}
        >
          <MapPin size={18} />
          {busy ? "در حال ثبت…" : "به فروشگاه رسیدم"}
        </button>
      )}
      {stage === 1 && (
        <>
          <button
            disabled={busy}
            className="trip-main-action"
            onClick={() => void act(o, "pickup")}
          >
            <PackageCheck size={18} />
            {busy ? "در حال ثبت…" : "بسته را از فروشگاه تحویل گرفتم"}
          </button>
          <p className="trip-hint">
            دریافت را فقط پس از بررسی تعداد اقلام و سلامت بسته ثبت کنید.
          </p>
        </>
      )}
      {stage === 2 && (
        <form
          className="trip-code-form"
          onSubmit={(e) => {
            e.preventDefault();
            void act(o, "complete", { code });
          }}
        >
          <label>
            <span>کد تحویل مشتری</span>
            <input
              name="deliveryCode"
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              maxLength={6}
              minLength={6}
              pattern="[0-9]{6}"
              value={code}
              onChange={(e) =>
                setCode(
                  e.target.value
                    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
                    .replace(/\D/g, ""),
                )
              }
              placeholder="کد شش‌رقمی"
              required
            />
          </label>
          <button disabled={busy} className="trip-main-action">
            <ShieldCheck size={18} />
            {busy ? "در حال ثبت…" : "تأیید کد و تحویل نهایی"}
          </button>
          <p className="trip-hint">
            کد در صفحهٔ سفارشِ اپلیکیشن مشتری است؛ فقط پس از تحویل بسته وارد
            کنید. این کد از طریق پیامک ارسال نمی‌شود.
          </p>
        </form>
      )}
    </article>
  );
}

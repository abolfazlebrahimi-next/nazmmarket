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
    <div className="finance-breakdown">
      <span>
        کرایهٔ ناخالص<b>{money(order.grossFare ?? order.courierFee)} تومان</b>
      </span>
      <span>
        کمیسیون پلتفرم<b>{money(order.commission)} تومان</b>
      </span>
      <span>
        درآمد خالص شما
        <b>{money(order.netEarnings ?? order.courierFee)} تومان</b>
      </span>
    </div>
  );
}
export default function ActiveDelivery({
  order: o,
  busy,
  act,
  support,
}: {
  order: Row;
  busy: boolean;
  act: (o: Row, action: string, body?: Row) => Promise<void>;
  support: () => void;
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
    "رسیدن به فروشگاه",
    "در مسیر مشتری",
    "تحویل نهایی",
  ];
  const mapUrl = (lat: number, lng: number) =>
    `https://www.openstreetmap.org/directions?engine=fossgis_osrm_bike&route=;${lat},${lng}`;
  return (
    <article className="active-trip-card">
      <div className="order-top">
        <h2>
          <PackageCheck size={20} /> سفر فعال شما
        </h2>
        <span className="badge shipping">{titles[stage]}</span>
      </div>
      <small>{o.id}</small>
      <div className="trip-stages">
        {titles.map((t, i) => (
          <div
            key={t}
            className={`trip-stage ${i < stage ? "done" : i === stage ? "current" : ""}`}
          >
            <span>{i < stage ? <Check size={15} /> : money(i + 1)}</span>
            {t}
          </div>
        ))}
      </div>
      <div className="route">
        <div>
          <MapPin size={17} />
          <section>
            <small>دریافت از فروشگاه</small>
            <b>{o.storeName}</b>
            <p>{o.storeAddress}</p>
          </section>
        </div>
        <div>
          <MapPin size={17} />
          <section>
            <small>مقصد مشتری</small>
            <b>{o.addressTitle}</b>
            <p>{o.addressText}</p>
          </section>
        </div>
      </div>
      <div className="order-links">
        {stage < 2 && o.storePhone && (
          <a href={`tel:${o.storePhone}`}>
            <Phone size={15} />
            تماس فروشگاه
          </a>
        )}
        {stage >= 2 && o.customerPhone && (
          <a href={`tel:${o.customerPhone}`}>
            <Phone size={15} />
            تماس مشتری
          </a>
        )}
        {stage < 2 && o.storeLat != null && (
          <a
            href={mapUrl(o.storeLat, o.storeLng)}
            target="_blank"
            rel="noreferrer"
          >
            <MapPin size={15} />
            مسیریابی فروشگاه
          </a>
        )}
        {stage >= 2 && o.destinationLat != null && (
          <a
            href={mapUrl(o.destinationLat, o.destinationLng)}
            target="_blank"
            rel="noreferrer"
          >
            <MapPin size={15} />
            مسیریابی مقصد
          </a>
        )}
        <button className="text-btn" onClick={support}>
          <Headphones size={15} />
          گزارش مشکل سفر
        </button>
      </div>
      <FinanceBreakdown order={o} />
      {stage === 0 && (
        <button
          disabled={busy}
          className="primary trip-main-action"
          onClick={() => void act(o, "arrive")}
        >
          به فروشگاه رسیدم
        </button>
      )}
      {stage === 1 && (
        <>
          <button
            disabled={busy}
            className="primary trip-main-action"
            onClick={() => void act(o, "pickup")}
          >
            بسته را از فروشگاه تحویل گرفتم
          </button>
          <p className="spec-hint">
            دریافت را فقط پس از بررسی تعداد اقلام و سلامت بسته ثبت کنید.
          </p>
        </>
      )}
      {stage === 2 && (
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            void act(o, "complete", { code });
          }}
        >
          <label>
            کد تحویل مشتری
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              maxLength={6}
              minLength={6}
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
          <button
            disabled={busy || code.length !== 6}
            className="primary trip-main-action"
          >
            <ShieldCheck size={17} />
            تأیید کد و تحویل نهایی
          </button>
          <small>
            کد در صفحهٔ سفارشِ اپلیکیشن مشتری است؛ فقط پس از تحویل بسته وارد
            کنید. این کد از طریق پیامک ارسال نمی‌شود.
          </small>
        </form>
      )}
    </article>
  );
}

import { Check, Clock3, MapPin, Package, Store } from "lucide-react";
import { money } from "./api";
import { FinanceBreakdown } from "./ActiveDelivery";

type Row = Record<string, any>;

export default function AvailableOffer({
  order,
  busy,
  connected,
  act,
}: {
  order: Row;
  busy: boolean;
  connected: boolean;
  act: (order: Row, action: string) => Promise<void>;
}) {
  const count = (order.items || []).reduce(
    (total: number, item: Row) => total + Number(item.qty || 0),
    0,
  );

  return (
    <article className="order-card available-offer-card">
      <div className="order-top">
        <div className="available-offer-title">
          <span aria-hidden="true">
            <Package size={19} />
          </span>
          <div>
            <h2>سفارش آمادهٔ پذیرش</h2>
            <small className="order-id">{order.id}</small>
          </div>
        </div>
        <span className={`badge ${order.declinedByMe ? "declined" : "pending"}`}>
          {order.declinedByMe ? "قابل‌پذیرش دوباره" : "در انتظار سفیر"}
        </span>
      </div>

      <div className="offer-main-fare">
        <span>درآمد خالص این سفر</span>
        <strong>
          {money(order.netEarnings ?? order.courierFee)} <small>تومان</small>
        </strong>
      </div>
      <FinanceBreakdown order={order} />

      <div className="offer-route">
        <section>
          <span className="offer-route-icon pickup">
            <Store size={18} />
          </span>
          <div>
            <small>دریافت از سوپرمارکت</small>
            <h3>{order.storeName}</h3>
            <p>{order.storeAddress || "نشانی فروشگاه ثبت نشده"}</p>
          </div>
        </section>
        <section>
          <span className="offer-route-icon destination">
            <MapPin size={18} />
          </span>
          <div>
            <small>محدودهٔ تحویل به مشتری</small>
            <h3>{order.addressTitle || "مقصد مشتری"}</h3>
            <p>نشانی کامل پس از پذیرش نمایش داده می‌شود.</p>
          </div>
        </section>
      </div>

      <div className="offer-details">
        <span>
          <MapPin size={15} />
          {order.pickupKm == null
            ? "فاصله تا فروشگاه نامشخص"
            : `${money(order.pickupKm)} کیلومتر تا فروشگاه`}
        </span>
        <span>
          <Package size={15} />
          {money(count)} قلم کالا
        </span>
        {order.fareDetails?.minutes != null && (
          <span>
            <Clock3 size={15} />
            {money(order.fareDetails.minutes)} دقیقه تخمینی
          </span>
        )}
        {order.fareDetails?.distanceKm != null && (
          <span>
            <MapPin size={15} />
            {money(order.fareDetails.distanceKm)} کیلومتر مسیر تخمینی
          </span>
        )}
      </div>

      {order.declinedByMe && (
        <p className="available-offer-note" role="status">
          این پیشنهاد را رد کرده بودید؛ چون هنوز سفیر دیگری آن را نپذیرفته،
          می‌توانید همین‌جا دوباره قبولش کنید.
        </p>
      )}

      <button
        className="primary available-offer-accept"
        disabled={busy || !connected}
        onClick={() => void act(order, "claim")}
      >
        <Check size={18} />
        {busy ? "در حال ثبت…" : "قبول سفارش"}
      </button>
    </article>
  );
}

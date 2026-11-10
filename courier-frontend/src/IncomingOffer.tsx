import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  BellRing,
  Check,
  MapPin,
  Package,
  Store,
  Clock3,
  X,
  WifiOff,
} from "lucide-react";
import { money } from "./api";
import { FinanceBreakdown, OfferCountdown } from "./ActiveDelivery";
type Row = Record<string, any>;
export default function IncomingOffer({
  order,
  busy,
  connected,
  error,
  act,
  onExpire,
}: {
  order: Row;
  busy: boolean;
  connected: boolean;
  error: string;
  act: (order: Row, action: string) => Promise<void>;
  onExpire: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const shell = document.querySelector<HTMLElement>(".courier-shell");
    const oldInert = shell?.inert ?? false,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (shell) shell.inert = true;
    panel.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = overflow;
      if (shell) shell.inert = oldInert;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  const count = (order.items || []).reduce(
    (n: number, item: Row) => n + Number(item.qty || 0),
    0,
  );
  return createPortal(
    <div className="offer-overlay">
      <section
        ref={panel}
        className="offer-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="incoming-offer-title"
        aria-describedby="incoming-offer-description"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key !== "Tab") return;
          const focusable = Array.from(
            panel.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled),a[href],input:not(:disabled),[tabindex="0"]',
            ) || [],
          );
          if (!focusable.length) {
            e.preventDefault();
            return;
          }
          const first = focusable[0],
            last = focusable[focusable.length - 1];
          if (
            e.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === panel.current)
          ) {
            e.preventDefault();
            last.focus();
          } else if (
            !e.shiftKey &&
            (document.activeElement === last ||
              document.activeElement === panel.current)
          ) {
            e.preventDefault();
            first.focus();
          }
        }}
      >
        <div className="offer-handle" aria-hidden="true" />
        <header className="offer-sheet-header">
          <div className="offer-title">
            <span>
              <BellRing size={22} />
            </span>
            <div>
              <h2 id="incoming-offer-title">پیشنهاد سفارش جدید</h2>
              <p id="incoming-offer-description">
                مسیر و کرایه را بررسی کنید و پیشنهاد را قبول یا رد کنید.
              </p>
            </div>
          </div>
          <OfferCountdown
            expiresAt={order.offerExpiresAt}
            onExpire={onExpire}
          />
        </header>
        <div className="offer-sheet-content">
          <div className="offer-main-fare">
            <span>درآمد خالص این سفر</span>
            <strong>
              {money(order.netEarnings ?? order.courierFee)}{" "}
              <small>تومان</small>
            </strong>
          </div>
          <FinanceBreakdown order={order} />
          <div className="offer-route">
            <section>
              <span className="offer-route-icon pickup">
                <Store size={20} />
              </span>
              <div>
                <small>دریافت از سوپرمارکت</small>
                <h3>{order.storeName}</h3>
                <p>{order.storeAddress || "نشانی فروشگاه ثبت نشده"}</p>
              </div>
            </section>
            <section>
              <span className="offer-route-icon destination">
                <MapPin size={20} />
              </span>
              <div>
                <small>محدودهٔ تحویل به مشتری</small>
                <h3>{order.addressTitle || "مقصد مشتری"}</h3>
                <p>
                  {order.addressText ||
                    "نشانی کامل پس از پذیرش نمایش داده می‌شود."}
                </p>
              </div>
            </section>
          </div>
          <div className="offer-details">
            <span>
              <MapPin size={16} />
              {order.pickupKm == null
                ? "فاصله تا فروشگاه نامشخص"
                : `${money(order.pickupKm)} کیلومتر تا فروشگاه`}
            </span>
            <span>
              <Package size={16} />
              {money(count)} قلم کالا
            </span>
            {order.fareDetails?.minutes != null && (
              <span>
                <Clock3 size={16} />
                {money(order.fareDetails.minutes)} دقیقه تخمینی
              </span>
            )}
            {order.fareDetails?.distanceKm != null && (
              <span>
                <MapPin size={16} />
                {money(order.fareDetails.distanceKm)} کیلومتر مسیر تخمینی
              </span>
            )}
          </div>
          <p className="offer-accept-hint">
            قبول پیشنهاد یعنی شروع حرکت به فروشگاه؛ دریافت بسته را پس از رسیدن،
            جداگانه تأیید می‌کنید.
          </p>
        </div>
        <footer className="offer-sheet-footer">
          {error && (
            <p className="offer-action-error" role="alert">
              {error}
            </p>
          )}
          {!connected && (
            <p className="offer-action-error" role="status">
              <WifiOff size={16} />
              اتصال قطع است؛ تا برقراری ارتباط پذیرش یا رد ثبت نمی‌شود.
            </p>
          )}
          <div className="offer-sheet-actions">
            <button
              className="primary"
              disabled={busy || !connected}
              onClick={() => void act(order, "claim")}
            >
              <Check size={20} />
              {busy ? "در حال ثبت…" : "قبول سفارش"}
            </button>
            <button
              className="decline"
              disabled={busy || !connected}
              onClick={() => void act(order, "decline")}
            >
              <X size={20} />
              رد سفارش
            </button>
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

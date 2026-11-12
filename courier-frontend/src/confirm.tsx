import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * دیالوگ تأیید داخلی (بدون window.confirm که در پیش‌نمایش iframe کار نمی‌کند):
 * هر حذف/اقدام حساس باید دوباره از کاربر بپرسد.
 * روی document.body portal می‌شود و بالاتر از همهٔ لایه‌ها (حتی پیشنهاد سفارش
 * با z-index 10000) نقاشی می‌شود تا هیچ‌وقت بی‌صدا پنهان نماند.
 */
type Ask = { text: string; okLabel: string; resolve: (ok: boolean) => void };
let push: ((a: Ask) => void) | null = null;

export function askConfirm(
  text: string,
  okLabel = "بله، مطمئنم",
): Promise<boolean> {
  return new Promise((resolve) => {
    if (push) push({ text, okLabel, resolve });
    else resolve(false);
  });
}

export function ConfirmHost() {
  const [ask, setAsk] = useState<Ask | null>(null);
  useEffect(() => {
    push = (a) =>
      setAsk((prev) => {
        prev?.resolve(false);
        return a;
      });
    return () => {
      push = null;
    };
  }, []);
  if (!ask) return null;
  const done = (ok: boolean) => {
    ask.resolve(ok);
    setAsk(null);
  };
  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10050,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "rgba(20,25,22,0.6)",
      }}
      role="alertdialog"
      aria-modal="true"
      aria-label="تأیید عملیات"
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          padding: 22,
          maxWidth: 340,
          width: "100%",
          textAlign: "center",
          boxShadow: "0 18px 50px rgba(0,0,0,0.3)",
        }}
      >
        <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 800 }}>
          آیا مطمئنید؟
        </h3>
        <p
          style={{
            margin: "0 0 16px",
            fontSize: 12.5,
            lineHeight: 2,
            color: "#5b6560",
          }}
        >
          {ask.text}
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            style={{
              flex: 1,
              padding: "12px 0",
              borderRadius: 12,
              border: 0,
              background: "#16865b",
              color: "#fff",
              fontWeight: 800,
              cursor: "pointer",
            }}
            onClick={() => done(true)}
          >
            {ask.okLabel}
          </button>
          <button
            style={{
              flex: 1,
              padding: "12px 0",
              borderRadius: 12,
              border: 0,
              background: "#eef0ee",
              color: "#22282a",
              fontWeight: 800,
              cursor: "pointer",
            }}
            onClick={() => done(false)}
          >
            انصراف
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

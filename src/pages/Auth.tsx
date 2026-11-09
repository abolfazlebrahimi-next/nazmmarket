import { useEffect, useRef, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { api } from "../api/client";
import { pd, pad2, toEn, Wordmark } from "../components/ui";
import type { User } from "../data";

type Step = "phone" | "otp" | "name";

export default function AuthPage({ onLogin }: { onLogin: (u: User) => void }) {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState<string[]>(["", "", "", "", "", ""]);
  const [names, setNames] = useState({ first: "", last: "" });
  const [busy, setBusy] = useState(false);
  const [timer, setTimer] = useState(99);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const phoneOk = phone.length === 11 && phone.startsWith("09");
  const codeFull = code.every((d) => d !== "");

  useEffect(() => {
    if (step !== "otp" || timer <= 0) return;
    const t = window.setInterval(() => setTimer((s) => s - 1), 1000);
    return () => window.clearInterval(t);
  }, [step, timer]);

  const sendOtp = async () => {
    setBusy(true);
    await api.auth.sendOtp(phone);
    setBusy(false);
    setCode(["", "", "", "", "", ""]);
    setTimer(99);
    setStep("otp");
    inputsRef.current[0]?.focus();
  };

  const verify = async () => {
    setBusy(true);
    const res = await api.auth.verifyOtp(phone, code.join(""));
    setBusy(false);
    if (!res.valid) return;
    setStep("name");
  };

  const finish = async () => {
    if (!names.first.trim()) return;
    setBusy(true);
    const u: User = { phone, firstName: names.first.trim(), lastName: names.last.trim() };
    await api.auth.completeProfile(u);
    setBusy(false);
    onLogin(u);
  };

  const setDigit = (i: number, v: string) => {
    const d = toEn(v).replace(/\D/g, "").slice(-1);
    setCode((c) => {
      const n = [...c];
      n[i] = d;
      return n;
    });
    if (d && i < 5) inputsRef.current[i + 1]?.focus();
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-white px-5 py-10">
      <div key={step} className="fade-rise w-full max-w-md rounded-[28px] border border-line bg-white p-7 shadow-[0_24px_70px_-30px_rgba(30,20,10,0.35)] sm:p-9">
        {step !== "phone" && (
          <button
            type="button"
            onClick={() => setStep("phone")}
            aria-label="بازگشت"
            className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#f4f3f0] text-ink transition active:scale-90"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
        )}

        {step === "phone" && (
          <>
            <div className="mb-6 text-center">
              <Wordmark twoLine size="text-[34px]" />
              <h1 className="mt-5 text-[18px] font-black text-ink">به ناز مارکت خوش آمدید!</h1>
            </div>
            <label htmlFor="auth-phone" className="block text-[13px] font-black text-ink">
              شماره موبایل خود را وارد کنید:
            </label>
            <input
              id="auth-phone"
              type="tel"
              inputMode="numeric"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(toEn(e.target.value).replace(/\D/g, "").slice(0, 11))}
              placeholder="۰۹*********"
              className="mt-3 h-13 w-full rounded-2xl border border-line px-4 text-right text-[15px] font-bold outline-none transition focus:border-brand"
              style={{ height: 52 }}
            />
            <button
              type="button"
              onClick={sendOtp}
              disabled={!phoneOk || busy}
              className="mt-6 w-full rounded-2xl bg-brand py-4 text-[14px] font-black text-white shadow-lg shadow-brand/30 transition enabled:hover:brightness-105 enabled:active:scale-[0.99] disabled:opacity-40"
            >
              {busy ? "در حال ارسال رمز..." : "ادامه"}
            </button>
            <button type="button" onClick={() => onLogin({ phone: "", firstName: "کاربر", lastName: "مهمان" })} className="mt-4 w-full text-center text-[12px] font-bold text-muted transition hover:text-brand">
              ادامه به عنوان مهمان
            </button>
          </>
        )}

        {step === "otp" && (
          <>
            <h1 className="text-right text-[18px] font-black text-ink">رمز یکبار مصرف خود را وارد کنید:</h1>
            <p className="mt-3 text-right text-[12px] font-semibold text-muted" dir="rtl">
              رمز یکبار مصرف به شماره <span className="font-black text-ink">{pd(phone)}</span> ارسال شد.
            </p>
            <div className="mt-6 flex justify-center gap-2.5" dir="ltr">
              {code.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    inputsRef.current[i] = el;
                  }}
                  value={d ? pd(d) : ""}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace" && !code[i] && i > 0) inputsRef.current[i - 1]?.focus();
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const digits = toEn(e.clipboardData.getData("text")).replace(/\D/g, "").slice(0, 6).split("");
                    const n = ["", "", "", "", "", ""];
                    digits.forEach((x, j) => (n[j] = x));
                    setCode(n);
                    inputsRef.current[Math.min(digits.length, 5)]?.focus();
                  }}
                  inputMode="numeric"
                  maxLength={1}
                  aria-label={`رقم ${pd(i + 1)}`}
                  className={`h-14 w-12 rounded-2xl border bg-white text-center text-[20px] font-black outline-none transition ${code[i] ? "border-brand" : "border-line"} focus:border-brand focus:ring-4 focus:ring-brand/15`}
                  style={{ height: 56, width: 50 }}
                />
              ))}
            </div>
            <p className="mt-5 text-right text-[11px] font-semibold text-muted">
              زمان باقی‌مانده تا ارسال مجدد رمز:{" "}
              <span dir="ltr" className="font-black text-mint">
                {pd(pad2(Math.floor(timer / 60)))}:{pd(pad2(timer % 60))}
              </span>{" "}
              {timer <= 0 && (
                <button type="button" onClick={() => setTimer(99)} className="mr-2 font-black text-brand underline underline-offset-4">
                  ارسال مجدد
                </button>
              )}
            </p>
            <p className="mt-2 rounded-xl bg-brand-soft px-3 py-2 text-[10.5px] font-bold leading-5 text-brand-dark">
              نسخه نمایشی: هر کد ۶ رقمی معتبر است (با اتصال بک‌اند، کد واقعی پیامکی دریافت می‌شود).
            </p>
            <button
              type="button"
              onClick={verify}
              disabled={!codeFull || busy}
              className="mt-5 w-full rounded-2xl bg-brand py-4 text-[14px] font-black text-white shadow-lg shadow-brand/30 transition enabled:hover:brightness-105 enabled:active:scale-[0.99] disabled:opacity-40"
            >
              {busy ? "در حال تایید..." : "تایید"}
            </button>
          </>
        )}

        {step === "name" && (
          <>
            <h1 className="text-right text-[18px] font-black text-ink">نام و نام خانوادگی خود را وارد کنید</h1>
            <div className="mt-5 space-y-3">
              <input
                autoFocus
                value={names.first}
                onChange={(e) => setNames((n) => ({ ...n, first: e.target.value }))}
                placeholder="نام خود را وارد کنید"
                aria-label="نام"
                className="w-full rounded-2xl border border-line px-4 py-3.5 text-[14px] font-bold outline-none transition focus:border-brand"
              />
              <input
                value={names.last}
                onChange={(e) => setNames((n) => ({ ...n, last: e.target.value }))}
                placeholder="نام خانوادگی خود را وارد کنید"
                aria-label="نام خانوادگی"
                className="w-full rounded-2xl border border-line px-4 py-3.5 text-[14px] font-bold outline-none transition focus:border-brand"
              />
            </div>
            <button
              type="button"
              onClick={finish}
              disabled={!names.first.trim() || busy}
              className="mt-6 w-full rounded-2xl bg-brand py-4 text-[14px] font-black text-white shadow-lg shadow-brand/30 transition enabled:hover:brightness-105 enabled:active:scale-[0.99] disabled:opacity-40"
            >
              {busy ? "در حال ورود..." : "تایید"}
            </button>
            <p className="mt-4 flex items-center justify-center gap-1.5 text-[10.5px] font-semibold text-muted">
              <ShieldCheck className="h-3.5 w-3.5 text-mint" /> اطلاعات شما نزد ناز مارکت محفوظ است
            </p>
          </>
        )}
      </div>
    </div>
  );
}

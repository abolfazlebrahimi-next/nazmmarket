import { useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  Lock,
  Phone,
  UserRound,
} from "lucide-react";
import { ApiError, api, tokenStore } from "../api/client";
import { Wordmark, toEn } from "../components/ui";
import type { User } from "../data";

type Mode = "login" | "register";
type Result = { token: string; user: User; addresses: unknown[] };

export default function AuthPage({ onAuth }: { onAuth: (r: Result) => void }) {
  const [mode, setMode] = useState<Mode>("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const phoneOk = /^09\d{9}$/.test(phone);
  const passOk = password.length >= 6;

  const switchMode = (next: Mode) => {
    setMode(next);
    setError("");
    setConfirm("");
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    if (!phoneOk) {
      setError("شماره موبایل باید ۱۱ رقم باشد و با ۰۹ شروع شود.");
      return;
    }
    if (!passOk) {
      setError("رمز عبور باید دست‌کم ۶ نویسه باشد.");
      return;
    }
    if (mode === "register" && password !== confirm) {
      setError("رمز عبور و تکرار آن یکسان نیستند.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const [firstName, ...rest] = name.trim().split(" ");
      const res =
        mode === "login"
          ? await api.auth.login(phone, password)
          : await api.auth.register({
              phone,
              password,
              firstName: firstName ?? "",
              lastName: rest.join(" "),
            });
      tokenStore.set(res.token);
      onAuth(res);
    } catch (err) {
      const fallback =
        mode === "login"
          ? "ورود انجام نشد؛ شماره موبایل و رمز عبور را بررسی کنید."
          : "ثبت‌نام انجام نشد؛ اطلاعات واردشده را بررسی کنید.";
      setError(
        err instanceof ApiError && err.message.trim() ? err.message : fallback,
      );
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[radial-gradient(120%_120%_at_100%_0%,#eaf4ee_0%,#fafcfb_45%,#edf1ee_100%)] px-4 py-8 sm:px-6">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-[30px] border border-line bg-white shadow-[0_30px_80px_-40px_rgba(40,25,10,0.45)] lg:grid-cols-[0.85fr_1fr]">
        {/* brand side (desktop) */}
        <aside className="relative hidden flex-col justify-between bg-gradient-to-br from-[#16865b] to-[#26352e] p-9 text-white lg:flex">
          <div className="absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/10" />
          <div className="absolute -bottom-16 -left-10 h-52 w-52 rounded-full bg-white/10" />
          <div className="relative">
            <h2 className="mt-6 text-[26px] font-black leading-9">
              ناز! مارکت
              <span className="mt-2 block text-[15px] font-bold leading-7 text-white/85">
                سوپرمارکت و هایپرمارکت‌های شهر، تا ۴۵ دقیقه دم در خانه‌ی شما.
              </span>
            </h2>
            <ul className="mt-7 space-y-3 text-[12.5px] font-semibold text-white/90">
              {["ثبت سفارش از فروشگاه‌های محلی", "مشاهده کالاهای ثبت‌شده توسط فروشنده", "پرداخت در محل؛ درگاه آنلاین فعال نیست"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* form side */}
        <section className="p-6 sm:p-9">
          <div className="flex items-center justify-between">
            <Wordmark size="text-[22px]" />

          </div>

          <div className="mt-6 grid grid-cols-2 gap-1 rounded-2xl bg-[#f4f3f0] p-1" role="tablist" aria-label="ورود یا ثبت‌نام">
            {([
              { key: "login", label: "ورود" },
              { key: "register", label: "ثبت‌نام" },
            ] as const).map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={mode === t.key}
                onClick={() => switchMode(t.key)}
                className={`rounded-xl py-2.5 text-[12.5px] font-black transition ${
                  mode === t.key ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <h1 className="mt-6 text-[19px] font-black text-ink">
            {mode === "login" ? "به حساب خود وارد شوید" : "یک حساب تازه بسازید"}
          </h1>

          <form onSubmit={submit} className="mt-5 space-y-3.5">
            <label className="naz-floating-field auth-floating-field">
              <span className="naz-floating-label">شماره موبایل</span>
              <span className="relative flex items-center">
                <Phone className="pointer-events-none absolute right-4 h-4 w-4 text-muted" />
                <input
                  type="tel"
                  name="phone"
                  inputMode="numeric"
                  autoComplete="username"
                  dir="ltr"
                  required
                  pattern="09[0-9]{9}"
                  value={phone}
                  onChange={(e) => {
                    setPhone(toEn(e.target.value).replace(/\D/g, "").slice(0, 11));
                    setError("");
                  }}
                  placeholder="09xxxxxxxxx"
                  className="h-12 w-full rounded-2xl border border-line bg-white pr-11 pl-4 text-left text-[14px] font-bold tracking-wide outline-none transition placeholder:tracking-normal placeholder:text-[#c3beb9] focus:border-brand"
                />
              </span>
            </label>

            {mode === "register" && (
              <label className="naz-floating-field auth-floating-field">
                <span className="naz-floating-label">نام و نام خانوادگی</span>
                <span className="relative flex items-center">
                  <UserRound className="pointer-events-none absolute right-4 h-4 w-4 text-muted" />
                  <input
                    name="fullName"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setError("");
                    }}
                    placeholder="مثلاً سارا محمدی"
                    autoComplete="name"
                    className="h-12 w-full rounded-2xl border border-line bg-white pr-11 pl-4 text-[13px] font-bold outline-none transition placeholder:text-[#c3beb9] focus:border-brand"
                  />
                </span>
              </label>
            )}

            <label className="naz-floating-field auth-floating-field">
              <span className="naz-floating-label">رمز عبور</span>
              <span className="relative flex items-center">
                <Lock className="pointer-events-none absolute right-4 h-4 w-4 text-muted" />
                <input
                  type={showPass ? "text" : "password"}
                  name="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="حداقل ۶ کاراکتر"
                  className="h-12 w-full rounded-2xl border border-line bg-white pr-11 pl-11 text-left text-[13.5px] font-bold outline-none transition placeholder:text-right placeholder:text-[#c3beb9] focus:border-brand"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  aria-label={showPass ? "پنهان کردن رمز" : "نمایش رمز"}
                  className="absolute left-3 flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-[#f4f3f0]"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>

            {mode === "register" && (
              <label className="naz-floating-field auth-floating-field">
                <span className="naz-floating-label">تکرار رمز عبور</span>
                <span className="relative flex items-center">
                  <Lock className="pointer-events-none absolute right-4 h-4 w-4 text-muted" />
                  <input
                    type={showPass ? "text" : "password"}
                    name="passwordConfirm"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={confirm}
                    onChange={(e) => {
                      setConfirm(e.target.value);
                      setError("");
                    }}
                    placeholder="رمز عبور را دوباره بنویسید"
                    className="h-12 w-full rounded-2xl border border-line bg-white pr-11 pl-4 text-left text-[13.5px] font-bold outline-none transition placeholder:text-right placeholder:text-[#c3beb9] focus:border-brand"
                    dir="ltr"
                  />
                </span>
                {confirm.length > 0 && confirm !== password && (
                  <span className="mt-1.5 block text-[10.5px] font-bold text-red-600">رمزها یکسان نیستند.</span>
                )}
              </label>
            )}

            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-2xl bg-red-50 px-3.5 py-3 text-[11.5px] font-bold leading-5 text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-[13.5px] font-black text-white shadow-lg shadow-brand/30 transition enabled:hover:brightness-105 enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" /> لطفاً صبر کنید…
                </>
              ) : (
                <>
                  {mode === "login" ? "ورود به حساب" : "ساخت حساب"}
                  <ArrowLeft className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

        </section>
      </div>
    </div>
  );
}

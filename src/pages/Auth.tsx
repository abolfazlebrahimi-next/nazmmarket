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
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { ApiError, api, tokenStore } from "../api/client";
import { Wordmark, pd, toEn } from "../components/ui";
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
  const canSubmit = phoneOk && passOk && (mode === "login" || password === confirm);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError("");
    setConfirm("");
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canSubmit || busy) return;
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
      setError(err instanceof ApiError ? err.message : "خطایی رخ داد؛ دوباره تلاش کنید.");
      setBusy(false);
    }
  };

  const fillDemo = () => {
    setMode("login");
    setPhone("09123456789");
    setPassword("123456");
    setError("");
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[radial-gradient(120%_120%_at_100%_0%,#fff3ec_0%,#faf9f7_45%,#f2efeb_100%)] px-4 py-8 sm:px-6">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-[30px] border border-line bg-white shadow-[0_30px_80px_-40px_rgba(40,25,10,0.45)] lg:grid-cols-[0.85fr_1fr]">
        {/* brand side (desktop) */}
        <aside className="relative hidden flex-col justify-between bg-gradient-to-br from-[#ff6a1f] to-[#e03d00] p-9 text-white lg:flex">
          <div className="absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/10" />
          <div className="absolute -bottom-16 -left-10 h-52 w-52 rounded-full bg-white/10" />
          <div className="relative">
            <span className="inline-flex rounded-2xl bg-white/15 px-3 py-1.5 text-[11px] font-black backdrop-blur">
              خرید آنلاین نظرآباد
            </span>
            <h2 className="mt-6 text-[26px] font-black leading-9">
              ناز! مارکت
              <span className="mt-2 block text-[15px] font-bold leading-7 text-white/85">
                سوپرمارکت و هایپرمارکت‌های شهر، تا ۴۵ دقیقه دم در خانه‌ی شما.
              </span>
            </h2>
            <ul className="mt-7 space-y-3 text-[12.5px] font-semibold text-white/90">
              {["ثبت سفارش از چند فروشگاه محلی", "تحویل سریع در نظرآباد و تنکمان", "پرداخت آنلاین یا در محل"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <p className="relative flex items-center gap-2 text-[11px] font-bold text-white/70">
            <ShieldCheck className="h-4 w-4" /> رمز عبور شما به‌صورت هش‌شده ذخیره می‌شود
          </p>
        </aside>

        {/* form side */}
        <section className="p-6 sm:p-9">
          <div className="flex items-center justify-between">
            <Wordmark size="text-[22px]" />
            <button
              type="button"
              onClick={fillDemo}
              className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1.5 text-[10px] font-black text-brand-dark transition hover:brightness-95"
            >
              <Sparkles className="h-3 w-3" /> ورود آزمایشی
            </button>
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
          <p className="mt-1.5 text-[11.5px] font-medium leading-6 text-muted">
            {mode === "login"
              ? "شماره موبایل شما نام کاربری حساب است."
              : "شماره موبایل = نام کاربری. یک رمز عبور برای خود انتخاب کنید."}
          </p>

          <form onSubmit={submit} className="mt-5 space-y-3.5">
            <label className="block">
              <span className="mb-1.5 block text-[11.5px] font-black text-ink">شماره موبایل (نام کاربری)</span>
              <span className="relative flex items-center">
                <Phone className="pointer-events-none absolute right-4 h-4 w-4 text-muted" />
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="username"
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(toEn(e.target.value).replace(/\D/g, "").slice(0, 11))}
                  placeholder="09123456789"
                  className="h-12 w-full rounded-2xl border border-line bg-white pr-11 pl-4 text-left text-[14px] font-bold tracking-wide outline-none transition placeholder:tracking-normal placeholder:text-[#c3beb9] focus:border-brand"
                />
              </span>
            </label>

            {mode === "register" && (
              <label className="block">
                <span className="mb-1.5 block text-[11.5px] font-black text-ink">
                  نام و نام خانوادگی <span className="font-medium text-muted">(اختیاری)</span>
                </span>
                <span className="relative flex items-center">
                  <UserRound className="pointer-events-none absolute right-4 h-4 w-4 text-muted" />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثلاً سارا محمدی"
                    autoComplete="name"
                    className="h-12 w-full rounded-2xl border border-line bg-white pr-11 pl-4 text-[13px] font-bold outline-none transition placeholder:text-[#c3beb9] focus:border-brand"
                  />
                </span>
              </label>
            )}

            <label className="block">
              <span className="mb-1.5 block text-[11.5px] font-black text-ink">رمز عبور</span>
              <span className="relative flex items-center">
                <Lock className="pointer-events-none absolute right-4 h-4 w-4 text-muted" />
                <input
                  type={showPass ? "text" : "password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
              <label className="block">
                <span className="mb-1.5 block text-[11.5px] font-black text-ink">تکرار رمز عبور</span>
                <span className="relative flex items-center">
                  <Lock className="pointer-events-none absolute right-4 h-4 w-4 text-muted" />
                  <input
                    type={showPass ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
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
              disabled={!canSubmit || busy}
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

          <p className="mt-4 text-center text-[10.5px] font-medium leading-5 text-muted">
            با ورود یا ثبت‌نام، <span className="font-black text-ink">قوانین و مقررات</span> ناز مارکت را می‌پذیرید.
          </p>

          <div className="mt-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-[10px] font-bold text-muted">یا</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <button
            type="button"
            onClick={() => onAuth({ token: "", user: { phone: "", firstName: "کاربر", lastName: "مهمان" }, addresses: [] })}
            className="mt-4 w-full rounded-2xl border border-line py-3 text-[12px] font-black text-ink transition hover:border-brand/50 hover:text-brand active:scale-[0.99]"
          >
            ادامه به عنوان مهمان
          </button>

          <p className="mt-3 text-center text-[10px] font-medium text-muted">
            ورود آزمایشی: {pd("09123456789")} · رمز {pd("123456")}
          </p>
        </section>
      </div>
    </div>
  );
}

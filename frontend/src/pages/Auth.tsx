import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
} from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  Lock,
  Phone,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { ApiError, api, tokenStore } from "../api/client";
import { toEn } from "../components/ui";
import type { AuthResponse } from "../api/client";

type AuthStep =
  | "phone"
  | "passwordLogin"
  | "otp"
  | "register"
  | "forgotPhone"
  | "forgotOtp"
  | "resetPassword";
type OtpPurpose = "login" | "password_reset";

const OTP_LENGTH = 4;
const emptyOtp = () => Array.from({ length: OTP_LENGTH }, () => "");

const onlyDigits = (value: string, maxLength = 11) =>
  toEn(value).replace(/\D/g, "").slice(0, maxLength);
const maskPhone = (phone: string) =>
  phone.length === 11 ? `${phone.slice(0, 3)}•••••${phone.slice(-3)}` : phone;

export default function AuthPage({ onAuth }: { onAuth: (response: AuthResponse) => void }) {
  const [step, setStep] = useState<AuthStep>("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [otpDigits, setOtpDigits] = useState<string[]>(emptyOtp);
  const otpInputs = useRef<Array<HTMLInputElement | null>>([]);
  const [signupToken, setSignupToken] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const titleByStep: Record<AuthStep, string> = {
    phone: "",
    passwordLogin: "ورود با رمز عبور",
    otp: "",
    register: "تکمیل ساخت حساب",
    forgotPhone: "بازیابی رمز عبور",
    forgotOtp: "کد بازیابی را وارد کنید",
    resetPassword: "انتخاب رمز عبور جدید",
  };
  const subtitleByStep: Record<AuthStep, string> = {
    phone: "",
    passwordLogin: "",
    otp: "",
    register: "شماره‌ات تأیید شد. یک نام دلخواه و رمز عبور برای حسابت انتخاب کن.",
    forgotPhone: "شماره‌ای را وارد کن که حساب نظرآباد شاپ با آن ساخته شده است.",
    forgotOtp: "برای تأیید مالکیت شماره، کد بازیابی پیامک‌شده را وارد کن.",
    resetPassword: "کد درست بود؛ حالا رمز عبور تازه‌ای برای حسابت انتخاب کن.",
  };

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(
      () => setResendIn((seconds) => Math.max(0, seconds - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const finishAuth = (response: AuthResponse) => {
    tokenStore.set(response.token);
    onAuth(response);
  };

  const errorMessage = (cause: unknown, fallback: string) =>
    cause instanceof ApiError && cause.message.trim() ? cause.message : fallback;

  const clearOtp = () => setOtpDigits(emptyOtp());

  const changeOtpDigit = (index: number, value: string) => {
    const digits = onlyDigits(value, OTP_LENGTH);
    setError("");
    if (!digits) {
      setOtpDigits((current) =>
        current.map((digit, position) => (position === index ? "" : digit)),
      );
      return;
    }

    if (digits.length === 1) {
      setOtpDigits((current) =>
        current.map((digit, position) =>
          position === index ? digits : digit,
        ),
      );
      if (index < OTP_LENGTH - 1) otpInputs.current[index + 1]?.focus();
      return;
    }

    const next = emptyOtp();
    digits.split("").forEach((digit, position) => {
      next[position] = digit;
    });
    setOtpDigits(next);
    otpInputs.current[Math.min(digits.length, OTP_LENGTH - 1)]?.focus();
  };

  const pasteOtp = (event: ClipboardEvent<HTMLInputElement>) => {
    const digits = onlyDigits(event.clipboardData.getData("text"), OTP_LENGTH);
    if (!digits) return;
    event.preventDefault();
    const next = emptyOtp();
    digits.split("").forEach((digit, position) => {
      next[position] = digit;
    });
    setOtpDigits(next);
    setError("");
    otpInputs.current[Math.min(digits.length, OTP_LENGTH - 1)]?.focus();
  };

  const requestCode = async (purpose: OtpPurpose, rawPhone: string) => {
    if (busy) return;
    const normalizedPhone = onlyDigits(rawPhone);
    if (!/^09\d{9}$/.test(normalizedPhone)) {
      setError("شماره موبایل باید ۱۱ رقم باشد و با ۰۹ شروع شود.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await api.auth.requestOtp(normalizedPhone, purpose);
      setVerifiedPhone(normalizedPhone);
      // Keep the verified number only in component state; clear the editable field
      // as soon as the code step opens.
      setPhoneInput("");
      clearOtp();
      setResendIn(60);
      setStep(purpose === "login" ? "otp" : "forgotOtp");
    } catch (cause) {
      setError(errorMessage(cause, "ارسال کد انجام نشد؛ دوباره تلاش کن."));
    } finally {
      setBusy(false);
    }
  };

  const resendCode = async () => {
    if (busy || resendIn > 0 || !verifiedPhone) return;
    const purpose: OtpPurpose = step === "forgotOtp" ? "password_reset" : "login";
    setBusy(true);
    setError("");
    try {
      await api.auth.requestOtp(verifiedPhone, purpose);
      clearOtp();
      setResendIn(60);
    } catch (cause) {
      setError(errorMessage(cause, "ارسال دوبارهٔ کد انجام نشد؛ دوباره تلاش کن."));
    } finally {
      setBusy(false);
    }
  };

  const editPhone = () => {
    setPhoneInput(verifiedPhone);
    clearOtp();
    setResendIn(0);
    setSignupToken("");
    setResetToken("");
    setError("");
    setStep(step === "forgotOtp" ? "forgotPhone" : "phone");
  };

  const startPasswordLogin = () => {
    setPassword("");
    setError("");
    setStep("passwordLogin");
  };

  const startPasswordRecovery = () => {
    setPhoneInput(phoneInput || verifiedPhone);
    setPassword("");
    clearOtp();
    setResendIn(0);
    setError("");
    setStep("forgotPhone");
  };

  const returnToPhone = () => {
    setPhoneInput(verifiedPhone || phoneInput);
    setPassword("");
    clearOtp();
    setSignupToken("");
    setResetToken("");
    setResendIn(0);
    setError("");
    setStep("phone");
  };

  const loginWithPassword = async () => {
    const normalizedPhone = onlyDigits(phoneInput);
    if (!/^09\d{9}$/.test(normalizedPhone)) {
      setError("شماره موبایل باید ۱۱ رقم باشد و با ۰۹ شروع شود.");
      return;
    }
    if (!password) {
      setError("رمز عبور را وارد کن.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = await api.auth.login(normalizedPhone, password);
      finishAuth(response);
    } catch (cause) {
      setError(errorMessage(cause, "شماره موبایل یا رمز عبور اشتباه است."));
    } finally {
      setBusy(false);
    }
  };

  const verifyLoginCode = async () => {
    const code = otpDigits.join("");
    if (code.length !== OTP_LENGTH) {
      setError("هر چهار رقم کد یکبارمصرف پیامک‌شده را وارد کن.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await api.auth.verifyOtp(verifiedPhone, code);
      if ("signupToken" in response) {
        setSignupToken(response.signupToken);
        setDisplayName("");
        setPassword("");
        setPasswordConfirm("");
        setStep("register");
      } else {
        finishAuth(response);
      }
    } catch (cause) {
      setError(errorMessage(cause, "کد نادرست یا منقضی شده است؛ دوباره بررسی کن."));
    } finally {
      setBusy(false);
    }
  };

  const verifyRecoveryCode = async () => {
    const code = otpDigits.join("");
    if (code.length !== OTP_LENGTH) {
      setError("هر چهار رقم کد بازیابی را وارد کن.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await api.auth.verifyPasswordResetOtp(verifiedPhone, code);
      setResetToken(response.resetToken);
      clearOtp();
      setPassword("");
      setPasswordConfirm("");
      setStep("resetPassword");
    } catch (cause) {
      setError(errorMessage(cause, "کد نادرست یا منقضی شده است؛ دوباره بررسی کن."));
    } finally {
      setBusy(false);
    }
  };

  const createAccount = async () => {
    const name = displayName.trim();
    if (name.length < 2) {
      setError("یک نام دلخواه با دست‌کم ۲ نویسه وارد کن.");
      return;
    }
    if (password.length < 6) {
      setError("رمز عبور باید دست‌کم ۶ نویسه باشد.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("رمز عبور و تکرار آن یکسان نیستند.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await api.auth.completeOtpRegistration({
        signupToken,
        name,
        password,
      });
      finishAuth(response);
    } catch (cause) {
      setError(errorMessage(cause, "ساخت حساب انجام نشد؛ دوباره تلاش کن."));
    } finally {
      setBusy(false);
    }
  };

  const saveNewPassword = async () => {
    if (password.length < 6) {
      setError("رمز عبور باید دست‌کم ۶ نویسه باشد.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("رمز عبور و تکرار آن یکسان نیستند.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await api.auth.resetPassword(resetToken, password);
      finishAuth(response);
    } catch (cause) {
      setError(errorMessage(cause, "تغییر رمز انجام نشد؛ کد بازیابی تازه بگیر."));
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    switch (step) {
      case "phone":
        void requestCode("login", phoneInput);
        break;
      case "passwordLogin":
        void loginWithPassword();
        break;
      case "otp":
        void verifyLoginCode();
        break;
      case "register":
        void createAccount();
        break;
      case "forgotPhone":
        void requestCode("password_reset", phoneInput);
        break;
      case "forgotOtp":
        void verifyRecoveryCode();
        break;
      case "resetPassword":
        void saveNewPassword();
        break;
    }
  };

  const isPhoneStep =
    step === "phone" || step === "passwordLogin" || step === "forgotPhone";
  const isOtpStep = step === "otp" || step === "forgotOtp";
  const submitLabel: Record<AuthStep, string> = {
    phone: "دریافت کد",
    passwordLogin: "ورود به حساب",
    otp: "تأیید کد و ادامه",
    register: "ساخت حساب و ورود",
    forgotPhone: "دریافت کد بازیابی",
    forgotOtp: "تأیید کد بازیابی",
    resetPassword: "ذخیره رمز جدید و ورود",
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[radial-gradient(120%_120%_at_100%_0%,#eaf4ee_0%,#fafcfb_45%,#edf1ee_100%)] px-4 py-8 sm:px-6">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-[30px] border border-line bg-white shadow-[0_30px_80px_-40px_rgba(40,25,10,0.45)] lg:grid-cols-[0.85fr_1fr]">
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#16865b] to-[#26352e] p-9 text-white lg:flex">
          <div className="absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/10" />
          <div className="absolute -bottom-16 -left-10 h-52 w-52 rounded-full bg-white/10" />
          <div className="relative">
            <h2 className="mt-6 text-[26px] font-black leading-9">
              نظرآباد شاپ
              <span className="mt-2 block text-[15px] font-bold leading-7 text-white/85">
                سوپرمارکت و هایپرمارکت‌های شهر، تا ۴۵ دقیقه دم در خانه‌ی شما.
              </span>
            </h2>
            <ul className="mt-7 space-y-3 text-[12.5px] font-semibold text-white/90">
              {["ورود سریع و امن با شماره موبایل", "ساخت حساب در چند قدم کوتاه", "ثبت سفارش از فروشگاه‌های محلی"].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <p className="relative text-[11px] font-semibold text-white/70">
            اطلاعات ورودت فقط برای امن نگه‌داشتن حساب استفاده می‌شود.
          </p>
        </aside>

        <section
          className="flex min-h-[320px] flex-col p-6 sm:min-h-[360px] sm:p-9"
          dir="rtl"
        >
          <div className="flex min-h-14 items-center">
            <span className="text-[20px] font-black tracking-tight text-brand">
              نظرآباد شاپ
            </span>
          </div>

          {titleByStep[step] && (
            <h1 className="mt-6 text-[20px] font-black text-ink">
              {titleByStep[step]}
            </h1>
          )}
          {subtitleByStep[step] && (
            <p className="mt-2 text-[12px] font-semibold leading-6 text-muted">
              {subtitleByStep[step]}
            </p>
          )}

          <form
            onSubmit={submit}
            className="mt-8 flex flex-col gap-3.5"
            noValidate
          >
            {isPhoneStep && (
              <label className="naz-floating-field auth-floating-field">
                <span className="naz-floating-label">شماره موبایل</span>
                <span className="relative flex items-center">
                  <Phone className="pointer-events-none absolute right-4 h-4 w-4 text-muted" />
                  <input
                    type="tel"
                    name="phone"
                    inputMode="numeric"
                    autoComplete="tel"
                    autoFocus
                    dir="ltr"
                    required
                    disabled={busy}
                    maxLength={11}
                    pattern="09[0-9]{9}"
                    value={phoneInput}
                    onChange={(event) => {
                      setPhoneInput(onlyDigits(event.target.value));
                      setError("");
                    }}
                    placeholder="09xxxxxxxxx"
                    className="h-12 w-full rounded-2xl border border-line bg-white pr-11 pl-4 text-left text-[14px] font-bold tracking-wide outline-none transition placeholder:tracking-normal placeholder:text-[#c3beb9] focus:border-brand disabled:bg-[#fafaf8]"
                  />
                </span>
              </label>
            )}

            {step === "passwordLogin" && (
              <PasswordField
                label="رمز عبور"
                name="password"
                value={password}
                onChange={(value) => {
                  setPassword(value);
                  setError("");
                }}
                show={showPassword}
                onToggle={() => setShowPassword((visible) => !visible)}
                disabled={busy}
                autoComplete="current-password"
              />
            )}

            {isOtpStep && (
              <>
                <div className="space-y-2">
                  <span
                    id="sms-otp-label"
                    className="block text-[11px] font-bold text-muted"
                  >
                    کد پیامک‌شده
                  </span>
                  <div
                    className="grid w-full grid-cols-4 gap-2.5"
                    dir="ltr"
                    role="group"
                    aria-labelledby="sms-otp-label"
                  >
                    {otpDigits.map((digit, index) => (
                      <input
                        key={index}
                        ref={(element) => {
                          otpInputs.current[index] = element;
                        }}
                        type="text"
                        name={index === 0 ? "otp" : `otp-${index + 1}`}
                        inputMode="numeric"
                        autoComplete={index === 0 ? "one-time-code" : "off"}
                        autoFocus={index === 0}
                        aria-label={`رقم ${index + 1} از ${OTP_LENGTH}`}
                        dir="ltr"
                        required
                        disabled={busy}
                        maxLength={OTP_LENGTH}
                        pattern="[0-9]*"
                        value={digit}
                        onChange={(event) =>
                          changeOtpDigit(index, event.target.value)
                        }
                        onPaste={pasteOtp}
                        onKeyDown={(event) => {
                          if (
                            event.key === "Backspace" &&
                            !otpDigits[index] &&
                            index > 0
                          ) {
                            event.preventDefault();
                            otpInputs.current[index - 1]?.focus();
                          } else if (
                            event.key === "ArrowLeft" &&
                            index > 0
                          ) {
                            otpInputs.current[index - 1]?.focus();
                          } else if (
                            event.key === "ArrowRight" &&
                            index < OTP_LENGTH - 1
                          ) {
                            otpInputs.current[index + 1]?.focus();
                          }
                        }}
                        className="h-14 w-full min-w-0 rounded-xl border border-line bg-white text-center text-[22px] font-black text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10 disabled:bg-[#fafaf8]"
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={editPhone}
                    disabled={busy}
                    className="text-brand transition hover:underline disabled:cursor-not-allowed disabled:text-muted"
                  >
                    تغییر شماره
                  </button>
                  <button
                    type="button"
                    onClick={() => void resendCode()}
                    disabled={busy || resendIn > 0}
                    className="inline-flex items-center gap-1 text-brand transition enabled:hover:underline disabled:cursor-not-allowed disabled:text-muted"
                  >
                    <RefreshCw className="h-3 w-3" />
                    {resendIn > 0 ? `ارسال دوباره پس از ${resendIn} ثانیه` : "ارسال دوباره کد"}
                  </button>
                </div>
              </>
            )}

            {step === "register" && (
              <>
                <div className="flex items-center gap-2 rounded-2xl bg-[#eef8f2] px-4 py-3 text-[11px] font-bold text-[#276647]">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  شماره <b dir="ltr" className="tracking-wide">{maskPhone(verifiedPhone)}</b> تأیید شد.
                </div>
                <label className="naz-floating-field auth-floating-field">
                  <span className="naz-floating-label">نام دلخواه / نام نمایشی</span>
                  <span className="relative flex items-center">
                    <UserRound className="pointer-events-none absolute right-4 h-4 w-4 text-muted" />
                    <input
                      type="text"
                      name="displayName"
                      autoComplete="name"
                      autoFocus
                      required
                      maxLength={40}
                      disabled={busy}
                      value={displayName}
                      onChange={(event) => {
                        setDisplayName(event.target.value);
                        setError("");
                      }}
                      placeholder="مثلاً سارا محمدی"
                      className="h-12 w-full rounded-2xl border border-line bg-white pr-11 pl-4 text-[13px] font-bold outline-none transition placeholder:text-[#c3beb9] focus:border-brand disabled:bg-[#fafaf8]"
                    />
                  </span>
                </label>
                <PasswordField
                  label="رمز عبور"
                  name="newPassword"
                  value={password}
                  onChange={(value) => {
                    setPassword(value);
                    setError("");
                  }}
                  show={showPassword}
                  onToggle={() => setShowPassword((visible) => !visible)}
                  disabled={busy}
                  autoComplete="new-password"
                />
                <PasswordField
                  label="تکرار رمز عبور"
                  name="confirmPassword"
                  value={passwordConfirm}
                  onChange={(value) => {
                    setPasswordConfirm(value);
                    setError("");
                  }}
                  show={showPassword}
                  onToggle={() => setShowPassword((visible) => !visible)}
                  disabled={busy}
                  autoComplete="new-password"
                />
                {passwordConfirm.length > 0 && password !== passwordConfirm && (
                  <p className="text-[10.5px] font-bold text-red-600">رمزها یکسان نیستند.</p>
                )}
                <p className="text-[10px] font-semibold leading-5 text-muted">
                  تأیید شماره تا ۱۰ دقیقه برای تکمیل ساخت حساب معتبر است.
                </p>
              </>
            )}

            {step === "resetPassword" && (
              <>
                <div className="flex items-center gap-2 rounded-2xl bg-[#eef8f2] px-4 py-3 text-[11px] font-bold text-[#276647]">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  شماره <b dir="ltr" className="tracking-wide">{maskPhone(verifiedPhone)}</b> تأیید شد.
                </div>
                <PasswordField
                  label="رمز عبور جدید"
                  name="newPassword"
                  value={password}
                  onChange={(value) => {
                    setPassword(value);
                    setError("");
                  }}
                  show={showPassword}
                  onToggle={() => setShowPassword((visible) => !visible)}
                  disabled={busy}
                  autoComplete="new-password"
                />
                <PasswordField
                  label="تکرار رمز جدید"
                  name="confirmNewPassword"
                  value={passwordConfirm}
                  onChange={(value) => {
                    setPasswordConfirm(value);
                    setError("");
                  }}
                  show={showPassword}
                  onToggle={() => setShowPassword((visible) => !visible)}
                  disabled={busy}
                  autoComplete="new-password"
                />
                {passwordConfirm.length > 0 && password !== passwordConfirm && (
                  <p className="text-[10.5px] font-bold text-red-600">رمزها یکسان نیستند.</p>
                )}
              </>
            )}

            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-2xl bg-red-50 px-3.5 py-3 text-[11.5px] font-bold leading-5 text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-[13.5px] font-black text-white shadow-lg shadow-brand/30 transition enabled:hover:brightness-105 enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" /> لطفاً صبر کن…
                </>
              ) : (
                <>
                  {submitLabel[step]}
                  <ArrowLeft className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {(step === "phone" || step === "passwordLogin") && (
            <div className="mt-4 flex items-center justify-between gap-3 text-[11px] font-bold">
              {step === "phone" ? (
                <button
                  type="button"
                  onClick={startPasswordLogin}
                  disabled={busy}
                  className="text-brand transition hover:underline disabled:cursor-not-allowed disabled:text-muted"
                >
                  ورود با رمز عبور
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setPassword("");
                    setError("");
                    setStep("phone");
                  }}
                  disabled={busy}
                  className="text-brand transition hover:underline disabled:cursor-not-allowed disabled:text-muted"
                >
                  ورود با کد پیامکی
                </button>
              )}
              <button
                type="button"
                onClick={startPasswordRecovery}
                disabled={busy}
                className="text-brand transition hover:underline disabled:cursor-not-allowed disabled:text-muted"
              >
                فراموشی رمز عبور
              </button>
            </div>
          )}
          {step === "forgotPhone" && (
            <button
              type="button"
              onClick={returnToPhone}
              disabled={busy}
              className="mt-4 w-full text-center text-[11px] font-bold text-muted transition hover:text-brand disabled:opacity-50"
            >
              ورود یا ساخت حساب
            </button>
          )}
        </section>
      </div>
    </div>
  );
}

function PasswordField({
  label,
  name,
  value,
  onChange,
  show,
  onToggle,
  disabled,
  autoComplete,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggle: () => void;
  disabled: boolean;
  autoComplete: string;
}) {
  return (
    <label className="naz-floating-field auth-floating-field">
      <span className="naz-floating-label">{label}</span>
      <span className="relative flex items-center">
        <Lock className="pointer-events-none absolute right-4 h-4 w-4 text-muted" />
        <input
          type={show ? "text" : "password"}
          name={name}
          autoComplete={autoComplete}
          required
          minLength={6}
          maxLength={256}
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="حداقل ۶ نویسه"
          className="h-12 w-full rounded-2xl border border-line bg-white pr-11 pl-12 text-left text-[13.5px] font-bold outline-none transition placeholder:text-right placeholder:text-[#c3beb9] focus:border-brand disabled:bg-[#fafaf8]"
          dir="ltr"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? "پنهان کردن رمز" : "نمایش رمز"}
          disabled={disabled}
          className="absolute left-3 flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-[#f4f3f0] disabled:opacity-50"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </span>
    </label>
  );
}

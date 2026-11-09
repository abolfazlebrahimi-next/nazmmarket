import { useState } from "react";
import {
  BadgeCheck,
  Check,
  Copy,
  Gift,
  Headphones,
  Heart,
  Info,
  LoaderCircle,
  Lock,
  LogIn,
  LogOut,
  MessageSquareText,
  Phone,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  TicketPercent,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { pd } from "../components/ui";
import { Sheet } from "../components/ui";
import { api } from "../api/client";
import type { AppCtx } from "../ctx";
import type { User } from "../data";
import { discountCodes, faNum } from "../data";

export function AccountView({ c }: { c: AppCtx }) {
  const fullName = [c.user?.firstName, c.user?.lastName].filter(Boolean).join(" ");
  const name = fullName || (c.isGuest ? "کاربر مهمان" : "کاربر ناز");
  const phone = c.user?.phone ? pd(c.user.phone) : "بدون شماره";

  const rows: { icon: typeof Heart; label: string; desc?: string; pill?: string; pillCls?: string; sheet?: string; action?: () => void; pro?: boolean }[] = [
    { icon: Sparkles, label: "ناز! پرو", pro: true, desc: c.proActive ? "اشتراک فعال است" : "اشتراک فعال ندارید", pill: c.proActive ? undefined : "خرید اشتراک", pillCls: "bg-[#4b4b48] text-white", sheet: "pro" },
    { icon: UserRound, label: "مشخصات حساب", desc: "نام، نام خانوادگی و رمز عبور", pill: "ویرایش", pillCls: "bg-[#f4f3f0] text-ink", sheet: "profile" },
    { icon: Users, label: "دعوت دوستان", desc: "تا ۲ میلیون تومان کد تخفیف", pill: "دعوت کردن", pillCls: "bg-peach text-brand", sheet: "invite" },
    { icon: Wallet, label: "افزایش اعتبار کیف پول", desc: `موجودی: ${faNum(c.wallet)} تومان`, sheet: "wallet" },
    { icon: Heart, label: "کالاهای مورد علاقه‌ی من", desc: `${pd(c.favorites.length)} کالا`, action: () => c.openSub({ name: "favorites" }) },
    { icon: TicketPercent, label: "کدهای تخفیف من", pill: "جدید", pillCls: "bg-peach text-brand", sheet: "codes" },
    { icon: MessageSquareText, label: "نظرات من", sheet: "reviews" },
    { icon: ReceiptText, label: "لیست پرداخت‌ها", sheet: "payments" },
    { icon: Headphones, label: "پشتیبانی", sheet: "support" },
    { icon: Info, label: "قوانین و مقررات", sheet: "rules" },
    { icon: ShieldCheck, label: "حریم خصوصی", sheet: "privacy" },
  ];

  return (
    <div className="fade-rise mx-auto min-h-dvh w-full max-w-3xl pb-24 md:pb-16">
      <div className="border-b border-line bg-white px-5 pb-2 pt-5">
        <h2 className="text-[17px] font-black text-ink">حساب کاربری</h2>
        <button type="button" onClick={() => c.setSheet("profile")} aria-label="ویرایش پروفایل" className="mt-3 flex w-full items-center gap-3 pb-3 text-right transition hover:opacity-80">
          <span className="flex shrink-0 items-center justify-center rounded-full border-2 border-line bg-brand-soft text-brand" style={{ height: 52, width: 52 }}>
            <UserRound className="h-6 w-6" />
          </span>
          <span className="flex-1">
            <span className="block text-[16px] font-black text-ink">{name}</span>
            <span className="mt-0.5 block text-[12px] font-medium text-muted" dir="ltr" style={{ textAlign: "right" }}>{phone}</span>
          </span>
        </button>
      </div>

      {c.isGuest && (
        <div className="px-4 pt-3 lg:px-5">
          <div className="flex items-center gap-3 rounded-2xl border border-brand/25 bg-brand-soft/70 p-3.5">
            <LogIn className="h-5 w-5 shrink-0 text-brand" />
            <p className="flex-1 text-[11px] font-bold leading-5 text-brand-dark">
              در حالت مهمان هستید؛ سفارش‌ها فقط روی همین دستگاه ذخیره می‌شوند.
            </p>
            <button
              type="button"
              onClick={c.logout}
              className="shrink-0 rounded-xl bg-brand px-3 py-2 text-[11px] font-black text-white"
            >
              ورود / ثبت‌نام
            </button>
          </div>
        </div>
      )}

      <div className="px-4 pt-3 lg:px-5">
        <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-l from-[#ffe9dc] to-[#fff3ec] p-4">
          <div className="absolute -left-6 -top-8 h-28 w-28 rounded-full bg-brand/10" />
          <div className="relative flex items-center gap-3">
            <span className="floaty flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-white shadow-md">
              <Gift className="h-7 w-7 text-brand" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-black leading-6 text-ink">تا ۲ میلیون تومان تخفیف بگیرید!</p>
              <p className="text-[11px] font-medium text-muted">ویژه دعوت از دوستان</p>
              <button type="button" onClick={() => c.setSheet("invite")} className="mt-2.5 rounded-xl bg-brand px-5 py-2.5 text-[12px] font-black text-white shadow-md transition active:scale-95">
                دعوت کردن
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 border-y border-line bg-white lg:mx-4 lg:rounded-[24px] lg:border">
        {rows.map((row) => (
          <button
            key={row.label}
            type="button"
            onClick={() => (row.action ? row.action() : row.sheet && c.setSheet(row.sheet))}
            className="flex w-full items-center gap-3 border-b border-line px-4 py-4 text-right transition last:border-0 hover:bg-[#fffaf6] active:bg-brand-soft/40"
          >
            <row.icon className="shrink-0 text-ink" strokeWidth={1.8} style={{ height: 22, width: 22 }} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[13.5px] font-extrabold text-ink">
                {row.label}
                {row.pro && <span className="rounded bg-[#0e7c86] px-1 py-px text-[8.5px] font-black italic text-white">Pro</span>}
              </span>
              {row.desc && <span className="mt-0.5 block text-[11px] font-medium text-muted">{row.desc}</span>}
            </span>
            {row.pill && <span className={`shrink-0 rounded-full px-3 py-1.5 text-[10.5px] font-black ${row.pillCls}`}>{row.pill}</span>}
          </button>
        ))}
        <button type="button" onClick={c.logout} className="flex w-full items-center gap-3 px-4 py-4 text-right transition hover:bg-red-50/60">
          <LogOut className="shrink-0 text-ink" strokeWidth={1.8} style={{ height: 22, width: 22 }} />
          <span className="flex-1 text-[13.5px] font-extrabold text-ink">{c.isGuest ? "ورود به حساب" : "خروج"}</span>
        </button>
      </div>
      <p className="px-4 pt-4 text-[10px] font-medium text-muted lg:px-5">
        نسخه ۲.۰.۰ · {c.isGuest ? "حالت مهمان (ذخیره روی این دستگاه)" : "حساب متصل به سرور ناز مارکت"}
      </p>
    </div>
  );
}

export function AccountSheetHost({ c }: { c: AppCtx }) {
  const [topUpBusy, setTopUpBusy] = useState<number | null>(null);
  const sheet = c.sheet;
  if (!sheet) return null;
  const close = () => c.setSheet(null);
  const copy = (t: string) => {
    try {
      navigator.clipboard?.writeText(t);
    } catch { /* ignore */ }
    c.toast("کپی شد");
  };
  const topUp = async (amt: number) => {
    setTopUpBusy(amt);
    try {
      if (c.isGuest) {
        c.setWallet(c.wallet + amt);
      } else {
        const res = await api.wallet.topUp(amt);
        c.setWallet(res.wallet);
      }
      c.toast(`${faNum(amt)} تومان به کیف پول اضافه شد`);
    } catch (err) {
      c.toast(err instanceof Error ? err.message : "شارژ کیف پول انجام نشد");
    } finally {
      setTopUpBusy(null);
    }
  };

  switch (sheet) {
    case "codes":
      return (
        <Sheet title="کدهای تخفیف من" onClose={close}>
          <div className="space-y-2.5">
            {discountCodes.map((d) => (
              <div key={d.code} className="flex items-center gap-3 rounded-3xl border border-dashed border-brand/40 bg-brand-soft/60 p-3.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-brand shadow-sm">
                  <TicketPercent className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-black text-ink">{d.title}</p>
                  <p className="mt-0.5 text-[10.5px] font-medium text-muted">{d.desc}</p>
                  <p dir="ltr" className="mt-1 text-left text-[11px] font-black tracking-wider text-brand">{d.code}</p>
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <button type="button" onClick={() => copy(d.code)} className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[10px] font-black text-ink shadow-sm">
                    <Copy className="h-3 w-3" /> کپی
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      c.applyCode(d.code);
                      if (c.cartCount > 0) {
                        close();
                        c.openSub({ name: "checkout" });
                      } else {
                        close();
                        c.toast("کد ذخیره شد؛ هنگام تکمیل خرید اعمال می‌شود");
                      }
                    }}
                    className="rounded-lg bg-brand px-2.5 py-1.5 text-[10px] font-black text-white"
                  >
                    استفاده
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Sheet>
      );
    case "invite":
      return (
        <Sheet title="دعوت دوستان" onClose={close}>
          <div className="rounded-3xl bg-gradient-to-l from-[#ffe9dc] to-[#fff3ec] p-5 text-center">
            <Gift className="mx-auto h-10 w-10 text-brand" />
            <p className="mt-3 text-[14px] font-black text-ink">با هر دعوت موفق، هر دو نفر تخفیف می‌گیرید!</p>
            <p className="mx-auto mt-1.5 max-w-64 text-[11px] font-medium leading-5 text-muted">
              کد دعوت خود را برای دوستانتان در نظرآباد بفرستید؛ بعد از اولین خرید آن‌ها، کد تخفیف به حساب شما اضافه می‌شود.
            </p>
            <div className="mx-auto mt-4 flex max-w-72 items-center gap-2 rounded-2xl bg-white p-2 shadow-sm">
              <span dir="ltr" className="flex-1 text-[12px] font-black tracking-wider text-ink">NAZ-NAZARABAD</span>
              <button type="button" onClick={() => copy("NAZ-NAZARABAD")} className="flex items-center gap-1 rounded-xl bg-brand px-3 py-2 text-[11px] font-black text-white">
                <Copy className="h-3.5 w-3.5" /> کپی کد
              </button>
            </div>
          </div>
        </Sheet>
      );
    case "wallet":
      return (
        <Sheet title="کیف پول ناز مارکت" onClose={close}>
          <div className="rounded-3xl bg-ink p-5 text-white">
            <p className="text-[11px] font-bold text-white/55">موجودی فعلی</p>
            <p className="mt-1 text-[24px] font-black">{faNum(c.wallet)} تومان</p>
          </div>
          <p className="mt-4 text-[12px] font-black text-ink">افزایش اعتبار</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[50000, 100000, 200000].map((amt) => (
              <button
                key={amt}
                type="button"
                disabled={topUpBusy === amt}
                onClick={() => topUp(amt)}
                className="flex items-center justify-center gap-1.5 rounded-2xl border border-line py-3 text-[12px] font-black text-ink transition hover:border-brand hover:text-brand active:scale-95 disabled:opacity-60"
              >
                {topUpBusy === amt ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {faNum(amt)}
              </button>
            ))}
          </div>
        </Sheet>
      );
    case "pro":
      return (
        <Sheet title="ناز! پرو" onClose={close}>
          <div className="rounded-3xl bg-gradient-to-l from-[#0e7c86] to-[#0a5a61] p-5 text-white">
            <p className="flex items-center gap-2 text-[16px] font-black">
              ناز! پرو <span className="rounded bg-white/20 px-1.5 py-0.5 text-[9px] italic">Pro</span>
            </p>
            <p className="mt-1.5 text-[11px] font-medium leading-5 text-white/75">ارسال رایگان نامحدود از فروشگاه‌های پرو نظرآباد + تخفیف‌های اختصاصی هر هفته</p>
          </div>
          <div className="mt-3 space-y-2">
            {[
              { t: "اشتراک ماهانه", p: "۴۹٬۰۰۰ تومان" },
              { t: "اشتراک سه‌ماهه", p: "۱۲۹٬۰۰۰ تومان" },
            ].map((plan) => (
              <button
                key={plan.t}
                type="button"
                onClick={() => {
                  c.setProActive(true);
                  close();
                  c.toast("اشتراک ناز پرو فعال شد");
                }}
                className="flex w-full items-center justify-between rounded-2xl border border-line p-3.5 text-right transition hover:border-brand active:scale-[0.99]"
              >
                <span className="flex items-center gap-2 text-[12px] font-black text-ink">
                  <BadgeCheck className="h-4 w-4 text-[#0e7c86]" /> {plan.t}
                </span>
                <span className="text-[12px] font-black text-brand">{plan.p}</span>
              </button>
            ))}
          </div>
        </Sheet>
      );
    case "support":
      return (
        <Sheet title="پشتیبانی ناز مارکت" onClose={close}>
          <div className="space-y-2.5 text-[12px] font-semibold leading-6 text-muted">
            <p>تیم پشتیبانی ناز مارکت هر روز از ساعت ۷ صبح تا ۱۲ شب پاسخ‌گوی شماست.</p>
            <a href="tel:02645321000" className="flex items-center gap-3 rounded-2xl border border-line p-3.5 text-ink">
              <Phone className="h-5 w-5 shrink-0 text-brand" />
              <span className="font-black">۰۲۶ - ۴۵۳۲ ۱۰۰</span>
              <span className="text-[10px] font-medium text-muted">(پیش‌شماره البرز)</span>
            </a>
            <button type="button" onClick={() => c.toast("گفت‌وگوی آنلاین با اتصال بک‌اند فعال می‌شود")} className="flex w-full items-center gap-3 rounded-2xl border border-line p-3.5 text-ink">
              <MessageSquareText className="h-5 w-5 shrink-0 text-brand" />
              <span className="font-black">گفت‌وگوی آنلاین</span>
            </button>
          </div>
        </Sheet>
      );
    case "profile":
      return (
        <ProfileSheet
          c={c}
          close={close}
        />
      );
    case "payments":
      return (
        <Sheet title="لیست پرداخت‌ها" onClose={close}>
          {c.orders.length === 0 ? (
            <p className="py-6 text-center text-[12px] font-semibold text-muted">هنوز پرداختی ثبت نشده است.</p>
          ) : (
            <div className="divide-y divide-line">
              {c.orders.map((o) => (
                <div key={o.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-[12px] font-black text-ink">{o.storeName}</p>
                    <p className="mt-0.5 text-[10px] font-medium text-muted">
                      سفارش ناز-{pd(o.id.replace("NM-", ""))} · {o.time}
                    </p>
                  </div>
                  <span className="text-[12px] font-black text-ink">{faNum(o.total)} تومان</span>
                </div>
              ))}
            </div>
          )}
        </Sheet>
      );
    case "reviews":
      return (
        <Sheet title="نظرات من" onClose={close}>
          <p className="py-6 text-center text-[12px] font-semibold leading-6 text-muted">
            هنوز نظری ثبت نکرده‌اید.
            <br />
            بعد از تحویل سفارش، می‌توانید به فروشگاه و کالاها امتیاز بدهید.
          </p>
        </Sheet>
      );
    case "rules":
      return (
        <Sheet title="قوانین و مقررات" onClose={close}>
          <div className="space-y-3 text-[12px] font-medium leading-6 text-muted">
            <p>۱. سفارش‌ها فقط در محدوده‌ی شهرستان نظرآباد (شهر نظرآباد، تنکمان و سیدجمال‌الدین) تحویل داده می‌شوند.</p>
            <p>۲. در صورت ناموجود بودن کالا، مبلغ آن به کیف پول شما بازگردانده می‌شود یا کالای جایگزین با هماهنگی پیشنهاد می‌گردد.</p>
            <p>۳. امکان لغو سفارش تا پیش از شروع آماده‌سازی توسط فروشگاه وجود دارد.</p>
            <p>۴. هزینه ارسال برای خریدهای بالای ۴۰۰ هزار تومان رایگان است.</p>
          </div>
        </Sheet>
      );
    case "privacy":
      return (
        <Sheet title="حریم خصوصی" onClose={close}>
          <div className="space-y-3 text-[12px] font-medium leading-6 text-muted">
            <p>ناز مارکت اطلاعات شخصی شما (شماره تماس و آدرس) را فقط برای پردازش و تحویل سفارش استفاده می‌کند و آن را با اشخاص ثالث به اشتراک نمی‌گذارد.</p>
            <p>می‌توانید هر زمان درخواست حذف حساب و اطلاعات خود را ثبت کنید.</p>
          </div>
        </Sheet>
      );
    default:
      return null;
  }
}


/* ---------------- profile editor ---------------- */
function ProfileSheet({ c, close }: { c: AppCtx; close: () => void }) {
  const [first, setFirst] = useState(c.user?.firstName ?? "");
  const [last, setLast] = useState(c.user?.lastName ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setError("");
    if (password && password.length < 6) {
      return setError("رمز عبور جدید باید حداقل ۶ کاراکتر باشد.");
    }
    setBusy(true);
    try {
      if (c.isGuest || !c.user) {
        c.updateUser({ ...(c.user ?? { phone: "", firstName: "", lastName: "" }), firstName: first.trim(), lastName: last.trim() } as User);
      } else {
        const res = await api.auth.updateProfile({
          firstName: first.trim(),
          lastName: last.trim(),
          ...(password ? { password } : {}),
        });
        c.updateUser(res.user);
      }
      c.toast("اطلاعات حساب ذخیره شد");
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ذخیره اطلاعات انجام نشد.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="مشخصات حساب" onClose={close}>
      <div className="rounded-2xl bg-[#f8f7f4] px-3.5 py-3">
        <p className="text-[10.5px] font-bold text-muted">شماره موبایل (نام کاربری)</p>
        <p className="mt-1 text-[13px] font-black text-ink" dir="ltr" style={{ textAlign: "right" }}>
          {c.user?.phone ? pd(c.user.phone) : "حساب مهمان"}
        </p>
      </div>

      <div className="mt-3 space-y-2.5">
        <input
          value={first}
          onChange={(e) => setFirst(e.target.value)}
          placeholder="نام"
          aria-label="نام"
          className="w-full rounded-2xl border border-line px-4 py-3 text-[13px] font-bold outline-none transition focus:border-brand"
        />
        <input
          value={last}
          onChange={(e) => setLast(e.target.value)}
          placeholder="نام خانوادگی"
          aria-label="نام خانوادگی"
          className="w-full rounded-2xl border border-line px-4 py-3 text-[13px] font-bold outline-none transition focus:border-brand"
        />
        {!c.isGuest && (
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black text-ink">
              <Lock className="h-3.5 w-3.5 text-muted" /> رمز عبور جدید (اختیاری)
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="خالی بگذارید تا تغییر نکند"
              aria-label="رمز عبور جدید"
              dir="ltr"
              className="w-full rounded-2xl border border-line px-4 py-3 text-left text-[13px] font-bold outline-none transition focus:border-brand"
            />
          </label>
        )}
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700">{error}</p>}
      </div>

      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 text-[13px] font-black text-white transition active:scale-[0.99] disabled:opacity-60"
      >
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" strokeWidth={3} />}
        ذخیره تغییرات
      </button>

      {c.isGuest && (
        <button type="button" onClick={() => { close(); c.logout(); }} className="mt-2 w-full rounded-2xl bg-[#f4f3f0] py-3 text-[12px] font-black text-ink">
          ورود / ثبت‌نام برای ذخیره دائمی
        </button>
      )}
    </Sheet>
  );
}

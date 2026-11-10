import { useState } from "react";
import {
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
  TicketPercent,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { Empty, pd, ScreenHeader, Sheet } from "../components/ui";
import { api } from "../api/client";
import type { AppCtx } from "../ctx";
import type { User } from "../data";
import { discountCodes, faNum } from "../data";

export function AccountView({ c }: { c: AppCtx }) {
  const fullName = [c.user?.firstName, c.user?.lastName]
    .filter(Boolean)
    .join(" ");
  const name = fullName || (c.isGuest ? "کاربر مهمان" : "کاربر ناز");
  const phone = c.user?.phone ? pd(c.user.phone) : "بدون شماره";

  const rows: {
    icon: typeof Heart;
    label: string;
    desc?: string;
    pill?: string;
    pillCls?: string;
    sheet?: string;
    action?: () => void;
  }[] = [
    {
      icon: ReceiptText,
      label: "تاریخچه سفارش‌ها",
      desc: "خریدهای تکمیل‌شده و لغوشده",
      action: () => c.openSub({ name: "order-history" }),
    },
    {
      icon: UserRound,
      label: "مشخصات حساب",
      desc: "نام، نام خانوادگی و رمز عبور",
      pill: "ویرایش",
      pillCls: "bg-[#f4f3f0] text-ink",
      sheet: "profile",
    },
    {
      icon: Users,
      label: "دعوت دوستان",
      desc: "اشتراک‌گذاری کد و لینک دعوت",
      pill: "دعوت",
      pillCls: "bg-brand-soft text-brand-dark",
      sheet: "invite",
    },
    {
      icon: Wallet,
      label: "کیف پول",
      desc: `موجودی: ${faNum(c.wallet)} تومان`,
      sheet: "wallet",
    },
    {
      icon: Heart,
      label: "کالاهای مورد علاقه‌ی من",
      desc: `${pd(c.favorites.length)} کالا`,
      action: () => c.openSub({ name: "favorites" }),
    },
    {
      icon: TicketPercent,
      label: "کدهای تخفیف من",
      action: () => c.openSub({ name: "account-detail", id: "codes" }),
    },
    {
      icon: MessageSquareText,
      label: "نظرات من",
      action: () => c.openSub({ name: "account-detail", id: "reviews" }),
    },
    {
      icon: ReceiptText,
      label: "مبالغ سفارش‌ها",
      action: () => c.openSub({ name: "account-detail", id: "payments" }),
    },
    { icon: Headphones, label: "پشتیبانی", sheet: "support" },
    { icon: Info, label: "قوانین و مقررات", sheet: "rules" },
    { icon: ShieldCheck, label: "حریم خصوصی", sheet: "privacy" },
  ];

  return (
    <div className="fade-rise mx-auto min-h-dvh w-full max-w-3xl pb-24 md:pb-16">
      <div className="border-b border-line bg-white px-5 pb-2 pt-5">
        <h2 className="text-[17px] font-black text-ink">حساب کاربری</h2>
        <button
          type="button"
          onClick={() => c.setSheet("profile")}
          aria-label="ویرایش پروفایل"
          className="mt-3 flex w-full items-center gap-3 pb-3 text-right transition hover:opacity-80"
        >
          <span
            className="flex shrink-0 items-center justify-center rounded-full border-2 border-line bg-brand-soft text-brand"
            style={{ height: 52, width: 52 }}
          >
            <UserRound className="h-6 w-6" />
          </span>
          <span className="flex-1">
            <span className="block text-[16px] font-black text-ink">
              {name}
            </span>
            <span
              className="mt-0.5 block text-[12px] font-medium text-muted"
              dir="ltr"
              style={{ textAlign: "right" }}
            >
              {phone}
            </span>
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

      <div className="mt-3 border-y border-line bg-white lg:mx-4 lg:rounded-[24px] lg:border">
        {rows.map((row) => (
          <button
            key={row.label}
            type="button"
            onClick={() =>
              row.action ? row.action() : row.sheet && c.setSheet(row.sheet)
            }
            className="flex w-full items-center gap-3 border-b border-line px-4 py-4 text-right transition last:border-0 hover:bg-[#fffaf6] active:bg-brand-soft/40"
          >
            <row.icon
              className="shrink-0 text-ink"
              strokeWidth={1.8}
              style={{ height: 22, width: 22 }}
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[13.5px] font-extrabold text-ink">
                {row.label}
              </span>
              {row.desc && (
                <span className="mt-0.5 block text-[11px] font-medium text-muted">
                  {row.desc}
                </span>
              )}
            </span>
            {row.pill && (
              <span
                className={`shrink-0 rounded-full px-3 py-1.5 text-[10.5px] font-black ${row.pillCls}`}
              >
                {row.pill}
              </span>
            )}
          </button>
        ))}
        <button
          type="button"
          onClick={c.logout}
          className="flex w-full items-center gap-3 px-4 py-4 text-right transition hover:bg-red-50/60"
        >
          <LogOut
            className="shrink-0 text-ink"
            strokeWidth={1.8}
            style={{ height: 22, width: 22 }}
          />
          <span className="flex-1 text-[13.5px] font-extrabold text-ink">
            {c.isGuest ? "ورود به حساب" : "خروج"}
          </span>
        </button>
      </div>
      <p className="px-4 pt-4 text-[10px] font-medium text-muted lg:px-5">
        نسخه ۲.۰.۰ ·{" "}
        {c.isGuest
          ? "حالت مهمان (ذخیره روی این دستگاه)"
          : "حساب متصل به سرور ناز مارکت"}
      </p>
    </div>
  );
}

export function AccountSheetHost({ c }: { c: AppCtx }) {
  const [shareFallback, setShareFallback] = useState(false);
  const sheet = c.sheet;
  if (!sheet) return null;
  const close = () => c.setSheet(null);
  const copy = (t: string) => {
    try {
      navigator.clipboard?.writeText(t);
    } catch {
      /* ignore */
    }
    c.toast("کپی شد");
  };
  const referralCode = c.user?.id
    ? `NAZ-${c.user.id}`
    : c.user?.phone
      ? `NAZ-${c.user.phone}`
      : "NAZ-NAZARABAD";
  const referralLink = `${window.location.origin}/?ref=${encodeURIComponent(referralCode)}`;
  const referralMessage = `با لینک من از ناز مارکت خرید کن؛ کد دعوت ${referralCode}: ${referralLink}`;
  const shareReferral = async () => {
    const shareApi = navigator as Navigator & {
      share?: (data: {
        title?: string;
        text?: string;
        url?: string;
      }) => Promise<void>;
    };
    try {
      if (shareApi.share && window.isSecureContext) {
        await shareApi.share({
          title: "دعوت به ناز مارکت",
          text: referralMessage,
          url: referralLink,
        });
        setShareFallback(false);
      } else {
        setShareFallback(true);
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError"))
        setShareFallback(true);
    }
  };

  switch (sheet) {
    case "invite":
      return (
        <Sheet title="دعوت دوستان" onClose={close}>
          <div className="rounded-3xl bg-gradient-to-l from-[#eaf4ee] to-[#f5f8f5] p-5 text-center">
            <Gift className="mx-auto h-10 w-10 text-brand" />
            <p className="mt-3 text-[14px] font-black text-ink">
              با هر دعوت موفق، هر دو نفر تخفیف می‌گیرید!
            </p>
            <p className="mx-auto mt-1.5 max-w-64 text-[11px] font-medium leading-5 text-muted">
              کد دعوت خود را برای دوستانتان در نظرآباد بفرستید؛ بعد از اولین
              خرید آن‌ها، کد تخفیف به حساب شما اضافه می‌شود.
            </p>
            <div className="mx-auto mt-4 flex max-w-72 items-center gap-2 rounded-2xl bg-white p-2 shadow-sm">
              <span
                dir="ltr"
                className="flex-1 text-[12px] font-black tracking-wider text-ink"
              >
                {referralCode}
              </span>
              <button
                type="button"
                onClick={() => copy(referralCode)}
                className="flex items-center gap-1 rounded-xl bg-brand-soft px-3 py-2 text-[11px] font-black text-brand-dark"
              >
                <Copy className="h-3.5 w-3.5" /> کپی کد
              </button>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => copy(referralLink)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-white px-3 py-3 text-[11px] font-bold text-ink"
            >
              <Copy className="h-4 w-4" /> کپی لینک دعوت
            </button>
            <button
              type="button"
              onClick={shareReferral}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-3 py-3 text-[11px] font-black text-white"
            >
              <Users className="h-4 w-4" /> اشتراک‌گذاری
            </button>
          </div>
          {shareFallback && (
            <div className="mt-3 rounded-2xl border border-line bg-[#f8faf8] p-3">
              <p className="mb-2 text-[10px] font-bold text-muted">
                ارسال با یکی از برنامه‌ها
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    label: "واتساپ",
                    href: `https://wa.me/?text=${encodeURIComponent(referralMessage)}`,
                  },
                  {
                    label: "تلگرام",
                    href: `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(`کد دعوت من ${referralCode}`)}`,
                  },
                  {
                    label: "پیامک",
                    href: `sms:?body=${encodeURIComponent(referralMessage)}`,
                  },
                ].map((app) => (
                  <a
                    key={app.label}
                    href={app.href}
                    target={app.label === "پیامک" ? undefined : "_blank"}
                    rel="noreferrer"
                    className="rounded-xl bg-white px-2 py-2.5 text-center text-[11px] font-black text-brand-dark shadow-sm"
                  >
                    {app.label}
                  </a>
                ))}
              </div>
            </div>
          )}
        </Sheet>
      );
    case "wallet":
      return (
        <Sheet title="کیف پول ناز مارکت" onClose={close}>
          <div className="rounded-3xl bg-ink p-5 text-white">
            <p className="text-[11px] font-bold text-white/55">
              موجودی ثبت‌شده
            </p>
            <p className="mt-1 text-[24px] font-black">
              {faNum(c.wallet)} تومان
            </p>
          </div>
          <p className="mt-4 rounded-2xl bg-[#f4f3f0] p-3 text-[11px] font-medium leading-5 text-muted">
            افزایش اعتبار کیف پول تا زمان اتصال درگاه پرداخت غیرفعال است. این
            موجودی برای پرداخت سفارش‌ها استفاده نمی‌شود.
          </p>
        </Sheet>
      );
    case "support":
      return (
        <Sheet title="پشتیبانی ناز مارکت" onClose={close}>
          <div className="space-y-2.5 text-[12px] font-semibold leading-6 text-muted">
            <p>
              تیم پشتیبانی ناز مارکت هر روز از ساعت ۷ صبح تا ۱۲ شب پاسخ‌گوی
              شماست.
            </p>
            <p>
              برای ارتباط مستقیم با پشتیبانی با یکی از شماره‌های زیر تماس
              بگیرید:
            </p>
            {["09935377426", "09905312639"].map((number) => (
              <a
                key={number}
                href={`tel:${number}`}
                className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3.5 text-ink transition hover:border-brand/40"
              >
                <Phone className="h-5 w-5 shrink-0 text-brand" />
                <span className="flex-1 text-left font-black" dir="ltr">
                  {pd(number)}
                </span>
                <span className="text-[10px] font-bold text-brand">تماس</span>
              </a>
            ))}
            <button
              type="button"
              onClick={() =>
                c.toast("گفت‌وگوی آنلاین با اتصال بک‌اند فعال می‌شود")
              }
              className="flex w-full items-center gap-3 rounded-2xl border border-line p-3.5 text-ink"
            >
              <MessageSquareText className="h-5 w-5 shrink-0 text-brand" />
              <span className="font-black">گفت‌وگوی آنلاین</span>
            </button>
          </div>
        </Sheet>
      );
    case "profile":
      return <ProfileSheet c={c} close={close} />;
    case "rules":
      return (
        <Sheet title="قوانین و مقررات" onClose={close}>
          <div className="space-y-3 text-[12px] font-medium leading-6 text-muted">
            <p>
              ۱. سفارش‌ها فقط در محدوده‌ی شهرستان نظرآباد (شهر نظرآباد،
              بیجارآباد و سیدجمال‌الدین) تحویل داده می‌شوند.
            </p>
            <p>
              ۲. در صورت ناموجود بودن کالا، مبلغ آن به کیف پول شما بازگردانده
              می‌شود یا کالای جایگزین با هماهنگی پیشنهاد می‌گردد.
            </p>
            <p>
              ۳. امکان لغو سفارش تا پیش از شروع آماده‌سازی توسط فروشگاه وجود
              دارد.
            </p>
            <p>
              ۴. هزینه ارسال براساس مسافت و وزن، در شرایط عادی ۵۰ تا ۸۰ هزار
              تومان و در باران و برف حداکثر ۱۰۰ هزار تومان محاسبه می‌شود.
            </p>
          </div>
        </Sheet>
      );
    case "privacy":
      return (
        <Sheet title="حریم خصوصی" onClose={close}>
          <div className="space-y-3 text-[12px] font-medium leading-6 text-muted">
            <p>
              ناز مارکت اطلاعات شخصی شما (شماره تماس و آدرس) را فقط برای پردازش
              و تحویل سفارش استفاده می‌کند و آن را با اشخاص ثالث به اشتراک
              نمی‌گذارد.
            </p>
            <p>می‌توانید هر زمان درخواست حذف حساب و اطلاعات خود را ثبت کنید.</p>
          </div>
        </Sheet>
      );
    default:
      return null;
  }
}

export function AccountDetailPage({
  c,
  kind,
}: {
  c: AppCtx;
  kind: "codes" | "payments" | "reviews";
}) {
  const title =
    kind === "codes"
      ? "کدهای تخفیف من"
      : kind === "payments"
        ? "مبالغ سفارش‌ها"
        : "نظرات من";
  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text);
    c.toast("کد تخفیف کپی شد");
  };
  return (
    <div className="fade-rise mx-auto min-h-dvh w-full max-w-3xl pb-24 md:pb-12">
      <ScreenHeader title={title} onBack={() => c.closeSub()} />
      {kind === "codes" && (
        <div className="space-y-3 p-4">
          {discountCodes.length === 0 ? (
            <Empty
              icon={TicketPercent}
              title="کد تخفیف فعالی ندارید"
              desc="کدهای معتبر فروشگاه پس از تعریف و فعال‌سازی توسط فروشنده، اینجا نمایش داده می‌شوند."
            />
          ) : (
            discountCodes.map((d) => (
              <article
                key={d.code}
                className="flex items-center gap-3 rounded-3xl border border-line bg-white p-4 shadow-sm"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                  <TicketPercent className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-black text-ink">{d.title}</p>
                  <p className="mt-1 text-[10.5px] font-medium text-muted">
                    {d.desc} · ویژهٔ {d.storeName}
                  </p>
                  <p
                    dir="ltr"
                    className="mt-1 text-left text-[11px] font-black tracking-wider text-brand"
                  >
                    {d.code} ·{" "}
                    {d.kind === "percent"
                      ? `${d.amount}٪`
                      : `${faNum(d.amount)} تومان`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => copy(d.code)}
                    className="rounded-lg bg-[#f4f3f0] px-3 py-1.5 text-[10px] font-black text-ink"
                  >
                    کپی کد
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      c.openSub({ name: "store", id: d.storeId });
                      c.toast(
                        "پس از افزودن کالا، کد را در مرحلهٔ تسویه وارد کنید.",
                      );
                    }}
                    className="rounded-lg bg-brand px-3 py-1.5 text-[10px] font-black text-white"
                  >
                    فروشگاه
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      )}
      {kind === "payments" &&
        (c.orders.length ? (
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {c.orders.map((o) => (
              <article
                key={o.id}
                className="overflow-hidden rounded-3xl border border-line bg-white shadow-sm"
              >
                <div className="flex items-start gap-3 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                    <ReceiptText className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-black text-ink">
                      {o.storeName}
                    </p>
                    <p className="mt-1 text-[10px] font-medium text-muted">
                      سفارش ناز-{pd(o.id.replace("NM-", ""))} · {o.time}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#f4f3f0] px-2 py-1 text-[9px] font-bold text-muted">
                    {o.payment === "cash"
                      ? "پرداخت در محل · ثبت‌نشده"
                      : "درگاه پرداخت متصل نیست"}
                  </span>
                </div>
                <div className="mx-4 flex items-center justify-between border-t border-line py-3">
                  <span className="text-[10px] font-bold text-muted">
                    مبلغ سفارش
                  </span>
                  <span className="rounded-xl bg-brand-soft px-3 py-2 text-[13px] font-black text-brand-dark">
                    {faNum(o.total)} تومان
                  </span>
                </div>
                <div className="h-1 bg-brand" />
              </article>
            ))}
          </div>
        ) : (
          <Empty
            icon={ReceiptText}
            title="پرداختی ثبت نشده"
            desc="پرداخت‌های سفارش‌های شما در این صفحه نمایش داده می‌شوند."
          />
        ))}
      {kind === "reviews" && (
        <Empty
          icon={MessageSquareText}
          title="هنوز نظری ثبت نکرده‌اید"
          desc="پس از دریافت سفارش، می‌توانید تجربه‌ی خود را برای فروشگاه و کالاها ثبت کنید."
        />
      )}
    </div>
  );
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
        c.updateUser({
          ...(c.user ?? { phone: "", firstName: "", lastName: "" }),
          firstName: first.trim(),
          lastName: last.trim(),
        } as User);
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
        <p className="text-[10.5px] font-bold text-muted">
          شماره موبایل (نام کاربری)
        </p>
        <p
          className="mt-1 text-[13px] font-black text-ink"
          dir="ltr"
          style={{ textAlign: "right" }}
        >
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
              <Lock className="h-3.5 w-3.5 text-muted" /> رمز عبور جدید
              (اختیاری)
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
        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700">
            {error}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 text-[13px] font-black text-white transition active:scale-[0.99] disabled:opacity-60"
      >
        {busy ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Check className="h-4 w-4" strokeWidth={3} />
        )}
        ذخیره تغییرات
      </button>

      {c.isGuest && (
        <button
          type="button"
          onClick={() => {
            close();
            c.logout();
          }}
          className="mt-2 w-full rounded-2xl bg-[#f4f3f0] py-3 text-[12px] font-black text-ink"
        >
          ورود / ثبت‌نام برای ذخیره دائمی
        </button>
      )}
    </Sheet>
  );
}

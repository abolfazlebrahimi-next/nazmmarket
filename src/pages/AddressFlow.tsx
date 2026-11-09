import { useState } from "react";
import { CheckCircle2, ChevronLeft, LoaderCircle, LocateFixed, MapPin, MoreVertical, Plus, Trash2, X } from "lucide-react";
import MapPicker from "../components/MapPicker";
import { pd, toEn } from "../components/ui";
import type { AppCtx } from "../ctx";
import type { Address } from "../data";

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=fa&lat=${lat}&lon=${lng}`);
    const j = (await r.json()) as { address?: Record<string, string> };
    const a = j.address ?? {};
    const parts = [a.road || a.pedestrian, a.neighbourhood || a.suburb, a.city || a.town || a.village, a.county].filter(Boolean);
    return parts.length ? parts.slice(0, 3).join("، ") : "";
  } catch {
    return "";
  }
}

const coordsLabel = (lat: number, lng: number) => `مختصات: ${pd(lat.toFixed(5))}، ${pd(lng.toFixed(5))}`;

/** Address selection — map + saved addresses list (full screen mobile / modal on desktop) */
export function AddressSelect({ c }: { c: AppCtx }) {
  const [locating, setLocating] = useState(false);
  const saveCurrentLocation = () => {
    if (!navigator.geolocation) return c.toast("موقعیت مکانی در این مرورگر در دسترس نیست");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      c.setPickedPin({ lat, lng });
      const fallback = `مختصات ${lat.toFixed(5)}، ${lng.toFixed(5)}`;
      const label = await reverseGeocode(lat, lng);
      const address: Address = {
        id: Date.now(),
        title: "موقعیت فعلی",
        address: label || fallback,
        detail: "ثبت‌شده با موقعیت مکانی",
        phone: c.user?.phone || c.addresses[0]?.phone || "",
        type: "home", lat, lng,
      };
      c.setPickedLabel(address.address);
      c.setAddresses([...c.addresses, address]);
      c.setSelectedAddressId(address.id);
      setLocating(false);
      c.toast("موقعیت فعلی به آدرس‌ها اضافه شد");
    }, () => {
      setLocating(false);
      c.toast("دریافت موقعیت ناموفق بود؛ دسترسی مکان را بررسی کنید");
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  };
  const confirm = () => {
    c.closeSub();
    if (c.subReturn === "checkout") c.openSub({ name: "checkout" });
  };

  const removeAddress = (id: number) => {
    const next = c.addresses.filter((a) => a.id !== id);
    c.setAddresses(next);
    if (c.selectedAddressId === id && next.length) c.setSelectedAddressId(next[0].id);
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="relative shrink-0">
        <MapPicker
          marker={c.pickedPin}
          onPick={(p) => {
            c.setPickedPin(p);
            c.setPickedLabel(coordsLabel(p.lat, p.lng));
            reverseGeocode(p.lat, p.lng).then((label) => {
              if (label) c.setPickedLabel(label);
            });
          }}
          height="h-[34dvh] lg:h-80"
        />
        <button
          type="button"
          onClick={() => c.closeSub()}
          aria-label="بازگشت"
          className="absolute bottom-4 right-4 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink shadow-lg transition active:scale-90"
        >
          <X className="h-4.5 w-4.5" />
        </button>
      </div>

      <div className="relative z-10 -mt-5 flex flex-1 flex-col rounded-t-[26px] bg-white px-5 pb-6 pt-3 shadow-[0_-12px_30px_-18px_rgba(0,0,0,0.35)] lg:overflow-y-auto app-scroll">
        <div className="mx-auto h-1 w-10 rounded-full bg-line" />
        <h2 className="mt-3 text-center text-[16px] font-black text-ink">انتخاب آدرس</h2>
        <button type="button" onClick={saveCurrentLocation} disabled={locating} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-soft px-4 py-3 text-[12px] font-black text-brand-dark transition active:scale-[0.99] disabled:opacity-60">
          {locating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
          {locating ? "در حال ثبت موقعیت..." : "ثبت موقعیت فعلی با یک لمس"}
        </button>

        {c.pickedPin && (
          <div className="fade-rise mt-4 rounded-2xl border border-brand/30 bg-brand-soft/70 p-3">
            <p className="flex items-start gap-2 text-[11.5px] font-extrabold leading-5 text-ink">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 fill-brand text-brand" />
              <span className="min-w-0 flex-1">{c.pickedLabel || "در حال دریافت نشانی..."}</span>
              <button type="button" onClick={() => { c.setPickedPin(null); c.setPickedLabel(""); }} aria-label="حذف نقطه انتخابی" className="text-muted transition hover:text-brand">
                <X className="h-4 w-4" />
              </button>
            </p>
            <button
              type="button"
              onClick={() => c.openSub({ name: "address-form" })}
              className="mt-2.5 w-full rounded-xl bg-brand py-2.5 text-[11.5px] font-black text-white transition active:scale-[0.98]"
            >
              ثبت این نقطه به عنوان آدرس جدید
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => c.openSub({ name: "address-form" })}
          className="mt-4 flex w-full items-center gap-2 rounded-2xl border border-line px-4 py-3.5 text-right transition hover:border-brand/50 active:scale-[0.99]"
        >
          <Plus className="h-5 w-5 text-brand" strokeWidth={2.6} />
          <span className="flex-1 text-[13px] font-black text-brand">افزودن آدرس جدید</span>
          <ChevronLeft className="h-4.5 w-4.5 text-brand" />
        </button>

        <div className="mt-3 space-y-2.5">
          {c.addresses.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => c.setSelectedAddressId(a.id)}
              aria-pressed={c.selectedAddressId === a.id}
              className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-right transition ${c.selectedAddressId === a.id ? "border-ink bg-[#fbfaf8]" : "border-line bg-white"}`}
            >
              <MapPin className={`h-5 w-5 shrink-0 ${c.selectedAddressId === a.id ? "fill-ink text-ink" : "text-muted"}`} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-black text-ink">{a.title}</span>
                <span className="mt-0.5 block truncate text-[11px] font-medium text-muted">
                  {a.address}، {a.detail}
                </span>
              </span>
              {c.selectedAddressId === a.id && <CheckCircle2 className="h-5 w-5 shrink-0 text-mint" />}
              <MoreVertical className="h-4.5 w-4.5 shrink-0 text-muted" />
            </button>
          ))}
          {c.addresses.length > 1 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {c.addresses.map((a) => (
                <button key={`rm-${a.id}`} type="button" onClick={() => removeAddress(a.id)} className="inline-flex items-center gap-1 rounded-lg bg-[#f4f3f0] px-2.5 py-1.5 text-[10px] font-bold text-muted transition hover:bg-red-50 hover:text-red-500">
                  <Trash2 className="h-3 w-3" /> حذف «{a.title}»
                </button>
              ))}
            </div>
          )}
        </div>

        <button type="button" onClick={confirm} className="mt-auto w-full rounded-2xl bg-[#f4f3f0] py-4 pt-4 text-[13px] font-black text-ink transition hover:bg-line active:scale-[0.99]">
          تایید و ادامه
        </button>
      </div>
    </div>
  );
}

/** Address details form — map pin + fields */
export function AddressForm({ c }: { c: AppCtx }) {
  const [title, setTitle] = useState<"home" | "work">("home");
  const [addr, setAddr] = useState(c.pickedLabel.startsWith("مختصات") ? "" : c.pickedLabel);
  const [detail, setDetail] = useState("");
  const [phone, setPhone] = useState(c.user?.phone ? pd(c.user.phone) : "");
  const [saving, setSaving] = useState(false);

  const saveAddr = async () => {
    if (!addr.trim() && !c.pickedPin) return c.toast("نشانی را کامل وارد کنید");
    setSaving(true);
    const a: Address = {
      id: Date.now(),
      title: title === "home" ? "خانه" : "محل کار",
      address: addr.trim() || c.pickedLabel || "محل انتخاب‌شده روی نقشه",
      detail: detail.trim() || "—",
      phone: toEn(phone).replace(/\D/g, "") || c.user?.phone || "",
      type: title,
      lat: c.pickedPin?.lat,
      lng: c.pickedPin?.lng,
    };
    setSaving(false);
    c.setAddresses([...c.addresses, a]);
    c.setSelectedAddressId(a.id);
    c.setPickedPin(null);
    c.setPickedLabel("");
    c.openSub({ name: "address" });
    c.toast("آدرس جدید ذخیره شد");
  };

  return (
    <div className="min-h-dvh bg-white lg:min-h-0">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <button type="button" onClick={() => c.openSub({ name: "address" })} aria-label="بازگشت" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f3f0] transition active:scale-90">
          <X className="h-4.5 w-4.5" />
        </button>
        <h2 className="flex-1 text-[15px] font-black text-ink">جزئیات آدرس</h2>
      </div>

      <div className="mx-auto max-w-2xl px-5 pb-10 pt-4">
        <div className="overflow-hidden rounded-3xl border border-line">
          <MapPicker
            marker={c.pickedPin}
            onPick={(p) => {
              c.setPickedPin(p);
              c.setPickedLabel(coordsLabel(p.lat, p.lng));
              reverseGeocode(p.lat, p.lng).then((label) => {
                if (label) c.setPickedLabel(label);
              });
            }}
            height="h-[38dvh] lg:h-64"
            hint={false}
          />
        </div>

        <label className="mt-6 block text-[13px] font-black text-ink" htmlFor="addr-text">نشانی</label>
        <textarea
          id="addr-text"
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
          rows={3}
          placeholder="مثلاً: نظرآباد، خیابان شهید بهشتی، کوچه شهید رجایی"
          className="mt-2 w-full resize-none rounded-2xl border border-line px-4 py-3 text-[13px] font-semibold outline-none transition focus:border-brand"
        />

        <label className="mt-5 block text-[13px] font-black text-ink" htmlFor="addr-detail">جزئیات آدرس</label>
        <input
          id="addr-detail"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="پلاک، واحد، طبقه"
          className="mt-2 w-full rounded-2xl border border-line px-4 py-3.5 text-[13px] font-semibold outline-none transition focus:border-brand"
        />

        <p className="mt-5 text-[13px] font-black text-ink">
          عنوان آدرس <span className="text-[11px] font-medium text-muted">(اختیاری)</span>
        </p>
        <div className="mt-2 flex gap-2">
          {([
            { key: "home", label: "خانه" },
            { key: "work", label: "محل کار" },
          ] as const).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTitle(t.key)}
              aria-pressed={title === t.key}
              className={`rounded-full px-4 py-2.5 text-[12px] font-extrabold transition ${title === t.key ? "bg-ink text-white" : "border border-line bg-white text-ink"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <label className="mt-5 block text-[13px] font-black text-ink" htmlFor="addr-phone">موبایل تحویل گیرنده</label>
        <input
          id="addr-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          dir="ltr"
          placeholder="۰۹۹۵۳۷۴۲۶"
          className="mt-2 w-full rounded-2xl border border-line px-4 py-3.5 text-right text-[13px] font-semibold outline-none transition focus:border-brand"
        />

        <button
          type="button"
          onClick={saveAddr}
          disabled={saving}
          className="mt-7 w-full rounded-2xl bg-brand py-4 text-[14px] font-black text-white shadow-lg shadow-brand/30 transition enabled:active:scale-[0.99] disabled:opacity-60"
        >
          {saving ? "در حال ذخیره..." : "تایید و ذخیره"}
        </button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[10.5px] font-semibold text-muted">
          {c.pickedPin ? (
            <>
              <LoaderCircle className="hidden" />
              <MapPin className="h-3.5 w-3.5 text-brand" /> نقطه‌ی انتخابی روی نقشه با ذخیره آدرس ثبت می‌شود
            </>
          ) : (
            "نکته: برای ثبت لوکیشن دقیق، روی نقشه کلیک کنید"
          )}
        </p>
      </div>
    </div>
  );
}

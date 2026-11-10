import { useEffect, useState } from "react";
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { api, type Courier, verifyLabel } from "./api";
function Photos({
  title,
  files,
  onChange,
  multiple = false,
}: {
  title: string;
  files: File[];
  onChange: (f: File[]) => void;
  multiple?: boolean;
}) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const next = files.map((f) => URL.createObjectURL(f));
    setUrls(next);
    return () => next.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);
  const [error, setError] = useState("");
  function choose(fs: File[]) {
    if (
      fs.some(
        (f) =>
          !["image/png", "image/jpeg", "image/webp"].includes(f.type) ||
          f.size > 5 * 1024 * 1024,
      )
    ) {
      setError("هر عکس باید JPG، PNG یا WebP و حداکثر ۵ مگابایت باشد.");
      return;
    }
    onChange((multiple ? [...files, ...fs] : fs).slice(0, multiple ? 4 : 1));
    setError("");
  }
  return (
    <section className="photo-section">
      <h3>{title}</h3>
      <div className="photo-grid">
        {urls.map((u, i) => (
          <div className="photo-thumb" key={u}>
            <img src={u} alt={title + " " + (i + 1)} />
            <button
              type="button"
              aria-label="حذف عکس"
              onClick={() => onChange(files.filter((_, j) => j !== i))}
            >
              <X size={15} />
            </button>
          </div>
        ))}
        {files.length < (multiple ? 4 : 1) && (
          <label
            className="photo-drop"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              choose(Array.from(e.dataTransfer.files));
            }}
          >
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple={multiple}
              onChange={(e) => choose(Array.from(e.target.files || []))}
            />
            <Camera size={26} />
            <b>انتخاب عکس</b>
            <small>یا عکس را اینجا رها کنید</small>
          </label>
        )}
      </div>
      <small>
        تصویر واضح و بدون بازتاب · حداکثر ۵ مگابایت
        {multiple ? " · تا ۴ تصویر" : ""}
      </small>
      {error && <p className="alert error">{error}</p>}
    </section>
  );
}
export default function Verification({
  courier,
  onUpdate,
}: {
  courier: Courier;
  onUpdate: (c: Courier) => void;
}) {
  const [editing, setEditing] = useState(
      courier.verificationStatus === "unsubmitted",
    ),
    [step, setStep] = useState(0),
    [plate, setPlate] = useState(""),
    [nationalId, setNationalId] = useState(""),
    [birthDate, setBirthDate] = useState(""),
    [brand, setBrand] = useState(""),
    [model, setModel] = useState(""),
    [color, setColor] = useState(""),
    [portrait, setPortrait] = useState<File[]>([]),
    [vehicleDocument, setVehicleDocument] = useState<File[]>([]),
    [national, setNational] = useState<File[]>([]),
    [license, setLicense] = useState<File[]>([]),
    [motor, setMotor] = useState<File[]>([]),
    [platePhoto, setPlatePhoto] = useState<File[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const vehicle = `${brand} ${model}، ${color}`;
  useEffect(() => {
    let live = true;
    api("/profile/details")
      .then((r) => {
        if (live && r.profile) {
          setNationalId(r.profile.nationalId);
          setBirthDate(r.profile.birthDate);
          setBrand(r.profile.brand);
          setModel(r.profile.model);
          setColor(r.profile.color);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, []);
  const steps = [
    "اطلاعات و موتور",
    "مدارک هویتی",
    "تصاویر موتور",
    "بررسی و ارسال",
  ];
  const valid =
    step === 0
      ? !!plate.trim() &&
        !!brand.trim() &&
        !!model.trim() &&
        !!color.trim() &&
        /^\d{10}$/.test(nationalId) &&
        !!birthDate
      : step === 1
        ? national.length > 0 && license.length > 0 && portrait.length > 0
        : step === 2
          ? motor.length > 0 &&
            platePhoto.length > 0 &&
            vehicleDocument.length > 0
          : true;
  async function submit() {
    setBusy(true);
    try {
      const b = new FormData();
      b.set("plate", plate);
      b.set("vehicleInfo", vehicle);
      b.set("nationalId", nationalId);
      b.set("birthDate", birthDate);
      b.set("brand", brand);
      b.set("model", model);
      b.set("color", color);
      b.set("portrait", portrait[0]);
      b.set("vehicleDocument", vehicleDocument[0]);
      motor.forEach((f) => b.append("motor", f));
      b.set("national", national[0]);
      b.set("license", license[0]);
      b.set("platePhoto", platePhoto[0]);
      const r = await api("/verification", { method: "POST", body: b });
      onUpdate(r.courier);
      setEditing(false);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className={`verification-status ${courier.verificationStatus}`}>
        <ShieldCheck size={28} />
        <div>
          <b>{verifyLabel[courier.verificationStatus]}</b>
          <p>
            {courier.rejectionReason ||
              "مدارک شما فقط در اختیار مدیریت مجاز است و به‌صورت رمزگذاری‌شده نگهداری می‌شود."}
          </p>
        </div>
        <button
          onClick={async () => {
            try {
              onUpdate((await api("/auth/me")).courier);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          بررسی وضعیت
        </button>
      </div>
      {!editing &&
        ["rejected", "needs_correction"].includes(
          courier.verificationStatus,
        ) && (
          <button
            className="primary"
            onClick={() => {
              setStep(0);
              setEditing(true);
            }}
          >
            اصلاح و ارسال مجدد مدارک
          </button>
        )}
      {courier.verificationStatus === "approved" && !editing && (
        <button
          onClick={() => {
            if (
              window.confirm(
                "با ارسال مدارک اصلاح‌شده، فعالیت متوقف و پرونده دوباره برای تأیید مدیر ارسال می‌شود. تا پایان سفر فعال امکان این کار وجود ندارد.",
              )
            ) {
              setEditing(true);
              setStep(0);
            }
          }}
        >
          درخواست اصلاح اطلاعات و مدارک
        </button>
      )}
      {editing && (
        <section className="panel verification-form">
          <ol className="wizard">
            {steps.map((s, i) => (
              <li key={s} className={i <= step ? "done" : ""}>
                <span>{i < step ? <Check size={14} /> : i + 1}</span>
                <small>{s}</small>
              </li>
            ))}
          </ol>
          {step === 0 && (
            <>
              <h2>مشخصات شما و وسیله نقلیه</h2>
              <div className="form-grid">
                <label>
                  نام و نام خانوادگی
                  <input value={courier.fullName} readOnly />
                </label>
                <label>
                  شماره موبایل
                  <input value={courier.phone} readOnly />
                </label>
                <label>
                  شماره پلاک موتور
                  <input
                    placeholder="مثلاً ۱۲۳ · ۴۵۶۷۸"
                    value={plate}
                    onChange={(e) => setPlate(e.target.value)}
                    maxLength={40}
                  />
                </label>
                <label>
                  کد ملی
                  <input
                    inputMode="numeric"
                    maxLength={10}
                    value={nationalId}
                    onChange={(e) =>
                      setNationalId(
                        e.target.value
                          .replace(/[۰-۹]/g, (d) =>
                            String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)),
                          )
                          .replace(/\D/g, ""),
                      )
                    }
                  />
                </label>
                <label>
                  تاریخ تولد
                  <input
                    type="date"
                    value={birthDate}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setBirthDate(e.target.value)}
                  />
                  <small>تاریخ مطابق تقویم نمایش‌داده‌شدهٔ مرورگر</small>
                </label>
                <label>
                  برند موتور
                  <input
                    value={brand}
                    maxLength={100}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="مثلاً هوندا"
                  />
                </label>
                <label>
                  مدل موتور
                  <input
                    value={model}
                    maxLength={100}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="مثلاً ۱۲۵"
                  />
                </label>
                <label>
                  رنگ موتور
                  <input
                    value={color}
                    maxLength={60}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="مثلاً مشکی"
                  />
                </label>
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <h2>مدارک هویتی خوانا</h2>
              <Photos
                title="تصویر پرسنلی"
                files={portrait}
                onChange={setPortrait}
              />
              <Photos
                title="تصویر کارت ملی"
                files={national}
                onChange={setNational}
              />
              <Photos
                title="تصویر گواهینامه موتور"
                files={license}
                onChange={setLicense}
              />
            </>
          )}
          {step === 2 && (
            <>
              <h2>تصاویر موتور و پلاک</h2>
              <Photos
                title="تصویر مدارک موتور"
                files={vehicleDocument}
                onChange={setVehicleDocument}
              />
              <p className="muted">
                نمای کامل موتور و پلاک خوانا را ثبت کنید. امکان انتخاب چند تصویر
                وجود دارد.
              </p>
              <Photos
                title="عکس‌های موتور"
                multiple
                files={motor}
                onChange={setMotor}
              />
              <Photos
                title="نمای نزدیک پلاک"
                files={platePhoto}
                onChange={setPlatePhoto}
              />
            </>
          )}
          {step === 3 && (
            <>
              <h2>یک بار دیگر بررسی کنید</h2>
              <div className="review-box">
                <p>
                  پلاک: <b>{plate}</b>
                </p>
                <p>
                  وسیله: <b>{vehicle}</b>
                </p>
                <p>
                  {motor.length +
                    national.length +
                    license.length +
                    platePhoto.length +
                    portrait.length +
                    vehicleDocument.length}{" "}
                  تصویر آماده ارسال امن
                </p>
                <small>
                  پس از ارسال، وضعیت «در حال بررسی» می‌شود. امکان فعالیت فقط پس
                  از تأیید مدیریت فراهم است.
                </small>
              </div>
            </>
          )}
          {error && <p className="alert error">{error}</p>}
          <div className="wizard-actions">
            <button
              disabled={step === 0 || busy}
              onClick={() => setStep((s) => s - 1)}
            >
              <ChevronRight size={16} /> مرحله قبل
            </button>
            {step < 3 ? (
              <button
                className="primary"
                disabled={!valid}
                onClick={() => setStep((s) => s + 1)}
              >
                ادامه <ChevronLeft size={16} />
              </button>
            ) : (
              <button
                className="primary"
                disabled={busy}
                onClick={() => void submit()}
              >
                <Upload size={17} />
                {busy ? "در حال ارسال…" : "ارسال برای بررسی مدیریت"}
              </button>
            )}
          </div>
        </section>
      )}
    </>
  );
}

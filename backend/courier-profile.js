export function digits(value) {
  return String(value ?? "")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}
export function validNationalId(value) {
  const id = digits(value);
  if (!/^\d{10}$/.test(id) || /^(\d)\1{9}$/.test(id)) return false;
  const sum = [...id.slice(0, 9)].reduce(
      (n, d, i) => n + Number(d) * (10 - i),
      0,
    ),
    r = sum % 11;
  return Number(id[9]) === (r < 2 ? r : 11 - r);
}
export function validateCourierProfile(body) {
  const nationalId = digits(body.nationalId),
    birthDate = String(body.birthDate ?? ""),
    brand = String(body.brand ?? "")
      .trim()
      .slice(0, 100),
    model = String(body.model ?? "")
      .trim()
      .slice(0, 100),
    color = String(body.color ?? "")
      .trim()
      .slice(0, 60);
  if (!validNationalId(nationalId))
    throw Object.assign(new Error("کد ملی ده‌رقمی معتبر وارد کنید."), {
      status: 400,
      code: "invalid_national_id",
    });
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) ||
    !Number.isFinite(Date.parse(birthDate)) ||
    new Date(birthDate).toISOString().slice(0, 10) !== birthDate ||
    Date.parse(birthDate) >= Date.now()
  )
    throw Object.assign(
      new Error("تاریخ تولد میلادی معتبر و پیش از امروز لازم است."),
      { status: 400, code: "invalid_birth_date" },
    );
  if (!brand || !model || !color)
    throw Object.assign(new Error("برند، مدل و رنگ موتور را تکمیل کنید."), {
      status: 400,
      code: "invalid_vehicle_profile",
    });
  return { nationalId, birthDate, brand, model, color };
}

/**
 * محدودهٔ ارسال پلتفرم: نظرآباد، آبیک و هشتگرد.
 * - سفارشِ خارج از این سه شهر پذیرفته نمی‌شود («خارج از محدوده»).
 * - «پیک‌های خود پلتفرم» فقط سفارش‌های نظرآباد را برمی‌دارند؛ برای آبیک و
 *   هشتگرد فروشنده باید خودش ارسال کند یا سفارش را رد کند.
 */
export const ZONE_CITIES = ["نظرآباد", "آبیک", "هشتگرد"];
export const PLATFORM_CITY = "نظرآباد";

const CENTERS = [
  ["نظرآباد", 35.9548, 50.6042],
  ["آبیک", 36.0396, 50.5292],
  ["هشتگرد", 35.9925, 50.6806],
];
const ZONE_RADIUS_KM = 12;

/** شهر نشانی را از متن یا مختصات حدس می‌زند؛ اگر نامشخص بود null برمی‌گرداند. */
export function resolveCity(text = "", lat = null, lng = null) {
  const t = String(text ?? "");
  for (const city of ZONE_CITIES) if (t.includes(city)) return city;
  const la = Number(lat),
    ln = Number(lng);
  if (Number.isFinite(la) && Number.isFinite(ln)) {
    let best = null;
    let bestD = ZONE_RADIUS_KM;
    for (const [city, clat, clng] of CENTERS) {
      const d = Math.hypot(
        (la - clat) * 111,
        (ln - clng) * 111 * Math.cos((la * Math.PI) / 180),
      );
      if (d <= bestD) {
        best = city;
        bestD = d;
      }
    }
    return best;
  }
  return null;
}

/** شهرهای ناشناخته/خالی برای سازگاری قدیمی مجاز فرض می‌شوند. */
export function isZoneCity(city) {
  const c = String(city ?? "").trim();
  return !c || ZONE_CITIES.includes(c);
}

/** فقط سفارش‌های نظرآباد به «پیک‌های پلتفرم» می‌رسند. */
export function isPlatformCity(city) {
  const c = String(city ?? "").trim();
  return !c || c === PLATFORM_CITY;
}

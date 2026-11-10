export function validPoint(lat, lng) {
  return (
    lat !== null &&
    lat !== undefined &&
    lng !== null &&
    lng !== undefined &&
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lng)) &&
    Math.abs(Number(lat)) <= 90 &&
    Math.abs(Number(lng)) <= 180
  );
}
export function distanceKm(a, b) {
  if (!a || !b || !validPoint(a.lat, a.lng) || !validPoint(b.lat, b.lng))
    return null;
  const rad = (n) => (Number(n) * Math.PI) / 180;
  const dlat = rad(b.lat - a.lat),
    dlng = rad(b.lng - a.lng);
  return (
    6371 *
    2 *
    Math.atan2(
      Math.sqrt(
        Math.sin(dlat / 2) ** 2 +
          Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dlng / 2) ** 2,
      ),
      Math.sqrt(
        Math.max(
          0,
          1 -
            (Math.sin(dlat / 2) ** 2 +
              Math.cos(rad(a.lat)) *
                Math.cos(rad(b.lat)) *
                Math.sin(dlng / 2) ** 2),
        ),
      ),
    )
  );
}
export function deliveryQuote({
  from,
  to,
  weightKg = 0.5,
  weather = "normal",
} = {}) {
  const straight = distanceKm(from, to),
    km = straight === null ? null : Math.round(straight * 1.3 * 100) / 100;
  const minutes = km === null ? 15 : Math.ceil((km / 18) * 60 + 8),
    weight = Math.max(0, Number(weightKg) || 0.5);
  const adverse = ["rain", "snow"].includes(weather);
  const raw =
    50000 +
    (km === null ? 0 : Math.max(0, km - 2) * 2500) +
    Math.max(0, weight - 3) * 1800 +
    Math.max(0, minutes - 20) * 250 +
    (adverse ? 20000 : 0);
  return {
    fee: Math.min(
      adverse ? 100000 : 80000,
      Math.max(50000, Math.ceil(raw / 1000) * 1000),
    ),
    distanceKm: km,
    minutes,
    weightKg: weight,
    weather,
    estimated: true,
    locationMissing: km === null,
    method: "haversine × 1.3; estimated road distance, not live routing",
  };
}
export async function platformSettings(db) {
  const row = await db.get(
    "SELECT value_json FROM platform_settings WHERE id=1",
  );
  try {
    return {
      weather: "normal",
      commissionPercent: 0,
      ...JSON.parse(row?.value_json || "{}"),
    };
  } catch {
    return { weather: "normal", commissionPercent: 0 };
  }
}

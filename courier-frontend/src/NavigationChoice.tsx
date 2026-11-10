import { MapPin, ExternalLink } from "lucide-react";
type Point = { lat: unknown; lng: unknown };
const valid = (p?: Point) =>
  p != null &&
  p.lat != null &&
  p.lng != null &&
  String(p.lat).trim() !== "" &&
  String(p.lng).trim() !== "" &&
  Number.isFinite(Number(p.lat)) &&
  Number.isFinite(Number(p.lng)) &&
  Math.abs(Number(p.lat)) <= 90 &&
  Math.abs(Number(p.lng)) <= 180;
export default function NavigationChoice({
  destination,
  origin,
  label,
}: {
  destination: Point;
  origin?: Point;
  label: string;
}) {
  if (!valid(destination))
    return <span className="muted">مختصات {label} ثبت نشده است.</span>;
  const lat = Number(destination.lat),
    lng = Number(destination.lng),
    end = `${lat},${lng}`;
  const start = valid(origin)
    ? `${Number(origin!.lat)},${Number(origin!.lng)}`
    : null;
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const neshan = start
    ? `${ios ? "neshan://?" : "https://nshn.ir/?"}origin=${start}&destination=${end}&vehicle=m`
    : ios
      ? `neshan://?ll=${end}`
      : `https://nshn.ir/?lat=${lat}&lng=${lng}`;
  const links = [
    {
      name: "Google Maps",
      href: `https://www.google.com/maps/dir/?api=1&destination=${end}&travelmode=driving`,
    },
    { name: "نشان", href: neshan },
    // Balad's public location link opens the destination in Balad. The rider
    // starts guidance there; we never invent a proprietary routing API.
    {
      name: "بلد",
      href: `https://balad.ir/location?latitude=${lat}&longitude=${lng}&zoom=17`,
    },
  ];
  return (
    <details className="navigation-choice">
      <summary>
        <MapPin size={15} />
        مسیریابی {label}
      </summary>
      <div
        className="navigation-apps"
        aria-label={`انتخاب برنامهٔ مسیریابی ${label}`}
      >
        <p>
          مقصد را در برنامهٔ دلخواه باز کنید و مسیریابی را همان‌جا شروع کنید.
        </p>
        {links.map((link) => (
          <a
            key={link.name}
            href={link.href}
            target={link.href.startsWith("https:") ? "_blank" : undefined}
            rel="noopener noreferrer"
          >
            <ExternalLink size={15} />
            {link.name}
          </a>
        ))}
        <small>بازشدن مستقیم اپ به نصب برنامه و تنظیمات گوشی بستگی دارد.</small>
      </div>
    </details>
  );
}

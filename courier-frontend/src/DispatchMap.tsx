import { useEffect, useRef, useState } from "react";
import * as L from "leaflet";
import { LocateFixed, MapPin, Navigation, Store } from "lucide-react";
import "leaflet/dist/leaflet.css";
import type { Courier } from "./api";
type Order = Record<string, any>;
const valid = (lat: unknown, lng: unknown) =>
  lat != null &&
  lng != null &&
  Number.isFinite(Number(lat)) &&
  Number.isFinite(Number(lng)) &&
  Math.abs(Number(lat)) <= 90 &&
  Math.abs(Number(lng)) <= 180;
export default function DispatchMap({
  courier,
  orders,
  onLocate,
  busy,
}: {
  courier: Courier;
  orders: Order[];
  onLocate: () => void;
  busy: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);
  const [failed, setFailed] = useState(false);
  const hasPosition = valid(courier.lat, courier.lng);
  const visible = orders.filter(
    (o) => o.status !== 5 && valid(o.storeLat, o.storeLng),
  );
  const hasPoints = hasPosition || visible.length > 0;
  useEffect(() => {
    if (!host.current || !hasPoints) return;
    const m = L.map(host.current, {
      zoomControl: false,
      scrollWheelZoom: false,
    }).setView([35.96721, 50.65043], 13);
    map.current = m;
    L.control.zoom({ position: "bottomleft" }).addTo(m);
    const tiles = L.tileLayer(
      "https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
      { maxZoom: 19, attribution: "&copy; OpenStreetMap &copy; CARTO" },
    ).addTo(m);
    let errors = 0;
    tiles.on("tileload", () => setFailed(false));
    tiles.on("tileerror", () => {
      errors++;
      if (errors === 3)
        tiles.setUrl("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
      if (errors >= 6) setFailed(true);
    });
    markers.current = L.layerGroup().addTo(m);
    const resize = new ResizeObserver(() => m.invalidateSize());
    resize.observe(host.current);
    requestAnimationFrame(() => m.invalidateSize());
    return () => {
      resize.disconnect();
      m.remove();
      map.current = null;
      markers.current = null;
    };
  }, [hasPoints]);
  useEffect(() => {
    const m = map.current,
      group = markers.current;
    if (!m || !group) return;
    group.clearLayers();
    const points: L.LatLngExpression[] = [];
    const add = (
      lat: unknown,
      lng: unknown,
      label: string,
      css: string,
      symbol: string,
    ) => {
      const point: L.LatLngExpression = [Number(lat), Number(lng)];
      points.push(point);
      const pin = L.marker(point, {
        icon: L.divIcon({
          className: "map-pin-host",
          html: `<span class="map-pin ${css}">${symbol}</span>`,
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        }),
      }).addTo(group);
      // Text node prevents store names/addresses from being interpreted as HTML.
      const text = document.createElement("span");
      text.textContent = label;
      pin.bindTooltip(text);
    };
    if (hasPosition)
      add(courier.lat, courier.lng, "موقعیت ثبت‌شدهٔ شما", "you", "●");
    visible.forEach((o) => {
      add(o.storeLat, o.storeLng, o.storeName, "pickup", "▣");
      if (o.claimedByMe && valid(o.destinationLat, o.destinationLng))
        add(
          o.destinationLat,
          o.destinationLng,
          "مقصد مشتری",
          "destination",
          "⌂",
        );
    });
    if (points.length > 1)
      m.fitBounds(L.latLngBounds(points), { padding: [55, 55], maxZoom: 15 });
    else if (points.length) m.setView(points[0], 14);
  }, [courier.lat, courier.lng, orders, hasPoints]);
  return (
    <section
      className="dispatch-map"
      aria-label="نقشه موقعیت پیک و فروشگاه‌های پیشنهادی"
    >
      {hasPoints ? (
        <div className="dispatch-map-canvas" ref={host} />
      ) : (
        <div className="map-placeholder">
          <div className="map-radar">
            <MapPin size={32} />
          </div>
          <h3>مسیر امروزت از اینجا شروع می‌شود</h3>
          <p>
            با فعال کردن موقعیت، محل شما و فروشگاه‌های پیشنهادی روی نقشه نمایش
            داده می‌شوند.
          </p>
          <button disabled={busy} onClick={onLocate}>
            <LocateFixed size={17} /> فعال‌سازی موقعیت من
          </button>
        </div>
      )}
      <div className="map-caption">
        <span>
          <i className={courier.online ? "online-dot" : "offline-dot"} />
          {courier.online ? "در جست‌وجوی سفارش نزدیک" : "محدودهٔ سفارش‌های شما"}
        </span>
        <span>
          <Store size={14} /> فروشگاه <MapPin size={14} /> موقعیت شما
        </span>
      </div>
      {hasPoints && (
        <button
          className="map-locate"
          disabled={busy}
          onClick={onLocate}
          aria-label="تازه‌سازی موقعیت مکانی"
        >
          <Navigation size={20} />
        </button>
      )}
      {failed && (
        <p className="map-warning" role="status">
          کاشی‌های نقشه در دسترس نیستند؛ اطلاعات سفارش‌ها در کارت‌های پایین قابل
          مشاهده است.
        </p>
      )}
      {hasPoints && (
        <small className="map-note">نقاط واقعی؛ مسیریابی زنده نیست</small>
      )}
    </section>
  );
}

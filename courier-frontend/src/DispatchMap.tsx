import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as L from "leaflet";
import {
  LocateFixed,
  MapPin,
  Navigation,
  RefreshCw,
  WifiOff,
} from "lucide-react";
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
const providers = [
  {
    name: "OpenStreetMap",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap",
  },
  {
    name: "CARTO Voyager",
    url: "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap &copy; CARTO",
  },
];
// An explicitly labelled coordinate grid, not invented roads, when tile services
// are unreachable. Leaflet markers/zoom still work at their actual coordinates.
function coordinateGrid() {
  class CoordinatesLayer extends L.GridLayer {
    createTile(coords: L.Coords) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 256;
      const c = canvas.getContext("2d")!;
      c.fillStyle = "#e5eee8";
      c.fillRect(0, 0, 256, 256);
      c.strokeStyle = "#c3d6cb";
      c.lineWidth = 1;
      for (let i = 0; i <= 256; i += 64) {
        c.beginPath();
        c.moveTo(i, 0);
        c.lineTo(i, 256);
        c.moveTo(0, i);
        c.lineTo(256, i);
        c.stroke();
      }
      const lng = (coords.x / 2 ** coords.z) * 360 - 180;
      const lat =
        (Math.atan(Math.sinh(Math.PI * (1 - (2 * coords.y) / 2 ** coords.z))) *
          180) /
        Math.PI;
      c.font = "11px sans-serif";
      c.fillStyle = "#729580";
      c.fillText(`${lat.toFixed(3)}°, ${lng.toFixed(3)}°`, 10, 20);
      return canvas;
    }
  }
  return new CoordinatesLayer({
    tileSize: 256,
    attribution: "نمای مختصات — بدون اطلاعات خیابان",
  });
}
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
  const host = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null),
    markers = useRef<L.LayerGroup | null>(null),
    fitKey = useRef("");
  const [provider, setProvider] = useState(0),
    [retry, setRetry] = useState(0),
    [state, setState] = useState<"loading" | "ready" | "coordinates">(
      "loading",
    );
  const hasPosition = valid(courier.lat, courier.lng);
  const visible = orders.filter(
    (o) => o.status !== 5 && valid(o.storeLat, o.storeLng),
  );
  const hasPoints = hasPosition || visible.length > 0;
  useLayoutEffect(() => {
    if (!host.current) return;
    const defaultLat = Number(import.meta.env.VITE_MAP_DEFAULT_LAT) || 35.96721,
      defaultLng = Number(import.meta.env.VITE_MAP_DEFAULT_LNG) || 50.65043;
    const m = L.map(host.current, {
      zoomControl: false,
      scrollWheelZoom: false,
    }).setView(
      hasPosition
        ? [Number(courier.lat), Number(courier.lng)]
        : visible.length
          ? [Number(visible[0].storeLat), Number(visible[0].storeLng)]
          : [defaultLat, defaultLng],
      hasPoints ? 14 : 13,
    );
    map.current = m;
    L.control.zoom({ position: "bottomleft" }).addTo(m);
    // Keep a truthful coordinate base visible during slow tile loads/provider changes.
    coordinateGrid().addTo(m);
    markers.current = L.layerGroup().addTo(m);
    const observer = new ResizeObserver(() =>
      m.invalidateSize({ pan: false, debounceMoveend: true }),
    );
    observer.observe(host.current);
    const raf = requestAnimationFrame(() => m.invalidateSize({ pan: false }));
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      m.remove();
      map.current = null;
      markers.current = null;
      fitKey.current = "";
    };
  }, []);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    let disposed = false,
      loaded = false,
      failures = 0;
    setState("loading");
    const config = providers[provider];
    const tiles = L.tileLayer(config.url, {
      maxZoom: 19,
      attribution: config.attribution,
      crossOrigin: true,
    }).addTo(m);
    let fallback: L.GridLayer | null = null;
    const fail = () => {
      if (disposed || loaded) return;
      if (provider === 0) {
        setProvider(1);
        return;
      }
      if (!fallback) {
        m.removeLayer(tiles);
        fallback = coordinateGrid().addTo(m);
        setState("coordinates");
      }
    };
    const timer = setTimeout(fail, 10000);
    tiles.on("tileload", () => {
      if (!disposed) {
        loaded = true;
        clearTimeout(timer);
        setState("ready");
      }
    });
    tiles.on("tileerror", () => {
      if (++failures >= 3) fail();
    });
    return () => {
      disposed = true;
      clearTimeout(timer);
      m.removeLayer(tiles);
      if (fallback) m.removeLayer(fallback);
    };
  }, [provider, retry]);
  useLayoutEffect(() => {
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
      const p: L.LatLngExpression = [Number(lat), Number(lng)];
      points.push(p);
      const text = document.createElement("span");
      text.textContent = label;
      L.marker(p, {
        icon: L.divIcon({
          className: "map-pin-host",
          html: `<span class="map-pin ${css}">${symbol}</span>`,
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        }),
      })
        .addTo(group)
        .bindTooltip(text);
    };
    if (hasPosition)
      add(courier.lat, courier.lng, "موقعیت ثبت‌شدهٔ شما", "you", "●");
    visible
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .forEach((o) => {
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
    // A location update or reordered polling response must not reset a map the
    // rider is using. Fit only for changed entities or an explicit locate action.
    const key = JSON.stringify([
      hasPosition ? "you" : null,
      ...visible.map(
        (o) =>
          `${o.id}:${o.claimedByMe && valid(o.destinationLat, o.destinationLng) ? "destination" : "store"}`,
      ),
    ]);
    if (key !== fitKey.current) {
      fitKey.current = key;
      m.invalidateSize({ pan: false });
      if (points.length > 1)
        m.fitBounds(L.latLngBounds(points), {
          padding: [65, 65],
          maxZoom: 15,
          animate: false,
        });
      else if (points.length) m.setView(points[0], 14, { animate: false });
    }
  }, [courier.lat, courier.lng, orders, hasPosition]);
  return (
    <section
      className={`dispatch-map map-${state}`}
      aria-label="نقشه موقعیت سفیر و فروشگاه‌ها"
    >
      <div className="dispatch-map-canvas" ref={host} />
      <div className="map-caption">
        <span>
          <i className={courier.online ? "online-dot" : "offline-dot"} />
          {hasPoints
            ? "موقعیت و سفارش‌های شما"
            : "نمای شهر؛ موقعیت شما هنوز ثبت نشده"}
        </span>
        <span className="map-provider">
          <select
            aria-label="سرویس نقشه"
            value={provider}
            onChange={(e) => setProvider(Number(e.target.value))}
          >
            {providers.map((p, i) => (
              <option value={i} key={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </span>
      </div>
      {!hasPoints && (
        <div className="map-onboarding">
          <MapPin size={20} />
          <span>برای نمایش محدودهٔ واقعی خود، موقعیت را فعال کنید.</span>
          <button
            disabled={busy}
            onClick={() => {
              fitKey.current = "";
              onLocate();
            }}
          >
            <LocateFixed size={15} /> موقعیت من
          </button>
        </div>
      )}
      <button
        className="map-locate"
        disabled={busy}
        onClick={() => {
          fitKey.current = "";
          onLocate();
        }}
        aria-label="تازه‌سازی موقعیت مکانی"
      >
        <Navigation size={20} />
      </button>
      {state === "loading" && (
        <span className="map-loading" role="status">
          در حال دریافت نقشه…
        </span>
      )}
      {state === "coordinates" && (
        <div className="map-warning" role="status">
          <WifiOff size={16} />
          <span>
            سرویس خیابان‌ها در دسترس نیست؛ فقط شبکهٔ مختصات و نقاط واقعی نمایش
            داده می‌شود.
          </span>
          <button
            onClick={() => {
              setProvider(0);
              setRetry((n) => n + 1);
            }}
          >
            <RefreshCw size={14} />
            تلاش مجدد
          </button>
        </div>
      )}
      <small className="map-note">
        {state === "coordinates"
          ? "شبکهٔ مختصات؛ بدون خیابان"
          : "نقشهٔ خیابان‌ها؛ بدون مسیریابی زنده"}
      </small>
    </section>
  );
}

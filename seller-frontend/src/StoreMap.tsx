import { useEffect, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
export default function StoreMap({
  lat,
  lng,
  onPick,
}: {
  lat: string;
  lng: string;
  onPick: (lat: string, lng: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null),
    marker = useRef<L.CircleMarker | null>(null),
    pick = useRef(onPick);
  pick.current = onPick;
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    const m = L.map(host.current).setView(
      [Number(lat) || 35.96721, Number(lng) || 50.65043],
      14,
    );
    map.current = m;
    const layer = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      { maxZoom: 19, attribution: "&copy; OpenStreetMap" },
    ).addTo(m);
    let errors = 0;
    layer.on("tileload", () => setError(false));
    layer.on("tileerror", () => {
      errors++;
      if (errors === 3)
        layer.setUrl("https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png");
      if (errors >= 6) setError(true);
    });
    m.on("click", (e) =>
      pick.current(e.latlng.lat.toFixed(6), e.latlng.lng.toFixed(6)),
    );
    const observer = new ResizeObserver(() => m.invalidateSize());
    observer.observe(host.current);
    requestAnimationFrame(() => m.invalidateSize());
    return () => {
      observer.disconnect();
      m.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);
  useEffect(() => {
    if (!map.current || !lat || !lng) return;
    const p: L.LatLngExpression = [Number(lat), Number(lng)];
    if (!marker.current)
      marker.current = L.circleMarker(p, {
        radius: 10,
        color: "#16865b",
        fillOpacity: 0.8,
      }).addTo(map.current);
    else marker.current.setLatLng(p);
    map.current.panTo(p);
  }, [lat, lng]);
  return (
    <div className="store-map-wrap">
      <p>موقعیت فروشگاه را روی نقشه انتخاب کنید</p>
      <div
        ref={host}
        style={{
          height: 290,
          width: "100%",
          position: "relative",
          borderRadius: 14,
          zIndex: 0,
        }}
      />
      {error && (
        <p className="map-error">
          سرویس نقشه در شبکه شما در دسترس نیست. مختصات را دستی وارد کنید یا از
          دکمه موقعیت من استفاده کنید.
        </p>
      )}
    </div>
  );
}

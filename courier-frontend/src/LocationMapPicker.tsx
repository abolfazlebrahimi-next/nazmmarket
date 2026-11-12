import { useEffect, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * انتخاب موقعیت روی نقشه — بدون نیاز به GPS مرورگر (در iframe/HTTP هم کار می‌کند).
 * روی نقشه بزنید یا مکان را جست‌وجو کنید؛ onPick مختصات را برمی‌گرداند.
 */
export type LatLng = { lat: number; lng: number };

const NAZARBAD: LatLng = { lat: 35.96721, lng: 50.65043 };

const pinIcon = L.divIcon({
  className: "",
  html: `<div><svg width="34" height="46" viewBox="0 0 34 46" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3))"><path d="M17 1C8.2 1 1 8.2 1 17c0 11.8 16 28 16 28s16-16.2 16-28C33 8.2 25.8 1 17 1z" fill="#16865b" stroke="#fff" stroke-width="2"/><circle cx="17" cy="16.5" r="6" fill="#fff"/></svg></div>`,
  iconSize: [34, 46],
  iconAnchor: [17, 46],
});

type Result = { id: number; label: string; lat: number; lng: number };

export default function LocationMapPicker({
  marker,
  onPick,
  height = 300,
}: {
  marker: LatLng | null;
  onPick: (p: LatLng) => void;
  height?: number;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const mRef = useRef<L.Marker | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);
  const [openResults, setOpenResults] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");

  useEffect(() => {
    if (!boxRef.current || mapRef.current) return;
    const map = L.map(boxRef.current, { zoomControl: true }).setView(
      [NAZARBAD.lat, NAZARBAD.lng],
      14,
    );
    const tiles = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      { attribution: "&copy; OpenStreetMap", maxZoom: 19 },
    ).addTo(map);
    let fallback = false,
      errors = 0;
    tiles.on("tileload", () => {});
    tiles.on("tileerror", () => {
      errors++;
      if (!fallback && errors >= 3) {
        fallback = true;
        tiles.setUrl("https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png");
      }
    });
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(boxRef.current);
    requestAnimationFrame(() => map.invalidateSize());
    map.on("click", (e: L.LeafletMouseEvent) =>
      onPickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }),
    );
    mapRef.current = map;
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      mRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (marker) {
      if (!mRef.current) {
        mRef.current = L.marker([marker.lat, marker.lng], {
          icon: pinIcon,
          draggable: true,
        }).addTo(map);
        mRef.current.on("dragend", () => {
          const ll = mRef.current?.getLatLng();
          if (ll) onPickRef.current?.({ lat: ll.lat, lng: ll.lng });
        });
        map.setView([marker.lat, marker.lng], Math.max(map.getZoom(), 16));
      } else {
        mRef.current.setLatLng([marker.lat, marker.lng]);
        map.panTo([marker.lat, marker.lng]);
      }
    } else if (mRef.current) {
      mRef.current.remove();
      mRef.current = null;
    }
  }, [marker?.lat, marker?.lng]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setBusy(false);
      return;
    }
    setBusy(true);
    const t = window.setTimeout(async () => {
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=fa&countrycodes=ir&q=${encodeURIComponent(q)}`,
        );
        const j = (await r.json()) as {
          place_id: number;
          display_name: string;
          lat: string;
          lon: string;
        }[];
        setResults(
          j.map((x) => ({
            id: x.place_id,
            label: x.display_name.split(",").slice(0, 3).join("، ").trim(),
            lat: parseFloat(x.lat),
            lng: parseFloat(x.lon),
          })),
        );
      } catch {
        setResults([]);
      } finally {
        setBusy(false);
      }
    }, 500);
    return () => window.clearTimeout(t);
  }, [query]);

  const locate = () => {
    if (!navigator.geolocation) {
      setGeoError("مرورگر از موقعیت مکانی پشتیبانی نمی‌کند؛ روی نقشه بزنید.");
      return;
    }
    setLocating(true);
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        onPickRef.current?.(p);
        mapRef.current?.flyTo([p.lat, p.lng], 17);
      },
      () => {
        setLocating(false);
        setGeoError(
          "موقعیت خودکار در دسترس نیست (اجازهٔ مرورگر یا اتصال امن)؛ روی نقشه بزنید یا مکان را جست‌وجو کنید.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div style={{ position: "relative", width: "100%", height }}>
      <div
        ref={boxRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          right: 10,
          zIndex: 1000,
          display: "flex",
          gap: 8,
        }}
      >
        <div style={{ position: "relative", flex: 1 }}>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpenResults(true);
            }}
            placeholder="جست‌وجوی محله، خیابان و…"
            aria-label="جست‌وجو در نقشه"
            style={{
              width: "100%",
              height: 42,
              borderRadius: 14,
              border: "1px solid #d8ded9",
              background: "#fff",
              padding: "0 12px",
              fontSize: 12,
              fontWeight: 700,
              boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
              outline: "none",
            }}
          />
          {openResults && (busy || results.length > 0) && (
            <div
              style={{
                marginTop: 6,
                background: "#fff",
                borderRadius: 14,
                border: "1px solid #d8ded9",
                boxShadow: "0 10px 24px rgba(0,0,0,0.14)",
                overflow: "hidden",
              }}
            >
              {busy && results.length === 0 && (
                <p style={{ margin: 0, padding: "10px 12px", fontSize: 11 }}>
                  در حال جست‌وجو…
                </p>
              )}
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setQuery(r.label);
                    setOpenResults(false);
                    onPickRef.current?.({ lat: r.lat, lng: r.lng });
                    mapRef.current?.flyTo([r.lat, r.lng], 17);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "right",
                    padding: "10px 12px",
                    fontSize: 11.5,
                    fontWeight: 700,
                    border: 0,
                    borderBottom: "1px solid #eef1ee",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={locate}
          aria-label="موقعیت من"
          style={{
            height: 42,
            padding: "0 14px",
            borderRadius: 14,
            border: "1px solid #d8ded9",
            background: "#fff",
            color: "#16865b",
            fontWeight: 800,
            fontSize: 12,
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
            whiteSpace: "nowrap",
          }}
        >
          {locating ? "…" : "موقعیت من"}
        </button>
      </div>
      {geoError && (
        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: 12,
            right: 12,
            zIndex: 1000,
            background: "#fff7ed",
            border: "1px solid #fcd9a4",
            color: "#92400e",
            borderRadius: 12,
            padding: "8px 12px",
            fontSize: 10.5,
            fontWeight: 700,
            lineHeight: 1.9,
          }}
        >
          {geoError}
        </div>
      )}
    </div>
  );
}

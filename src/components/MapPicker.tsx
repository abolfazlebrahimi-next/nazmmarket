import { useEffect, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LoaderCircle, LocateFixed, MapPin, Search, X } from "lucide-react";
import type { LatLng } from "../ctx";

const NAZARBAD: LatLng = { lat: 35.96721, lng: 50.65043 };

const pinIcon = L.divIcon({
  className: "nz-pin",
  html: `<div><svg width="34" height="46" viewBox="0 0 34 46" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3))"><path d="M17 1C8.2 1 1 8.2 1 17c0 11.8 16 28 16 28s16-16.2 16-28C33 8.2 25.8 1 17 1z" fill="#ff4d00" stroke="#fff" stroke-width="2"/><circle cx="17" cy="16.5" r="6" fill="#fff"/></svg></div>`,
  iconSize: [34, 46],
  iconAnchor: [17, 46],
});

type Result = { id: number; label: string; lat: number; lng: number };

export default function MapPicker({
  marker,
  onPick,
  height = "h-[42dvh]",
  hint = true,
}: {
  marker: LatLng | null;
  onPick?: (p: LatLng) => void;
  height?: string;
  hint?: boolean;
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

  /* init map once */
  useEffect(() => {
    if (!boxRef.current || mapRef.current) return;
    const map = L.map(boxRef.current, { zoomControl: false }).setView([NAZARBAD.lat, NAZARBAD.lng], 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap", maxZoom: 19 }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => onPickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      mRef.current = null;
    };
  }, []);

  /* marker sync */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (marker) {
      if (!mRef.current) {
        mRef.current = L.marker([marker.lat, marker.lng], { icon: pinIcon, draggable: true }).addTo(map);
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

  /* address search (Nominatim) */
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
        const j = (await r.json()) as { place_id: number; display_name: string; lat: string; lon: string }[];
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
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        onPickRef.current?.(p);
        mapRef.current?.flyTo([p.lat, p.lng], 17);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <div className={`relative w-full overflow-hidden ${height}`}>
      <div ref={boxRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute left-1/2 top-[74px] z-10 -translate-x-1/2">
        {hint && !marker && (
          <span className="rounded-xl bg-ink/85 px-3.5 py-2 text-[10.5px] font-black text-white shadow-lg backdrop-blur">
            برای انتخاب محل تحویل سفارش، روی نقشه کلیک کنید
          </span>
        )}
      </div>

      <div className="absolute inset-x-3 top-3 z-20">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpenResults(true);
              }}
              placeholder="جستجوی محله، خیابان و ..."
              aria-label="جستجو در نقشه"
              className="h-11 w-full rounded-2xl border border-line bg-white pl-9 pr-10 text-[12px] font-bold shadow-md outline-none transition focus:border-brand"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setOpenResults(false);
                }}
                aria-label="پاک کردن جستجو"
                className="absolute left-2 top-1/2 -translate-y-1/2 text-muted"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={locate}
            aria-label="موقعیت من"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-brand shadow-md transition active:scale-95"
          >
            {locating ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <LocateFixed className="h-5 w-5" />}
          </button>
        </div>

        {openResults && (busy || results.length > 0) && (
          <div className="mt-1.5 overflow-hidden rounded-2xl border border-line bg-white shadow-xl">
            {busy && results.length === 0 && <p className="px-4 py-3 text-[11px] font-bold text-muted">در حال جستجو در نقشه...</p>}
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
                className="flex w-full items-center gap-2 border-b border-line px-3.5 py-3 text-right text-[11.5px] font-bold text-ink transition last:border-0 hover:bg-brand-soft"
              >
                <MapPin className="h-4 w-4 shrink-0 text-brand" />
                <span className="truncate">{r.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

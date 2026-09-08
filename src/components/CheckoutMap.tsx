import { useState, useEffect, useRef } from "react";
import { Navigation } from "lucide-react";

const BRAND = "#C8102E";

async function ensureLeafletCSS() {
  if (!document.querySelector('link[href*="leaflet"]')) {
    const link = document.createElement("link");
    link.rel  = "stylesheet";
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(link);
    await new Promise(r => setTimeout(r, 300));
  }
}

function makePinIcon(L: any, color = BRAND) {
  return L.divIcon({
    html: `<div style="background:${color};width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>`,
    iconSize: [26, 26], iconAnchor: [13, 26],
  });
}

interface CheckoutMapProps {
  shopLat: number;
  shopLng: number;
  initialLat?: number | null;
  initialLng?: number | null;
  /** Called immediately when coordinates change (pin drag, click, or GPS fix). */
  onCoordsChange: (lat: number, lng: number) => void;
  /** Called asynchronously once reverse-geocoding resolves. */
  onAddressChange: (address: string) => void;
}

export default function CheckoutMap({
  shopLat, shopLng,
  initialLat, initialLng,
  onCoordsChange,
  onAddressChange,
}: CheckoutMapProps) {
  const [locating, setLocating] = useState(false);
  const mapDivRef  = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<any>(null);
  const markerRef  = useRef<any>(null);

  /* Init map on mount; destroy on unmount */
  useEffect(() => {
    let mounted = true; // guard against completing after unmount

    const timer = setTimeout(async () => {
      if (!mounted || !mapDivRef.current || leafletRef.current) return;
      const L = await import("leaflet");
      await ensureLeafletCSS();
      if (!mounted || !mapDivRef.current) return; // re-check after await

      const initLat = initialLat ?? shopLat;
      const initLng = initialLng ?? shopLng;
      const map = L.map(mapDivRef.current).setView([initLat, initLng], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
      }).addTo(map);
      const marker = L.marker([initLat, initLng], { icon: makePinIcon(L), draggable: true }).addTo(map);
      markerRef.current = marker;
      leafletRef.current = map;

      if (initialLat && initialLng) {
        marker.setLatLng([initialLat, initialLng]);
        map.setView([initialLat, initialLng], 15);
      }

      /* Propagate coords immediately; geocode address async */
      const onMove = (la: number, lo: number) => {
        onCoordsChange(la, lo); // immediate — no waiting on network
        fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${la}&lon=${lo}&format=json&accept-language=ar`
        )
          .then(r => r.json())
          .then(d => { if (mounted) onAddressChange(d.display_name ?? ""); })
          .catch(() => {});
      };

      marker.on("dragend", () => { const p = marker.getLatLng(); onMove(p.lat, p.lng); });
      map.on("click", (e: any) => { marker.setLatLng(e.latlng); onMove(e.latlng.lat, e.latlng.lng); });

      // Reverse-geocode initial coords if provided
      if (initialLat && initialLng) onMove(initialLat, initialLng);
    }, 120);

    return () => {
      mounted = false;
      clearTimeout(timer);
      if (leafletRef.current) {
        leafletRef.current.remove();
        leafletRef.current = null;
        markerRef.current  = null;
      }
    };
  }, []); // run once on mount

  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: la, longitude: lo } = pos.coords;
        // Move pin and propagate coords immediately
        if (markerRef.current && leafletRef.current) {
          markerRef.current.setLatLng([la, lo]);
          leafletRef.current.setView([la, lo], 16);
        }
        onCoordsChange(la, lo); // immediate
        fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${la}&lon=${lo}&format=json&accept-language=ar`
        )
          .then(r => r.json())
          .then(d => onAddressChange(d.display_name ?? ""))
          .catch(() => {})
          .finally(() => setLocating(false));
      },
      () => setLocating(false)
    );
  };

  return (
    <>
      {/* GPS button */}
      <button
        onClick={locate}
        disabled={locating}
        className="w-full py-2.5 rounded-xl border-2 border-dashed font-bold flex items-center justify-center gap-2"
        style={{ borderColor: BRAND, color: BRAND }}
      >
        <Navigation className={`w-4 h-4 ${locating ? "animate-spin" : ""}`} />
        {locating ? "جاري التحديد..." : "📍 استخدام موقعي الحالي"}
      </button>

      {/* Map */}
      <div
        ref={mapDivRef}
        style={{ height: 220, borderRadius: 12, overflow: "hidden" }}
        className="border border-gray-200"
      />

      <p className="text-xs text-gray-400">
        انقر على الخريطة أو اسحب الدبوس لتحديد موقعك بدقة
      </p>
    </>
  );
}

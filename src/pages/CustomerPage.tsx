// @ts-nocheck
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  ShoppingCart,MoreVertical, Plus, Minus, Trash2, MapPin, Navigation,
  X, ChevronLeft, ChevronRight, CheckCircle, Phone, User, Package, Bike, Edit2, Heart,
  ClipboardList
} from "lucide-react";
import CheckoutMap from "@/components/CheckoutMap";
import ItemNote from "@/components/ItemNote";
import BannerSlider from "@/components/BannerSlider";
import {
  getActiveMenuItems, refreshMenuItems, fileToBase64, type MenuItem
} from "@/lib/menuStore";
import { getActiveSections, refreshSections } from "@/lib/sectionStore";
import { getShopSettings, refreshShopSettings, isShopOpen } from "@/lib/settingsStore";
import {
  getCustomerProfile, refreshCustomerProfile, saveCustomerProfile, type CustomerProfile
} from "@/lib/customerStore";
import {
  createOrder, generateOrderId, getOrder,
  getActiveOrderId, refreshActiveOrderId, refreshOrders, isFirstOrderForPhone,
  clearActiveOrderId,
  type StoredOrder, type TrackStatus
} from "@/lib/orderStore";
  import {
  validateCoupon, refreshCoupons, applyCouponUsage, type Coupon
} from "@/lib/couponStore";
import MoreMenu from "@/pages/MoreMenu";
import PhoneLogin from "@/components/PhoneLogin";
import { getCustomer, saveCustomer } from "@/lib/customerAuth";
import { getCustomerOrders, reserveOrderNumber, saveOrderToFirestore } from "@/lib/firestoreCounter";
type CartItem = { item: MenuItem; qty: number ; note?: string };
type Step = "menu" | "cart" | "checkout" | "success" | "more" | "about" | "contact" | "privacy" | "terms" | "login";
const BRAND = "#C8102E";
const BRAND_DARK = "#7A1F1F";
const YELLOW = "#F4B942";
const STORE_LAT = 25.7;
const STORE_LNG = 39.3;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const radius = 6371;
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLng = toRadians(lng2 - lng1);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("966")) return `0${digits.slice(3)}`;
  if (digits.startsWith("5")) return `0${digits}`;
  return digits;
}

const TRACK_STEPS_DELIVERY = [
  "تم استلام الطلب",
  "جاري التحضير",
  "المندوب في الطريق",
  "تم التسليم",
] as const;

const TRACK_STEPS_PICKUP = [
  "تم استلام الطلب",
  "جاري التحضير",
  "جاهز للاستلام",
  "تم التسليم",
] as const;
const TRACK_PROGRESS: Record<string, number> = {
  "تم استلام الطلب": 0,
  "جاري التحضير": 1,
  "جاهز للاستلام": 2,
  "المندوب في الطريق": 2,
  "في الطريق": 2,
  "تم التوصيل": 3,
  "تم التسليم": 3,
  "مرفوض": -1,
};
/* ─── Leaflet init helper ─────────────────────────────────────── */
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

/* ════════════════════════════════════════════════════════════
   REGISTRATION MODAL — top-level component to prevent
   unmount/remount (and keyboard dismissal) on every state change
════════════════════════════════════════════════════════════ */
interface RegModalProps {
  regName: string;
  regPhone: string;
  regLat: number | null;
  regLng: number | null;
  regAddress: string;
  shopLat: number;
  shopLng: number;
  setRegName: (v: string) => void;
  setRegPhone: (v: string) => void;
  setRegLat: (v: number) => void;
  setRegLng: (v: number) => void;
  setRegAddress: (v: string) => void;
  saveRegistration: () => void;
}

function RegModal({
  regName, regPhone, regLat, regLng, regAddress,
  shopLat, shopLng,
  setRegName, setRegPhone, setRegLat, setRegLng, setRegAddress,
  saveRegistration,
}: RegModalProps) {
  const [regLocating, setRegLocating] = useState(false);
  const regMapRef    = useRef<HTMLDivElement>(null);
  const regLeafletRef = useRef<any>(null);
  const regMarkerRef  = useRef<any>(null);

  /* Map init on mount; cleanup on unmount */
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!regMapRef.current || regLeafletRef.current) return;
      const L = await import("leaflet");
      await ensureLeafletCSS();
      const initLat = regLat ?? shopLat;
      const initLng = regLng ?? shopLng;
      const map = L.map(regMapRef.current!).setView([initLat, initLng], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
      }).addTo(map);
      const marker = L.marker([initLat, initLng], { icon: makePinIcon(L, BRAND), draggable: true }).addTo(map);
      regMarkerRef.current = marker; regLeafletRef.current = map;
      if (regLat && regLng) { marker.setLatLng([regLat, regLng]); map.setView([regLat, regLng], 15); }
      const onMove = async (la: number, lo: number) => {
        setRegLat(la); setRegLng(lo);
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${la}&lon=${lo}&format=json&accept-language=ar`);
          const d = await r.json();
          setRegAddress(d.display_name ?? "");
        } catch { /* ignore */ }
      };
      marker.on("dragend", () => { const p = marker.getLatLng(); onMove(p.lat, p.lng); });
      map.on("click", (e: any) => { marker.setLatLng(e.latlng); onMove(e.latlng.lat, e.latlng.lng); });
    }, 200);
    return () => {
      clearTimeout(timer);
      if (regLeafletRef.current) {
        regLeafletRef.current.remove();
        regLeafletRef.current = null;
        regMarkerRef.current = null;
      }
    };
  }, []);

  const locateForReg = () => {
    if (!navigator.geolocation) return;
    setRegLocating(true);
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude: la, longitude: lo } = pos.coords;
      setRegLat(la); setRegLng(lo);
      if (regMarkerRef.current && regLeafletRef.current) {
        regMarkerRef.current.setLatLng([la, lo]);
        regLeafletRef.current.setView([la, lo], 16);
      }
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${la}&lon=${lo}&format=json&accept-language=ar`)
        .then(r => r.json()).then(d => setRegAddress(d.display_name ?? ""))
        .catch(() => {}).finally(() => setRegLocating(false));
    }, () => setRegLocating(false));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="px-5 pt-6 pb-4 border-b border-gray-100">
          <img src={`${import.meta.env.BASE_URL}images/logo.jpg`} alt="تويلف" className="h-20 w-20 rounded-2xl object-cover mx-auto mb-3 shadow" />
          <h2 className="text-xl font-black text-center text-gray-800">مرحباً بك في تويلف شاورما</h2>
          <p className="text-sm text-center text-gray-400 mt-1">سجّل بياناتك لتسريع طلباتك</p>
        </div>

        <div className="p-5 space-y-4">
          {/* Name & Phone */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">الاسم الكامل *</label>
            <input className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-right outline-none focus:border-red-400"
              placeholder="اسمك" value={regName} onChange={e => setRegName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">رقم الجوال *</label>
            <input type="tel" className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-right outline-none focus:border-red-400"
              placeholder="05xxxxxxxx" value={regPhone} onChange={e => setRegPhone(e.target.value)} />
          </div>

          {/* Location — always visible */}
          <div>
            <label className="text-sm font-bold text-gray-700 mb-2 block flex items-center gap-1">
              <MapPin className="w-4 h-4" style={{ color: BRAND }} /> حدد موقعك على الخريطة
            </label>
            <p className="text-xs text-gray-400 mb-2">انقر على الخريطة أو اسحب الدبوس لتحديد موقعك</p>

            {/* GPS button */}
            <button onClick={locateForReg} disabled={regLocating}
              className="w-full mb-2 py-2 rounded-xl border-2 border-dashed text-sm font-bold flex items-center justify-center gap-1"
              style={{ borderColor: BRAND, color: BRAND }}>
              <Navigation className={`w-4 h-4 ${regLocating ? "animate-spin" : ""}`} />
              {regLocating ? "جاري التحديد..." : "📍 استخدام موقعي الحالي"}
            </button>

            {/* Map always visible */}
            <div ref={regMapRef} style={{ height: 220, borderRadius: 12, overflow: "hidden" }}
              className="border border-gray-200" />

            {regAddress && <p className="text-xs text-gray-500 mt-2 line-clamp-2">📌 {regAddress}</p>}
            {regLat && <p className="text-xs text-green-600 mt-1 font-bold">✓ تم تحديد الموقع</p>}
          </div>

          <button onClick={saveRegistration} disabled={!regName.trim() || !regPhone.trim()}
            className="w-full py-4 rounded-xl text-white font-black text-lg disabled:opacity-50"
            style={{ background: `linear-gradient(135deg,${BRAND},${BRAND_DARK})` }}>
            ابدأ الطلب 🍽️
          </button>
        </div>
      </div>
    </div>
  );
}

function MyOrdersView({ orders, onBack, onOpen }: {
  orders: StoredOrder[];
  onBack: () => void;
  onOpen: (order: StoredOrder) => void;
  customerName: string;
  onOrderNow: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="rounded-full bg-white p-2 shadow">
          <ChevronRight className="h-5 w-5" />
        </button>
        <h2 className="text-xl font-black text-gray-800">طلباتي</h2>
      </div>
      {orders.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center text-gray-400 shadow">
          <ClipboardList className="mx-auto mb-3 h-12 w-12 opacity-30" />
          <p>مرحبا {customerName}، لا يوجد طلبات بعد</p>
          <button type="button" onClick={onOrderNow} className="mt-5 rounded-xl px-6 py-3 font-black text-white" style={{ background: BRAND }}>
            اطلب الآن
          </button>
        </div>
      ) : (
        orders.map(order => (
          <button
            type="button"
            key={order.id}
            onClick={() => onOpen(order)}
            className="flex w-full items-center justify-between rounded-2xl bg-white p-4 text-right shadow"
          >
            <div>
              <p className="font-black text-gray-800">طلب {order.orderCode || `#${order.orderNumber || order.id}`}</p>
              <p className="mt-1 text-sm text-gray-500">{order.orderType} · {order.trackStatus}</p>
            </div>
            <div className="font-black" style={{ color: BRAND }}>{order.amount} ر.س</div>
          </button>
        ))
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
export default function CustomerPage() {
  const [menuItems, setMenuItems]       = useState<MenuItem[]>([]);
  const [sections, setSections]         = useState<string[]>([]);
const [activeCategory, setCategory] = useState<string>("");

// هذا يخليه اول ما تفتح الصفحة يختار اول قسم تلقائيا ويصير مرتب
useEffect(() => {
  if (sections.length > 0 &&!activeCategory) {
    setCategory(sections[0]);
  }
}, [sections, activeCategory]);
  const [cart, setCart]                 = useState<CartItem[]>([]);
  const [step, setStep]                 = useState<Step>("menu");
const [showLogin, setShowLogin] = useState(false);
const [showAccountMenu, setShowAccountMenu] = useState(false);
const customerData = JSON.parse(localStorage.getItem("customer") || "null");
  const [settings, setSettings] = useState(getShopSettings());

  // تحديث تلقائي من لوحة التحكم
  useEffect(() => {
    refreshShopSettings().then(s => { if(s) setSettings(s); });
    const handler = () => setSettings(getShopSettings());
    window.addEventListener("dataUpdated", handler);
    const id = setInterval(() => {
      refreshShopSettings().then(s => { if(s) setSettings(s); });
    }, 2000);
    return () => {
      window.removeEventListener("dataUpdated", handler);
      clearInterval(id);
    };
  }, []);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

useEffect(() => {
  const onOnline = () => setIsOffline(false);
  const onOffline = () => setIsOffline(true);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}, []);  /* registration */
  const [profile, setProfile]           = useState<CustomerProfile | null>(null);
const [showRegister, setShowRegister] = useState(false);
  const [regName, setRegName]           = useState("");
  const [regPhone, setRegPhone]         = useState("");
  const [regLat, setRegLat]             = useState<number | null>(null);
  const [regLng, setRegLng]             = useState<number | null>(null);
  const [regAddress, setRegAddress]     = useState("");
  /* checkout */
  const [customer] = useState(() => {
    try { return JSON.parse(localStorage.getItem("customer_current") || "null"); }
    catch { return null; }
  });
  const [name, setName]                 = useState("");
  const [phone, setPhone]               = useState("");
  const [savedAccount, setSavedAccount] = useState<{ name: string; phone: string } | null>(null);
  const [orderType, setOrderType]       = useState<"استلام" | "توصيل">("استلام");
  const [address, setAddress]           = useState("");
  const [notes, setNotes]               = useState("");
  const [lat, setLat]                   = useState<number | null>(null);
  const [lng, setLng]                   = useState<number | null>(null);
  const [payMethod, setPayMethod]       = useState<"كاش" | "شبكة" | "تحويل">("كاش");
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  /* shop status (re-evaluated every minute) */
  const [isOpen, setIsOpen] = useState(() => isShopOpen(getShopSettings()));
  const deliveryDistance = lat !== null && lng !== null
    ? haversineKm(STORE_LAT, STORE_LNG, lat, lng)
    : null;
  const deliveryUnavailable = orderType === "توصيل" && deliveryDistance !== null && deliveryDistance > 15;

  const logoutCustomer = () => {
    ["customer_current", "twelve_customer", "customer", "userName", "userPhone"].forEach(key => localStorage.removeItem(key));
    setSavedAccount(null);
    setProfile(null);
    setName("");
    setPhone("");
    setShowAccountMenu(false);
    window.dispatchEvent(new Event("customer-updated"));
  };

  useEffect(() => {
    if (customer) {
      setName(customer.name);
      setPhone(customer.phone);
    }
  }, []);

  useEffect(() => {
    const loadSavedAccount = () => {
      try {
        const saved = JSON.parse(localStorage.getItem("customer_current") || "null");
        if (saved?.name && saved?.phone) {
          setSavedAccount({ name: saved.name, phone: saved.phone });
          setName(saved.name);
          setPhone(saved.phone);
        } else {
          setSavedAccount(null);
        }
      } catch {
        setSavedAccount(null);
      }
    };
    loadSavedAccount();
    window.addEventListener("customer-updated", loadSavedAccount);
    return () => window.removeEventListener("customer-updated", loadSavedAccount);
  }, []);

  /* coupon */
  const [couponInput, setCouponInput]       = useState("");
  const [couponApplied, setCouponApplied]   = useState<Coupon | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponError, setCouponError]       = useState("");
  const [couponSuccess, setCouponSuccess]   = useState("");
  /* first-order */
  const [foIsFirst, setFoIsFirst]           = useState(false);
  /* tracking */
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [liveOrder, setLiveOrder]         = useState<StoredOrder | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem("favoriteItems") || "[]"); } catch { return []; }
  });
  const [showFavorites, setShowFavorites] = useState(false);
  const [showMyOrders, setShowMyOrders] = useState(false);
  const [myOrders, setMyOrders] = useState<StoredOrder[]>([]);
    // تحديث تلقائي للمنيو والاقسام كل 5 ثواني + الطلبات كل 3 ثواني
  useEffect(() => {
  const loadMenu = async () => {
    const freshItems = await refreshMenuItems();
    const freshSections = await refreshSections();
    await refreshShopSettings();
    await refreshCoupons();
    
    const activeItems = (freshItems || []) as any[];
    const activeSecs = (freshSections || []) as any[];

const filteredSecs = activeSecs
.filter((s: any) => s && s.active !== false)
.map((s: any) => String(s.name || s.title || s.category || s.id || "").trim())
.filter(Boolean);

const filteredItems = activeItems.filter((i: any) => i.active !== false && i.available !== false && filteredSecs.includes(String(i.category || "").trim()));

setMenuItems(filteredItems as any);
const categories = Array.from(new Set([
...filteredSecs,
]));
setSections(categories as any);
    // تحديث حالة الطلب المرفوض
    const savedId = localStorage.getItem("twelve_active_order");
    if (savedId) {
      try {
        const freshOrders = await refreshOrders();
        const found = (freshOrders as any[])?.find((o:any) => o.id === savedId);
        if (found) { (window as any).lastStatus = found.status; setLiveOrder(found); }
      } catch {}
    }
  };
    loadMenu();
    const menuInterval = setInterval(loadMenu, 5000);
    const onOnline = () => { void loadMenu(); };
    window.addEventListener("online", onOnline);
    return () => {
      clearInterval(menuInterval);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  useEffect(() => {
    const loadOrder = async () => {
      await refreshOrders();
      await refreshActiveOrderId();
      const id = getActiveOrderId();
      if (id) {
        setActiveOrderId(id);
        const fresh = getOrder(id);
        if (fresh) setLiveOrder(fresh);
      }
    };
    loadOrder();
    const orderInterval = setInterval(loadOrder, 3000);
    return () => clearInterval(orderInterval);
  }, []);

  /* ── Load data ──────────────────────────────────────────────── */
  const reload = useCallback(async () => {
    const [allItems, allSections, remoteSettings] = await Promise.all([
      refreshMenuItems(),
      refreshSections(),
      refreshShopSettings(),
      refreshCoupons(),
    ]);
const items = (allItems || []).filter((item: any) => item.active !== false && item.available !== false);
    setMenuItems(items);
    const categories = Array.from(new Set([
      ...(allSections || [])
        .filter((section: any) => section && section.active !== false)
        .map((section: any) => String(section.name || section.title || section.category || section.id || "").trim())
        .filter(Boolean),
      ...items.map((item: any) => String(item.category || "").trim()).filter(Boolean),
    ]));
    setSections(categories);
    if (categories.length > 0) {
  setCategory(categories[0]);
}
    setSettings(remoteSettings);
    setIsOpen(isShopOpen(remoteSettings));
  }, []);
  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      await reload();
      if (cancelled) return;

      const p = getCustomerProfile();
      if (!p) {
        setShowRegister(false);
        return;
      }

      setProfile(p);
      prefillFromProfile(p);
      await Promise.all([refreshCustomerProfile(p.phone), refreshOrders(), refreshActiveOrderId(p.phone)]);
      if (cancelled) return;
      const id = getActiveOrderId();
      if (id) {
        const o = getOrder(id);
        if (o && o.adminStatus !== "مكتمل" && o.adminStatus !== "مرفوض") {
          setActiveOrderId(id);
          setLiveOrder(o);
          setStep("success");
        }
      }
    };
    void initialize();
    const onDataUpdated = () => { void reload(); };
    window.addEventListener("twelve-data-updated", onDataUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener("twelve-data-updated", onDataUpdated);
    };
  }, [reload]);

  function prefillFromProfile(p: CustomerProfile) {
    setName(p.name);
    setPhone(p.phone);
    if (p.lat) setLat(p.lat);
    if (p.lng) setLng(p.lng);
    if (p.address) setAddress(p.address);
  }

  /* ── Recheck open/closed every minute ──────────────────────── */
  useEffect(() => {
    const iv = setInterval(() => setIsOpen(isShopOpen(getShopSettings())), 60_000);
    return () => clearInterval(iv);
  }, []);

  /* ── Live order polling ─────────────────────────────────────── */
  useEffect(() => {
    if (!activeOrderId) return;
    const update = async () => {
      await refreshOrders();
      const o = getOrder(activeOrderId);
      if (o) setLiveOrder(o);
    };
    const iv = setInterval(update, 3000);
    const onDataUpdated = () => { void update(); };
    window.addEventListener("twelve-data-updated", onDataUpdated);
    return () => {
      clearInterval(iv);
      window.removeEventListener("twelve-data-updated", onDataUpdated);
    };
  }, [activeOrderId]);

  /* ── Save registration ──────────────────────────────────────── */
  const saveRegistration = async () => {
    if (!regName.trim() || !regPhone.trim()) return;
    const p: CustomerProfile = {
      name: regName.trim(), phone: regPhone.trim(),
      lat: regLat ?? undefined, lng: regLng ?? undefined, address: regAddress || undefined,
    };
    await saveCustomerProfile(p);
    saveCustomer(p.name, p.phone, { lat: p.lat, lng: p.lng, address: p.address });
    setProfile(p);
    prefillFromProfile(p);
localStorage.setItem("twelve_customer", JSON.stringify(p));
localStorage.setItem("luser", JSON.stringify({name: p.name, phone: p.phone}));
localStorage.setItem("user", JSON.stringify({name: p.name, phone: p.phone}));
    setShowRegister(false);
  };

   /* — Cart helpers — FAST — */
  const addToCart = (item: MenuItem) => {
    if (isOffline) {
      alert("لا يمكن الطلب بدون انترنت");
      return;
    }
    setCart(c => {
      const idx = c.findIndex(x => x.item.id === item.id);
      if (idx >= 0) {
        const n = [...c];
        n[idx] = {...n[idx], qty: n[idx].qty + 1 };
        return n;
      }
      return [...c, { item, qty: 1 }];
    });
  };
  const setQty = (id: number, qty: number) => {
    if (qty <= 0) setCart(c => c.filter(x => x.item.id!== id));
    else setCart(c => c.map(x => x.item.id === id? {...x, qty } : x));
  };
  const removeFromCart = (id: number) => setCart(c => c.filter(x => x.item.id!== id));
  const toggleFavorite = (id: number) => {
    setFavoriteIds(prev => {
      const next = prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id];
      localStorage.setItem("favoriteItems", JSON.stringify(next));
      return next;
    });
  };
  const openMyOrders = async () => {
    let registeredPhone = "";
    try {
      const saved = JSON.parse(localStorage.getItem("customer_current") || "null");
      registeredPhone = String(saved?.phone || "").trim();
    } catch {}
    if (!registeredPhone) {
      registeredPhone = String(getCustomer()?.phone || localStorage.getItem("userPhone") || "").trim();
    }
    setMyOrders([]);
    console.log("customerPhone", registeredPhone);
    try {
      const firestoreOrders = await getCustomerOrders(registeredPhone);
      const realtimeOrders = await refreshOrders();
      const matchingRealtimeOrders = Object.values(realtimeOrders).filter(order =>
        normalizePhone(order.customerPhone) === normalizePhone(registeredPhone),
      );
      const allOrders = [...firestoreOrders, ...matchingRealtimeOrders];
      setMyOrders(Array.from(new Map(allOrders.map(order => [order.id, order])).values())
        .sort((a, b) => b.createdAt - a.createdAt));
    } catch (error) {
      console.warn("Firestore orders query failed, using RTDB orders", error);
      const orders = await refreshOrders();
      setMyOrders(Object.values(orders)
        .filter(order => normalizePhone(order.customerPhone) === normalizePhone(registeredPhone))
        .sort((a, b) => b.createdAt - a.createdAt));
    }
    setShowFavorites(false);
    setShowMyOrders(true);
    setStep("menu");
  };
  /* ── Pricing ────────────────────────────────────────────────── */
  const subtotal      = cart.reduce((s, x) => s + x.item.price * x.qty, 0);
  const promoDiscountAmt = settings.promoEnabled
    ? Math.round(subtotal * settings.promoPercent / 100 * 100) / 100
    : 0;
  const foDiscountAmt = foIsFirst && settings.firstOrderDiscountEnabled
    ? Math.round(Math.min(subtotal * settings.firstOrderDiscountPercent / 100, settings.firstOrderDiscountMax) * 100) / 100
    : 0;
  const effectiveSubtotal = Math.max(0, subtotal - promoDiscountAmt - couponDiscount - foDiscountAmt);
  const tax           = Math.round(effectiveSubtotal * 15 / 115 * 100) / 100;
  const delivery      = orderType === "توصيل" ? settings.deliveryFee : 0;
  const grandTotal    = effectiveSubtotal + delivery;
  const cartCount     = cart.reduce((s, x) => s + x.qty, 0);

  /* ── First-order check when phone changes ───────────────────── */
  useEffect(() => {
    if (phone.trim().length >= 9) {
      setFoIsFirst(settings.firstOrderDiscountEnabled && isFirstOrderForPhone(phone.trim()));
    } else {
      setFoIsFirst(false);
    }
  }, [phone, settings.firstOrderDiscountEnabled]);

  /* ── Re-validate coupon when orderType changes ──────────────── */
  useEffect(() => {
    if (!couponApplied) return;
    if (couponApplied.appliesTo === "delivery" && orderType !== "توصيل") {
      clearCoupon();
      setCouponError("الكود ينطبق على التوصيل فقط");
    } else if (couponApplied.appliesTo === "pickup" && orderType !== "استلام") {
      clearCoupon();
      setCouponError("الكود ينطبق على الاستلام من الفرع فقط");
    }
  }, [orderType]);  

  /* ── Coupon helpers ─────────────────────────────────────────── */
  const clearCoupon = () => {
    setCouponInput("");
    setCouponApplied(null);
    setCouponDiscount(0);
    setCouponError("");
    setCouponSuccess("");
  };

  const handleApplyCoupon = () => {
    setCouponError("");
    setCouponSuccess("");
    if (!couponInput.trim()) return;
    const result = validateCoupon(couponInput, phone, subtotal, orderType);
    if (result.valid) {
      setCouponApplied(result.coupon);
      setCouponDiscount(result.discount);
      setCouponSuccess(`✅ تم تطبيق الكود · خصم ${result.discount.toFixed(2)} ر.س`);
    } else {
      setCouponApplied(null);
      setCouponDiscount(0);
      setCouponError(result.error);
    }
  };

  /* ── Place order ────────────────────────────────────────────── */
  const handleReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setReceiptLoading(true);
    try { setReceiptImage(await fileToBase64(file)); } finally { setReceiptLoading(false); }
  };

  const payMethodLabel = payMethod === "كاش" ? "كاش عند الاستلام" : payMethod === "شبكة" ? "شبكة عند الاستلام" : "تحويل بنكي";

  const placeOrder = async () => {
    if (isOffline) {
      alert("لا يمكن الطلب بدون انترنت");
      return;
    }
    if (!name.trim() || !phone.trim()) return;
    if (deliveryUnavailable) return;
    if (payMethod === "تحويل" && !receiptImage) return;
    const id = generateOrderId();
    let orderNumber: number;
    try {
      orderNumber = await reserveOrderNumber();
    } catch (error) {
      console.warn("Firestore counter unavailable, using local fallback", error);
      const fallback = Number(localStorage.getItem("local_order_counter") || "1000") + 1;
      localStorage.setItem("local_order_counter", String(fallback));
      orderNumber = fallback;
    }
    let savedCustomer: any = null;
    try { savedCustomer = JSON.parse(localStorage.getItem("customer_current") || "null"); } catch {}
    saveCustomer(name, phone, { lat: lat ?? undefined, lng: lng ?? undefined, address });
    await saveCustomerProfile({  name: name.trim(), phone: phone.trim(), lat: lat ?? undefined, lng: lng ?? undefined, address });
   const orderData = {
  createdAt: new Date().toISOString(),
  date: new Date().toISOString(),
  timestamp: Date.now(),
  createdAtMs: Date.now(),
    id, orderNumber, orderCode: `#${orderNumber}`, customerName: name.trim(), customerPhone: phone.trim(),
      orderType, area: address, notes,
items: cart.map(x => ({ name: x.item.name, qty: x.qty, price: x.item.price, note: (x as any).note || (x.item as any).note || "" })),
      subtotal, tax, deliveryFee: delivery,
      amount: grandTotal.toFixed(2),
      payMethod: payMethodLabel,
      receiptImage: payMethod === "تحويل" ? receiptImage : null,
      customerNotes: notes || "",
      couponCode:         couponApplied?.code,
      couponDiscount:     couponApplied ? couponDiscount : undefined,
      firstOrderDiscount: foDiscountAmt > 0 ? foDiscountAmt : undefined,
      promoDiscount:      promoDiscountAmt > 0 ? promoDiscountAmt : undefined,
      trackStatus: "جاري التحضير",
      adminStatus: "جديد",
      lat: lat ?? undefined, lng: lng ?? undefined,
    } as StoredOrder;
    try {
      await saveOrderToFirestore(orderData, savedCustomer || { name: name.trim(), phone: phone.trim() });
    } catch (error) {
      console.warn("Firestore order save failed, continuing with RTDB", error);
    }
    await createOrder(orderData);

    if (couponApplied) await applyCouponUsage(couponApplied.id, phone.trim());
    setActiveOrderId(id);
    setLiveOrder(getOrder(id));
    setStep("success");
    setCart([]);
      clearCoupon();
  setFoIsFirst(false);
  };

/* — Filtered items — */
const activeNames = getActiveSections().map(s => String(s.name).trim());
const visibleMenuItems = menuItems.filter(i => activeNames.includes(String(i.category || "").trim()));
const filtered = (showFavorites
? visibleMenuItems.filter(item => favoriteIds.includes(item.id))
: activeCategory
? visibleMenuItems.filter(i => String(i.category || "").trim() === activeCategory)
: visibleMenuItems);
  /* ════════════════════════════════════════════════════════════
     SUCCESS / TRACKING
  ════════════════════════════════════════════════════════════ */
if (step === "success" && liveOrder) {
const isPickup = (liveOrder as any)?.orderType === "استلام" || (liveOrder as any)?.type === "استلام" || (liveOrder as any)?.OrderType === "استلام" || liveOrder?.orderType === "استلام" as any;
const TRACK_STEPS = isPickup ? TRACK_STEPS_PICKUP : TRACK_STEPS_DELIVERY;
    
    if (liveOrder.status === "مرفوض") {
      return (
        <div className="min-h-screen" style={{ background: "#FFFBF5" }}>
          <div className="max-w-md mx-auto p-4">
            <div className="bg-white rounded-2xl shadow p-8 text-center mt-10">
              <div className="text-6xl">❌</div>
              <h2 className="text-2xl font-black text-red-600 mt-4">تم رفض الطلب</h2>
              <p className="text-gray-500 mt-2">نعتذر، المطعم لا يستطيع قبول طلبك حاليا</p>
              <p className="text-xs text-gray-400 mt-1">رقم الطلب: {liveOrder.orderCode || `#${liveOrder.orderNumber || liveOrder.id}`}</p>
              <button
                onClick={() => {
                  localStorage.removeItem("twelve_active_order");
                  window.location.reload();
                }}
                className="mt-6 bg-black text-white px-8 py-3 rounded-full font-bold w-full"
              >
                طلب جديد
              </button>
            </div>
          </div>
        </div>
      );
    }

const statusStr = String((liveOrder as any).trackStatus || "").trim();
  const isRejected = statusStr.includes("مرفوض") || statusStr.includes("رفض");
  
  const baseSteps = isPickup ? TRACK_STEPS_PICKUP : TRACK_STEPS_DELIVERY;
  
  const finalSteps = isRejected ? ["تم استلام الطلب", "مرفوض"] : baseSteps;
  const completedThrough = isRejected ? 1 : (TRACK_PROGRESS[statusStr as any] ?? 0);
    
  return (
      <div className="min-h-screen" style={{ background: "#FFFBF5" }}>
        <header style={{ background: `linear-gradient(135deg,${BRAND},${BRAND_DARK})` }} className="text-white px-4 py-4 shadow-lg">
          <div className="max-w-md mx-auto flex items-center gap-3">
<img src={`${import.meta.env.BASE_URL}images/logo.jpg`} alt="توصيلك" style={{height: "45px", width: "45px", borderRadius: "50%", objectFit: "cover", background: "white"}} />
            <span className="font-black text-xl">تويلف شاورما وفلافل</span>
          </div>
        </header>
        <div className="max-w-md mx-auto p-4 space-y-4">
          <div className="bg-white rounded-2xl shadow p-5 text-center">
            <CheckCircle className="w-14 h-14 mx-auto mb-2" style={{ color: BRAND }} />
            <p className="text-gray-500 text-sm mb-1">رقم طلبك</p>
            <p className="text-2xl font-black" style={{ color: BRAND }}>{liveOrder.orderCode || `#${liveOrder.orderNumber || liveOrder.id}`}</p>
          </div>
          <div className="bg-white rounded-2xl shadow p-5">
            <h3 className="font-bold text-gray-700 mb-4">حالة الطلب</h3>
            <div className="tracking-steps text-base leading-10">
{finalSteps.map((label, i) => {
              const done = i <= completedThrough;
              const active = i === completedThrough + 1;
              const isError = label === "مرفوض";
              return (
                <div key={label} className={`step flex items-center gap-2 ${done ? "done" : ""}`}>
                  <span className="icon text-xl leading-none flex-shrink-0">
{isError ? "✖" : done ? "✔" : "○"}
                  </span>
                  <span className="text font-medium"
style={{ color: isError ? "#f40808" : active ? BRAND : done ? "#333" : "#aaa" }}>
{label}
                  </span>
                  {active && <span className="text-xs leading-5 bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full mr-auto">الآن</span>}
                </div>
              );
            })}
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow p-5">
            <h3 className="font-bold text-gray-700 mb-3">ملخص الطلب</h3>
            {liveOrder.items.map((it, i) => (
              <div key={i} className="flex justify-between text-sm py-1 border-b border-gray-100 last:border-0">
                <span>{it.name} × {it.qty}</span>
                <span className="font-bold">{(it.price * it.qty).toFixed(2)} ر.س</span>
              </div>
            ))}
            <div className="mt-2 space-y-1 text-sm text-gray-500">
              <div className="flex justify-between text-xs text-gray-400"><span>شامل ضريبة 15%</span><span>{liveOrder.tax?.toFixed(2)} ر.س</span></div>
              {liveOrder.deliveryFee > 0 && <div className="flex justify-between"><span>التوصيل</span><span>{liveOrder.deliveryFee?.toFixed(2)} ر.س</span></div>}
            </div>
            <div className="flex justify-between font-black text-lg mt-2 pt-2 border-t">
              <span>الإجمالي</span>
              <span style={{ color: BRAND }}>{liveOrder.amount} ر.س</span>
            </div>
          </div>
          <button onClick={() => { setStep("menu"); setActiveOrderId(null); setLiveOrder(null); }}
            className="w-full py-3 rounded-xl text-white font-bold" style={{ background: BRAND }}>
            طلب جديد
          </button>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════
     CHECKOUT
  ════════════════════════════════════════════════════════════ */
  if (step === "checkout") {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "#FFFBF5" }}>
        {showLogin && <PhoneLogin onClose={() => setShowLogin(false)} />}
{ showRegister && (
          <RegModal
            regName={regName} regPhone={regPhone}
            regLat={regLat} regLng={regLng}
            regAddress={regAddress}
            shopLat={settings.shopLat} shopLng={settings.shopLng}
            setRegName={setRegName} setRegPhone={setRegPhone}
            setRegLat={setRegLat} setRegLng={setRegLng} setRegAddress={setRegAddress}
            saveRegistration={saveRegistration}
          />
        )}
        <header style={{ background: `linear-gradient(135deg,${BRAND},${BRAND_DARK})` }} className="text-white px-4 py-4 shadow-lg sticky top-0 z-10">
          <div className="max-w-md mx-auto flex items-center gap-3">
            <button onClick={() => setStep("cart")}
              className="p-1 rounded-full hover:bg-white/20"><ChevronLeft className="w-6 h-6" /></button>
            <span className="font-black text-xl">إتمام الطلب</span>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto max-w-md mx-auto w-full p-4 space-y-3">

          {/* Personal info */}
          <div className="bg-white rounded-2xl shadow p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-700 flex items-center gap-2">
                <User className="w-5 h-5" style={{ color: BRAND }} /> بياناتك
              </h3>
              {savedAccount && <span className="text-xs font-bold text-green-600">مسجل</span>}
            </div>
            {(customer || savedAccount) && <p className="mb-3 text-sm font-bold text-gray-600">مرحبا {customer?.name || savedAccount?.name}</p>}
            <input className="w-full border border-gray-200 rounded-xl px-4 py-3 mb-3 text-right outline-none focus:border-red-400"
              placeholder="الاسم الكامل *" value={customer?.name || name} readOnly={!!customer || !!savedAccount} onChange={e => setName(e.target.value)} />
            <input type="tel" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right outline-none focus:border-red-400"
              placeholder="رقم الجوال *" value={customer?.phone || phone} readOnly={!!customer || !!savedAccount} onChange={e => setPhone(e.target.value)} />
            {(customer || savedAccount) && <button type="button" onClick={() => setShowLogin(true)} className="mt-2 text-sm font-bold" style={{ color: BRAND_DARK }}>تغيير الحساب</button>}
          </div>

          {/* Coupon code */}
          <div className="bg-white rounded-2xl shadow p-5">
            <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">🏷️ كود الخصم</h3>

            {foIsFirst && (
              <div className="mb-3 p-3 rounded-xl bg-green-50 border border-green-200 text-sm text-green-700 font-bold flex items-center gap-2">
                🎉 تم تطبيق خصم أول طلب تلقائياً · توفير {foDiscountAmt.toFixed(2)} ر.س
              </div>
            )}

            {couponApplied ? (
              <div className="flex items-center justify-between p-3 rounded-xl bg-green-50 border border-green-200">
                <span className="text-green-700 font-bold text-sm">{couponSuccess}</span>
                <button onClick={clearCoupon} className="text-xs text-red-500 font-bold flex-shrink-0 mr-2">إزالة</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-right outline-none focus:border-red-400 text-sm font-bold tracking-wider uppercase"
                  placeholder="أدخل كود الخصم"
                  value={couponInput}
                  onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError(""); }}
                  onKeyDown={e => e.key === "Enter" && handleApplyCoupon()}
                />
                <button onClick={handleApplyCoupon}
                  className="px-5 py-3 rounded-xl text-white font-bold text-sm flex-shrink-0"
                  style={{ background: BRAND }}>
                  تطبيق
                </button>
              </div>
            )}
            {couponError && <p className="text-red-500 text-xs mt-2 font-bold">{couponError}</p>}
          </div>

          {/* Order type */}
          <div className="bg-white rounded-2xl shadow p-5">
            <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5" style={{ color: BRAND }} /> طريقة الاستلام
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {(["استلام", "توصيل"] as const).map(t => (
                <button key={t} onClick={() => setOrderType(t)}
                  className="py-3 rounded-xl font-bold border-2 flex flex-col items-center gap-1"
                  style={{ borderColor: orderType === t ? BRAND : "#eee", background: orderType === t ? BRAND : "#fff", color: orderType === t ? "#fff" : "#555" }}>
                  {t === "استلام" ? <Package className="w-5 h-5" /> : <Bike className="w-5 h-5" />}
                  {t === "استلام" ? "استلام من الفرع" : "توصيل للمنزل"}
                </button>
              ))}
            </div>
          </div>

          {/* Delivery section */}
          {orderType === "توصيل" && (
            <div className="bg-white rounded-2xl shadow p-5 space-y-3">
              <h3 className="font-bold text-gray-700 flex items-center gap-2">
                <MapPin className="w-5 h-5" style={{ color: BRAND }} /> موقع التوصيل
              </h3>

              {/* Self-contained map: GPS button + map + instructions */}
              <CheckoutMap
                shopLat={settings.shopLat}
                shopLng={settings.shopLng}
                initialLat={lat}
                initialLng={lng}
                onCoordsChange={(la, lo) => { setLat(la); setLng(lo); }}
                onAddressChange={(addr) => setAddress(addr)}
              />

              {/* Address field */}
              <input className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right outline-none focus:border-red-400 text-sm"
                placeholder="العنوان (يملأ تلقائياً)" value={address} onChange={e => setAddress(e.target.value)} />

              {deliveryUnavailable && (
                <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
                  التوصيل غير متاح خارج خيبر
                </p>
              )}
            </div>
          )}

          {/* Payment method */}
          <div className="bg-white rounded-2xl shadow p-5 space-y-3">
            <h3 className="font-bold text-gray-700 flex items-center gap-2">
              💳 طريقة الدفع
            </h3>
            <div className={`grid gap-3 ${orderType === "توصيل" ? "grid-cols-3" : "grid-cols-2"}`}>
              {(["كاش", "شبكة"] as const).map(m => (
                <button key={m} onClick={() => setPayMethod(m)}
                  className="py-3 rounded-xl font-bold border-2 flex flex-col items-center gap-1 text-sm"
                  style={{ borderColor: payMethod === m ? BRAND : "#eee", background: payMethod === m ? BRAND : "#fff", color: payMethod === m ? "#fff" : "#555" }}>
                  {m === "كاش" ? "💵" : "💳"}
                  {m === "كاش" ? "كاش عند الاستلام" : "شبكة عند الاستلام"}
                </button>
              ))}
              {orderType === "توصيل" && (
                <button onClick={() => setPayMethod("تحويل")}
                  className="py-3 rounded-xl font-bold border-2 flex flex-col items-center gap-1 text-sm"
                  style={{ borderColor: payMethod === "تحويل" ? BRAND : "#eee", background: payMethod === "تحويل" ? BRAND : "#fff", color: payMethod === "تحويل" ? "#fff" : "#555" }}>
                  🏦 تحويل بنكي
                </button>
              )}
            </div>

            {/* Bank transfer: QR + receipt upload */}
            {payMethod === "تحويل" && (
              <div className="space-y-3 pt-1">
                {settings.qrImage ? (
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-2">امسح الـ QR لإتمام التحويل</p>
                    <img src={settings.qrImage} alt="QR تحويل" className="w-48 h-48 object-contain mx-auto rounded-xl border border-gray-200" />
                  </div>
                ) : (
                  <div className="text-center py-3 text-gray-400 text-sm bg-gray-50 rounded-xl">
                    صورة QR ستُضاف قريباً من إدارة المحل
                  </div>
                )}
                <label className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed cursor-pointer font-bold text-sm
                  ${receiptImage ? "border-green-500 bg-green-50 text-green-700" : "border-gray-300 text-gray-600 hover:border-red-400"}`}>
                  {receiptLoading ? "⏳ جاري الرفع..." : receiptImage ? "✅ تم رفع الإيصال" : "📎 رفع صورة الإيصال *"}
                  <input type="file" accept="image/*" className="hidden" onChange={handleReceipt} />
                </label>
                {!receiptImage && (
                  <p className="text-xs text-red-500 text-center">يجب رفع صورة الإيصال لإتمام الطلب</p>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="bg-white rounded-2xl shadow p-5">
            <textarea className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right outline-none focus:border-red-400 text-sm"
              placeholder="ملاحظات للمطعم (اختياري)..." rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          {/* Bill */}
          <div className="bg-white rounded-2xl shadow p-5">
            <div className="space-y-1.5 text-sm text-gray-600">
              <div className="flex justify-between"><span>مجموع الأصناف</span><span>{subtotal.toFixed(2)} ر.س</span></div>
              {promoDiscountAmt > 0 && (
                <div className="flex justify-between font-bold text-amber-600">
                  <span>خصم العرض (-{settings.promoPercent}%)</span>
                  <span>- {promoDiscountAmt.toFixed(2)} ر.س</span>
                </div>
              )}
              {couponDiscount > 0 && (
                <div className="flex justify-between font-bold text-green-600">
                  <span>خصم كود ({couponApplied?.code})</span>
                  <span>- {couponDiscount.toFixed(2)} ر.س</span>
                </div>
              )}
              {foDiscountAmt > 0 && (
                <div className="flex justify-between font-bold text-green-600">
                  <span>خصم أول طلب (-{settings.firstOrderDiscountPercent}%)</span>
                  <span>- {foDiscountAmt.toFixed(2)} ر.س</span>
                </div>
              )}
              <div className="flex justify-between text-gray-400 text-xs"><span>شامل ضريبة القيمة المضافة 15%</span><span>{tax.toFixed(2)} ر.س</span></div>
              {orderType === "توصيل" && (
                <div className="flex justify-between"><span>رسوم التوصيل</span><span>{settings.deliveryFee.toFixed(2)} ر.س</span></div>
              )}
            </div>
            <div className="flex justify-between font-black text-xl pt-2 mt-2 border-t">
              <span>الإجمالي</span>
              <span style={{ color: BRAND }}>{grandTotal.toFixed(2)} ر.س</span>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t p-4 max-w-md mx-auto w-full">
          <button onClick={placeOrder}
            disabled={
              !name.trim() || !phone.trim() || deliveryUnavailable ||
              (payMethod === "تحويل" && !receiptImage)
            }
            className="w-full py-4 rounded-xl text-white font-black text-lg disabled:opacity-40"
            style={{ background: `linear-gradient(135deg,${BRAND},${BRAND_DARK})` }}>
            تأكيد الطلب · {grandTotal.toFixed(2)} ر.س
          </button>
        </div>
      </div>
    );
  }
  if (step === "more") {
    return (
      <div className="min-h-screen" style={{ background: "#FFFBF5" }}>
        <div className="p-4">
          <button onClick={() => setStep("menu")} className="bg-white px-4 py-2 rounded-full shadow">← رجوع</button>
        </div>
        <MoreMenu />
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════
     CART
  ════════════════════════════════════════════════════════════ */
  if (step === "cart") {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "#FFFBF5" }}>
        {showRegister && (
          <RegModal
            regName={regName} regPhone={regPhone}
            regLat={regLat} regLng={regLng}
            regAddress={regAddress}
            shopLat={settings.shopLat} shopLng={settings.shopLng}
            setRegName={setRegName} setRegPhone={setRegPhone}
            setRegLat={setRegLat} setRegLng={setRegLng} setRegAddress={setRegAddress}
            saveRegistration={saveRegistration}
          />
        )}
        <header style={{ background: `linear-gradient(135deg,${BRAND},${BRAND_DARK})` }} className="text-white px-4 py-4 shadow-lg">
          <div className="max-w-md mx-auto flex items-center gap-3">
            <button onClick={() => setStep("menu")} className="p-1 rounded-full hover:bg-white/20"><ChevronLeft className="w-6 h-6" /></button>
            <span className="font-black text-xl">سلة الطلبات</span>
            <span className="mr-auto text-sm px-3 py-0.5 rounded-full font-bold" style={{ background: YELLOW, color: "#7a1a00" }}>{cartCount} صنف</span>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto max-w-md mx-auto w-full p-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <ShoppingCart className="w-16 h-16 mb-3 opacity-30" /><p>السلة فارغة</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map(({ item, qty }) => (
                <div key={item.id} className="bg-white rounded-2xl shadow p-4 flex items-center gap-3">
                  {item.img
                    ? <img src={item.img} alt={item.name} className="w-16 h-16 object-cover rounded-xl flex-shrink-0" />
                    : <div className="w-16 h-16 rounded-xl flex-shrink-0 flex items-center justify-center text-2xl" style={{ background: "#fff7ed" }}>🍽️</div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{item.name}</p>
                    <p className="text-sm font-bold" style={{ color: BRAND }}>{(item.price * qty).toFixed(2)} ر.س</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setQty(item.id, qty - 1)} className="w-8 h-8 rounded-full flex items-center justify-center border-2"
                      style={{ borderColor: BRAND, color: BRAND }}><Minus className="w-3 h-3" /></button>
                    <span className="w-6 text-center font-bold">{qty}</span>
                    <button onClick={() => setQty(item.id, qty + 1)} className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                      style={{ background: BRAND }}><Plus className="w-3 h-3" /></button>
                    <button onClick={() => removeFromCart(item.id)} className="mr-1 p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                
                  </div>
                  <ItemNote item={item} />
                </div>
              ))}


              {/* Bill summary */}
              <div className="bg-white rounded-2xl shadow p-4">
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex justify-between"><span>مجموع الأصناف</span><span>{subtotal.toFixed(2)} ر.س</span></div>
                  <div className="flex justify-between text-xs text-gray-400"><span>شامل ضريبة القيمة المضافة 15%</span><span>{tax.toFixed(2)} ر.س</span></div>
                  <div className="flex justify-between text-xs text-gray-400 italic">
                    <span>رسوم التوصيل (إن اخترت توصيل)</span><span>{settings.deliveryFee} ر.س</span>
                  </div>
                </div>
                <div className="flex justify-between font-black text-xl pt-2 mt-2 border-t">
                  <span>الإجمالي</span>
                  <span style={{ color: BRAND }}>{subtotal.toFixed(2)}+ ر.س</span>
                </div>
              </div>
            </div>
          )}
        </div>
        {cart.length > 0 && (
          <div className="sticky bottom-0 bg-white border-t p-4 max-w-md mx-auto w-full">
<button 
  onClick={() => {
    if (isOffline) {
      alert("لا يمكن الطلب بدون انترنت");
      return;
    }
    setStep("checkout");
  }}
  disabled={isOffline}
  className="w-full py-4 rounded-xl text-white font-black text-lg disabled:cursor-not-allowed disabled:opacity-50"
  style={{ background: `linear-gradient(135deg,${BRAND},${BRAND_DARK})` }}
>
  إتمام الطلب - {subtotal.toFixed(2)} ر.س
</button>
            
          </div>
        )}
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════
     MENU (main)
  ════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#FFFBF5" }}>
      {showRegister && (
        <RegModal
          regName={regName} regPhone={regPhone}
          regLat={regLat} regLng={regLng}
          regAddress={regAddress}
          shopLat={settings.shopLat} shopLng={settings.shopLng}
          setRegName={setRegName} setRegPhone={setRegPhone}
          setRegLat={setRegLat} setRegLng={setRegLng} setRegAddress={setRegAddress}
          saveRegistration={saveRegistration}
        />
      )}

      {/* Header */}
      <header style={{ background: `linear-gradient(135deg,${BRAND},${BRAND_DARK})` }} className="text-white shadow-lg sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}images/logo.jpg`} alt="تويلف" className="h-10 w-10 rounded-full object-cover bg-white" />
            <div>
              <p className="font-black text-lg leading-tight">تويلف شاورما وفلافل</p>
              <p className="text-xs text-red-200 leading-tight">الروضة، خيبر</p>
            </div>
          </div>
<div className="flex items-center gap-1">

<button onClick={() => setStep("more")} className="relative p-2 rounded-full hover:bg-white/20">
<MoreVertical className="w-7 h-7" />
</button>

<button onClick={() => setStep("cart")} className="relative p-2 rounded-full hover:bg-white/20">
<ShoppingCart className="w-7 h-7" />
{cartCount > 0 && (
<span className="absolute -top-1 -left-1 text-xs font-black w-5 h-5 rounded-full flex items-center justify-center" style={{ background: YELLOW, color: "#7a1a00" }}>{cartCount}</span>
)}
</button>
</div>

{showLogin && <PhoneLogin onClose={() => setShowLogin(false)} />}
 </div>
        {/* Category tabs */}
        <div className="max-w-2xl mx-auto px-4 pb-3">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
{sections.filter((cat:any) => { const name = typeof cat === 'string' ? cat : cat.name; const all = (sections as any[]); const found = all.find ? all.find((s:any)=> (s.name||s)===name) : null; return found ? found.active !== false : true; }).map(cat => (
              <button key={cat} onClick={() => { setShowFavorites(false); setCategory(cat); }}
                className="flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-bold"
                style={{ background: activeCategory === cat ? YELLOW : "rgba(255,255,255,0.2)", color: activeCategory === cat ? "#7a1a00" : "#fff" }}>
                {cat}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Items grid */}
      <main className="flex-1 max-w-2xl mx-auto w-full p-4 pb-20">
        {showMyOrders ? <MyOrdersView
          orders={myOrders}
          customerName={getCustomer()?.name || name || "عميلنا"}
          onBack={() => setShowMyOrders(false)}
          onOrderNow={() => setShowMyOrders(false)}
          onOpen={order => { setLiveOrder(order); setActiveOrderId(order.id); setStep("success"); }}
        /> : <>

        {isOffline && (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-sm font-bold text-amber-800">
            لا يمكن الطلب بدون انترنت، المنيو لفقطلعرض 
          </div>
        )}

        <BannerSlider
          banners={[settings.banners[0], settings.banners[1], settings.banners[2]].filter(Boolean)}
        />

        {/* Closed banner */}
        {!isOpen && (
          <div className="mb-4 rounded-2xl p-4 flex items-center gap-3 shadow"
            style={{ background: "linear-gradient(135deg,#1a1a1a,#3a3a3a)", color: "#fff" }}>
            <span className="text-3xl flex-shrink-0">🔒</span>
            <div>
              <p className="font-black text-base">المحل مغلق حالياً</p>
              <p className="text-xs text-gray-300 mt-0.5">يمكنك تصفح القائمة والعودة لاحقاً عند فتح المحل</p>
            </div>
          </div>
        )}

        {/* Promo banner */}
        {settings.promoEnabled && isOpen && (
          <div className="mb-4 rounded-2xl p-3 flex items-center gap-3 shadow-md"
            style={{ background: `linear-gradient(135deg,${YELLOW},#f59e0b)` }}>
            <span className="text-2xl flex-shrink-0">🎉</span>
            <p className="font-black text-sm" style={{ color: "#7a1a00" }}>
              {settings.promoMessage}
            </p>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <p>لا توجد أصناف في هذا التصنيف</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map(item => {
              const inCart = cart.find(x => x.item.id === item.id);
              return (
                <div key={item.id} className="bg-white rounded-2xl shadow overflow-hidden flex flex-col">
                  {item.img
                    ? <img src={item.img} alt={item.name} className="w-full h-32 object-cover" />
                    : <div className="w-full h-32 flex items-center justify-center text-5xl" style={{ background: "linear-gradient(135deg,#fff7ed,#ffe4e6)" }}>🍽️</div>
                  }
                  <div className="p-3 flex flex-col flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-black text-sm">{item.name}</p>
                      <button
                        type="button"
                        onClick={() => toggleFavorite(item.id)}
                        aria-label={favoriteIds.includes(item.id) ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
                        className="flex-shrink-0 rounded-full p-1"
                      >
                        <Heart className="h-5 w-5" fill={favoriteIds.includes(item.id) ? BRAND_DARK : "none"} style={{ color: favoriteIds.includes(item.id) ? BRAND_DARK : "#9ca3af" }} />
                      </button>
                    </div>
                    {item.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 flex-1">{item.description}</p>}
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-black text-sm" style={{ color: BRAND }}>{item.price} ر.س</span>
                      {!isOpen ? (
                        <span className="text-xs text-gray-400 font-bold">مغلق</span>
                      ) : inCart ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => setQty(item.id, inCart.qty - 1)} disabled={isOffline} className="w-7 h-7 rounded-full flex items-center justify-center border-2 disabled:cursor-not-allowed disabled:opacity-40"
                            style={{ borderColor: BRAND, color: BRAND }}><Minus className="w-3 h-3" /></button>
                          <span className="text-sm font-bold w-5 text-center">{inCart.qty}</span>
                          <button onClick={() => setQty(item.id, inCart.qty + 1)} disabled={isOffline} className="w-7 h-7 rounded-full flex items-center justify-center text-white disabled:cursor-not-allowed disabled:opacity-40"
                            style={{ background: BRAND }}><Plus className="w-3 h-3" /></button>
                        </div>
                      ) : (
                        <button onClick={() => addToCart(item)} disabled={isOffline} className="w-8 h-8 rounded-full flex items-center justify-center text-white disabled:cursor-not-allowed disabled:opacity-40"
                          style={{ background: BRAND }}><Plus className="w-4 h-4" /></button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </>}
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-gray-400 py-4">
        <a href={settings.mapLink} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 hover:text-red-600">
          <MapPin className="w-3 h-3" /> {settings.shopName}
        </a>
      </footer>

      <nav className="fixed bottom-0 left-0 right-0 z-30 h-14 border-t border-[#7A1F1F] shadow-[0_-2px_12px_rgba(0,0,0,0.18)]" style={{ background: `linear-gradient(135deg,${BRAND},${BRAND_DARK})` }} dir="rtl">
        <div className="mx-auto flex h-full max-w-2xl items-stretch justify-around">
          <button
            type="button"
            onClick={() => {
              setShowFavorites(false);
              setShowMyOrders(false);
              setShowRegister(false);
              if (getCustomer()) setShowAccountMenu(prev => !prev);
              else setShowLogin(true);
            }}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-bold text-white hover:text-[#F4B942]"
          >
            <User className="h-5 w-5" />
            <span>{getCustomer()?.name || "حسابي"}</span>
          </button>
          <button
            type="button"
            onClick={() => { setShowMyOrders(false); setShowFavorites(true); setStep("menu"); }}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-bold ${showFavorites ? "text-[#F4B942]" : "text-white hover:text-[#F4B942]"}`}
          >
            <Heart className="h-5 w-5" />
            <span>المفضلة</span>
          </button>
          <button
            type="button"
            onClick={openMyOrders}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-bold ${liveOrder ? "text-white hover:text-[#F4B942]" : "text-white/40"}`}
            disabled={!liveOrder}
          >
            <ClipboardList className="h-5 w-5" />
            <span>طلباتي</span>
          </button>
        </div>
      </nav>

      {showAccountMenu && getCustomer() && (
        <div className="fixed bottom-16 right-4 z-40">
          <button
            type="button"
            onClick={logoutCustomer}
            className="rounded-xl bg-white px-5 py-3 text-sm font-black text-red-600 shadow-lg border border-gray-100"
          >
            تسجيل الخروج
          </button>
        </div>
      )}

      {/* Floating cart */}
      {cartCount > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-20">
          <button onClick={() => setStep("cart")}
            className="text-white font-black px-6 py-3.5 rounded-2xl shadow-xl flex items-center gap-3"
            style={{ background: `linear-gradient(135deg,${BRAND},${BRAND_DARK})` }}>
            <ShoppingCart className="w-5 h-5" />
            <span>عرض السلة</span>
            <span className="px-2 py-0.5 rounded-full text-sm font-black" style={{ background: YELLOW, color: "#7a1a00" }}>{cartCount}</span>
            <span>{subtotal.toFixed(2)}+ ر.س</span>
          </button>
        </div>
      )}      
      
    </div>
  );
}

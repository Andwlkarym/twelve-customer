import { useState, useEffect, useCallback, useRef } from "react";
import { LogOut, MapPin, Phone, CheckCircle2, Package, Volume2, Bell, BellOff } from "lucide-react";
import { refreshOrders, updateBothStatuses, type StoredOrder } from "@/lib/orderStore";
import { getShopSettings, refreshShopSettings } from "@/lib/settingsStore";
import { requestNotificationPermission, subscribeToPush } from "@/lib/pushNotifications";
import { endSession, hasSession, startSession } from "@/lib/authSession";

const DELIVERY_PASS = "0000";
const SESSION_KEY   = "twelve_delivery_session";
const BRAND      = "#C8102E";
const BRAND_DARK = "#8B0000";

/* ══════════════════════════════════════════════════════════════════ */
export default function DeliveryPage() {
  const [authed, setAuthed]       = useState(() => hasSession(SESSION_KEY));
  const [passInput, setPassInput] = useState("");
  const [passError, setPassError] = useState(false);

  const tryLogin = () => {
    if (passInput === DELIVERY_PASS) { startSession(SESSION_KEY); setAuthed(true); }
    else setPassError(true);
  };

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f5f5f5" }}>
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <span className="text-5xl block mb-3">🛵</span>
            <h1 className="text-xl font-black text-gray-800">لوحة المندوب</h1>
            <p className="text-sm text-gray-400">تويلف شاورما</p>
          </div>
          <input type="password"
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-center text-xl tracking-widest outline-none focus:border-red-400 mb-3"
            placeholder="كلمة السر" value={passInput}
            onChange={e => { setPassInput(e.target.value); setPassError(false); }}
            onKeyDown={e => e.key === "Enter" && tryLogin()} maxLength={6} />
          {passError && <p className="text-red-500 text-sm text-center mb-2">كلمة السر غير صحيحة</p>}
          <button onClick={tryLogin} className="w-full py-3 rounded-xl text-white font-black text-lg"
            style={{ background: BRAND }}>دخول</button>
        </div>
      </div>
    );
  }
  return <DeliveryDashboard onLogout={() => { endSession(SESSION_KEY); setAuthed(false); }} />;
}

/* ══════════════════════════════════════════════════════════════════ */
function DeliveryDashboard({ onLogout }: { onLogout: () => void }) {
  const [orders, setOrders]           = useState<StoredOrder[]>([]);
  const [modalOrder, setModalOrder]   = useState<StoredOrder | null>(null);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const [pushStatus, setPushStatus]   = useState<"idle" | "granted" | "denied" | "unsupported">("idle");
const [tick, setTick] = useState(Date.now());
useEffect(()=>{ const t=setInterval(()=>setTick(Date.now()),1000); return ()=>clearInterval(t); },[]);

const timeLeft = (o:any) => {
  if(!o) return "";
  const c = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || o.timestamp || tick);
  const end = c.getTime() + 30*60*1000; // 30 دقيقة
  const diff = end - tick;
  if(diff<=0) return "⏰ انتهى";
  const m = Math.floor(diff/60000);
  const s = Math.floor((diff%60000)/1000);
  return `⏱️ ${m}:${String(s).padStart(2,'0')}`;
};
  // alarmRef: active Audio element; pendingRef: queue of unacknowledged orders
  // seenRef: IDs already queued for alarm — pre-seeded on mount with orders
  // that are already "في الطريق" so they never re-alarm after a remount/login.
  const alarmRef   = useRef<HTMLAudioElement | null>(null);
  const pendingRef = useRef<StoredOrder[]>([]);
  const seenRef    = useRef<Set<string>>(
    new Set(),
  );

  const [settings, setSettings] = useState(getShopSettings());

  useEffect(() => {
    let active = true;
    const reloadSettings = async () => {
      const remote = await refreshShopSettings();
      if (active) setSettings(remote);
    };
    void reloadSettings();
    const onDataUpdated = () => { void reloadSettings(); };
    window.addEventListener("twelve-data-updated", onDataUpdated);
    return () => {
      active = false;
      window.removeEventListener("twelve-data-updated", onDataUpdated);
    };
  }, []);

  /* ── Request push notification permission on mount ───────────── */
  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPushStatus("unsupported");
      return;
    }
    if (Notification.permission === "granted") {
      setPushStatus("granted");
      void subscribeToPush(DELIVERY_PASS);
      return;
    }
    if (Notification.permission === "denied") {
      setPushStatus("denied");
      return;
    }
    // Permission not yet asked — request it
    requestNotificationPermission().then(granted => {
      if (granted) {
        setPushStatus("granted");
        void subscribeToPush(DELIVERY_PASS);
      } else {
        setPushStatus("denied");
      }
    });
  }, []);

  /* ── Cleanup audio on unmount (e.g. logout) ───────────────────── */
  useEffect(() => {
    return () => {
      if (alarmRef.current) {
        alarmRef.current.pause();
        alarmRef.current.currentTime = 0;
        alarmRef.current = null;
      }
    };
  }, []);

  /* ── Play / try alarm ─────────────────────────────────────────── */
  const startAlarm = useCallback(() => {
    if (alarmRef.current) return; // already playing
    const audio = new Audio(`${import.meta.env.BASE_URL}sounds/alarm.mp3`);
    audio.loop   = true;
    audio.volume = 0.85;
    // Set ref first to prevent concurrent calls from creating duplicates.
    // Clear it on rejection so the user-gesture retry path can re-enter.
    alarmRef.current = audio;
    audio.play()
      .then(() => setSoundBlocked(false))
      .catch(() => {
        alarmRef.current = null; // allow retry via enableSound (user gesture)
        setSoundBlocked(true);
      });
  }, []);

  /* ── Advance to next pending order (or stop alarm if queue empty) */
  const advanceQueue = useCallback(() => {
    const next = pendingRef.current.shift();
    if (next) {
      setModalOrder(next);
      startAlarm(); // keep alarm running; restart it if it was blocked earlier
    } else {
      if (alarmRef.current) {
        alarmRef.current.pause();
        alarmRef.current.currentTime = 0;
        alarmRef.current = null;
      }
      setSoundBlocked(false);
      setModalOrder(null);
    }
  }, [startAlarm]);

  /* ── User gesture: enable sound when autoplay was blocked ─────── */
  const enableSound = () => {
    setSoundBlocked(false);
    startAlarm();
  };

  /* ── Load delivery orders ─────────────────────────────────────── */
  const reload = useCallback(async () => {
    const remoteOrders = await refreshOrders();
    const deliveryOrders = Object.values(remoteOrders)
        .filter(o => o.adminStatus === "جاهز" && o.orderType === "توصيل")
        .sort((a, b) => b.createdAt - a.createdAt);
    deliveryOrders
      .filter(order => order.trackStatus === "في الطريق")
      .forEach(order => seenRef.current.add(order.id));
    setOrders(deliveryOrders);
  }, []);

  useEffect(() => {
    void reload();
    const iv = setInterval(() => { void reload(); }, 3000);
    const onDataUpdated = () => { void reload(); };
    window.addEventListener("twelve-data-updated", onDataUpdated);
    return () => {
      clearInterval(iv);
      window.removeEventListener("twelve-data-updated", onDataUpdated);
    };
  }, [reload]);

  /* ── Detect new delivery orders → queue + alarm ───────────────── */
  useEffect(() => {
    const fresh = orders.filter(o => !seenRef.current.has(o.id));
    if (fresh.length === 0) return;

    fresh.forEach(o => seenRef.current.add(o.id));
    // Push all new orders into the pending queue
    pendingRef.current.push(...fresh);

    // Open modal only if none is currently shown; queue holds the rest
    setModalOrder(prev => {
      if (prev !== null) return prev;            // modal already open — keep it
      return pendingRef.current.shift() ?? null; // pop the first pending
    });

    startAlarm();
  }, [orders, startAlarm]);

  /* ── Flashing browser title ───────────────────────────────────── */
  useEffect(() => {
    if (!modalOrder) {
      document.title = "لوحة المندوب — تويلف";
      return;
    }
    let on = true;
    const iv = setInterval(() => {
      document.title = on ? "🛵 طلب جديد!!" : "⚪️ طلب جديد!!";
      on = !on;
    }, 600);
    return () => { clearInterval(iv); document.title = "لوحة المندوب — تويلف"; };
  }, [modalOrder]);

  /* ── Modal accept: start delivery → advance queue ─────────────── */
  const handleModalAccept = () => {
    if (!modalOrder) return;
    // Keep adminStatus "جاهز" so the card stays visible; advance trackStatus to "في الطريق"
    updateBothStatuses(modalOrder.id, "جاهز", "في الطريق");
    reload();
    advanceQueue();
  };

  const markDelivered = (id: string) => {
    updateBothStatuses(id, "مكتمل", "تم التوصيل");
    reload();
    // Do NOT call advanceQueue here — completing a delivery card must not
    // affect the alarm queue, which is only advanced via handleModalAccept.
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#f5f5f5" }}>

      {/* ── NEW ORDER MODAL (mandatory — no close button) ────────── */}
      {modalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.82)" }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">

            {/* Pulsing green header */}
            <div className="py-5 px-5 text-center"
              style={{
                background: "linear-gradient(135deg,#16a34a,#14532d)",
                animation: "pulse 1s ease-in-out infinite alternate",
              }}>
              <p className="text-white font-black text-3xl mb-1">🛵 طلب للتوصيل!!</p>
              <p className="text-green-200 font-bold text-base">{modalOrder.id}</p>
              {pendingRef.current.length > 0 && (
                <p className="text-green-300 text-xs mt-1">
                  +{pendingRef.current.length} طلب آخر في الانتظار
                </p>
              )}
            </div>

            {/* Details */}
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-gray-50 rounded-2xl p-3">
                  <p className="text-gray-400 text-xs mb-0.5">الاسم</p>
                  <p className="font-black text-gray-800">{modalOrder.customerName}</p>
                </div>
                <div className="bg-gray-50 rounded-2xl p-3">
                  <p className="text-gray-400 text-xs mb-0.5">الجوال</p>
                  <a href={`tel:${modalOrder.customerPhone}`}
                    className="font-black text-blue-600">{modalOrder.customerPhone}</a>
                </div>
                {modalOrder.area && (
                  <div className="bg-gray-50 rounded-2xl p-3 col-span-2">
                    <p className="text-gray-400 text-xs mb-0.5">العنوان</p>
                    <p className="font-bold text-sm">📍 {modalOrder.area}</p>
                  </div>
                )}
                {modalOrder.lat && modalOrder.lng && (
                  <div className="col-span-2">
                    <a href={`https://www.google.com/maps?q=${modalOrder.lat},${modalOrder.lng}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 font-bold text-sm w-full"
                      style={{ borderColor: "#3b82f6", color: "#3b82f6" }}>
                      🗺️ فتح الموقع في الخريطة
                    </a>
                  </div>
                )}
                <div className="bg-gray-50 rounded-2xl p-3">
                  <p className="text-gray-400 text-xs mb-0.5">المبلغ</p>
                  <p className="font-black text-xl" style={{ color: BRAND }}>{modalOrder.amount} ر.س</p>
                </div>
                <div className="bg-gray-50 rounded-2xl p-3">
                  <p className="text-gray-400 text-xs mb-0.5">الدفع</p>
                  <p className="font-bold text-sm">
                    {modalOrder.payMethod === "كاش عند الاستلام" ? "💵 كاش"
                      : modalOrder.payMethod === "شبكة عند الاستلام" ? "💳 شبكة"
                      : "🏦 تحويل"}
                  </p>
                </div>
              </div>
        {/* عداد الوقت */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center font-black text-red-600 mb-3 text-lg">
          {timeLeft(modalOrder)}
        </div>

        {/* Items */}
              {/* Items */}
              <div className="bg-gray-50 rounded-2xl p-3 text-xs text-gray-600 max-h-28 overflow-y-auto">
                {modalOrder.items.map((it, i) => (
                  <div key={i} className="flex justify-between py-0.5">
                    <span>{it.name} × {it.qty}</span>
                    <span className="font-bold">{(it.price * it.qty).toFixed(2)} ر.س</span>
                  </div>
                ))}
              </div>

              {modalOrder.notes && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800 font-bold">
                  📝 {modalOrder.notes}
                </div>
              )}

              {/* Sound blocked banner — user gesture re-enables it */}
              {soundBlocked && (
                <button onClick={enableSound}
                  className="w-full py-2 rounded-xl border-2 border-dashed font-bold text-sm flex items-center justify-center gap-2"
                  style={{ borderColor: "#f59e0b", color: "#92400e", background: "#fffbeb" }}>
                  <Volume2 className="w-4 h-4" /> اضغط هنا لتفعيل صوت التنبيه
                </button>
              )}

              {/* Accept button */}
              <button onClick={handleModalAccept}
                className="w-full py-5 rounded-2xl text-white font-black text-2xl shadow-lg active:scale-95 transition-transform"
                style={{ background: "linear-gradient(135deg,#16a34a,#14532d)" }}>
                🛵 تسلّمت الطلب
              </button>
            </div>
          </div>
        </div>
      )}

      <header style={{ background: `linear-gradient(135deg,${BRAND},${BRAND_DARK})` }} className="text-white shadow-lg">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}images/logo.jpg`} alt="تويلف" className="h-10 w-10 rounded-full object-cover bg-white" />
            <div>
              <p className="font-black text-lg leading-tight">لوحة المندوب</p>
              <p className="text-xs text-red-200">الطلبات الجاهزة للتوصيل</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Push notification status indicator */}
            {pushStatus === "granted" && (
              <span title="الإشعارات مفعّلة" className="flex items-center gap-1 text-xs text-green-300">
                <Bell className="w-4 h-4" /> إشعارات
              </span>
            )}
            {pushStatus === "denied" && (
              <span title="الإشعارات محظورة — فعّلها من إعدادات المتصفح" className="flex items-center gap-1 text-xs text-yellow-300">
                <BellOff className="w-4 h-4" /> محظورة
              </span>
            )}
            <button onClick={onLogout} className="flex items-center gap-1 text-red-200 hover:text-white text-sm">
              <LogOut className="w-4 h-4" /> خروج
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full p-4">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Package className="w-16 h-16 mb-3 opacity-30" />
            <p className="text-lg font-bold">لا توجد طلبات جاهزة</p>
            <p className="text-sm">ستظهر الطلبات هنا عند اكتمال التحضير</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 font-bold">{orders.length} طلب جاهز للتوصيل</p>
            {orders.map(o => (
              <DeliveryCard
                key={o.id}
                order={o}
                shopMapLink={settings.mapLink}
                onDelivered={() => markDelivered(o.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
function DeliveryCard({ order, shopMapLink, onDelivered }: {
  order: StoredOrder; shopMapLink: string; onDelivered: () => void;
}) {
  const customerMapLink = order.lat && order.lng
    ? `https://www.google.com/maps?q=${order.lat},${order.lng}`
    : order.area ? `https://www.google.com/maps/search/${encodeURIComponent(order.area)}` : null;

  return (
    <div className="bg-white rounded-2xl shadow p-5 border-r-4 border-green-400">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="font-black text-gray-800 text-lg">{order.id}</span>
          <span className="mr-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">جاهز 🟢</span>
        </div>
        <span className="text-xs text-gray-400">
          {new Date(order.createdAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm"><span>👤</span><span className="font-bold">{order.customerName}</span></div>
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-gray-400" />
          <a href={`tel:${order.customerPhone}`} className="font-bold text-blue-600 text-sm">{order.customerPhone}</a>
        </div>
        {order.area && (
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-600">{order.area}</p>
          </div>
        )}
        {order.notes && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-sm text-yellow-800">📝 {order.notes}</div>
        )}
      </div>

      <div className="bg-gray-50 rounded-xl p-3 mb-4 text-sm space-y-1">
        {order.items.map((it, i) => (
          <div key={i} className="flex justify-between">
            <span>{it.name} × {it.qty}</span><span className="font-bold">{(it.price * it.qty).toFixed(2)}</span>
          </div>
        ))}
        <div className="border-t border-gray-200 pt-1 flex justify-between font-black" style={{ color: BRAND }}>
          <span>الإجمالي</span><span>{order.amount} ر.س</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <a href={shopMapLink} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 font-bold text-sm"
          style={{ borderColor: BRAND, color: BRAND }}>
          <MapPin className="w-4 h-4" /> موقع المحل
        </a>
        {customerMapLink ? (
          <a href={customerMapLink} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 font-bold text-sm"
            style={{ borderColor: "#3b82f6", color: "#3b82f6" }}>
            <MapPin className="w-4 h-4" /> موقع العميل
          </a>
        ) : (
          <button disabled className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 font-bold text-sm border-gray-200 text-gray-300">
            <MapPin className="w-4 h-4" /> موقع العميل
          </button>
        )}
      </div>

      <button onClick={onDelivered}
        className="w-full py-3 rounded-xl text-white font-black text-base flex items-center justify-center gap-2"
        style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)" }}>
        <CheckCircle2 className="w-5 h-5" /> تم التسليم ✓
      </button>
    </div>
  );
}

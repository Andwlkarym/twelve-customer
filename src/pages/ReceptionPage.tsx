import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import {
  LogOut, Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
  Package, ChefHat, BarChart3, Upload, X, Save,
  ShoppingBag, TrendingUp, Star, Eye, EyeOff, Layers, Tag, Percent, Users
} from "lucide-react";
import {
  getAllOrders, refreshOrders, updateBothStatuses, updateAdminStatus, approveReceipt,
  type StoredOrder, type AdminStatus
} from "@/lib/orderStore";
import {
  getActiveMenuItems, refreshMenuItems, addMenuItem, updateMenuItem, toggleMenuItem,
  deleteMenuItem, type MenuItem
} from "@/lib/menuStore";
import {
  getSections, refreshSections, addSection, toggleSection, deleteSection,
  type Section
} from "@/lib/sectionStore";
import { getShopSettings, refreshShopSettings } from "@/lib/settingsStore";
import { notifyDeliveryAgents } from "@/lib/pushNotifications";
import { endSession, hasSession, startSession } from "@/lib/authSession";
import { getCustomers, type LocalCustomer } from '../lib/customerAuth'
import { getCustomerDocuments } from "@/lib/firestoreCounter";

const ADMIN_PASS = "77212";
const SESSION_KEY = "twelve_reception_session";
const BRAND = "#C8102E";
const YELLOW = "#FFB81C";

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};
type MainTab = "orders" | "menu" | "stats" | "customers";
type OrderTab = "جديد" | "قيد التحضير" | "جاهز" | "مكتمل" | "مرفوض";
const ORDER_TABS: OrderTab[] = ["جديد", "قيد التحضير", "جاهز", "مكتمل", "مرفوض"];

function sortedOrders(map: Record<string, StoredOrder>): StoredOrder[] {
  return Object.values(map).sort((a, b) =>
    (a.orderNumber ?? Number.MAX_SAFE_INTEGER) - (b.orderNumber ?? Number.MAX_SAFE_INTEGER),
  );
}
function todayStart(): number {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime();
}

/* ══════════════════════════════════════════════════════════════════ */
export default function ReceptionPage() {
  const [authed, setAuthed] = useState(() => hasSession(SESSION_KEY));
  const [passInput, setPassInput] = useState("");
  const [passError, setPassError] = useState(false);

  const tryLogin = () => {
    if (passInput === ADMIN_PASS) { startSession(SESSION_KEY); setAuthed(true); }
    else { setPassError(true); }
  };

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f5f5f5" }}>
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <img src={`${import.meta.env.BASE_URL}images/logo.jpg`} alt="تويلف" className="h-16 w-16 rounded-2xl object-cover mx-auto mb-3 shadow" />
            <h1 className="text-xl font-black text-gray-800">لوحة الاستقبال</h1>
            <p className="text-sm text-gray-400">تويلف شاورما</p>
          </div>
          <input type="password"
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-center text-xl tracking-widest outline-none focus:border-red-400 mb-3"
            placeholder="كلمة السر" value={passInput}
            onChange={e => { setPassInput(e.target.value); setPassError(false); }}
            onKeyDown={e => e.key === "Enter" && tryLogin()} maxLength={8} />
          {passError && <p className="text-red-500 text-sm text-center mb-2">كلمة السر غير صحيحة</p>}
          <button onClick={tryLogin} className="w-full py-3 rounded-xl text-white font-black text-lg"
            style={{ background: BRAND }}>دخول</button>
        </div>
      </div>
    );
  }

  return <Dashboard onLogout={() => { endSession(SESSION_KEY); setAuthed(false); }} />;
}

/* ══════════════════════════════════════════════════════════════════ */
function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [, navigate] = useLocation();
  const [mainTab, setMainTab]   = useState<MainTab>("orders");
  const [orders, setOrders]     = useState<Record<string, StoredOrder>>({});
  const [menu, setMenu]         = useState<MenuItem[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [customers, setCustomers] = useState<LocalCustomer[]>([]);

  /* ── Alarm state ──────────────────────────────────────────────── */
  const alarmRef  = useRef<HTMLAudioElement | null>(null);
  const seenRef   = useRef<Set<string>>(new Set());
  const [modalOrder, setModalOrder] = useState<StoredOrder | null>(null);

  const stopAlarm = useCallback(() => {
    if (alarmRef.current) {
      alarmRef.current.pause();
      alarmRef.current.currentTime = 0;
      alarmRef.current = null;
    }
    setModalOrder(null);
  }, []);

  /* ── Data reload ──────────────────────────────────────────────── */
  const reload = useCallback(async () => {
    const [remoteOrders, remoteMenu, remoteSections] = await Promise.all([
      refreshOrders(),
      refreshMenuItems(),
      refreshSections(),
      refreshShopSettings(),
    ]);
    setOrders(remoteOrders);
    setMenu(remoteMenu);
    setSections(remoteSections);
    try {
      setCustomers(await getCustomerDocuments());
    } catch {
      setCustomers(getCustomers());
    }
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

  /* ── Detect new orders → start alarm ─────────────────────────── */
  useEffect(() => {
    const fresh = Object.values(orders).filter(
      o => o.adminStatus === "جديد" && !seenRef.current.has(o.id),
    );
    if (fresh.length === 0) return;

    fresh.forEach(o => seenRef.current.add(o.id));

    /* show modal only if none is open yet */
    setModalOrder(prev => prev ?? fresh[0]);

    /* start alarm only once */
    if (!alarmRef.current) {
      const audio = new Audio(`${import.meta.env.BASE_URL}sounds/alarm.mp3`);
      audio.loop   = true;
      audio.volume = 0.85;
      audio.play().catch(() => { /* autoplay blocked – alarm shows on next interaction */ });
      alarmRef.current = audio;
    }
  }, [orders]);

  /* ── Flashing browser title ───────────────────────────────────── */
  useEffect(() => {
    if (!modalOrder) {
      document.title = "لوحة الاستقبال — تويلف";
      return;
    }
    let on = true;
    const iv = setInterval(() => {
      document.title = on ? "🔴 طلب جديد!!" : "⚪️ طلب جديد!!";
      on = !on;
    }, 600);
    return () => { clearInterval(iv); document.title = "لوحة الاستقبال — تويلف"; };
  }, [modalOrder]);

  /* ── Modal accept / reject ────────────────────────────────────── */
  const handleModalAccept = () => {
    if (!modalOrder) return;
    updateBothStatuses(modalOrder.id, "قيد التحضير", "جاري التحضير");
    reload();
    stopAlarm();
  };
  const handleModalReject = () => {
    if (!modalOrder) return;
updateBothStatuses(modalOrder.id, "مرفوض", "مرفوض");
    reload();
    stopAlarm();
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#f5f5f5" }}>

      {/* ── NEW ORDER MODAL (mandatory — no close button) ────────── */}
      {modalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.80)" }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-bounce-once">

            {/* Pulsing header */}
            <div className="py-5 px-5 text-center" style={{
              background: `linear-gradient(135deg,${BRAND},#6B0000)`,
              animation: "pulse 1s ease-in-out infinite alternate",
            }}>
              <p className="text-white font-black text-3xl mb-1">🔔 طلب جديد!!</p>
              <p className="text-red-200 font-bold text-base">{modalOrder.orderCode || `#${modalOrder.orderNumber || modalOrder.id}`}</p>
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
                <div className="bg-gray-50 rounded-2xl p-3 col-span-2">
                  <p className="text-gray-400 text-xs mb-0.5">
                    {modalOrder.orderType === "توصيل" ? "العنوان" : "طريقة الاستلام"}
                  </p>
                  <p className="font-bold">
                    {modalOrder.orderType === "توصيل"
                      ? `🛵 توصيل — ${modalOrder.area || "—"}`
                      : "🏪 استلام من الفرع"}
                  </p>
                </div>
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

              {/* Items summary */}
              <div className="bg-gray-50 rounded-2xl p-3 text-xs text-gray-600 max-h-28 overflow-y-auto">
                {modalOrder.items.map((it, i) => (
                  <div key={i} className="flex justify-between py-0.5">
                    <span>{it.name} × {it.qty}</span>
                    <span className="font-bold">{(it.price * it.qty).toFixed(2)} ر.س</span>
                    {(it as any).note && <div className="text-[11px] bg-amber-50 border border-amber-200 text-amber-800 rounded px-2 py-1 mt-1">📝 {(it as any).note}</div>}
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button onClick={handleModalReject}
                  className="py-5 rounded-2xl text-white font-black text-2xl shadow-lg active:scale-95 transition-transform"
                  style={{ background: "#dc2626" }}>
                  ✕ رفض
                </button>
                <button onClick={handleModalAccept}
                  className="py-5 rounded-2xl text-white font-black text-2xl shadow-lg active:scale-95 transition-transform"
                  style={{ background: "#16a34a" }}>
                  ✓ قبول
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <header style={{ background: `linear-gradient(135deg,${BRAND},#8B0000)` }} className="text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}images/logo.jpg`} alt="تويلف" className="h-10 w-10 rounded-full object-cover bg-white" />
            <div>
              <p className="font-black text-lg leading-tight">لوحة الاستقبال</p>
              <p className="text-xs text-red-200">تويلف شاورما</p>
            </div>
          </div>
          <button onClick={onLogout} className="flex items-center gap-1 text-red-200 hover:text-white text-sm">
            <LogOut className="w-4 h-4" /> خروج
          </button>
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-3 flex gap-1 flex-wrap">
          {([
            { id: "orders" as MainTab, label: "الطلبات",       icon: <Package className="w-4 h-4" /> },
            { id: "menu"   as MainTab, label: "إدارة الأصناف",  icon: <ChefHat className="w-4 h-4" /> },
            { id: "stats"  as MainTab, label: "الإحصائيات",     icon: <BarChart3 className="w-4 h-4" /> },
            { id: "customers" as MainTab, label: "الزبائن",      icon: <Users className="w-4 h-4" /> },
          ]).map(t => (
            <button key={t.id} onClick={() => setMainTab(t.id)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold"
              style={{ background: mainTab === t.id ? YELLOW : "rgba(255,255,255,0.15)", color: mainTab === t.id ? "#7a1a00" : "#fff" }}>
              {t.icon}{t.label}
            </button>
          ))}
          <button onClick={() => navigate("/admin/coupons")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold"
            style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}>
            <Tag className="w-4 h-4" /> أكواد الخصم
          </button>
          <button onClick={() => navigate("/admin/settings")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold"
            style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}>
            ⚙️ الإعدادات
          </button>
        </div>
      </header>
      <main className="flex-1 max-w-5xl mx-auto w-full p-4">
        {mainTab === "orders" && <OrdersTab orders={orders} onAction={reload} onAlarmStop={stopAlarm} />}
        {mainTab === "menu"   && <MenuTab menu={menu} sections={sections} onAction={reload} />}
        {mainTab === "stats"  && <StatsTab orders={orders} menu={menu} />}
        {mainTab === "customers" && <CustomersTab customers={customers} />}
      </main>
    </div>
  );
}

function CustomersTab({ customers }: { customers: LocalCustomer[] }) {
  return (
    <div className="bg-white rounded-2xl shadow overflow-hidden">
      <div className="p-5 border-b border-gray-100 flex items-center justify-between">
        <h2 className="font-black text-gray-800 flex items-center gap-2">
          <Users className="w-5 h-5" style={{ color: BRAND }} /> الزبائن
        </h2>
        <span className="text-sm text-gray-400">{customers.length} زبون</span>
      </div>
      {customers.length === 0 ? (
        <div className="p-10 text-center text-gray-400">لا يوجد زبائن مسجلون بعد</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {customers.map(customer => (
            <div key={customer.phone} className="p-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-black text-gray-800">{customer.name}</p>
                <p className="text-sm text-gray-500">{customer.phone}</p>
              </div>
              <a href={`tel:${customer.phone}`} className="text-sm font-bold text-blue-600">اتصال</a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ORDERS TAB
══════════════════════════════════════════════════════════════════ */
function OrdersTab({ orders, onAction, onAlarmStop }: {
  orders: Record<string, StoredOrder>;
  onAction: () => void;
  onAlarmStop: () => void;
}) {
  const [tab, setTab] = useState<OrderTab>("جديد");
  const all = sortedOrders(orders);
  const filtered = all.filter(o => o.adminStatus === tab);

  return (
    <div>
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {ORDER_TABS.map(t => {
          const count = all.filter(o => o.adminStatus === t).length;
          return (
            <button key={t} onClick={() => setTab(t)}
              className="flex-shrink-0 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 border-2"
              style={{ borderColor: tab === t ? BRAND : "#e5e7eb", background: tab === t ? BRAND : "#fff", color: tab === t ? "#fff" : "#666" }}>
              {t}
              {count > 0 && (
                <span className="text-xs rounded-full w-5 h-5 flex items-center justify-center font-black"
                  style={{ background: tab === t ? YELLOW : BRAND, color: tab === t ? "#7a1a00" : "#fff" }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400">
          <Package className="w-12 h-12 mb-2 opacity-30" /><p>لا توجد طلبات في "{tab}"</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map(o => <OrderCard key={o.id} order={o} onAction={onAction} onAlarmStop={onAlarmStop} />)}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order, onAction, onAlarmStop }: {
  order: StoredOrder; onAction: () => void; onAlarmStop: () => void;
}) {
  const isNew       = order.adminStatus === "جديد";
  const isPreparing = order.adminStatus === "قيد التحضير";
  const isReady     = order.adminStatus === "جاهز";
  const [showReceipt, setShowReceipt] = useState(false);

  const accept  = () => { updateBothStatuses(order.id, "قيد التحضير", "جاري التحضير"); onAlarmStop(); onAction(); };
  const ready   = () => {
    updateBothStatuses(order.id, "جاهز", order.orderType === "استلام" ? "جاهز للاستلام" : "جاري التحضير");
    // Notify delivery agent via push when a delivery order is ready
    if (order.orderType === "توصيل") {
      void notifyDeliveryAgents(order.customerName, order.amount, order.id, ADMIN_PASS);
    }
    onAction();
  };
  const deliver = () => { updateBothStatuses(order.id, "مكتمل", order.orderType === "توصيل" ? "في الطريق" : "تم التوصيل"); onAlarmStop(); onAction(); };
  const reject  = () => { updateAdminStatus(order.id, "مرفوض"); onAlarmStop(); onAction(); };

  const isTransfer    = order.payMethod === "تحويل بنكي";
  const borderColor   = isNew ? YELLOW : isPreparing ? "#3b82f6" : isReady ? "#22c55e" : BRAND;

  return (
    <div className="bg-white rounded-2xl shadow p-4 border-r-4" style={{ borderColor }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-black text-gray-800">{order.orderCode || `#${order.orderNumber || order.id}`}</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-bold"
            style={{ background: order.orderType === "توصيل" ? "#fff3f3" : "#f0fdf4", color: order.orderType === "توصيل" ? BRAND : "#16a34a" }}>
            {order.orderType === "توصيل" ? "🛵 توصيل" : "🏪 استلام"}
          </span>
          {/* Payment badge */}
          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${isTransfer ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
            {order.payMethod === "كاش عند الاستلام" ? "💵 كاش" : order.payMethod === "شبكة عند الاستلام" ? "💳 شبكة" : "🏦 تحويل"}
          </span>
          {isTransfer && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${order.receiptApproved ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
              {order.receiptApproved ? "✅ إيصال معتمد" : "⏳ بانتظار الإيصال"}
            </span>
          )}
        </div>
<span className="text-xs text-gray-400 flex-shrink-0">{(() => { const raw = (order as any).createdAt || (order as any).date || (order as any).createdAtMs || (order as any).timestamp; if (!raw) return ""; let d: Date; if (typeof raw === 'object' && raw?.toDate) d = raw.toDate(); else if (typeof raw === 'object' && (raw as any)?.seconds) d = new Date((raw as any).seconds * 1000); else if (typeof raw === 'number') d = new Date(raw); else { d = new Date(raw as string); } return isNaN(d.getTime()) ? "" : d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }); })()}</span>
      </div>

      <div className="mb-3 text-sm space-y-1">
        <p><span className="text-gray-500">الاسم: </span><span className="font-bold">{order.customerName}</span></p>
        <p><span className="text-gray-500">الجوال: </span>
          <a href={`tel:${order.customerPhone}`} className="font-bold text-blue-600">{order.customerPhone}</a></p>
        {order.orderType === "توصيل" && (
          <>
            {order.area && <p><span className="text-gray-500">العنوان: </span><span>{order.area}</span></p>}
            {order.lat && order.lng && (
              <a href={`https://www.google.com/maps?q=${order.lat},${order.lng}`} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-500 flex items-center gap-1 hover:underline">
                🗺️ عرض الموقع في الخريطة
              </a>
            )}
          </>
        )}
        {order.notes && <p><span className="text-gray-500">ملاحظات: </span><span className="text-orange-600">{order.notes}</span></p>}
      </div>

      {/* Receipt section */}
      {isTransfer && order.receiptImage && (
        <div className="mb-3 border border-blue-100 rounded-xl p-3 bg-blue-50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-700">📎 إيصال التحويل</span>
            <button onClick={() => setShowReceipt(v => !v)}
              className="text-xs text-blue-500 underline">
              {showReceipt ? "إخفاء" : "عرض الإيصال"}
            </button>
          </div>
          {showReceipt && (
            <img src={order.receiptImage} alt="إيصال التحويل" className="w-full max-h-64 object-contain rounded-lg border border-blue-200 bg-white" />
          )}
          {!order.receiptApproved && (
            <button onClick={() => { approveReceipt(order.id); onAction(); }}
              className="w-full py-2 rounded-xl text-white text-sm font-bold" style={{ background: "#16a34a" }}>
              ✅ اعتماد الإيصال
            </button>
          )}
        </div>
      )}
      {isTransfer && !order.receiptImage && (
        <div className="mb-3 text-xs text-yellow-600 bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2 font-bold">
          ⚠️ لم يُرفع الإيصال بعد
        </div>
      )}

      <div className="bg-gray-50 rounded-xl p-3 mb-3 space-y-1 text-sm">
{order.items.map((it:any, i) => (
<div key={i} className="flex flex-col py-1">
<div className="flex justify-between">
<span>{it.name} x {it.qty}</span>
<span className="font-bold">{(it.price * it.qty).toFixed(2)}</span>
</div>
{(it as any).note && <div className="text-[11px] bg-amber-100 border border-amber-300 text-amber-900 rounded px-2 py-1 mt-1 font-bold">📝 {(it as any).note}</div>}
</div>
))}
        <div className="border-t border-gray-200 pt-1 mt-1 space-y-0.5 text-xs text-gray-500">
          {order.promoDiscount != null && order.promoDiscount > 0 && (
            <div className="flex justify-between text-amber-600 font-bold">
              <span>خصم العرض الترويجي</span>
              <span>- {order.promoDiscount.toFixed(2)}</span>
            </div>
          )}
          {order.couponDiscount != null && order.couponDiscount > 0 && (
            <div className="flex justify-between text-green-600 font-bold">
              <span>خصم كود {order.couponCode}</span>
              <span>- {order.couponDiscount.toFixed(2)}</span>
            </div>
          )}
          {order.firstOrderDiscount != null && order.firstOrderDiscount > 0 && (
            <div className="flex justify-between text-green-600 font-bold">
              <span>خصم أول طلب</span>
              <span>- {order.firstOrderDiscount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between"><span>ضريبة 15%</span><span>{order.tax?.toFixed(2) ?? "—"}</span></div>
          {order.deliveryFee > 0 && <div className="flex justify-between"><span>توصيل</span><span>{order.deliveryFee?.toFixed(2)}</span></div>}
        </div>
        <div className="flex justify-between font-black text-sm pt-1" style={{ color: BRAND }}>
          <span>الإجمالي</span><span>{order.amount} ر.س</span>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {isNew && (
          <>
            <button onClick={accept} className="flex-1 py-2 rounded-xl text-white text-sm font-bold" style={{ background: "#22c55e" }}>✅ قبول</button>
            <button onClick={reject} className="px-3 py-2 rounded-xl text-white text-sm font-bold" style={{ background: "#ef4444" }}>رفض</button>
          </>
        )}
        {isPreparing && <button onClick={ready} className="flex-1 py-2 rounded-xl text-white text-sm font-bold" style={{ background: "#3b82f6" }}>🔔 جاهز</button>}
        {isReady && (
          <button onClick={deliver} className="flex-1 py-2 rounded-xl text-white text-sm font-bold" style={{ background: BRAND }}>
            {order.orderType === "توصيل" ? "🛵 تسليم للمندوب" : "✅ تم الاستلام"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MENU TAB
══════════════════════════════════════════════════════════════════ */
type MenuForm = { name: string; description: string; price: string; category: string; img: string; active: boolean };
const BLANK: MenuForm = { name: "", description: "", price: "", category: "", img: "", active: true };

function MenuTab({ menu, sections, onAction }: { menu: MenuItem[]; sections: Section[]; onAction: () => void }) {
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState<MenuItem | null>(null);
  const [form, setForm]             = useState<MenuForm>(BLANK);
  const [imgLoading, setImgLoading] = useState(false);

  /* Section management */
  const [newSecName, setNewSecName] = useState("");
  const [showSecForm, setShowSecForm] = useState(false);

  const sectionNames = sections.map(s => s.name);

  const openAdd = () => {
    const defaultCat = sections.find(s => s.active)?.name ?? sectionNames[0] ?? "";
    setEditing(null); setForm({ ...BLANK, category: defaultCat }); setShowForm(true);
  };
  const openEdit = (item: MenuItem) => {
    setEditing(item);
    setForm({
      name: item.name || '',
      description: item.description || '',
      price: String(item.price?? ''),
      category: item.category || '',
      img: item.image || (item as any).img || '',
      available: item.available?? true
    } as any);
    setShowForm(true);
  };
const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  setImgLoading(true);
  try {
    const compressedB64 = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => {
        const im = new Image();
        im.src = r.result as string;
        im.onload = () => {
          const c = document.createElement("canvas");
          const MAX = 800;
          let w = im.width, h = im.height;
          if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } }
          else { if (h > MAX) { w *= MAX / h; h = MAX; } }
          c.width = w; c.height = h;
          c.getContext("2d")!.drawImage(im, 0, 0, w, h);
          resolve(c.toDataURL("image/webp", 0.6));
        };
      };
      r.readAsDataURL(file);
    });
    setForm(f => ({...f, img: compressedB64 }));
  } finally {
    setImgLoading(false);
  }
};


  const saveItem = () => {
    if (!form.name.trim() || !form.price || !form.category) return;
const base = { name: form.name.trim(), description: form.description.trim(), price: Number(form.price), category: form.category, image: form.img, img: form.img, imageUrl: form.img, photo: form.img, available: true };
    if (editing) updateMenuItem(editing.id, base); else addMenuItem(base);
    setShowForm(false); setEditing(null); onAction();
  };

const delItem = (id: string) => { if (confirm("حذف هذا الصنف؟")) { deleteMenuItem(id); onAction(); } };

  const addSec = () => {
    if (!newSecName.trim()) return;
    addSection(newSecName.trim()); setNewSecName(""); setShowSecForm(false); onAction();
  };

  return (
    <div className="space-y-6">
      {/* Sections management */}
      <div className="bg-white rounded-2xl shadow p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-gray-800 flex items-center gap-2">
            <Layers className="w-5 h-5" style={{ color: BRAND }} /> الأقسام
          </h3>
          <button onClick={() => setShowSecForm(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-sm font-bold"
            style={{ background: BRAND }}>
            <Plus className="w-4 h-4" /> إضافة قسم
          </button>
        </div>

        {showSecForm && (
          <div className="flex gap-2 mb-4">
            <input className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-right outline-none focus:border-red-400"
              placeholder="اسم القسم الجديد" value={newSecName} onChange={e => setNewSecName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addSec()} />
            <button onClick={addSec} className="px-4 py-2 rounded-xl text-white font-bold" style={{ background: "#22c55e" }}>إضافة</button>
            <button onClick={() => setShowSecForm(false)} className="px-3 py-2 rounded-xl border text-gray-500"><X className="w-4 h-4" /></button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {sections.map(sec => (  // في لوحة التحكم نظهر الكل
            <div key={sec.name} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm"
              style={{ borderColor: sec.active ? BRAND : "#ddd", background: sec.active ? "#fff3f3" : "#f9f9f9" }}>
              <span className="font-bold" style={{ color: sec.active ? BRAND : "#aaa" }}>{sec.name}</span>
              <button onClick={() => { toggleSection(sec.name, !sec.active); onAction(); }}
                className="p-0.5 rounded-full hover:bg-gray-200" title={sec.active ? "إخفاء من العملاء" : "إظهار للعملاء"}>
                {sec.active ? <Eye className="w-3.5 h-3.5 text-green-600" /> : <EyeOff className="w-3.5 h-3.5 text-gray-400" />}
              </button>
              <button onClick={() => { if (confirm(`حذف قسم "${sec.name}"؟`)) { deleteSection(sec.name); onAction(); } }}
                className="p-0.5 rounded-full hover:bg-red-100">
                <X className="w-3.5 h-3.5 text-red-400" />
              </button>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">👁️ الأقسام المخفية لن تظهر لعملاء الموقع</p>
      </div>

      {/* Items */}
      <div className="flex items-center justify-between">
        <h3 className="font-black text-gray-800 text-lg">الأصناف ({menu.length})</h3>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-bold"
          style={{ background: BRAND }}><Plus className="w-4 h-4" /> إضافة صنف</button>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow p-5 border-2 border-red-100">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-black text-gray-800">{editing ? "تعديل الصنف" : "إضافة صنف جديد"}</h4>
            <button onClick={() => { setShowForm(false); setEditing(null); }}><X className="w-5 h-5 text-gray-400" /></button>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">اسم الصنف *</label>
              <input className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-right outline-none focus:border-red-400"
                placeholder="وجبة زنجر" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">القسم *</label>
              <select className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-right outline-none focus:border-red-400 bg-white"
                value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                <option value="">-- اختر قسم --</option>
                {sectionNames.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">السعر (ريال) *</label>
              <input type="number" min="0" step="0.5" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-right outline-none focus:border-red-400"
                placeholder="0.00" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">الوصف</label>
              <input className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-right outline-none focus:border-red-400"
                placeholder="وصف مختصر" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">صورة الصنف</label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-red-400 text-gray-500 text-sm">
                  <Upload className="w-4 h-4" />
                  {imgLoading ? "جاري الرفع..." : "رفع صورة"}
                  <input type="file" accept="image/*" className="hidden" onChange={handleImage} />
                </label>
                {form.img && <img src={form.img} alt="" className="w-14 h-14 object-cover rounded-xl border" />}
                {form.img && <button onClick={() => setForm(f => ({ ...f, img: "" }))} className="text-red-400 text-xs">حذف الصورة</button>}
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={saveItem} className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white font-bold" style={{ background: BRAND }}>
              <Save className="w-4 h-4" /> {editing ? "حفظ التعديلات" : "إضافة الصنف"}
            </button>
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="px-4 py-2.5 rounded-xl border font-bold text-gray-600 hover:bg-gray-50">
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              <th className="px-4 py-3 text-right font-bold text-gray-600">الصورة</th>
              <th className="px-4 py-3 text-right font-bold text-gray-600">الاسم</th>
              <th className="px-4 py-3 text-right font-bold text-gray-600">القسم</th>
              <th className="px-4 py-3 text-right font-bold text-gray-600">السعر</th>
              <th className="px-4 py-3 text-center font-bold text-gray-600">الحالة</th>
              <th className="px-4 py-3 text-center font-bold text-gray-600">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {menu.map(item => (
              <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3">
                  {item.img
                    ? <img src={item.img} alt={item.name} className="w-12 h-12 object-cover rounded-xl" />
                    : <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: "#fff3f3" }}>🍽️</div>
                  }
                </td>
                <td className="px-4 py-3">
                  <p className="font-bold text-gray-800">{item.name}</p>
                  {item.description && <p className="text-xs text-gray-400 line-clamp-1">{item.description}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: "#fff3f3", color: BRAND }}>{item.category}</span>
                </td>
                <td className="px-4 py-3 font-black" style={{ color: BRAND }}>{item.price} ر.س</td>
                <td className="px-4 py-3 text-center">
<button onClick={() => { toggleMenuItem(item.id); onAction(); }}                    style={{ color: item.active ? "#22c55e" : "#aaa" }}>
                    {item.active ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => delItem(item.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   STATS TAB
══════════════════════════════════════════════════════════════════ */
function StatsTab({ orders, menu }: { orders: Record<string, StoredOrder>; menu: MenuItem[] }) {
  const settings = getShopSettings();
  const all = Object.values(orders);
const ts = todayStart();
const todayAll = all.filter((o:any) => { const r=o.createdAt||o.date||o.createdAtMs||o.timestamp||0; const ms=typeof r==='number'?r:r?.toDate?r.toDate().getTime():r?.seconds?r.seconds*1000:new Date(r).getTime(); return ms>=ts; });
const todayDone = todayAll.filter(o => o.adminStatus === "مكتمل");
const todayForSales = todayAll.filter(o => o.adminStatus !== "ملغي");
const salesTotal = todayForSales.reduce((s, o:any) => s + (parseFloat(String(o.amount).replace(/[^\d.]/g,'')) || parseFloat(String(o.total).replace(/[^\d.]/g,'')) || 0), 0);
const commissionAmt = Math.round(salesTotal * settings.commissionPercent / 100 * 100) / 100;
const netRevenue = salesTotal - commissionAmt;
const todayDelivery = todayAll.filter((o:any) => o.orderType === 'delivery' || o.type === 'delivery' || o.isDelivery || o.deliveryFee > 0 || !!o.deliveryAddress).length;
const todayPickup = todayAll.length - todayDelivery;

  const itemCounts: Record<string, number> = {};
  all.forEach(o => o.items.forEach(it => { itemCounts[it.name] = (itemCounts[it.name] ?? 0) + it.qty; }));
  const topItem = Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0];

  const catSales: Record<string, number> = {};
  todayDone.forEach(o => o.items.forEach(it => {
    const cat = menu.find(m => m.name === it.name)?.category ?? "أخرى";
    catSales[cat] = (catSales[cat] ?? 0) + it.price * it.qty;
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard icon={<TrendingUp className="w-6 h-6" />} label="مبيعات اليوم"   value={`${salesTotal.toFixed(2)} ر.س`} color={BRAND} />
        <StatCard icon={<ShoppingBag className="w-6 h-6" />} label="طلبات اليوم"   value={String(todayAll.length)}           color="#3b82f6" />
        <StatCard icon={<ShoppingBag className="w-6 h-6" />} label="طلبات التوصيل" value={String(todayDelivery)} color="bg-orange-100 text-orange-600" />
<StatCard icon={<ShoppingBag className="w-6 h-6" />} label="طلبات الاستلام" value={String(todayPickup)} color="bg-green-100 text-green-600" />
        <StatCard icon={<Star className="w-6 h-6" />}        label="أكثر صنف مبيع" value={topItem ? `${topItem[0]} (${topItem[1]})` : "—"} color={YELLOW} dark />
        {settings.commissionPercent > 0 && (
          <>
            <StatCard icon={<Percent className="w-6 h-6" />} label={`عمولة (${settings.commissionPercent}%)`} value={`${commissionAmt.toFixed(2)} ر.س`} color="#f97316" />
            <StatCard icon={<TrendingUp className="w-6 h-6" />} label="صافي الإيراد" value={`${netRevenue.toFixed(2)} ر.س`} color="#16a34a" />
          </>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow p-5">
        <h3 className="font-black text-gray-800 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5" style={{ color: BRAND }} /> توزيع طلبات اليوم
        </h3>
        {["جديد", "قيد التحضير", "جاهز", "مكتمل"].map(s => {
          const count = todayAll.filter(o => o.adminStatus === s).length;
          const pct = todayAll.length > 0 ? (count / todayAll.length) * 100 : 0;
          return (
            <div key={s} className="mb-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">{s}</span><span className="font-bold">{count}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: BRAND }} />
              </div>
            </div>
          );
        })}
      </div>

      {Object.keys(catSales).length > 0 && (
        <div className="bg-white rounded-2xl shadow p-5">
          <h3 className="font-black text-gray-800 mb-4">مبيعات حسب القسم</h3>
          {Object.entries(catSales).sort((a, b) => b[1] - a[1]).map(([cat, amount]) => (
            <div key={cat} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
              <span className="text-gray-600">{cat}</span>
              <span className="font-black" style={{ color: BRAND }}>{amount.toFixed(2)} ر.س</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color, dark }: {
  icon: React.ReactNode; label: string; value: string; color: string; dark?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center gap-2 mb-2" style={{ color }}>
        {icon}<span className="text-xs text-gray-400 font-medium">{label}</span>
      </div>
      <p className="font-black text-lg" style={{ color: dark ? color : "#1a1a1a" }}>{value}</p>
    </div>
  );
}

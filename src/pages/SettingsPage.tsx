import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Settings, Save, LogOut, ArrowRight,
  ToggleLeft, ToggleRight, Upload, Clock,
  Percent, Truck, Tag, Store, Gift,
} from "lucide-react";
import {
  getShopSettings, refreshShopSettings, saveShopSettings, type ShopSettings
} from "@/lib/settingsStore";
import { fileToBase64 } from "@/lib/menuStore";
import { endSession, hasSession, startSession } from "@/lib/authSession";

const ADMIN_PASS  = "4321";
const SESSION_KEY = "twelve_reception_session";
const BRAND  = "#C8102E";
const YELLOW = "#FFB81C";

const ARABIC_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

/* ══════════════════════════════════════════════════════════════════ */
export default function SettingsPage() {
  const [authed, setAuthed] = useState(() => hasSession(SESSION_KEY));
  const [passInput, setPassInput] = useState("");
  const [passError, setPassError] = useState(false);

  const tryLogin = () => {
    if (passInput === ADMIN_PASS) { startSession(SESSION_KEY); setAuthed(true); }
    else setPassError(true);
  };

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f5f5f5" }}>
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <img src={`${import.meta.env.BASE_URL}images/logo.jpg`} alt="تويلف"
              className="h-16 w-16 rounded-2xl object-cover mx-auto mb-3 shadow" />
            <h1 className="text-xl font-black text-gray-800">إعدادات التطبيق</h1>
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

  return <SettingsDashboard onLogout={() => { endSession(SESSION_KEY); setAuthed(false); }} />;
}

/* ══════════════════════════════════════════════════════════════════ */
function SettingsDashboard({ onLogout }: { onLogout: () => void }) {
  const [, navigate]  = useLocation();
  const [s, setS]     = useState<ShopSettings>(getShopSettings());
  const [saved, setSaved] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [bannerLoading, setBannerLoading] = useState<number | null>(null);

  /* reload if another page saves */
  useEffect(() => {
    let active = true;
    const reload = async () => {
      const remote = await refreshShopSettings();
      if (active) setS(remote);
    };
    void reload();
    const onDataUpdated = () => { void reload(); };
    window.addEventListener("twelve-data-updated", onDataUpdated);
    return () => {
      active = false;
      window.removeEventListener("twelve-data-updated", onDataUpdated);
    };
  }, []);

  const save = async () => {
    await saveShopSettings(s);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const toggleDay = (d: number) =>
    setS(prev => ({
      ...prev,
      workingDays: prev.workingDays.includes(d)
        ? prev.workingDays.filter(x => x !== d)
        : [...prev.workingDays, d].sort((a, b) => a - b),
    }));

  const handleQr = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setQrLoading(true);
    try { setS(prev => ({ ...prev, qrImage: "" }));
   const b64 = await fileToBase64(file) as string;  setS(prev => ({ ...prev, qrImage: b64 })); }
    finally { setQrLoading(false); }
  };

  const handleBanner = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setBannerLoading(index);
    try {
      const b64 = await fileToBase64(file) as string;
      setS(prev => {
        const banners = [...prev.banners];
        banners[index] = b64;
        return { ...prev, banners };
      });
    } finally { setBannerLoading(null); }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#f5f5f5" }}>

      {/* Header */}
      <header style={{ background: `linear-gradient(135deg,${BRAND},#8B0000)` }} className="text-white shadow-lg">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/admin/orders")}
              className="p-1 rounded-full hover:bg-white/20">
              <ArrowRight className="w-5 h-5" />
            </button>
            <img src={`${import.meta.env.BASE_URL}images/logo.jpg`} alt="تويلف"
              className="h-9 w-9 rounded-full object-cover bg-white" />
            <div>
              <p className="font-black text-base leading-tight flex items-center gap-1.5">
                <Settings className="w-4 h-4" /> إعدادات التطبيق
              </p>
              <p className="text-xs text-red-200">تويلف شاورما</p>
            </div>
          </div>
          <button onClick={onLogout} className="flex items-center gap-1 text-red-200 hover:text-white text-sm">
            <LogOut className="w-4 h-4" /> خروج
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-4 space-y-5 pb-28">

        {/* ── 1. التسعير والعمولة ───────────────────────────────────── */}
        <Section icon={<Truck className="w-5 h-5" />} title="التسعير والعمولة">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="سعر التوصيل (ريال)">
              <input type="number" min={0} step={0.5}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-red-400"
                value={s.deliveryFee}
                onChange={e => setS(p => ({ ...p, deliveryFee: Number(e.target.value) }))} />
              <p className="text-xs text-gray-400 mt-1">يظهر للعميل في صفحة الدفع</p>
            </Field>
            <Field label="نسبة عمولة المطعم (%)">
              <input type="number" min={0} max={100} step={0.5}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-red-400"
                value={s.commissionPercent}
                onChange={e => setS(p => ({ ...p, commissionPercent: Number(e.target.value) }))} />
              <p className="text-xs text-gray-400 mt-1">تُستخدم لحساب صافي إيراداتك في الإحصائيات</p>
            </Field>
          </div>
        </Section>

        {/* ── 2. ساعات العمل ────────────────────────────────────────── */}
        <Section icon={<Clock className="w-5 h-5" />} title="ساعات العمل">

          {/* Manual close override */}
          <ToggleRow
            label="إغلاق المحل الآن يدوياً"
            sub="يظهر للعملاء 'المحل مغلق' بغض النظر عن الوقت"
            active={s.shopManualClosed}
            color="#dc2626"
            onToggle={() => setS(p => ({ ...p, shopManualClosed: !p.shopManualClosed }))}
          />

          <div className="border-t border-gray-100 my-3" />

          <ToggleRow
            label="تفعيل ساعات العمل التلقائية"
            sub="يُغلق المحل تلقائياً خارج الأوقات المحددة"
            active={s.workingHoursEnabled}
            onToggle={() => setS(p => ({ ...p, workingHoursEnabled: !p.workingHoursEnabled }))}
          />

          {s.workingHoursEnabled && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="وقت الفتح">
                  <input type="time" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-red-400"
                    value={s.workingStart}
                    onChange={e => setS(p => ({ ...p, workingStart: e.target.value }))} />
                </Field>
                <Field label="وقت الإغلاق">
                  <input type="time" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-red-400"
                    value={s.workingEnd}
                    onChange={e => setS(p => ({ ...p, workingEnd: e.target.value }))} />
                </Field>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-2 block font-bold">أيام العمل</label>
                <div className="flex flex-wrap gap-2">
                  {ARABIC_DAYS.map((day, idx) => {
                    const active = s.workingDays.includes(idx);
                    return (
                      <button key={idx} onClick={() => toggleDay(idx)}
                        className="px-3 py-1.5 rounded-full text-sm font-bold border-2 transition-all"
                        style={{
                          borderColor: active ? BRAND : "#e5e7eb",
                          background:  active ? BRAND : "#fff",
                          color:       active ? "#fff" : "#666",
                        }}>
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </Section>

        {/* ── 3. العروض والخصومات ──────────────────────────────────── */}
        <Section icon={<Gift className="w-5 h-5" />} title="العروض والخصومات">

          {/* Promo banner */}
          <div className="mb-1">
            <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3">بانر العرض الترويجي</p>

            <ToggleRow
              label="تفعيل بانر الخصم"
              sub="يظهر للعملاء في صفحة القائمة وعند الدفع"
              active={s.promoEnabled}
              onToggle={() => setS(p => ({ ...p, promoEnabled: !p.promoEnabled }))}
            />

            {s.promoEnabled && (
              <div className="mt-4 grid sm:grid-cols-2 gap-4">
                <Field label="نسبة الخصم (%)">
                  <input type="number" min={1} max={100}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-red-400"
                    value={s.promoPercent}
                    onChange={e => setS(p => ({ ...p, promoPercent: Number(e.target.value) }))} />
                </Field>
                <Field label="رسالة البانر">
                  <input type="text" maxLength={120} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-red-400"
                    placeholder="اطلب الآن واحصل على خصم 10%!"
                    value={s.promoMessage}
                    onChange={e => setS(p => ({ ...p, promoMessage: e.target.value }))} />
                </Field>

                {/* Preview */}
                <div className="sm:col-span-2 rounded-xl p-3 border-2 border-dashed text-sm font-bold flex items-center gap-2"
                  style={{ borderColor: YELLOW, background: "#fffbeb", color: "#92400e" }}>
                  <Tag className="w-4 h-4 flex-shrink-0" style={{ color: YELLOW }} />
                  {s.promoMessage || "رسالة العرض ستظهر هنا"}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 my-4" />

          {/* First-order discount */}
          <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3">خصم أول طلب</p>

          <ToggleRow
            label="تفعيل خصم أول طلب التلقائي"
            sub="يُطبَّق تلقائياً بدون كود للعملاء الجدد"
            active={s.firstOrderDiscountEnabled}
            onToggle={() => setS(p => ({ ...p, firstOrderDiscountEnabled: !p.firstOrderDiscountEnabled }))}
          />

          {s.firstOrderDiscountEnabled && (
            <div className="mt-4 grid sm:grid-cols-2 gap-4">
              <Field label="نسبة خصم أول طلب (%)">
                <input type="number" min={1} max={100}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-red-400"
                  value={s.firstOrderDiscountPercent}
                  onChange={e => setS(p => ({ ...p, firstOrderDiscountPercent: Number(e.target.value) }))} />
              </Field>
              <Field label="أقصى قيمة للخصم (ريال)">
                <input type="number" min={1}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-red-400"
                  value={s.firstOrderDiscountMax}
                  onChange={e => setS(p => ({ ...p, firstOrderDiscountMax: Number(e.target.value) }))} />
              </Field>
            </div>
          )}
        </Section>

        {/* ── 4. صور البانر المتحرك ────────────────────────────────── */}
        <Section icon={<Upload className="w-5 h-5" />} title="صور البانر المتحرك">
          <div className="grid sm:grid-cols-3 gap-4">
            {[0, 1, 2].map(index => {
              const banner = s.banners[index] || "";
              return (
                <div key={index} className="border-2 border-dashed border-gray-200 rounded-xl p-3 text-center">
                  {banner ? (
                    <img src={banner} alt={`بانر ${index + 1}`} className="w-full aspect-video object-cover rounded-lg mb-3" />
                  ) : (
                    <div className="w-full aspect-video rounded-lg bg-gray-50 flex items-center justify-center text-xs text-gray-400 mb-3">
                      لا توجد صورة
                    </div>
                  )}
                  <label className="flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-lg cursor-pointer hover:border-red-400 text-gray-600 text-sm font-bold">
                    <Upload className="w-4 h-4" />
                    {bannerLoading === index ? "جاري الرفع..." : banner ? "تغيير الصورة" : "رفع صورة"}
                    <input type="file" accept="image/*" className="hidden" onChange={e => handleBanner(index, e)} />
                  </label>
                  {banner && (
                    <button onClick={() => setS(prev => ({ ...prev, banners: prev.banners.map((item, i) => i === index ? "" : item) }))}
                      className="text-red-500 text-xs font-bold mt-2">حذف الصورة</button>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-3">تظهر الصور للعميل فوق قائمة الوجبات وتتحرك تلقائياً كل 3 ثوانٍ</p>
        </Section>

        {/* ── 4. بيانات المتجر ─────────────────────────────────────── */}
        <Section icon={<Store className="w-5 h-5" />} title="بيانات المتجر">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="اسم المتجر" className="sm:col-span-2">
              <input type="text" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-red-400"
                value={s.shopName}
                onChange={e => setS(p => ({ ...p, shopName: e.target.value }))} />
            </Field>
            <Field label="رابط قوقل ماب" className="sm:col-span-2">
              <input type="text" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-red-400"
                value={s.mapLink}
                onChange={e => setS(p => ({ ...p, mapLink: e.target.value }))} />
            </Field>
            <Field label="خط العرض (Lat)">
              <input type="number" step="any" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-red-400"
                value={s.shopLat}
                onChange={e => setS(p => ({ ...p, shopLat: Number(e.target.value) }))} />
            </Field>
            <Field label="خط الطول (Lng)">
              <input type="number" step="any" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-red-400"
                value={s.shopLng}
                onChange={e => setS(p => ({ ...p, shopLng: Number(e.target.value) }))} />
            </Field>
          </div>

          {/* QR */}
          <div className="mt-4 border-t pt-4">
            <label className="text-sm font-bold text-gray-700 mb-2 block">
              🏦 صورة QR للتحويل البنكي
            </label>
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-red-400 text-gray-500 text-sm flex-shrink-0">
                <Upload className="w-4 h-4" />
                {qrLoading ? "جاري الرفع..." : s.qrImage ? "تغيير الصورة" : "رفع صورة QR"}
                <input type="file" accept="image/*" className="hidden" onChange={handleQr} />
              </label>
              {s.qrImage && (
                <div className="flex items-center gap-3">
                  <img src={s.qrImage} alt="QR" className="w-20 h-20 object-contain rounded-xl border border-gray-200 bg-white" />
                  <button onClick={() => setS(p => ({ ...p, qrImage: "" }))} className="text-red-400 text-xs font-bold">حذف</button>
                </div>
              )}
              {!s.qrImage && (
                <p className="text-xs text-gray-400">ستظهر للعميل عند اختيار التحويل البنكي</p>
              )}
            </div>
          </div>
        </Section>

      </main>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t shadow-lg p-4 z-20">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {saved && (
            <span className="text-green-600 font-bold text-sm flex items-center gap-1 flex-shrink-0">
              ✓ تم الحفظ
            </span>
          )}
          <button onClick={save}
            className="flex-1 py-3 rounded-xl text-white font-black text-base flex items-center justify-center gap-2 transition-all"
            style={{ background: saved ? "#16a34a" : `linear-gradient(135deg,${BRAND},#8B0000)` }}>
            <Save className="w-5 h-5" />
            {saved ? "تم حفظ الإعدادات ✓" : "حفظ جميع الإعدادات"}
          </button>
        </div>
      </div>

    </div>
  );
}

/* ── Sub-components ────────────────────────────────────────────── */

function Section({ icon, title, children }: {
  icon: React.ReactNode; title: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow p-5">
      <h2 className="font-black text-gray-800 mb-4 flex items-center gap-2 text-base">
        <span style={{ color: BRAND }}>{icon}</span>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Field({ label, children, className }: {
  label: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-xs text-gray-500 mb-1 block font-bold">{label}</label>
      {children}
    </div>
  );
}

function ToggleRow({ label, sub, active, onToggle, color }: {
  label: string; sub?: string; active: boolean; onToggle: () => void; color?: string;
}) {
  return (
    <label className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer gap-3">
      <div className="min-w-0">
        <p className="font-bold text-sm text-gray-800">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <button onClick={e => { e.preventDefault(); onToggle(); }} className="flex-shrink-0">
        {active
          ? <ToggleRight className="w-7 h-7" style={{ color: color ?? "#22c55e" }} />
          : <ToggleLeft  className="w-7 h-7 text-gray-400" />}
      </button>
    </label>
  );
}

/* Tailwind can't purge dynamic classes — define shared styles inline */
declare module "react" {
  interface HTMLAttributes<T> {
    className?: string;
  }
}

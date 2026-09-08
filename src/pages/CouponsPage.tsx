/**
 * Admin — Coupon Management  /admin/coupons
 * Requires same session as ReceptionPage (twelve_reception_session = "1")
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Plus, Trash2, Edit2, Tag, ArrowRight, ToggleLeft, ToggleRight } from "lucide-react";
import {
  getCoupons, refreshCoupons, addCoupon, updateCoupon, deleteCoupon,
  couponStatus, type Coupon, type DiscountType, type AppliesTo,
} from "@/lib/couponStore";
import { endSession, hasSession, startSession } from "@/lib/authSession";

const BRAND  = "#C8102E";
const YELLOW = "#FFB81C";
const ADMIN_SESSION_KEY = "twelve_reception_session";

const STATUS_COLORS: Record<string, string> = {
  "مفعّل":  "#22c55e",
  "لم يبدأ": "#f59e0b",
  "منتهي":  "#ef4444",
  "مستنفد": "#ef4444",
  "معطّل":  "#9ca3af",
};

const EMPTY_FORM = {
  code: "",
  discountType: "percent" as DiscountType,
  discountValue: 10,
  minOrder: 0,
  startDate: new Date().toISOString().split("T")[0],
  endDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
  maxUses: 0,
  appliesTo: "all" as AppliesTo,
  active: true,
};

export default function CouponsPage() {
  const [, navigate] = useLocation();
  const [authed, setAuthed]     = useState(false);
  const [password, setPassword] = useState("");
  const [pwError, setPwError]   = useState(false);

  const [coupons, setCoupons]   = useState<Coupon[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Coupon | null>(null);
  const [form, setForm]         = useState({ ...EMPTY_FORM });
  const [saving, setSaving]     = useState(false);

  /* ── auth ────────────────────────────────────────────────────── */
  useEffect(() => {
    if (hasSession(ADMIN_SESSION_KEY)) setAuthed(true);
  }, []);

  const login = () => {
    if (password === "4321") {
      startSession(ADMIN_SESSION_KEY);
      setAuthed(true);
    } else {
      setPwError(true);
    }
  };

  /* ── data ────────────────────────────────────────────────────── */
  const reload = async () => setCoupons(await refreshCoupons());
  useEffect(() => {
    void reload();
    const onDataUpdated = () => { void reload(); };
    window.addEventListener("twelve-data-updated", onDataUpdated);
    return () => window.removeEventListener("twelve-data-updated", onDataUpdated);
  }, []);

  /* ── modal helpers ────────────────────────────────────────────── */
  const openNew = () => {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  };

  const openEdit = (c: Coupon) => {
    setEditTarget(c);
    setForm({
      code:          c.code,
      discountType:  c.discountType,
      discountValue: c.discountValue,
      minOrder:      c.minOrder,
      startDate:     c.startDate,
      endDate:       c.endDate,
      maxUses:       c.maxUses,
      appliesTo:     c.appliesTo,
      active:        c.active,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.code.trim()) return;
    setSaving(true);
    if (editTarget) {
      await updateCoupon({
        ...editTarget,
        code:          form.code.toUpperCase().trim(),
        discountType:  form.discountType,
        discountValue: form.discountValue,
        minOrder:      form.minOrder,
        startDate:     form.startDate,
        endDate:       form.endDate,
        maxUses:       form.maxUses,
        appliesTo:     form.appliesTo,
        active:        form.active,
      });
    } else {
      await addCoupon({
        code:          form.code.toUpperCase().trim(),
        discountType:  form.discountType,
        discountValue: form.discountValue,
        minOrder:      form.minOrder,
        startDate:     form.startDate,
        endDate:       form.endDate,
        maxUses:       form.maxUses,
        appliesTo:     form.appliesTo,
        active:        form.active,
      });
    }
    await reload();
    setSaving(false);
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("حذف هذا الكود؟")) return;
    await deleteCoupon(id);
    await reload();
  };

  const toggleActive = async (c: Coupon) => {
    await updateCoupon({ ...c, active: !c.active });
    await reload();
  };

  const f = (key: keyof typeof form, val: unknown) =>
    setForm(prev => ({ ...prev, [key]: val }));

  /* ── login screen ─────────────────────────────────────────────── */
  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f5f5f5" }}>
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm text-center space-y-4">
          <Tag className="w-10 h-10 mx-auto" style={{ color: BRAND }} />
          <h2 className="font-black text-xl text-gray-800">أكواد الخصم</h2>
          <input
            type="password" placeholder="كلمة المرور"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-center outline-none focus:border-red-400"
            value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && login()}
          />
          {pwError && <p className="text-red-500 text-sm">كلمة المرور غير صحيحة</p>}
          <button onClick={login}
            className="w-full py-3 rounded-xl text-white font-bold"
            style={{ background: BRAND }}>
            دخول
          </button>
        </div>
      </div>
    );
  }

  /* ── main ─────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#f5f5f5" }}>
      {/* header */}
      <header style={{ background: `linear-gradient(135deg,${BRAND},#8B0000)` }} className="text-white px-4 py-4 shadow-lg sticky top-0 z-10">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => navigate("/admin/orders")}
              className="flex items-center gap-1.5 text-sm font-bold hover:bg-white/20 px-3 py-1.5 rounded-xl">
              <ArrowRight className="w-4 h-4" /> الطلبات
            </button>
            <span className="font-black text-lg flex items-center gap-2">
              <Tag className="w-5 h-5" /> أكواد الخصم
            </span>
            <button onClick={openNew}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-sm"
              style={{ background: YELLOW, color: "#7a1a00" }}>
              <Plus className="w-4 h-4" /> إضافة كود
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full p-4">
        {coupons.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Tag className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="font-bold text-lg">لا توجد أكواد خصم بعد</p>
            <p className="text-sm">اضغط "إضافة كود" لإنشاء أول كود</p>
          </div>
        ) : (
          <div className="space-y-3">
            {coupons.map(c => {
              const st = couponStatus(c);
              return (
                <div key={c.id} className="bg-white rounded-2xl shadow p-4">
                  <div className="flex items-start justify-between gap-3">
                    {/* left: code + badges */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="font-black text-xl tracking-wider" style={{ color: BRAND }}>{c.code}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold text-white"
                          style={{ background: STATUS_COLORS[st] ?? "#9ca3af" }}>
                          {st}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-bold">
                          {c.appliesTo === "all" ? "كل الطلبات" : c.appliesTo === "delivery" ? "التوصيل" : "الاستلام"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-sm text-gray-600">
                        <div>
                          <span className="text-gray-400 text-xs">الخصم: </span>
                          <span className="font-bold">
                            {c.discountType === "percent"
                              ? `${c.discountValue}%`
                              : `${c.discountValue} ر.س`}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400 text-xs">الحد الأدنى: </span>
                          <span className="font-bold">{c.minOrder} ر.س</span>
                        </div>
                        <div>
                          <span className="text-gray-400 text-xs">الاستخدامات: </span>
                          <span className="font-bold">
                            {c.usedCount}{c.maxUses > 0 ? ` / ${c.maxUses}` : ""}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400 text-xs">الصلاحية: </span>
                          <span className="font-bold text-xs">{c.startDate} → {c.endDate}</span>
                        </div>
                      </div>
                    </div>

                    {/* right: actions */}
                    <div className="flex flex-col gap-2 items-end flex-shrink-0">
                      <button onClick={() => toggleActive(c)} title={c.active ? "تعطيل" : "تفعيل"}>
                        {c.active
                          ? <ToggleRight className="w-7 h-7" style={{ color: "#22c55e" }} />
                          : <ToggleLeft className="w-7 h-7 text-gray-400" />}
                      </button>
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(c)}
                          className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200">
                          <Edit2 className="w-4 h-4 text-gray-600" />
                        </button>
                        <button onClick={() => handleDelete(c.id)}
                          className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100">
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Modal ─────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background: "rgba(0,0,0,0.55)" }}>
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b flex items-center justify-between">
              <h3 className="font-black text-lg text-gray-800">
                {editTarget ? "تعديل الكود" : "إضافة كود خصم جديد"}
              </h3>
              <button onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-xl font-bold">
                ×
              </button>
            </div>
            <div className="p-5 space-y-4">

              {/* Code name */}
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-1">اسم الكود *</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 font-black tracking-wider text-right outline-none focus:border-red-400 uppercase"
                  placeholder="مثال: TWELF10"
                  value={form.code}
                  onChange={e => f("code", e.target.value.toUpperCase())}
                />
              </div>

              {/* Discount type + value */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-1">نوع الخصم</label>
                  <select
                    className="w-full border border-gray-200 rounded-xl px-3 py-3 text-right outline-none focus:border-red-400"
                    value={form.discountType}
                    onChange={e => f("discountType", e.target.value as DiscountType)}>
                    <option value="percent">نسبة %</option>
                    <option value="fixed">مبلغ ثابت ريال</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-1">
                    قيمة الخصم {form.discountType === "percent" ? "(%)" : "(ر.س)"}
                  </label>
                  <input type="number" min={0}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right outline-none focus:border-red-400"
                    value={form.discountValue}
                    onChange={e => f("discountValue", parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              {/* Min order */}
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-1">الحد الأدنى للطلب (ر.س)</label>
                <input type="number" min={0}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right outline-none focus:border-red-400"
                  placeholder="0 = بدون حد أدنى"
                  value={form.minOrder}
                  onChange={e => f("minOrder", parseFloat(e.target.value) || 0)}
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-1">تاريخ البداية</label>
                  <input type="date"
                    className="w-full border border-gray-200 rounded-xl px-3 py-3 outline-none focus:border-red-400"
                    value={form.startDate}
                    onChange={e => f("startDate", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-1">تاريخ الانتهاء</label>
                  <input type="date"
                    className="w-full border border-gray-200 rounded-xl px-3 py-3 outline-none focus:border-red-400"
                    value={form.endDate}
                    onChange={e => f("endDate", e.target.value)}
                  />
                </div>
              </div>

              {/* Max uses */}
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-1">عدد مرات الاستخدام الكلي (0 = بلا حد)</label>
                <input type="number" min={0}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right outline-none focus:border-red-400"
                  value={form.maxUses}
                  onChange={e => f("maxUses", parseInt(e.target.value) || 0)}
                />
              </div>

              {/* Applies to */}
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-1">يشتغل على</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["all", "delivery", "pickup"] as AppliesTo[]).map(a => (
                    <button key={a} onClick={() => f("appliesTo", a)}
                      className="py-2 rounded-xl text-sm font-bold border-2"
                      style={{
                        borderColor: form.appliesTo === a ? BRAND : "#eee",
                        background:  form.appliesTo === a ? BRAND : "#fff",
                        color:       form.appliesTo === a ? "#fff" : "#555",
                      }}>
                      {a === "all" ? "كل الطلبات" : a === "delivery" ? "التوصيل فقط" : "الاستلام فقط"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active toggle */}
              <label className="flex items-center justify-between cursor-pointer p-3 bg-gray-50 rounded-xl">
                <span className="font-bold text-gray-700">الكود مفعّل</span>
                <button onClick={() => f("active", !form.active)}
                  className="flex-shrink-0">
                  {form.active
                    ? <ToggleRight className="w-8 h-8" style={{ color: "#22c55e" }} />
                    : <ToggleLeft className="w-8 h-8 text-gray-400" />}
                </button>
              </label>

              {/* Save */}
              <button onClick={handleSave} disabled={saving || !form.code.trim()}
                className="w-full py-3.5 rounded-xl text-white font-black text-base disabled:opacity-40"
                style={{ background: `linear-gradient(135deg,${BRAND},#8B0000)` }}>
                {editTarget ? "حفظ التعديلات" : "إضافة الكود"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

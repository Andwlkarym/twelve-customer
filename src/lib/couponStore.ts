/** Coupon / discount-code store - Firebase-backed product data. */
import { emitDataUpdated, readFirebase, writeFirebase } from "./firebaseRest";

export type DiscountType = "percent" | "fixed";
export type AppliesTo = "all" | "delivery" | "pickup";

export type Coupon = {
  id: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  minOrder: number;
  startDate: string;
  endDate: string;
  maxUses: number;
  usedCount: number;
  appliesTo: AppliesTo;
  active: boolean;
  usedByPhones: string[];
};

export type CouponStatus = "معطل" | "لم يبدأ" | "منتهي" | "مستنفد" | "مفعل";

const COUPONS_PATH = "coupons";
let couponsCache: Coupon[] = [];

/* — read — */
export function getCoupons(): Coupon[] {
  return [...couponsCache];
}

export async function refreshCoupons(): Promise<Coupon[]> {
  const remote = await readFirebase(COUPONS_PATH) as any;
  const parsed = Array.isArray(remote)? remote : remote? Object.values(remote) : [];
  couponsCache = parsed.filter(Boolean) as Coupon[];
  return getCoupons();
}

/* — write — */
async function save(coupons: Coupon[]): Promise<void> {
  couponsCache = [...coupons];
  for (const c of coupons) {
    if (!c.id) continue;
    await writeFirebase(COUPONS_PATH + "/" + c.id, c);
  }
  emitDataUpdated(COUPONS_PATH);
}

export async function addCoupon(data: Omit<Coupon, "id" | "usedCount" | "usedByPhones">): Promise<void> {
  const coupons = getCoupons();
  coupons.push({...data, id: `CP${Date.now()}`, usedCount: 0, usedByPhones: [] });
  await save(coupons);
}

export async function updateCoupon(updated: Coupon): Promise<void> {
  await save(getCoupons().map(c => c.id === updated.id? updated : c));
}

export async function deleteCoupon(id: string): Promise<void> {
  await save(getCoupons().filter(c => c.id!== id));
}

/** Mark coupon used by a phone - call after order is placed */
export async function applyCouponUsage(id: string, phone: string): Promise<void> {
  const coupons = getCoupons();
  const idx = coupons.findIndex(c => c.id === id);
  if (idx === -1) return;
  coupons[idx] = {
   ...coupons[idx],
    usedCount: (coupons[idx].usedCount || 0) + 1,
    usedByPhones: [...(coupons[idx].usedByPhones || []), phone],
  };
  await save(coupons);
}

/* — validation — */
export type ValidationResult =
  | { valid: true; coupon: Coupon; discount: number }
  | { valid: false; error: string };

export function validateCoupon(
  code: string,
  phone: string,
  subtotal: number,
  orderType: "استلام" | "توصيل",
): ValidationResult {
  const coupons = getCoupons();
  const coupon = coupons.find(c => c.code === code.trim().toUpperCase());

  if (!coupon) return { valid: false, error: "الكود غير صالح" };
  if (!coupon.active) return { valid: false, error: "الكود غير مفعل" };

  const today = new Date().toISOString().split("T")[0];
  if (today < coupon.startDate) return { valid: false, error: "الكود لم يبدأ بعد" };
  if (today > coupon.endDate) return { valid: false, error: "انتهت صلاحية الكود" };

  if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses)
    return { valid: false, error: "الكود مستنفد" };

  if (phone && (coupon.usedByPhones || []).includes(phone.trim()))
    return { valid: false, error: "استخدمت هذا الكود من قبل" };

  if (subtotal < coupon.minOrder)
    return { valid: false, error: `الحد الأدنى للطلب ${coupon.minOrder} ر.س` };

  if (coupon.appliesTo === "delivery" && orderType!== "توصيل")
    return { valid: false, error: "هذا الكود للتوصيل فقط" };

  if (coupon.appliesTo === "pickup" && orderType!== "استلام")
    return { valid: false, error: "هذا الكود للاستلام من الفرع فقط" };

  const discount = coupon.discountType === "percent"
   ? Math.min(subtotal * coupon.discountValue / 100, subtotal)
    : Math.min(coupon.discountValue, subtotal);

  return { valid: true, coupon, discount: Math.round(discount * 100) / 100 };
}

/* — status helper — */
export function couponStatus(c: Coupon): CouponStatus {
  if (!c.active) return "معطل";
  const today = new Date().toISOString().split("T")[0];
  if (today < c.startDate) return "لم يبدأ";
  if (today > c.endDate) return "منتهي";
  if (c.maxUses > 0 && c.usedCount >= c.maxUses) return "مستنفد";
  return "مفعل";
}
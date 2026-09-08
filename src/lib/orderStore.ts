/**
 * Shared order store — Firebase Realtime Database so Customer, Reception and
 * Delivery pages share the same orders across devices and sessions.
 */
import { emitDataUpdated, firebaseKey, readFirebase, writeFirebase } from "./firebaseRest";

export type TrackStatus =
  | "تم استلام الطلب"
  | "جاري التحضير"
  | "قيد التحضير"
  | "جاهز للاستلام"
  | "في الطريق"
  | "تم التوصيل"
  | "مرفوض"
  | "ملغي";

export type AdminStatus =
  | "جديد"
  | "قيد التحضير"
  | "جاهز"
  | "مكتمل"
  | "مرفوض"
  | "ملغي";
export type OrderType = "استلام" | "توصيل";

export type StoredOrder = {
  id: string;
  orderNumber?: number;
  orderCode?: string;
  customerName: string;
  customerPhone: string;
  orderType: OrderType;
  area: string;
  notes: string;
  items: { name: string; qty: number; price: number }[];
  subtotal: number;
  tax: number;
  deliveryFee: number;
  amount: string;        // grand total formatted
  payMethod: string;
  receiptImage?: string; // base64 — only for bank-transfer orders
  receiptApproved?: boolean;
  /* discount fields */
  couponCode?:         string;   // code used (if any)
  couponDiscount?:     number;   // SAR deducted by coupon
  firstOrderDiscount?: number;   // SAR deducted by first-order promo
  promoDiscount?:      number;   // SAR deducted by promotional banner
  trackStatus: TrackStatus;
  adminStatus: AdminStatus;
  lat?: number;
  lng?: number;
  createdAt: number;
  updatedAt: number;
};

const ORDERS_PATH = "orders";
const USERS_PATH = "users";
let ordersCache: Record<string, StoredOrder> = {};
let activeOrderIdCache: string | null = null;

/* ── read ─────────────────────────────────────────────────────── */

export function getAllOrders(): Record<string, StoredOrder> {
  return { ...ordersCache };
}

export function getOrder(id: string): StoredOrder | null {
  return ordersCache[id] ?? null;
}

export function getActiveOrderId(): string | null {
  return activeOrderIdCache;
}

export async function refreshOrders(): Promise<Record<string, StoredOrder>> {
const remote = await readFirebase(ORDERS_PATH) as Record<string, StoredOrder> | null;
  ordersCache = remote ?? {};
  return getAllOrders();
}
export async function refreshActiveOrderId(phone?: string | null): Promise<string | null> {
  const normalizedPhone = (phone || "").toString().trim();

if (!normalizedPhone) return null;
  activeOrderIdCache = await readFirebase(
    `${USERS_PATH}/${firebaseKey(normalizedPhone)}/activeOrderId`,
  ) as string | null;
  return activeOrderIdCache;
}

/* ── write ────────────────────────────────────────────────────── */

export async function createOrder(order: Omit<StoredOrder, "updatedAt">): Promise<void> {
  const storedOrder = { ...order, updatedAt: order.createdAt };
  ordersCache[order.id] = storedOrder;
  activeOrderIdCache = order.id;
  await Promise.all([
    writeFirebase(`${ORDERS_PATH}/${firebaseKey(order.id)}`, storedOrder),
    writeFirebase(
      `${USERS_PATH}/${firebaseKey(order.customerPhone)}/activeOrderId`,
      order.id,
    ),
  ]);
  emitDataUpdated(ORDERS_PATH);
}

export async function updateTrackStatus(id: string, trackStatus: TrackStatus): Promise<void> {
  if (!ordersCache[id]) return;
  const updated = { ...ordersCache[id], trackStatus, updatedAt: Date.now() };
  ordersCache[id] = updated;
  await writeFirebase(`${ORDERS_PATH}/${firebaseKey(id)}`, updated);
  emitDataUpdated(ORDERS_PATH);
}

export async function updateAdminStatus(id: string, adminStatus: AdminStatus): Promise<void> {
  if (!ordersCache[id]) return;
  const updated = { ...ordersCache[id], adminStatus, updatedAt: Date.now() };
  ordersCache[id] = updated;
  await writeFirebase(`${ORDERS_PATH}/${firebaseKey(id)}`, updated);
  emitDataUpdated(ORDERS_PATH);
}

export async function updateBothStatuses(
  id: string,
  adminStatus: AdminStatus,
  trackStatus: TrackStatus,
): Promise<void> {
  if (!ordersCache[id]) return;
  const updated = { ...ordersCache[id], adminStatus, trackStatus, updatedAt: Date.now() };
  ordersCache[id] = updated;
  await writeFirebase(`${ORDERS_PATH}/${firebaseKey(id)}`, updated);
  emitDataUpdated(ORDERS_PATH);
}

export async function approveReceipt(id: string): Promise<void> {
  if (!ordersCache[id]) return;
  const updated = { ...ordersCache[id], receiptApproved: true, updatedAt: Date.now() };
  ordersCache[id] = updated;
  await writeFirebase(`${ORDERS_PATH}/${firebaseKey(id)}`, updated);
  emitDataUpdated(ORDERS_PATH);
}

/* ── helpers ──────────────────────────────────────────────────── */

export function generateOrderId(): string {
  return `TW${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

/** Check whether a phone has any prior non-rejected orders */
export function isFirstOrderForPhone(phone: string): boolean {
  const orders = Object.values(ordersCache);
  return !orders.some(
    o => o.customerPhone.trim() === phone.trim() && o.adminStatus !== "مرفوض",
  );
}

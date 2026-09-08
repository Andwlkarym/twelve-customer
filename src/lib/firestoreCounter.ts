import { initializeApp, getApps } from "firebase/app";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import type { StoredOrder } from "./orderStore";

const firebaseConfig = {
  apiKey: "AIzaSyBrcBeV4Vxt51lgWbsFc1RRxWFsYEWx9jc",
  authDomain: "food-delivery-arabic.firebaseapp.com",
  projectId: "food-delivery-arabic",
  storageBucket: "food-delivery-arabic.firebasestorage.app",
  messagingSenderId: "334450775577",
  appId: "1:334450775577:web:b455cac674f26385eb3c88",
};

const app = getApps()[0] || initializeApp(firebaseConfig);
export const db = getFirestore(app);

export function cleanUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => cleanUndefined(item)) as T;
  }
  if (value && typeof value === "object" &&
      (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, cleanUndefined(item)]),
    ) as T;
  }
  return value;
}

export async function reserveOrderNumber(): Promise<number> {
  const counterRef = doc(db, "counters", "orders");
  return runTransaction(db, async transaction => {
    const snapshot = await transaction.get(counterRef);
    const next = (snapshot.data()?.current || 1000) + 1;
    if (snapshot.exists()) {
      transaction.update(counterRef, { current: next });
    } else {
      transaction.set(counterRef, { current: next });
    }
    return next;
  });
}

export async function saveOrderToFirestore(order: StoredOrder, customer: { id?: string | number; name: string; phone: string }) {
  const orderData = {
    ...order,
    customerId: customer.id ?? customer.phone,
    customerName: customer.name,
    customerPhone: customer.phone,
    createdAt: serverTimestamp(),
  };
  await setDoc(doc(db, "orders", order.id), cleanUndefined(orderData), { merge: true });
}

export async function getCustomerOrders(phone: string): Promise<StoredOrder[]> {
  let customer: any = null;
  try { customer = JSON.parse(localStorage.getItem("customer_current") || "null"); } catch {}
  const customerPhone = customer?.phone || phone;
  console.log("customerPhone", customerPhone);
  const normalizedPhone = customerPhone.replace(/\D/g, "").replace(/^966/, "").replace(/^0/, "");
  const snapshot = await getDocs(collection(db, "orders"));
  return snapshot.docs.map(item => {
    const data = item.data() as any;
    return { ...data, id: data.id || item.id, createdAt: data.createdAt?.toMillis?.() || Date.now() } as StoredOrder;
  }).filter(order => String(order.customerPhone || "").replace(/\D/g, "").replace(/^966/, "").replace(/^0/, "") === normalizedPhone)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveCustomerDocument(customer: { name: string; phone: string }) {
  const customerPhone = customer.phone.replace(/\D/g, "").replace(/^966/, "").replace(/^0/, "");
  if (!/^5\d{8}$/.test(customerPhone)) throw new Error("رقم الجوال يجب أن يتكون من 10 أرقام");
  const customerRef = doc(db, "customers", customerPhone);
  const snapshot = await getDocs(collection(db, "customers"));
  await Promise.all(snapshot.docs
    .filter(item => item.id !== customerPhone && String(item.data().phone || "").replace(/\D/g, "").replace(/^966/, "").replace(/^0/, "") === customerPhone)
    .map(item => deleteDoc(item.ref)));
  await setDoc(customerRef, cleanUndefined({
    ...customer,
    phone: `0${customerPhone}`,
    updatedAt: serverTimestamp(),
  }), { merge: true });
}

export async function getCustomerDocuments() {
  const snapshot = await getDocs(collection(db, "customers"));
  const grouped = new Map<string, { data: any; refs: typeof snapshot.docs }>();
  snapshot.docs.forEach(item => {
    const data = item.data() as any;
    const phone = String(data.phone || "").replace(/\D/g, "").replace(/^966/, "").replace(/^0/, "");
    if (!phone) return;
    const group = grouped.get(phone) || { data, refs: [] as unknown as typeof snapshot.docs };
    group.refs.push(item);
    grouped.set(phone, group);
  });
  const customers = await Promise.all(Array.from(grouped.entries()).map(async ([phone, group]) => {
    const canonicalRef = doc(db, "customers", phone);
    if (group.refs.some(item => item.id !== phone)) {
      await setDoc(canonicalRef, cleanUndefined({ ...group.data, phone: `0${phone}` }), { merge: true });
      await Promise.all(group.refs.filter(item => item.id !== phone).map(item => deleteDoc(item.ref)));
    }
    return { id: phone, ...group.data, phone: `0${phone}` };
  }));
  return customers;
}

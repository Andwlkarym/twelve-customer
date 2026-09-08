// @ts-nocheck
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  addDoc 
} from "firebase/firestore";
import { db } from "./firestoreCounter";

const cleanPath = (p: string) => p.replace(/^\//, "").replace(/\.json$/, "");

async function readFirebaseFn(path: string) {
  try {
    let clean = cleanPath(path);
    if (clean === "sections" || clean === "/sections" || clean === "/sections/") clean = "sections";
    if (clean === "settings" || clean === "products/settings") clean = "settings/main";
    if (clean === "items") clean = "products";
    
    // معالجة خاصة لـ settings/main
    if (clean === "settings/main" || clean.includes("/")) {
      const parts = clean.split("/").filter(Boolean);
      if (parts.length === 2) {
        const snap = await getDoc(doc(db, parts[0], parts[1]));
        return snap.exists() ? snap.data() : null;
      }
          if (parts.length === 3) {
      const parentSnap = await getDoc(doc(db, parts[0], parts[1]));
      if (!parentSnap.exists()) return null;
      return (parentSnap.data() as any)[parts[2]] || null;
    }
      if (parts.length === 1) {
        const colRef = collection(db, parts[0]);
        const snap = await getDocs(colRef);
        const data: any = {};
        snap.forEach(d => { data[d.id] = { id: d.id, ...d.data() }; });
        // لو settings رجع أول doc
        if (parts[0] === "settings" && data["main"]) return data["main"];
        return Object.keys(data).length ? data : null;
      }
    }
    
    // collection عادية
    const colRef = collection(db, clean);
    const snap = await getDocs(colRef);
    const data: any = {};
    snap.forEach(d => { data[d.id] = { id: d.id, ...d.data() }; });
    return Object.keys(data).length ? data : null;
  } catch (e) {
    console.error("read failed", path, e);
    return null;
  }
}

async function writeFirebaseFn(path: string, data: any) {
  try {
    let clean = cleanPath(path);
    if (clean === "sections") clean = "sections";
    if (clean === "settings" || clean === "products/settings") clean = "settings/main";
    if (clean === "products") clean = "products";
    if (clean === "settings/main") {
      await setDoc(doc(db, "settings", "main"), data, { merge: true });
      return;
    }

    // هذا السطر يحل مشكلة couponCode undefined
    const noUndefined = JSON.parse(JSON.stringify(data, (k,v) => v===undefined? null : v));

    const parts = clean.split("/").filter(Boolean);

    // هذا اللي يحل مشكلتك اللي في الصورة users/058.../profile
    if (parts.length === 3) {
      await setDoc(doc(db, parts[0], parts[1]), { [parts[2]]: noUndefined }, { merge: true });
      return;
    }

    const docId = parts.pop()!;
    const colPath = parts.join("/") || "sections";
    await setDoc(doc(db, colPath, docId), noUndefined, { merge: true });

  } catch (e) { console.error("write failed", path, e); }
}

async function pushFirebaseFn(path: string, data: any) {
  try {
    let clean = cleanPath(path);
    if (clean === "items") clean = "products";
    if (clean === "sections" || clean.includes("sections")) clean = "sections";
    const colRef = collection(db, clean);
    const res = await addDoc(colRef, data);
    return res.id;
  } catch (e) { console.error("push failed", path, e); return null; }
}

async function updateFirebaseFn(path: string, data: any) {
  try {
    let clean = cleanPath(path);
    if (clean === "settings" || clean === "products/settings") clean = "settings/main";
    const parts = clean.split("/").filter(Boolean);
    const docId = parts.pop()!;
    const colPath = parts.join("/");
    await updateDoc(doc(db, colPath, docId), data);
  } catch (e) { console.error("update failed", path, e); }
}

async function removeFirebaseFn(path: string) {
  try {
    const parts = cleanPath(path).split("/").filter(Boolean);
    const docId = parts.pop()!;
    const colPath = parts.join("/");
    await deleteDoc(doc(db, colPath, docId));
  } catch (e) { console.error("remove failed", path, e); }
}

export const readFirebase = readFirebaseFn;
export const writeFirebase = writeFirebaseFn;
export const updateFirebase = updateFirebaseFn;
export const removeFirebase = removeFirebaseFn;
export const pushFirebase = pushFirebaseFn;

export const readFirebaseRest = readFirebaseFn;
export const writeFirebaseRest = writeFirebaseFn;
export const updateFirebaseRest = updateFirebaseFn;
export const removeFirebaseRest = removeFirebaseFn;
export const pushFirebaseRest = pushFirebaseFn;

export const firebaseRest = {
  push: pushFirebaseFn, read: readFirebaseFn, get: readFirebaseFn,
  list: readFirebaseFn, fetch: readFirebaseFn, update: updateFirebaseFn,
  remove: removeFirebaseFn, delete: removeFirebaseFn, set: writeFirebaseFn,
  write: writeFirebaseFn, put: writeFirebaseFn, post: pushFirebaseFn,
};

export const ITEMS_PATH = "products";
export const CATEGORIES_PATH = "sections";
export const ORDERS_PATH = "orders";
export const CUSTOMERS_PATH = "customers";
export const COUPONS_PATH = "coupons";
export const SECTIONS_PATH = "sections";
export const SETTINGS_PATH = "settings/main";
export const DELIVERY_PATH = "delivery";

export const firebaseKey = (key: string) => {
  if (!key) return key;
  return String(key).replace(/[.#$\[\]]/g, "_");
};
export const deleteFirebase = async (path: string) => {
  try {
    // لا تستخدم cleanPath هنا لأنه يحذف products/
    let clean = path.replace(/^\//, "").replace(/\.json$/, "").trim();
    if (!clean) return;
    
    const parts = clean.split("/").filter(Boolean);
    if (parts.length < 2) {
      console.warn("skip delete, need collection/doc", clean);
      return;
    }
    
    const docId = parts.pop()!;
    const colPath = parts.join("/");
    if (!colPath || !docId) return;
    
    await deleteDoc(doc(db, colPath, docId));
  } catch (e) {
    console.error("delete failed", path, e);
  }
};

export const emitDataUpdated = (path?: string) => {
  window.dispatchEvent(new CustomEvent("data-updated", { detail: path }));
  window.dispatchEvent(new CustomEvent("twelve-data-updated", { detail: path }));
};
/**
 * Section store — manages Firebase-backed menu sections/categories.
 */
import { readFirebase, writeFirebase, deleteFirebase, emitDataUpdated } from "./firebaseRest";

export type Section = {
  id?: string;
  name: string;
  active: boolean;
};

const SECTION_PATH = "sections";
const LEGACY_PATH = "sections/sections"; // هذا هو الخربان
const EXTRA_PATHS = ["sections", "categories"];

export const DEFAULT_SECTIONS: Section[] = [];
let sectionsCache: Section[] = [];

export function getSections(): Section[] {
  return [...sectionsCache];
}

export async function refreshSections(): Promise<Section[]> {
  // اقرا من المكان الصحيح
  let remote: any = await readFirebase(SECTION_PATH);
  
  // لو ما لقى، شف المكان القديم الخربان
  if (!remote) {
    remote = await readFirebase(LEGACY_PATH);
  }

  let parsed: any[] = [];
  if (Array.isArray(remote)) {
    parsed = remote;
  } else if (remote && typeof remote === "object") {
    // لو هو object زي { عبدالكريم: {...}, sections: {...} }
    parsed = Object.entries(remote).map(([id, value]: [string, any]) => ({
      id,
      ...(value || {}),
      name: value?.name || value?.title || id,
    }));
  }

  // نظف الزبالة sections و coupons
  const cleaned = parsed
    .map(s => ({
      id: String(s.id || s.name || "").trim(),
      name: String(s.name || s.title || s.id || "").trim(),
      active: s.active !== false,
    }))
    .filter(s => s.name && s.name !== "sections" && s.name !== "coupons" && s.id !== "sections" && s.id !== "coupons");

  if (cleaned.length > 0) {
    sectionsCache = cleaned;
  }
  return getSections();
}

async function saveAll(sections: Section[]) {
  sectionsCache = [...sections];
  // احذف الدوكومنت الخربان القديم
  try { await deleteFirebase(LEGACY_PATH); } catch {}
  try { await deleteFirebase(`${SECTION_PATH}/sections`); } catch {}
  try { await deleteFirebase(`${SECTION_PATH}/coupons`); } catch {}

  // احفظ كل قسم كـ document لحاله بـ ID انجليزي
  for (const s of sections) {
    const docId = s.id || `sec_${Date.now()}_${Math.random().toString(36).slice(2,5)}`;
    const toSave = { ...s, id: docId };
    // مهم: نستخدم docId انجليزي، لكن name يبقى عربي عادي
    await writeFirebase(`${SECTION_PATH}/${docId}`, toSave);
  }
  emitDataUpdated(SECTION_PATH);
}

export async function addSection(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  await refreshSections();
  if (sectionsCache.some(s => s.name === trimmed)) return;
  
  const newSec: Section = {
    id: `sec_${Date.now()}`,
    name: trimmed,
    active: true,
  };
  await saveAll([...sectionsCache, newSec]);
}

export async function deleteSection(name: string) {
  await refreshSections();
  const target = sectionsCache.find(s => s.name === name || s.id === name);
  if (target?.id) {
    try { await deleteFirebase(`${SECTION_PATH}/${target.id}`); } catch {}
  }
  // احذف بأي طريقة
  try { await deleteFirebase(`${SECTION_PATH}/${name}`); } catch {}
  try { await deleteFirebase(`${LEGACY_PATH}`); } catch {}

  const filtered = sectionsCache.filter(s => s.name !== name && s.id !== name);
  sectionsCache = filtered;
  // اعد كتابة الباقي نظيف
  await saveAll(filtered);
}

export function getActiveSections() {
  return getSections().filter(s => s.active);
}

export function getSectionNames() {
return getActiveSections().map(s => s.name);
}

export async function toggleSection(name: string, active: boolean) {
  await refreshSections();
  const updated = sectionsCache.map(s => s.name === name ? { ...s, active } : s);
  await saveAll(updated);
}

// شغلها مرة وحدة عند بداية الصفحة
refreshSections();
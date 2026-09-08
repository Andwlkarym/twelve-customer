// @ts-nocheck
 import { create } from 'zustand'
import { firebaseRest, ITEMS_PATH, CATEGORIES_PATH } from './firebaseRest'

export type MenuItem = {
  id: string
  name: string
  price: number
  category?: string
  available?: boolean
  [key: string]: any
}

export type Category = {
  id: string
  name: string
  [key: string]: any
}

const MENU_CACHE_KEY = "twelve_menu_cache";

function toCollection(data: any): any[] {
  if (Array.isArray(data)) return data.map((value, index) => ({ id: String(index),...(value || {}) }));
  if (data && typeof data === "object") {
    return Object.entries(data)
     .filter(([id]) => id!== 'coupons' && id!== 'settings' && id!== 'main') // <-- فلتر يمنع صنف ر.س
     .map(([id, value]: [string, any]) => ({ id,...(value || {}) }));
  }
  return [];
}

async function readFirstAvailable(paths: string[]): Promise<any> {
  for (const path of paths) {
    const value = await firebaseRest.get(path);
    if (value !== null && value !== undefined) return value;
  }
  return null;
}

function extractProducts(data: any): any {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data.items ?? data.products ?? data.menu ?? data;
  }
  return data;
}

type MenuState = {
  items: MenuItem[]
  categories: Category[]
  loading: boolean
  fetchMenu: () => Promise<void>
}

const emitDataUpdated = (path: string) => {
  window.dispatchEvent(new CustomEvent('data-updated', { detail: path }))
}

export const useMenuStore = create((set: any) => ({
  items: [],
  categories: [],
  loading: false,
  fetchMenu: async () => {
    set({ loading: true });
    try {
      const [rawItems, catsData] = await Promise.all([
      readFirstAvailable([ITEMS_PATH, "products"]),
      readFirstAvailable(["sections"]),
      ]);
      const itemsData = extractProducts(rawItems);
      if (itemsData === null && catsData === null) throw new Error("menu unavailable");
      const items = toCollection(itemsData);
      const categories = toCollection(catsData);
      set({ items, categories });
      localStorage.setItem(MENU_CACHE_KEY, JSON.stringify({ items, categories }));
    } catch (e) {
      try {
        const cached = JSON.parse(localStorage.getItem(MENU_CACHE_KEY) || "null");
        if (cached) set({ items: cached.items || [], categories: cached.categories || [] });
      } catch (cacheError) {
        console.error(cacheError);
      }
    } finally {
      set({ loading: false });
    }
  },
}));

// هذا اللي كانت تدور عليه
export const refreshMenuItems = async () => {
  await useMenuStore.getState().fetchMenu();
  return useMenuStore.getState().items;
};

export const getActiveMenuItems = (): MenuItem[] => {
  const state = useMenuStore.getState();
  return state.items.filter((item: MenuItem) => item.available !== false);
};

export const addMenuItem = async (data: any) => {
  await firebaseRest.push(ITEMS_PATH, data);
  emitDataUpdated(ITEMS_PATH);
  await refreshMenuItems();
};

export const updateMenuItem = async (id: string, data: any) => {
  await firebaseRest.update(`${ITEMS_PATH}/${id}`, data);
  emitDataUpdated(ITEMS_PATH);
  await refreshMenuItems();
};

export const deleteMenuItem = async (id: string) => {
  await firebaseRest.remove(`${ITEMS_PATH}/${id}`);
  emitDataUpdated(ITEMS_PATH);
  await refreshMenuItems();
};

export const toggleMenuItem = async (id: string) => {
  const state = useMenuStore.getState();
  const item = state.items.find((i: any) => i.id === id);
  if (!item) return;
  await firebaseRest.update(`${ITEMS_PATH}/${id}`, { available: !item.available });
  emitDataUpdated(ITEMS_PATH);
  await refreshMenuItems();
};

export const addCategory = async (data: any) => {
  await firebaseRest.push(CATEGORIES_PATH, data);
  emitDataUpdated(CATEGORIES_PATH);
  await refreshMenuItems();
};

export const updateCategory = async (id: string, data: any) => {
  await firebaseRest.update(`${CATEGORIES_PATH}/${id}`, data);
  emitDataUpdated(CATEGORIES_PATH);
  await refreshMenuItems();
};

export const deleteCategory = async (id: string) => {
await firebaseRest.remove(`${CATEGORIES_PATH}/${id}`);
  emitDataUpdated(CATEGORIES_PATH);
  await refreshMenuItems();
};

export const fileToBase64 = (file) => {
return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
reader.onload = () => resolve(reader.result);
reader.onerror = (error) => reject(error);
});
};
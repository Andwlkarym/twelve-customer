/** Shop settings — persisted in Firebase Realtime Database. */
import { emitDataUpdated, readFirebase, writeFirebase } from "./firebaseRest";

export type ShopSettings = {
  shopName:   string;
  mapLink:    string;
  shopLat:    number;
  shopLng:    number;
  deliveryFee:    number;   // fixed delivery fee (SAR)
  maxDeliveryKm:  number;
  qrImage:        string;   // base64 QR for bank transfer (set by admin)
  banners:        string[]; // customer home slider images
  /* first-order automatic discount */
  firstOrderDiscountEnabled: boolean;
  firstOrderDiscountPercent: number;  // default 15
  firstOrderDiscountMax:     number;  // cap in SAR, default 30
  /* commission */
  commissionPercent: number;          // restaurant platform commission %
  /* working hours */
  workingHoursEnabled: boolean;
  workingStart:        string;        // "HH:MM" e.g. "09:00"
  workingEnd:          string;        // "HH:MM" e.g. "23:00"
  workingDays:         number[];      // 0=Sun … 6=Sat
  shopManualClosed:    boolean;       // force-close override
  /* promotional banner */
  promoEnabled:  boolean;
  promoPercent:  number;
  promoMessage:  string;
};

const SETTINGS_PATH = "settings/main";

const DEFAULTS: ShopSettings = {
  shopName:      "تويلف شاورما وفلافل - الروضة، خيبر",
  mapLink:       "https://maps.google.com/?q=M7RV%2B4JP",
  shopLat:       25.0418,
  shopLng:       39.5218,
  deliveryFee:   8,
  maxDeliveryKm: 10,
  qrImage:       "",
  banners:       [],
  firstOrderDiscountEnabled: false,
  firstOrderDiscountPercent: 15,
  firstOrderDiscountMax:     30,
  commissionPercent:   0,
  workingHoursEnabled: false,
  workingStart:        "09:00",
  workingEnd:          "23:00",
  workingDays:         [0, 1, 2, 3, 4, 5, 6],
  shopManualClosed:    false,
  promoEnabled:  false,
  promoPercent:  10,
  promoMessage:  "🎉 اطلب الآن واحصل على خصم 10% على طلبك!",
};

let settingsCache: ShopSettings = { ...DEFAULTS };

const normalizeBanners = (banners: string[] = []) =>
  Array.from({ length: 3 }, (_, index) => banners[index] || "");

export function getShopSettings(): ShopSettings {
  return { ...settingsCache, workingDays: [...settingsCache.workingDays], banners: normalizeBanners(settingsCache.banners) };
}

export async function refreshShopSettings(): Promise<ShopSettings> {
const remote = (await readFirebase(SETTINGS_PATH)) as Partial<ShopSettings> | null;
  settingsCache = { ...DEFAULTS, ...(remote ?? {}), banners: normalizeBanners(remote?.banners) };
  if (remote === null) await writeFirebase(SETTINGS_PATH, settingsCache);
  return getShopSettings();
}

export async function saveShopSettings(s: ShopSettings): Promise<void> {
  settingsCache = { ...s, workingDays: [...s.workingDays], banners: normalizeBanners(s.banners) };
  await writeFirebase(SETTINGS_PATH, settingsCache);
  emitDataUpdated(SETTINGS_PATH);
}

/** Returns true if shop is currently open based on settings */
export function isShopOpen(s: ShopSettings): boolean {
  if (s.shopManualClosed) return false;
  if (!s.workingHoursEnabled) return true;
  const now = new Date();
  if (!s.workingDays.includes(now.getDay())) return false;
  const [startH, startM] = s.workingStart.split(":").map(Number);
  const [endH, endM]     = s.workingEnd.split(":").map(Number);
  const nowMins   = now.getHours() * 60 + now.getMinutes();
  const startMins = startH * 60 + startM;
  const endMins   = endH   * 60 + endM;
  // support overnight spans (e.g. 22:00 → 02:00)
  if (endMins > startMins) return nowMins >= startMins && nowMins < endMins;
  return nowMins >= startMins || nowMins < endMins;
}

/** Haversine distance in km between two lat/lng points */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

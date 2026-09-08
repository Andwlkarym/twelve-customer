// @ts-nocheck
/**
 * Customer profile store — Firebase-backed customer records.
 */
import { emitDataUpdated, firebaseKey, readFirebase, writeFirebase } from "./firebaseRest";

export type CustomerProfile = {
  name: string;
  phone: string;
  lat?: number;
  lng?: number;
  address?: string;
};

const USERS_PATH = "users";
let profileCache: CustomerProfile | null = null;

export function getCustomerProfile(): CustomerProfile | null {
  return profileCache;
}

export async function refreshCustomerProfile(phone: string): Promise<CustomerProfile | null> {
  const normalizedPhone = phone.trim();
  if (!normalizedPhone) {
    profileCache = null;
    return null;
  }
  const profile = await readFirebase<CustomerProfile>(
    `${USERS_PATH}/${firebaseKey(normalizedPhone)}/profile`,
  );
  profileCache = profile?.name && profile.phone ? profile : null;
  return profileCache;
}

export async function saveCustomerProfile(profile: CustomerProfile): Promise<void> {
  profileCache = { ...profile };
  await writeFirebase(
    `${USERS_PATH}/${firebaseKey(profile.phone)}/profile`,
    profileCache,
  );
  emitDataUpdated(`${USERS_PATH}/${firebaseKey(profile.phone)}/profile`);
}

export function clearCustomerProfile(): void {
  profileCache = null;
}

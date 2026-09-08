export type LocalCustomer = {
  id: number | string;
  uid?: string;
  name: string;
  phone: string;
  district?: string;
  address?: string;
  lat?: number;
  lng?: number;
  createdAt: string;
  updatedAt?: string;
};

export function normalizeCustomerPhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("966")) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

export function isValidCustomerPhone(phone: string): boolean {
  return /^05\d{8}$/.test(formatCustomerPhone(phone));
}

export function formatCustomerPhone(phone: string): string {
  return `0${normalizeCustomerPhone(phone)}`;
}

export const getCustomer = (): LocalCustomer | null => {
  try {
    const data = localStorage.getItem("customer_current") || localStorage.getItem("twelve_customer");
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

export const getCustomers = (): LocalCustomer[] => {
  try {
    const data: unknown = JSON.parse(localStorage.getItem("customers") || "[]");
    if (Array.isArray(data) && data.length > 0) {
      const unique = Array.from(new Map(
        data.filter((item): item is LocalCustomer => !!item && typeof item === "object" && !!(item as LocalCustomer).name && !!(item as LocalCustomer).phone)
          .map(item => [normalizeCustomerPhone(item.phone), item]),
      ).values());
      if (unique.length !== data.length) localStorage.setItem("customers", JSON.stringify(unique));
      return unique;
    }
    const legacy = JSON.parse(localStorage.getItem("customer") || "null");
    return legacy?.name && legacy?.phone ? [legacy as LocalCustomer] : [];
  } catch {
    return [];
  }
};

export const saveCustomer = (name: string, phone: string, details: Partial<LocalCustomer> = {}) => {
  const now = new Date().toISOString();
  const normalizedPhone = formatCustomerPhone(phone);
  const customers = getCustomers();
  const existing = customers.find(customer => normalizeCustomerPhone(customer.phone) === normalizeCustomerPhone(normalizedPhone));
  const customer: LocalCustomer = {
    ...(existing || {}),
    ...details,
    id: existing?.id || Date.now(),
    name: name.trim(),
    phone: normalizedPhone,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  const nextCustomers = existing
    ? customers.map(item => normalizeCustomerPhone(item.phone) === normalizeCustomerPhone(normalizedPhone) ? customer : item)
    : [customer, ...customers];
  localStorage.setItem("customers", JSON.stringify(nextCustomers));
  localStorage.setItem("twelve_customer", JSON.stringify(customer));
  return customer;
};

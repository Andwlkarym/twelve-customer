/**
 * Helpers for Web Push Notifications on the delivery-agent page.
 *
 * Auth: the caller supplies the app password (delivery "0000" or reception
 * "4321"). This module exchanges it for a short-lived HMAC-signed session
 * token at the server, then uses that token for subscribe/notify calls.
 * No secrets are stored in the client bundle or env vars.
 */

/** Resolve the API base URL from the current page origin. */
function apiBase(): string {
  return `${window.location.origin}/api`;
}

/** Convert a base64url string to an ArrayBuffer for PushManager.subscribe. */
function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = window.atob(base64);
  const arr     = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer as ArrayBuffer;
}

/** Exchange a role password for a server-issued session token. */
async function getSessionToken(role: string, password: string): Promise<string> {
  const res = await fetch(`${apiBase()}/push/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, password }),
  });
  if (!res.ok) throw new Error(`Session exchange failed: ${res.status}`);
  const { token } = (await res.json()) as { token: string };
  return token;
}

/** Fetch the VAPID public key from the server. */
async function getVapidPublicKey(): Promise<string> {
  const res = await fetch(`${apiBase()}/push/vapid-public-key`);
  if (!res.ok) throw new Error(`VAPID key fetch failed: ${res.status}`);
  const { publicKey } = (await res.json()) as { publicKey: string };
  return publicKey;
}

/** Request OS notification permission. Returns true if granted. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

/**
 * Subscribe this browser to web push and register with the server.
 * @param deliveryPassword  The delivery agent password (validates server-side).
 * Safe to call multiple times — reuses an existing subscription if present.
 */
export async function subscribeToPush(deliveryPassword: string): Promise<boolean> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

    const [registration, publicKey, token] = await Promise.all([
      navigator.serviceWorker.ready,
      getVapidPublicKey(),
      getSessionToken("delivery", deliveryPassword),
    ]);

    let sub = await registration.pushManager.getSubscription();
    if (!sub) {
      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(publicKey),
      });
    }

    const res = await fetch(`${apiBase()}/push/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(sub.toJSON()),
    });
    return res.ok;
  } catch (err) {
    console.warn("[Push] subscribe failed:", err);
    return false;
  }
}

/**
 * Trigger a push notification to all subscribed delivery agents.
 * @param receptionPassword  The reception dashboard password (validates server-side).
 */
export async function notifyDeliveryAgents(
  customerName: string,
  amount: string,
  orderId: string,
  receptionPassword: string,
): Promise<void> {
  try {
    const token = await getSessionToken("reception", receptionPassword);
    await fetch(`${apiBase()}/push/notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: "🛵 طلب توصيل جديد",
        body: `${customerName} — ${amount} ر.س`,
        data: { orderId },
      }),
    });
  } catch (err) {
    console.warn("[Push] notify failed:", err);
  }
}

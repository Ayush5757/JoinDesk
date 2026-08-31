import { api } from "./api";

// Converts the VAPID public key (base64url, as printed by
// `npx web-push generate-vapid-keys`) into the raw Uint8Array format
// PushManager.subscribe() expects.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Registers the service worker, asks the browser/phone for notification
 * permission (this triggers the native permission popup), then subscribes
 * to Web Push and saves the subscription on our backend. This is what
 * powers "Special" user notifications — free, no Firebase/Google account,
 * no cap on recipients.
 *
 * Fully best-effort: silently does nothing on unsupported browsers, if the
 * user denies permission, or if the server hasn't set up VAPID keys yet.
 * Notifications are a bonus feature and should never block login or throw
 * an error the user sees.
 */
export async function enablePushNotifications(): Promise<void> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const { publicKey, configured } = await api.get<{
      publicKey: string | null;
      configured: boolean;
    }>("/api/push/vapid-public-key");

    if (!configured || !publicKey) return;

    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    await api.post("/api/push/subscribe", { subscription: subscription.toJSON() });
  } catch {
    // Best-effort — never let a notification/permission issue break the app.
  }
}

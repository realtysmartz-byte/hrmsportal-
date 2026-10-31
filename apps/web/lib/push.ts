export const LOCATION_REMINDERS_ENABLED = true;

type SaveSubscription = (input: { endpoint: string; p256dh: string; auth: string }) => Promise<unknown>;

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * Subscribes this device to "update your location" reminders.
 * Call it directly from a tap handler: iOS only shows the permission prompt on a user gesture.
 */
export async function subscribeToLocationReminders(save: SaveSubscription, prompt = true) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (
    !LOCATION_REMINDERS_ENABLED ||
    !publicKey ||
    typeof window === "undefined" ||
    !("Notification" in window) ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return;
  }

  let permission = Notification.permission;
  if (permission === "default" && prompt) {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") return;

  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

  const keys = subscription.toJSON().keys;
  if (!keys?.p256dh || !keys.auth) return;
  await save({ endpoint: subscription.endpoint, p256dh: keys.p256dh, auth: keys.auth });
}

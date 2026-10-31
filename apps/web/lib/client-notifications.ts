import { showNativeNotification, isNativeAndroidApp } from "./native-duty-tracking";

export interface PushNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
}

/**
 * Request notification permission from the user in browser/PWA.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const res = await Notification.requestPermission();
    return res === "granted";
  } catch {
    return false;
  }
}

/**
 * Dispatches a device notification (Android native alert or Web Notification).
 */
export async function sendDevicePushNotification(options: PushNotificationOptions): Promise<boolean> {
  const { title, body, tag } = options;

  // 1. If running on Android App (Capacitor), trigger native notification channel
  if (isNativeAndroidApp()) {
    try {
      const shown = await showNativeNotification(title, body);
      if (shown) return true;
    } catch {
      // Fall through to browser notification
    }
  }

  // 2. Web Browser / PWA Notification
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }

  if (permission !== "granted") {
    return false;
  }

  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && "showNotification" in reg) {
        await reg.showNotification(title, {
          body,
          icon: options.icon || "/icons/icon-192x192.png",
          badge: "/icons/icon-192x192.png",
          tag: tag || "hrms-alert",
          vibrate: [200, 100, 200],
        } as NotificationOptions);
        return true;
      }
    }

    new Notification(title, {
      body,
      icon: options.icon || "/icons/icon-192x192.png",
      tag: tag || "hrms-alert",
    });
    return true;
  } catch (err) {
    console.warn("[client-notifications] could not display notification:", err);
    return false;
  }
}

/**
 * Sends a rich, positive notification on Clock-In.
 */
export async function notifyClockIn(params: {
  employeeName?: string;
  timeStr: string;
  locationName?: string;
}) {
  const name = params.employeeName ? ` ${params.employeeName}` : "";
  const location = params.locationName || "Realty Smartz Pvt Ltd";
  return sendDevicePushNotification({
    title: "✨ Clocked In Successfully!",
    body: `Welcome to work${name}! Checked in at ${params.timeStr} (${location}). Wishing you a productive and rewarding day!`,
    tag: "attendance-clock-in",
  });
}

/**
 * Sends a rich, positive notification on Clock-Out.
 */
export async function notifyClockOut(params: {
  employeeName?: string;
  timeStr: string;
  durationStr?: string;
}) {
  const name = params.employeeName ? ` ${params.employeeName}` : "";
  const durationText = params.durationStr ? ` • Total duty: ${params.durationStr}` : "";
  return sendDevicePushNotification({
    title: "👋 Clocked Out Successfully!",
    body: `Great job today${name}! Clocked out at ${params.timeStr}${durationText}. Have a restful and wonderful evening!`,
    tag: "attendance-clock-out",
  });
}

/**
 * Sends a welcome notification on portal login (once per session).
 */
export async function notifyLogin(params: { employeeName?: string }) {
  if (typeof window === "undefined") return;
  const sessionKey = "rs_login_notified_session";
  if (sessionStorage.getItem(sessionKey)) return;

  const name = params.employeeName ? ` ${params.employeeName}` : "";
  const success = await sendDevicePushNotification({
    title: `👋 Welcome back${name}!`,
    body: "You're securely signed into Realty Smartz Portal. Have an awesome day!",
    tag: "auth-login",
  });

  if (success) {
    sessionStorage.setItem(sessionKey, "true");
  }
}


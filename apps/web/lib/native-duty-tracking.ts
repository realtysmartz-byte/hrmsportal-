import { Capacitor, registerPlugin } from "@capacitor/core";
import { haversineDistanceM } from "@realty-smartz/shared";
import type { StoredFix } from "@/lib/geolocation";

interface DutyTrackingPlugin {
  start(options: {
    intervalMs?: number;
    apiUrl?: string;
    employeeId?: string;
    employeeEmail?: string;
    dutyToken?: string;
    title?: string;
    body?: string;
  }): Promise<{ started: boolean }>;
  syncSession(options: {
    employeeId?: string;
    employeeEmail?: string;
    dutyToken?: string;
  }): Promise<{ synced?: boolean }>;
  stop(options?: {
    title?: string;
    body?: string;
  }): Promise<{ stopped: boolean }>;
  showNotification(options: { title: string; body: string }): Promise<{ shown?: boolean }>;
  isMockActive(): Promise<{ isMockActive?: boolean }>;
  lastKnownFix(): Promise<{
    lat?: number;
    lng?: number;
    accuracy?: number | null;
    timestamp?: number;
    isMockLocation?: boolean;
  }>;
}

const DutyTracking = registerPlugin<DutyTrackingPlugin>("DutyTracking", {
  web: () => ({
    async start() {
      return { started: false };
    },
    async syncSession() {
      return { synced: false };
    },
    async stop() {
      return { stopped: false };
    },
    async showNotification() {
      return {};
    },
    async isMockActive() {
      return { isMockActive: false };
    },
    async lastKnownFix() {
      return {};
    },
  }),
});

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/** Avoid restarting the native service on every page navigation. */
let nativeTrackingStarted = false;

export function isNativeAndroidApp() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export async function getNativePunchFix(maxAgeMs = 120_000): Promise<StoredFix | null> {
  if (!isNativeAndroidApp()) return null;
  try {
    const fix = await DutyTracking.lastKnownFix();
    if (
      fix &&
      typeof fix.lat === "number" &&
      typeof fix.lng === "number" &&
      Number.isFinite(fix.lat) &&
      Number.isFinite(fix.lng) &&
      !(fix.lat === 0 && fix.lng === 0) &&
      !fix.isMockLocation
    ) {
      const ts = typeof fix.timestamp === "number" && fix.timestamp > 0 ? fix.timestamp : Date.now();
      if (Date.now() - ts <= maxAgeMs) {
        return {
          lat: fix.lat,
          lng: fix.lng,
          accuracy: typeof fix.accuracy === "number" && Number.isFinite(fix.accuracy) ? fix.accuracy : 35,
          timestamp: ts,
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function getNativeMockLocationFlag(referenceFix: StoredFix): Promise<boolean> {
  if (!isNativeAndroidApp()) return false;
  try {
    const mockCheck = await DutyTracking.isMockActive();
    if (mockCheck?.isMockActive) {
      return true;
    }
    const fix = await DutyTracking.lastKnownFix();
    if (fix?.isMockLocation) {
      return true;
    }
    return false;
  } catch (err) {
    console.warn("[duty-tracking] could not read native fix:", err);
    return false;
  }
}

/** Sync current employee session to native SharedPreferences immediately on app load */
export async function syncNativeDutySession(employeeId?: string, employeeEmail?: string) {
  if (!isNativeAndroidApp()) return;
  try {
    let dutyToken = "";
    try {
      const res = await fetch("/api/native/duty-token", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        dutyToken = data.token || "";
        if (!employeeId) employeeId = data.employeeId;
      }
    } catch { }

    await DutyTracking.syncSession({
      employeeId: employeeId || "",
      employeeEmail: employeeEmail || "",
      dutyToken,
    });
  } catch (err) {
    console.warn("[duty-tracking] syncSession failed:", err);
  }
}

/** Start Android background location tracking (every 1 hour while on duty). */
  export async function startNativeDutyTracking(options?: {
    title?: string;
    body?: string;
    employeeId?: string;
    employeeEmail?: string;
  }) {
    if (!isNativeAndroidApp()) return;
    try {
      let employeeId = options?.employeeId || "";
      let employeeEmail = options?.employeeEmail || "";
      let dutyToken = "";
      try {
        const res = await fetch("/api/native/duty-token", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (!employeeId) employeeId = data.employeeId || "";
          dutyToken = data.token || "";
        }
      } catch { }

    await DutyTracking.start({
      intervalMs: DEFAULT_INTERVAL_MS,
      apiUrl: `${window.location.origin}/api/native/location-ping`,
      employeeId,
      employeeEmail,
      dutyToken,
      title: options?.title,
      body: options?.body,
    });
    nativeTrackingStarted = true;
  } catch (err) {
    console.error("[duty-tracking] start failed:", err);
  }
}

/** Stop Android background location tracking (on clock-out). */
export async function stopNativeDutyTracking(options?: { title?: string; body?: string }) {
  if (!isNativeAndroidApp()) return;
  nativeTrackingStarted = false;
  try {
    await DutyTracking.stop({
      title: options?.title,
      body: options?.body,
    });
  } catch (err) {
    console.error("[duty-tracking] stop failed:", err);
  }
}

/** Trigger native notification if on Android app */
export async function showNativeNotification(title: string, body: string): Promise<boolean> {
  if (!isNativeAndroidApp()) return false;
  try {
    const res = await DutyTracking.showNotification({ title, body });
    return Boolean(res.shown);
  } catch (err) {
    console.warn("[duty-tracking] native notification error:", err);
    return false;
  }
}

import { Capacitor, registerPlugin } from "@capacitor/core";

interface DutyTrackingPlugin {
  start(options: { intervalMs?: number; apiUrl?: string }): Promise<{ started: boolean }>;
  stop(): Promise<{ stopped: boolean }>;
}

const DutyTracking = registerPlugin<DutyTrackingPlugin>("DutyTracking", {
  web: () => ({
    async start() {
      return { started: false };
    },
    async stop() {
      return { stopped: false };
    },
  }),
});

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/** Avoid restarting the native service on every page navigation. */
let nativeTrackingStarted = false;

export function isNativeAndroidApp() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

/** Start Android foreground location tracking (every 30 min while on duty). */
export async function startNativeDutyTracking() {
  if (!isNativeAndroidApp()) return;
  if (nativeTrackingStarted) return;
  try {
    await DutyTracking.start({
      intervalMs: DEFAULT_INTERVAL_MS,
      apiUrl: `${window.location.origin}/api/native/location-ping`,
    });
    nativeTrackingStarted = true;
  } catch (err) {
    console.error("[duty-tracking] start failed:", err);
  }
}

/** Stop Android foreground location tracking (on clock-out). */
export async function stopNativeDutyTracking() {
  if (!isNativeAndroidApp()) return;
  nativeTrackingStarted = false;
  try {
    await DutyTracking.stop();
  } catch (err) {
    console.error("[duty-tracking] stop failed:", err);
  }
}

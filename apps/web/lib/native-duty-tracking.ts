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

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000;

export function isNativeAndroidApp() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

/** Start Android foreground location tracking (every 30 min while on duty). */
export async function startNativeDutyTracking() {
  if (!isNativeAndroidApp()) return;
  try {
    await DutyTracking.start({
      intervalMs: DEFAULT_INTERVAL_MS,
      apiUrl: `${window.location.origin}/api/native/location-ping`,
    });
  } catch (err) {
    console.error("[duty-tracking] start failed:", err);
  }
}

/** Stop Android foreground location tracking (on clock-out). */
export async function stopNativeDutyTracking() {
  if (!isNativeAndroidApp()) return;
  try {
    await DutyTracking.stop();
  } catch (err) {
    console.error("[duty-tracking] stop failed:", err);
  }
}

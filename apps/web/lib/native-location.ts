export type NativeLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  time: number | null;
};

type NativeLocationError = { code?: string; message?: string };

type CapacitorBridge = {
  isNativePlatform?: () => boolean;
  Plugins?: {
    BackgroundGeolocation?: {
      addWatcher: (
        options: Record<string, unknown>,
        callback: (location?: NativeLocation, error?: NativeLocationError) => void
      ) => string | Promise<string>;
      removeWatcher: (options: { id: string }) => unknown;
    };
    CapacitorHttp?: {
      request: (options: {
        url: string;
        method: string;
        headers: Record<string, string>;
        data: unknown;
      }) => Promise<{ status: number; data: unknown }>;
    };
  };
};

function getBridge() {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as { Capacitor?: CapacitorBridge }).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  const geo = cap.Plugins?.BackgroundGeolocation;
  const http = cap.Plugins?.CapacitorHttp;
  if (!geo || !http) return null;
  return { geo, http };
}

export function isNativeApp() {
  return getBridge() !== null;
}

/** Background GPS watcher that keeps running while the phone is locked (Android app only). */
export async function startNativeWatcher(
  onLocation: (location: NativeLocation) => void,
  onError: (error: NativeLocationError) => void
): Promise<() => void> {
  const bridge = getBridge();
  if (!bridge) throw new Error("Native app bridge unavailable");

  const id = await bridge.geo.addWatcher(
    {
      backgroundTitle: "Attendance tracking on",
      backgroundMessage: "Your location is shared with HR while you are punched in.",
      requestPermissions: true,
      stale: false,
      distanceFilter: 0,
    },
    (location, error) => {
      if (error) onError(error);
      else if (location) onLocation(location);
    }
  );

  return () => {
    void bridge.geo.removeWatcher({ id });
  };
}

/** Sends a ping through native HTTP so Android does not throttle it in the background. */
export async function sendNativePing(input: {
  lat: number;
  lng: number;
  address?: string;
  accuracyM: number | null;
  capturedAt: Date;
}) {
  const bridge = getBridge();
  if (!bridge) throw new Error("Native app bridge unavailable");

  const res = await bridge.http.request({
    url: `${window.location.origin}/api/trpc/attendance.locationPing`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    data: { json: { ...input, capturedAt: input.capturedAt.toISOString() } },
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Location ping failed (${res.status})`);
  }
}

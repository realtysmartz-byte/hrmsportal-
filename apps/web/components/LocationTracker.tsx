"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { MapPin } from "lucide-react";
import { LOCATION_PING_INTERVAL_MS } from "@realty-smartz/shared";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const data = (await res.json()) as { display_name?: string };
    return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

export function LocationTracker() {
  const { status: authStatus } = useSession();
  const [status, setStatus] = useState<"on" | "denied" | "error" | "idle">(
    "idle"
  );
  const [lastAt, setLastAt] = useState<Date | null>(null);
  const lastPos = useRef<GeolocationPosition | null>(null);
  const watchId = useRef<number | null>(null);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);
  const pingMutation = trpc.attendance.locationPing.useMutation();
  const pingRef = useRef(pingMutation.mutateAsync);
  pingRef.current = pingMutation.mutateAsync;

  const reportDisabledMutation = trpc.attendance.reportLocationDisabled.useMutation();
  const hasReportedRef = useRef(false);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    if (typeof window === "undefined" || !navigator.geolocation) {
      setStatus("error");
      return;
    }

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let firstPingTimer: ReturnType<typeof setInterval> | null = null;

    async function sendPing(pos: GeolocationPosition) {
      const { latitude, longitude, accuracy } = pos.coords;
      const address = await reverseGeocode(latitude, longitude);
      try {
        await pingRef.current({
          lat: latitude,
          lng: longitude,
          address,
          accuracyM: accuracy ?? null,
        });
        if (!cancelled) {
          setLastAt(new Date());
          setStatus("on");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    async function requestWakeLock() {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: {
            request: (
              type: "screen"
            ) => Promise<{ release: () => Promise<void> }>;
          };
        };
        if (nav.wakeLock) {
          wakeLock.current = await nav.wakeLock.request("screen");
        }
      } catch {
        // optional
      }
    }

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (cancelled) return;
        lastPos.current = pos;
        setStatus("on");
      },
      (err) => {
        if (cancelled) return;
        const isDenied = err.code === err.PERMISSION_DENIED;
        setStatus(isDenied ? "denied" : "error");

        if (isDenied && !hasReportedRef.current) {
          hasReportedRef.current = true;
          reportDisabledMutation.mutate({
            reason: "Employee turned off device location / denied permission during active session",
            deviceInfo: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
          });
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 60_000,
        timeout: 30_000,
      }
    );

    void requestWakeLock();

    firstPingTimer = setInterval(() => {
      if (lastPos.current) {
        void sendPing(lastPos.current);
        if (firstPingTimer) clearInterval(firstPingTimer);
        firstPingTimer = null;
      }
    }, 2000);

    intervalId = setInterval(() => {
      if (lastPos.current) {
        void sendPing(lastPos.current);
      } else {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            lastPos.current = pos;
            void sendPing(pos);
          },
          () => {
            if (!cancelled) setStatus("error");
          },
          { enableHighAccuracy: true, timeout: 20_000 }
        );
      }
    }, LOCATION_PING_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void requestWakeLock();
        if (lastPos.current) void sendPing(lastPos.current);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (firstPingTimer) clearInterval(firstPingTimer);
      if (intervalId) clearInterval(intervalId);
      if (watchId.current != null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
      document.removeEventListener("visibilitychange", onVisibility);
      void wakeLock.current?.release();
    };
  }, [authStatus]);

  if (authStatus !== "authenticated") return null;

  return (
    <div
      className={cn(
        "fixed bottom-3 right-3 z-40 flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-[11px] font-medium shadow-elevated",
        status === "on" && "border-teal-200 text-teal-800",
        status === "denied" && "border-maroon-200 text-maroon-700",
        (status === "error" || status === "idle") &&
          "border-neutral-200 text-neutral-600"
      )}
      title="Location is tracked every 30 minutes while you are signed in"
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          status === "on" && "animate-pulse bg-teal-600",
          status === "denied" && "bg-maroon-600",
          (status === "error" || status === "idle") && "bg-neutral-400"
        )}
      />
      <MapPin className="h-3 w-3" />
      {status === "on" && (
        <span>
          Location on
          {lastAt
            ? ` · ${lastAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : ""}
        </span>
      )}
      {status === "denied" && <span>Allow location access</span>}
      {status === "error" && <span>Location unavailable</span>}
      {status === "idle" && <span>Starting location…</span>}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { MapPin, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

// Active tracking interval: 5 minutes during work sessions (300,000 ms)
const ACTIVE_PING_INTERVAL_MS = 5 * 60 * 1000;

function haversineDistM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3500),
    });
    if (res.ok) {
      const data = (await res.json()) as { features?: Array<{ properties?: Record<string, string> }> };
      const props = data.features?.[0]?.properties;
      if (props) {
        const parts = [props.name, props.street, props.district, props.city].filter(Boolean);
        if (parts.length > 0) return parts.join(", ");
      }
    }
  } catch {
    // fallback gracefully
  }
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function LocationTracker() {
  const { data: session, status: authStatus } = useSession();
  const [status, setStatus] = useState<"on" | "denied" | "error" | "idle">("idle");
  const [lastAt, setLastAt] = useState<Date | null>(null);
  const [lastAddr, setLastAddr] = useState<string>("");
  const lastPos = useRef<GeolocationPosition | null>(null);
  const lastPingedCoords = useRef<{ lat: number; lng: number } | null>(null);
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
          lastPingedCoords.current = { lat: latitude, lng: longitude };
          setLastAt(new Date());
          setLastAddr(address);
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
            request: (type: "screen") => Promise<{ release: () => Promise<void> }>;
          };
        };
        if (nav.wakeLock) {
          wakeLock.current = await nav.wakeLock.request("screen");
        }
      } catch {
        // optional wake lock
      }
    }

    // 1. Send immediate ping on load
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        lastPos.current = pos;
        void sendPing(pos);
      },
      (err) => {
        if (cancelled) return;
        if (err.code === err.PERMISSION_DENIED) {
          setStatus("denied");
          if (!hasReportedRef.current) {
            hasReportedRef.current = true;
            reportDisabledMutation.mutate({
              reason: "Employee turned off device location / denied permission on page load",
              deviceInfo: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
            });
          }
        } else {
          setStatus("error");
        }
      },
      { enableHighAccuracy: true, timeout: 15_000 }
    );

    // 2. Watch position continuously; ping if employee moves > 40 meters
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (cancelled) return;
        lastPos.current = pos;
        setStatus("on");

        if (lastPingedCoords.current) {
          const distMoved = haversineDistM(
            lastPingedCoords.current.lat,
            lastPingedCoords.current.lng,
            pos.coords.latitude,
            pos.coords.longitude
          );
          // If moved more than 40m, record ping immediately
          if (distMoved > 40) {
            void sendPing(pos);
          }
        }
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
        maximumAge: 30_000,
        timeout: 20_000,
      }
    );

    void requestWakeLock();

    // 3. Regular periodic breadcrumb interval (every 5 mins)
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
    }, ACTIVE_PING_INTERVAL_MS);

    // 4. When visibility turns on (app brought to foreground), send ping
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void requestWakeLock();
        if (lastPos.current) void sendPing(lastPos.current);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
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
        "fixed bottom-3 right-3 z-40 flex items-center gap-2 rounded-full border bg-white/95 backdrop-blur-xs px-3.5 py-1.5 text-[11px] font-semibold shadow-md transition-all",
        status === "on" && "border-teal-200 text-teal-800",
        status === "denied" && "border-rose-200 text-rose-700 bg-rose-50/90",
        (status === "error" || status === "idle") && "border-neutral-200 text-neutral-600"
      )}
      title="Live GPS Location Tracking active. Pings are logged automatically every 5 minutes and upon displacement."
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          status === "on" && "animate-pulse bg-emerald-600",
          status === "denied" && "bg-rose-600",
          (status === "error" || status === "idle") && "bg-amber-400"
        )}
      />
      <MapPin className="h-3 w-3 shrink-0" />
      {status === "on" && (
        <span className="truncate max-w-[220px]">
          GPS Active
          {lastAt
            ? ` · ${lastAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : ""}
        </span>
      )}
      {status === "denied" && <span>Location Disabled (Alert Sent)</span>}
      {status === "error" && <span>GPS Searching…</span>}
      {status === "idle" && <span>Connecting GPS…</span>}
    </div>
  );
}

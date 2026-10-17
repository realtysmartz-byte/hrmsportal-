"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { MapPin } from "lucide-react";
import { LOCATION_PING_INTERVAL_MS } from "@realty-smartz/shared";
import { trpc } from "@/lib/trpc";
import { getCurrentPosition, reverseGeocodePlace } from "@/lib/geolocation";
import {
  isNativeAndroidApp,
  startNativeDutyTracking,
  stopNativeDutyTracking,
} from "@/lib/native-duty-tracking";
import { cn } from "@/lib/utils";

const LAST_PING_KEY = "rs_last_location_ping_at";

function readLastPingAt() {
  try {
    const raw = localStorage.getItem(LAST_PING_KEY);
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function writeLastPingAt(at: number) {
  try {
    localStorage.setItem(LAST_PING_KEY, String(at));
  } catch {
    // ignore
  }
}

export function LocationTracker() {
  const { status: authStatus } = useSession();
  const pathname = usePathname();
  const isPingPage = pathname === "/location-ping";
  const onEmployeeRoute = pathname?.startsWith("/employee-portal") ?? false;

  const { data: todayAttendance } = trpc.attendance.today.useQuery(undefined, {
    enabled: authStatus === "authenticated" && onEmployeeRoute && !isPingPage,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    // Only poll while on duty — idle users should not hit the API every minute
    refetchInterval: (data) =>
      data?.checkInTime && !data?.checkOutTime ? 5 * 60_000 : false,
  });

  const [status, setStatus] = useState<"on" | "denied" | "error" | "idle">("idle");
  const [lastAt, setLastAt] = useState<Date | null>(null);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);

  const pingMutation = trpc.attendance.locationPing.useMutation();
  const pingRef = useRef(pingMutation.mutateAsync);
  pingRef.current = pingMutation.mutateAsync;

  const reportDisabledMutation = trpc.attendance.reportLocationDisabled.useMutation();
  const reportRef = useRef(reportDisabledMutation.mutate);
  reportRef.current = reportDisabledMutation.mutate;
  const hasReportedRef = useRef(false);

  const isOnDuty = Boolean(
    todayAttendance?.checkInTime && !todayAttendance?.checkOutTime
  );

  useEffect(() => {
    if (authStatus !== "authenticated" || isPingPage || !onEmployeeRoute) return;
    if (typeof window === "undefined" || !navigator.geolocation) {
      setStatus("error");
      return;
    }

    let cancelled = false;
    const nativeApp = isNativeAndroidApp();

    function handleError(err: GeolocationPositionError) {
      if (cancelled) return;
      if (err.code === err.PERMISSION_DENIED) {
        setStatus("denied");
        if (!hasReportedRef.current) {
          hasReportedRef.current = true;
          reportRef.current({
            reason: "Employee turned off device location / denied permission",
            deviceInfo: navigator.userAgent,
          });
        }
      } else {
        setStatus("error");
      }
    }

    async function sendPing(pos: GeolocationPosition) {
      const { latitude, longitude, accuracy } = pos.coords;
      try {
        const place = await reverseGeocodePlace(latitude, longitude);
        await pingRef.current({
          lat: latitude,
          lng: longitude,
          address: place.address,
          accuracyM: accuracy ?? null,
          capturedAt: new Date(pos.timestamp),
        });
        if (!cancelled) {
          const now = Date.now();
          writeLastPingAt(now);
          setLastAt(new Date(pos.timestamp));
          setStatus("on");
        }
        return true;
      } catch {
        if (!cancelled) setStatus("error");
        return false;
      }
    }

    async function pingFresh() {
      try {
        const pos = await getCurrentPosition(true);
        return cancelled ? false : await sendPing(pos);
      } catch (err) {
        handleError(err as GeolocationPositionError);
        return false;
      }
    }

    /** Only ping if a full hour has passed since the last saved ping. */
    async function pingIfDue() {
      const last = readLastPingAt();
      if (Date.now() - last < LOCATION_PING_INTERVAL_MS) {
        if (!cancelled) {
          setStatus("on");
          if (last > 0) setLastAt(new Date(last));
        }
        return false;
      }
      return pingFresh();
    }

    async function requestWakeLock() {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: {
            request: (type: "screen") => Promise<{ release: () => Promise<void> }>;
          };
        };
        if (nav.wakeLock && isOnDuty) {
          wakeLock.current = await nav.wakeLock.request("screen");
        }
      } catch {
        // wake lock is optional
      }
    }

    // Permission / badge only — never record a ping while off duty
    if (!isOnDuty) {
      void stopNativeDutyTracking();
      navigator.geolocation.getCurrentPosition(
        () => !cancelled && setStatus("on"),
        handleError,
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }
      );
      return () => {
        cancelled = true;
      };
    }

    // Android APK: native foreground service owns the 1-hour pings — do not also ping from WebView on every open
    if (nativeApp) {
      void startNativeDutyTracking();
      navigator.geolocation.getCurrentPosition(
        () => !cancelled && setStatus("on"),
        handleError,
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }
      );
      return () => {
        cancelled = true;
      };
    }

    // Web browser: never ping just because the page opened.
    // Ping only when 1 hour has actually elapsed (interval + optional due-check).
    const last = readLastPingAt();
    if (last > 0) setLastAt(new Date(last));
    setStatus("on");

    void requestWakeLock();

    const intervalId = setInterval(() => void pingIfDue(), LOCATION_PING_INTERVAL_MS);

    // If already past due (e.g. tab left open overnight), one catch-up — still respects 1h gap
    void pingIfDue();

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      void wakeLock.current?.release();
    };
  }, [authStatus, isOnDuty, isPingPage, onEmployeeRoute]);

  if (authStatus !== "authenticated" || isPingPage || !onEmployeeRoute) return null;

  return (
    <div
      className={cn(
        "pointer-events-none fixed right-3 z-30 flex items-center gap-2 rounded-full border bg-white/95 backdrop-blur-xs px-3.5 py-1.5 text-[11px] font-semibold transition-all md:bottom-4 md:right-4",
        "bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))]",
        status === "on" && "border-teal-200 text-teal-800",
        status === "denied" && "border-rose-200 text-rose-700 bg-rose-50/90",
        (status === "error" || status === "idle") && "border-neutral-200 text-neutral-600"
      )}
      title="While punched in, location is recorded every 30 minutes (not on every page open)."
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
          {isOnDuty ? "GPS Tracking Active (1h)" : "GPS Ready"}
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

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
  syncNativeDutySession,
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
  const { data: session, status: authStatus } = useSession();
  const pathname = usePathname();
  const isPingPage = pathname === "/location-ping";
  const onEmployeeRoute = pathname?.startsWith("/employee-portal") ?? false;

  useEffect(() => {
    if (authStatus === "authenticated" && session?.user) {
      void syncNativeDutySession(session.user.id, session.user.email ?? undefined);
    }
  }, [authStatus, session?.user]);

  // Share cache with CheckInOutCard — no extra polling from tracker
  const { data: todayAttendance } = trpc.attendance.today.useQuery(undefined, {
    enabled: authStatus === "authenticated" && onEmployeeRoute && !isPingPage,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
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
      if (err.code === err.PERMISSION_DENIED || err.code === err.POSITION_UNAVAILABLE) {
        setStatus("denied");
        if (!hasReportedRef.current && isOnDuty) {
          hasReportedRef.current = true;
          reportRef.current({
            reason:
              err.code === err.PERMISSION_DENIED
                ? "Employee denied location permission while on active duty"
                : "Employee turned off device GPS / Location in phone settings while on active duty",
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
        const realTimestamp = new Date();
        await pingRef.current({
          lat: latitude,
          lng: longitude,
          address: place.address,
          accuracyM: accuracy,
          capturedAt: realTimestamp,
        });
        if (!cancelled) {
          const now = Date.now();
          writeLastPingAt(now);
          setLastAt(realTimestamp);
          hasReportedRef.current = false;
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

    /** Only ping if 1 hour (60 minutes) has passed since the last saved ping. */
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
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
      );
      return () => {
        cancelled = true;
      };
    }

    if (nativeApp) {
      void startNativeDutyTracking({
        employeeId: session?.user?.id,
        employeeEmail: session?.user?.email ?? undefined,
      });
    }

    // Web browser: never ping just because the page opened.
    // Ping only when 1 hour has actually elapsed (interval + optional due-check).
    const last = readLastPingAt();
    if (last > 0) setLastAt(new Date(last));
    setStatus("on");

    void requestWakeLock();

    const intervalId = setInterval(() => void pingIfDue(), LOCATION_PING_INTERVAL_MS);

    // If already past due, one catch-up — still respects 1h gap
    void pingIfDue();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void pingIfDue();
      }
    };
    const onFocus = () => {
      void pingIfDue();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
      void wakeLock.current?.release();
    };
  }, [authStatus, isOnDuty, isPingPage, onEmployeeRoute]);

  if (
    authStatus !== "authenticated" ||
    isPingPage ||
    !onEmployeeRoute ||
    pathname === "/employee-portal/dashboard"
  ) {
    return null;
  }

  return (
    <div
      className={cn(
        "pointer-events-none fixed right-3 z-30 flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--card)] px-3.5 py-1.5 text-[13px] font-[600] text-[var(--ink)] shadow-xs transition-all md:bottom-4 md:right-4",
        "bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))]"
      )}

      style={{
        transform: "translate3d(0, 0, 0)",
        WebkitTransform: "translate3d(0, 0, 0)",
        WebkitBackfaceVisibility: "hidden",
        backfaceVisibility: "hidden",
      }}
      title="While punched in, location is recorded every 1 hour with high-accuracy GPS."
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full shrink-0",
          status === "on" && "animate-pulse bg-[var(--ok)]",
          status === "denied" && "bg-[var(--danger)]",
          (status === "error" || status === "idle") && "bg-[var(--warn)]"
        )}
      />
      <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
      {status === "on" && (
        <span className="truncate max-w-[220px]">
          {isOnDuty ? "GPS Tracking Active (1 hr)" : "GPS Ready"}
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

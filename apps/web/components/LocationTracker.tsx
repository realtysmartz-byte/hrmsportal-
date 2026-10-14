"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { MapPin } from "lucide-react";
import { haversineDistanceM, LOCATION_PING_INTERVAL_MS } from "@realty-smartz/shared";
import { trpc } from "@/lib/trpc";
import { getCurrentPosition, reverseGeocodePlace } from "@/lib/geolocation";
import { cn } from "@/lib/utils";

const MOVE_THRESHOLD_M = 50;
const MIN_MOVE_PING_GAP_MS = 5 * 60 * 1000;

export function LocationTracker() {
  const { status: authStatus } = useSession();
  const { data: todayAttendance } = trpc.attendance.today.useQuery(undefined, {
    enabled: authStatus === "authenticated",
    refetchInterval: 60_000,
  });

  const [status, setStatus] = useState<"on" | "denied" | "error" | "idle">("idle");
  const [lastAt, setLastAt] = useState<Date | null>(null);
  const lastPinged = useRef<{ lat: number; lng: number; at: number } | null>(null);
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
    if (authStatus !== "authenticated") return;
    if (typeof window === "undefined" || !navigator.geolocation) {
      setStatus("error");
      return;
    }

    let cancelled = false;

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
          lastPinged.current = { lat: latitude, lng: longitude, at: Date.now() };
          setLastAt(new Date(pos.timestamp));
          setStatus("on");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    async function pingFresh() {
      try {
        const pos = await getCurrentPosition();
        if (!cancelled) await sendPing(pos);
      } catch (err) {
        handleError(err as GeolocationPositionError);
      }
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

    if (!isOnDuty) {
      // Only check permission state so the badge is accurate; nothing is recorded off duty.
      navigator.geolocation.getCurrentPosition(
        () => !cancelled && setStatus("on"),
        handleError,
        { enableHighAccuracy: false, timeout: 15_000, maximumAge: 0 }
      );
      return () => {
        cancelled = true;
      };
    }

    void pingFresh();

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (cancelled) return;
        setStatus("on");
        const prev = lastPinged.current;
        if (!prev || Date.now() - prev.at < MIN_MOVE_PING_GAP_MS) return;
        const moved = haversineDistanceM(
          prev.lat,
          prev.lng,
          pos.coords.latitude,
          pos.coords.longitude
        );
        if (moved > MOVE_THRESHOLD_M) void sendPing(pos);
      },
      handleError,
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 }
    );

    void requestWakeLock();

    const intervalId = setInterval(() => void pingFresh(), LOCATION_PING_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      void requestWakeLock();
      const last = lastPinged.current?.at ?? 0;
      if (Date.now() - last >= LOCATION_PING_INTERVAL_MS) void pingFresh();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      navigator.geolocation.clearWatch(watchId);
      document.removeEventListener("visibilitychange", onVisibility);
      void wakeLock.current?.release();
    };
  }, [authStatus, isOnDuty]);

  if (authStatus !== "authenticated") return null;

  return (
    <div
      className={cn(
        "fixed bottom-20 right-3 md:bottom-4 md:right-4 z-30 flex items-center gap-2 rounded-full border bg-white/95 backdrop-blur-xs px-3.5 py-1.5 text-[11px] font-semibold shadow-md transition-all",
        status === "on" && "border-teal-200 text-teal-800",
        status === "denied" && "border-rose-200 text-rose-700 bg-rose-50/90",
        (status === "error" || status === "idle") && "border-neutral-200 text-neutral-600"
      )}
      title="While punched in, your live GPS location is recorded every 30 minutes."
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
          {isOnDuty ? "GPS Tracking Active (30m)" : "GPS Ready"}
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

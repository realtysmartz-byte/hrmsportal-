"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  MapPin,
  LogIn,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCw,
  Navigation,
  Building,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Timer,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  geolocationErrorMessage,
  getCurrentPosition,
  reverseGeocodePlace,
  type GeoPlace,
} from "@/lib/geolocation";
import { LocationMap } from "@/components/LocationMap";
import { formatTimeIST, TIMEZONE_IST, getISTDateParts } from "@realty-smartz/shared";

export function CheckInOutCard() {
  const { data: session } = useSession();
  const utils = trpc.useUtils();
  const { data: today, isLoading } = trpc.attendance.today.useQuery();
  const { data: settings } = trpc.companySettings.get.useQuery();

  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isPermissionDenied, setIsPermissionDenied] = useState<boolean>(false);
  const [busy, setBusy] = useState(false);
  const [captured, setCaptured] = useState<GeoPlace | null>(null);
  const [showMap, setShowMap] = useState(false);

  // Live clock in Indian Standard Time (IST)
  useEffect(() => {
    function updateClock() {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          timeZone: TIMEZONE_IST,
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
      setCurrentDate(
        now.toLocaleDateString("en-US", {
          timeZone: TIMEZONE_IST,
          weekday: "long",
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      );

      // Check if 7:00 PM IST is reached while user is on duty
      const ist = getISTDateParts(now);
      if (ist.hour >= 19 && today?.checkInTime && !today?.checkOutTime) {
        void utils.attendance.today.invalidate();
        void utils.attendance.myRecentWeek.invalidate();
      }
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [today?.checkInTime, today?.checkOutTime, utils]);

  // Live on-duty elapsed timer
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  useEffect(() => {
    if (!today?.checkInTime || today?.checkOutTime) {
      setElapsedSeconds(0);
      return;
    }
    const checkInMs = new Date(today.checkInTime).getTime();
    function tickElapsed() {
      const diff = Math.max(0, Math.floor((Date.now() - checkInMs) / 1000));
      setElapsedSeconds(diff);
    }
    tickElapsed();
    const interval = setInterval(tickElapsed, 1000);
    return () => clearInterval(interval);
  }, [today?.checkInTime, today?.checkOutTime]);

  const formattedElapsed = useMemo(() => {
    const h = Math.floor(elapsedSeconds / 3600);
    const m = Math.floor((elapsedSeconds % 3600) / 60);
    const s = elapsedSeconds % 60;
    return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  }, [elapsedSeconds]);

  const checkIn = trpc.attendance.checkIn.useMutation({
    onSuccess: async () => {
      await utils.attendance.today.invalidate();
      await utils.attendance.today.refetch();
      await utils.attendance.myMonth.invalidate();
      await utils.attendance.myRecentWeek.invalidate();
      setError("");
      setIsPermissionDenied(false);
    },
  });

  const checkOut = trpc.attendance.checkOut.useMutation({
    onSuccess: async () => {
      await utils.attendance.today.invalidate();
      await utils.attendance.today.refetch();
      await utils.attendance.myMonth.invalidate();
      await utils.attendance.myRecentWeek.invalidate();
      setError("");
      setIsPermissionDenied(false);
    },
  });

  async function captureAndSubmit(mode: "in" | "out") {
    setError("");
    setIsPermissionDenied(false);
    setBusy(true);

    try {
      const pos = await getCurrentPosition();
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const place = await reverseGeocodePlace(lat, lng);
      setCaptured(place);

      let cleanName = place.name;
      let cleanAddress = place.address;

      if (!cleanName || /sunbreeze/i.test(cleanName) || cleanName === "Current location") {
        cleanName = "Realty Smartz Private Limited";
      }
      if (cleanAddress && /sunbreeze/i.test(cleanAddress)) {
        cleanAddress = cleanAddress.replace(/sunbreeze/gi, "Realty Smartz Private Limited");
      }

      const addressLabel = cleanAddress
        ? `${cleanName} — ${cleanAddress}`
        : cleanName;

      if (mode === "in") {
        await checkIn.mutateAsync({ lat, lng, address: addressLabel });
      } else {
        await checkOut.mutateAsync({ lat, lng, address: addressLabel });
      }
    } catch (err: unknown) {
      const errObj = err as { code?: number; message?: string };
      if (errObj && (errObj.code === 1 || errObj.message?.toLowerCase().includes("denied"))) {
        setIsPermissionDenied(true);
      }
      setError(geolocationErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return (
      <Card className="rounded-[28px] border border-white/10 bg-[#11121A] text-white shadow-xl overflow-hidden">
        <CardContent className="flex flex-col items-center justify-center py-20">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF7A70]/20 opacity-75" />
            <div className="h-10 w-10 animate-spin rounded-full border-3 border-white/10 border-t-[#FF7A70]" />
          </div>
          <p className="mt-4 text-xs font-semibold text-neutral-400">Verifying attendance & geofence...</p>
        </CardContent>
      </Card>
    );
  }

  const checkedIn = Boolean(today?.checkInTime);
  const checkedOut = Boolean(today?.checkOutTime);
  const employeeName = session?.user?.name ?? "Team Member";

  return (
    <div className="relative w-full rounded-[28px] sm:rounded-[32px] border border-neutral-200/80 bg-gradient-to-b from-white via-white to-neutral-50/70 p-5 sm:p-7 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.06)] overflow-hidden">
      {/* Subtle Top Ambient Sunset Accent */}
      <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[#FF7A70] via-[#FFA07A] to-[#FF7A70]" />
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-40 bg-gradient-to-b from-[#FF7A70]/10 to-transparent blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Brand & Organization Tagline */}
        <div className="flex items-center gap-2 rounded-full bg-neutral-100/80 border border-neutral-200/70 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-neutral-700 shadow-2xs">
          <Building className="h-3 w-3 text-[#FF7A70]" />
          <span>Realty Smartz Private Limited</span>
          <span className="text-neutral-300">·</span>
          <span className="text-[#FF7A70] font-extrabold">200m Geofence</span>
        </div>

        {/* Welcome Greeting */}
        <p className="mt-3 text-xs sm:text-sm text-neutral-500 font-medium">
          Welcome back, <strong className="text-neutral-900 font-semibold">{employeeName}</strong>
        </p>

        {/* Live IST Digital Clock */}
        <div className="my-4 flex flex-col items-center">
          <div className="flex items-baseline justify-center gap-2">
            <span className="font-mono text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-neutral-900 drop-shadow-2xs">
              {currentTime || "10:00:00 AM"}
            </span>
          </div>

          <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-neutral-500">
            <span>{currentDate || "Today"}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-[#FF7A70] bg-[#FF7A70]/10 px-2 py-0.5 rounded-md">
              <Clock className="h-2.5 w-2.5" />
              IST Sync
            </span>
          </div>
        </div>

        {/* Luminous Interactive Radial Dial */}
        <div className="relative my-4 flex h-44 w-44 sm:h-48 sm:w-48 items-center justify-center">
          {busy ? (
            // Locating State: High-Tech Radar Scanner
            <div className="relative flex h-40 w-40 sm:h-44 sm:w-44 items-center justify-center rounded-full bg-indigo-50/70 border-2 border-primary/30 shadow-inner">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF7A70]/20 opacity-70" />
              <div className="absolute inset-2 rounded-full border-2 border-dashed border-[#FF7A70]/40 animate-spin" />
              <div className="flex flex-col items-center text-[#FF7A70]">
                <Navigation className="h-10 w-10 animate-bounce" />
                <span className="mt-1.5 text-xs font-bold uppercase tracking-wider">Locating</span>
                <span className="text-[10px] text-neutral-500 font-mono">200m Radar</span>
              </div>
            </div>
          ) : checkedOut ? (
            // Completed State: Polished Emerald Seal
            <div className="relative flex h-40 w-40 sm:h-44 sm:w-44 items-center justify-center rounded-full bg-emerald-50/80 border-3 border-emerald-400/50 shadow-[0_8px_30px_rgba(16,185,129,0.15)]">
              <div className="flex flex-col items-center text-emerald-700">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
                  <Check className="h-6 w-6 stroke-[3]" />
                </div>
                <span className="mt-2 text-xs font-extrabold uppercase tracking-wider text-emerald-800">
                  Shift Complete
                </span>
                <span className="text-[11px] text-emerald-600 font-medium">
                  {today?.totalHours != null ? `${today.totalHours} hrs worked` : "All logged"}
                </span>
              </div>
            </div>
          ) : checkedIn ? (
            // On Duty State: Live Glowing Radial Ring with Live Elapsed Counter
            <div className="relative flex h-40 w-40 sm:h-44 sm:w-44 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-50 via-teal-50 to-emerald-50 border-3 border-emerald-400/60 shadow-[0_8px_30px_rgba(16,185,129,0.2)]">
              <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-emerald-400/20" />
              <div className="flex flex-col items-center text-neutral-900 z-10">
                <div className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                  <span>On Duty</span>
                </div>
                <span className="mt-2 font-mono text-base sm:text-lg font-black tracking-tight text-emerald-800">
                  {formattedElapsed}
                </span>
                <span className="text-[10px] font-semibold text-neutral-500 mt-0.5">
                  Started {today?.checkInTime ? formatTimeIST(today.checkInTime) : ""}
                </span>
              </div>
            </div>
          ) : (
            // Ready State: Pulsing Sunset Beacon
            <button
              type="button"
              disabled={busy}
              onClick={() => captureAndSubmit("in")}
              className="group relative flex h-40 w-40 sm:h-44 sm:w-44 items-center justify-center rounded-full bg-gradient-to-tr from-[#FF7A70]/10 via-[#FFA07A]/15 to-[#FF7A70]/10 border-2 border-[#FF7A70]/40 shadow-[0_10px_35px_rgba(255,122,112,0.2)] hover:scale-105 active:scale-95 transition-all duration-300"
            >
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF7A70]/20 opacity-70 group-hover:opacity-100" />
              <div className="flex flex-col items-center text-[#FF7A70]">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-tr from-[#FF7A70] to-[#FFA07A] text-white shadow-md group-hover:shadow-lg transition-all">
                  <LogIn className="h-6 w-6 ml-0.5" />
                </div>
                <span className="mt-2 text-xs font-extrabold uppercase tracking-wider text-neutral-900 group-hover:text-[#FF7A70] transition-colors">
                  Tap to Punch In
                </span>
                <span className="text-[10px] font-medium text-neutral-400">
                  200m GPS Verified
                </span>
              </div>
            </button>
          )}
        </div>

        {/* Live Loading Feedback */}
        {busy && (
          <div className="my-2 inline-flex items-center gap-2 rounded-full bg-[#FF7A70]/10 px-4 py-1.5 text-xs font-bold text-[#FF7A70] animate-pulse">
            <Navigation className="h-3.5 w-3.5 animate-spin" />
            <span>Pinpointing high-precision location…</span>
          </div>
        )}

        {/* Verified Location & Geofence Badge */}
        {checkedIn && (
          <div className="my-3 flex flex-col items-center gap-2 w-full max-w-md">
            {/* Address Pill */}
            <div className="flex items-center gap-2 rounded-full border border-neutral-200/90 bg-neutral-50 px-3.5 py-1.5 text-xs text-neutral-700 shadow-2xs max-w-full">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[#FF7A70]" />
              <span className="truncate font-medium">
                {today?.checkInAddress
                  ? today.checkInAddress.replace(/sunbreeze/gi, "Realty Smartz Private Limited")
                  : (settings?.officeName || "Realty Smartz Private Limited HQ, Gurugram")}
              </span>
            </div>

            {/* Geofence Rule Indicator */}
            <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border border-neutral-200 bg-white shadow-2xs">
              <span
                className={`h-2 w-2 rounded-full ${
                  today?.withinGeofence ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                }`}
              />
              <span className={today?.withinGeofence ? "text-emerald-700" : "text-amber-800"}>
                {today?.withinGeofence
                  ? "✓ Within 200m Office Perimeter"
                  : "▲ Outside usual perimeter (Location recorded)"}
              </span>
            </div>

            {/* Shift Checkout Summary if Checked Out */}
            {checkedOut && today?.checkOutTime && (
              <div className="mt-2 w-full rounded-2xl bg-emerald-50/90 border border-emerald-200/90 p-3.5 text-xs text-emerald-900 shadow-2xs">
                <div className="flex items-center justify-between font-semibold text-emerald-900">
                  <span>Punched Out: {formatTimeIST(today.checkOutTime)}</span>
                  {today.totalHours != null && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800 font-bold">
                      {today.totalHours} hrs worked
                    </span>
                  )}
                </div>
                {today.notes?.includes("Auto checked out") && (
                  <p className="mt-1 text-[11px] font-bold text-emerald-700">
                    ⚡ Shift End Auto Punch-Out Triggered (7:00 PM IST)
                  </p>
                )}
                {today.checkInTime && (
                  <p className="mt-0.5 text-[11px] text-emerald-600">
                    Punch In recorded at {formatTimeIST(today.checkInTime)}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Permission Denied Advisory Card */}
        {isPermissionDenied && (
          <div className="my-4 w-full max-w-md rounded-2xl border border-amber-300 bg-amber-50/90 p-4 text-left shadow-2xs">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-amber-900">
                  Location Permission Required
                </h4>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Realty Smartz requires geolocation verification within the 200-meter company perimeter. Please allow location access in your device settings.
                </p>
                <div className="pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-amber-300 bg-white text-xs font-semibold text-amber-900 hover:bg-amber-100 rounded-xl"
                    onClick={() => captureAndSubmit(checkedIn ? "out" : "in")}
                  >
                    <RotateCw className="mr-1.5 h-3.5 w-3.5" />
                    Retry Permission
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Generic Error Warning */}
        {error && !isPermissionDenied && (
          <div className="my-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        {/* Primary Tactile Action Buttons */}
        {!isPermissionDenied && (
          <div className="mt-3 w-full max-w-xs">
            {checkedOut ? (
              <div className="flex flex-col items-center gap-1.5">
                <Button
                  disabled
                  className="h-12 w-full gap-2 text-sm font-bold bg-emerald-50 text-emerald-800 border-2 border-emerald-400/30 opacity-100 rounded-2xl cursor-default shadow-xs"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Attendance Completed</span>
                </Button>
                <p className="text-[11px] text-neutral-400">
                  Attendance is complete for today. Resets automatically tomorrow morning.
                </p>
              </div>
            ) : !checkedIn ? (
              <Button
                className="h-13 w-full gap-2 text-base font-bold shadow-[0_8px_25px_rgba(255,122,112,0.35)] bg-gradient-to-r from-[#FF7A70] to-[#FFA07A] hover:opacity-95 text-white active:scale-98 transition-all rounded-2xl"
                disabled={busy}
                onClick={() => captureAndSubmit("in")}
              >
                <LogIn className="h-5 w-5" />
                {busy ? "Verifying 200m Location…" : "Punch In Now"}
              </Button>
            ) : (
              <Button
                className="h-13 w-full gap-2 text-base font-bold shadow-md bg-neutral-900 hover:bg-black text-white active:scale-98 transition-all rounded-2xl"
                disabled={busy}
                onClick={() => captureAndSubmit("out")}
              >
                <LogOut className="h-5 w-5" />
                {busy ? "Verifying 200m Location…" : "Punch Out (End Shift)"}
              </Button>
            )}
          </div>
        )}

        {/* Verification Map Drawer Toggle */}
        {(today?.checkInLat != null || captured?.lat != null) && (
          <div className="mt-4 w-full max-w-md pt-2">
            <button
              type="button"
              onClick={() => setShowMap(!showMap)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              <span>{showMap ? "Hide Verification Map" : "View Geofence Map"}</span>
              {showMap ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {showMap && (
              <div className="mt-3 overflow-hidden rounded-2xl border border-neutral-200 shadow-sm animate-in fade-in">
                <LocationMap
                  lat={today?.checkInLat ?? captured?.lat ?? 0}
                  lng={today?.checkInLng ?? captured?.lng ?? 0}
                  label={(today?.checkInAddress ?? captured?.name ?? "Realty Smartz Private Limited HQ").replace(/sunbreeze/gi, "Realty Smartz Private Limited")}
                  height={190}
                />
              </div>
            )}
          </div>
        )}

        {/* Workplace & Geofence Footnote */}
        <div className="mt-5 flex items-center gap-1.5 text-[11px] text-neutral-400">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>
            Office Perimeter: {settings?.officeName || "Realty Smartz HQ"} (200m Radius Enforced)
          </span>
        </div>
      </div>
    </div>
  );
}

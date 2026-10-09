"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  MapPin,
  LogIn,
  LogOut,
  Clock,
  RotateCw,
  Navigation,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { trpc } from "@/lib/trpc";
import {
  geolocationErrorMessage,
  getCurrentPosition,
  reverseGeocodePlace,
  type GeoPlace,
} from "@/lib/geolocation";
import { LocationMap } from "@/components/LocationMap";
import {
  formatTimeIST,
  TIMEZONE_IST,
  getISTDateParts,
  haversineDistanceM,
} from "@realty-smartz/shared";
import { cn } from "@/lib/utils";

export function CheckInOutCard() {
  const { data: session } = useSession();
  const utils = trpc.useUtils();
  const { data: today, isLoading } = trpc.attendance.today.useQuery();
  const { data: settings } = trpc.companySettings.get.useQuery();
  const { data: workLoc } = trpc.attendance.myWorkLocation.useQuery();

  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isPermissionDenied, setIsPermissionDenied] = useState<boolean>(false);
  const [busy, setBusy] = useState(false);
  const [captured, setCaptured] = useState<GeoPlace | null>(null);
  const [showMap, setShowMap] = useState(false);

  // Live device GPS coordinates for real-time pre-check
  const [liveCoords, setLiveCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Pre-fetch live location on mount
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLiveCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
    );
  }, []);

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

      // Invalidate if 7:00 PM IST is reached while user is on duty
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

  const reportLocationDisabled = trpc.attendance.reportLocationDisabled.useMutation();

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

  // Workplace details & geofence resolution
  const empData = workLoc?.employee;
  const officeData = workLoc?.office;
  const assignedSiteName = empData?.workLocationName || "Registered Office";
  const assignedSiteLat = empData?.workLocationLat ?? null;
  const assignedSiteLng = empData?.workLocationLng ?? null;
  const officeName = officeData?.officeName || "REALTY SMARTZ PVT LTD";
  const officeLat = officeData?.officeLat ?? 28.3997196;
  const officeLng = officeData?.officeLng ?? 77.0385682;
  const geofenceRadius = officeData?.geofenceRadiusM ?? 200;

  const distanceOfficeM = useMemo(() => {
    if (!liveCoords) return null;
    return haversineDistanceM(liveCoords.lat, liveCoords.lng, officeLat, officeLng);
  }, [liveCoords, officeLat, officeLng]);

  const distanceSiteM = useMemo(() => {
    if (!liveCoords || assignedSiteLat == null || assignedSiteLng == null) return null;
    return haversineDistanceM(liveCoords.lat, liveCoords.lng, assignedSiteLat, assignedSiteLng);
  }, [liveCoords, assignedSiteLat, assignedSiteLng]);

  const isAtOffice = distanceOfficeM != null && distanceOfficeM <= geofenceRadius;
  const isAtSite = distanceSiteM != null && distanceSiteM <= geofenceRadius;
  const isAuthorizedLocation = isAtOffice || isAtSite;

  async function captureAndSubmit(mode: "in" | "out") {
    setError("");
    setIsPermissionDenied(false);
    setBusy(true);

    try {
      const pos = await getCurrentPosition();
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setLiveCoords({ lat, lng });

      // Immediate client-side verification - Strict workplace location check
      const curDistOffice = haversineDistanceM(lat, lng, officeLat, officeLng);
      const curDistSite =
        assignedSiteLat != null && assignedSiteLng != null
          ? haversineDistanceM(lat, lng, assignedSiteLat, assignedSiteLng)
          : null;

      const withinAllowed =
        curDistOffice <= geofenceRadius ||
        (curDistSite != null && curDistSite <= geofenceRadius);

      if (mode === "in" && !withinAllowed) {
        setError(
          `Punch-in blocked: You are outside your assigned workplace. Please punch in from your registered office (${officeName}) or assigned site.`
        );
        return;
      }

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
      const isDenied = Boolean(
        errObj && (errObj.code === 1 || errObj.code === 2 || errObj.message?.toLowerCase().includes("denied") || errObj.message?.toLowerCase().includes("permission"))
      );
      if (isDenied) {
        setIsPermissionDenied(true);
        reportLocationDisabled.mutate({
          reason: errObj.message || "Device GPS Location Disabled / Permission Denied during punch attempt",
          deviceInfo: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        });
      }
      setError(geolocationErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const isOnDuty = Boolean(today?.checkInTime && !today?.checkOutTime);
  const hasCompletedSession = Boolean(today?.checkInTime && today?.checkOutTime);
  const employeeName = session?.user?.name ?? "Team Member";

  if (isLoading) {
    return (
      <div className="w-full rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <div className="flex flex-col items-center justify-center py-6">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-[#FF7A70]" />
          <p className="mt-3 text-xs font-medium text-neutral-500">Loading attendance status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-2xl border border-neutral-200/90 bg-white p-5 sm:p-6 shadow-sm">
      {/* Top Header: Company Logo & Greeting */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-4 border-b border-neutral-100">
        <Logo size={34} />
        <div className="text-center sm:text-right">
          <span className="text-[11px] font-medium text-neutral-500 block">Welcome,</span>
          <span className="text-sm font-semibold text-neutral-900 truncate block max-w-[200px]">
            {employeeName}
          </span>
        </div>
      </div>

      {/* Main Clock & Status Section */}
      <div className="py-5 flex flex-col items-center text-center">
        {/* Live IST Time */}
        <div className="font-mono text-4xl sm:text-5xl font-bold tracking-tight text-neutral-900">
          {currentTime || "10:00:00 AM"}
        </div>
        <div className="mt-1 text-xs font-medium text-neutral-500">
          {currentDate || "Today"} (IST)
        </div>

        {/* Status Badge */}
        <div className="mt-3">
          {isOnDuty ? (
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200/80 px-3 py-1 text-xs font-semibold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>On Duty · {formattedElapsed}</span>
            </div>
          ) : hasCompletedSession ? (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 border border-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-700">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>Punched Out · Session Recorded</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 border border-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-600">
              <Clock className="h-3.5 w-3.5 text-neutral-400" />
              <span>Off Duty · Ready to Punch In</span>
            </div>
          )}
        </div>

        {/* Assigned Workplace Location Pill */}
        <div className="mt-3 flex items-center gap-1.5 rounded-full bg-neutral-50 border border-neutral-200/70 px-3 py-1 text-xs text-neutral-600 max-w-full">
          <MapPin className="h-3.5 w-3.5 text-[#FF7A70] shrink-0" />
          <span className="truncate font-medium">
            {assignedSiteName && assignedSiteName !== "Registered Office"
              ? assignedSiteName
              : officeName}
          </span>
        </div>

        {/* Error / Alert Notice */}
        {error && !isPermissionDenied && (
          <div className="mt-4 w-full max-w-md rounded-xl border border-rose-200 bg-rose-50/90 px-3.5 py-2.5 text-left text-xs text-rose-700 flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="font-medium leading-relaxed">{error}</span>
          </div>
        )}

        {/* Permission Denied Banner */}
        {isPermissionDenied && (
          <div className="mt-4 w-full max-w-md rounded-xl border border-amber-200 bg-amber-50/90 p-3.5 text-left text-xs text-amber-800">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1.5 flex-1">
                <p className="font-semibold text-amber-900">Location Access Required</p>
                <p className="text-amber-700 leading-relaxed">
                  Please enable GPS location permissions in your browser or device settings to punch in/out.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-amber-300 bg-white hover:bg-amber-100"
                  onClick={() => captureAndSubmit(isOnDuty ? "out" : "in")}
                >
                  <RotateCw className="mr-1 h-3 w-3" />
                  Retry Location
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* SINGLE ACTION BUTTON: Punch In / Punch Out */}
        <div className="mt-5 w-full max-w-xs">
          {isOnDuty ? (
            <Button
              className="h-12 w-full gap-2 text-sm font-semibold shadow-sm bg-neutral-900 hover:bg-black text-white active:scale-98 transition-all rounded-xl"
              disabled={busy}
              onClick={() => captureAndSubmit("out")}
            >
              <LogOut className="h-4 w-4" />
              <span>{busy ? "Verifying Location…" : "Punch Out"}</span>
            </Button>
          ) : (
            <Button
              className={cn(
                "h-12 w-full gap-2 text-sm font-semibold shadow-sm rounded-xl transition-all active:scale-98",
                "bg-gradient-to-r from-[#FF7A70] to-[#FFA07A] text-white hover:opacity-95 shadow-[0_4px_16px_rgba(255,122,112,0.3)]"
              )}
              disabled={busy}
              onClick={() => captureAndSubmit("in")}
            >
              {busy ? (
                <>
                  <Navigation className="h-4 w-4 animate-spin" />
                  <span>Verifying Location…</span>
                </>
              ) : hasCompletedSession ? (
                <>
                  <RotateCw className="h-4 w-4" />
                  <span>Punch In Again</span>
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  <span>Punch In</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Today's Workday Summary (3 Simple Stat Boxes) */}
      <div className="mt-4 pt-4 border-t border-neutral-100 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-neutral-50/80 border border-neutral-100 p-2.5">
          <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider block">
            Punch In
          </span>
          <span className="text-xs sm:text-sm font-semibold text-neutral-800 mt-0.5 block truncate">
            {today?.checkInTime ? formatTimeIST(today.checkInTime) : "—"}
          </span>
        </div>

        <div className="rounded-xl bg-neutral-50/80 border border-neutral-100 p-2.5">
          <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider block">
            Punch Out
          </span>
          <span className="text-xs sm:text-sm font-semibold text-neutral-800 mt-0.5 block truncate">
            {today?.checkOutTime ? formatTimeIST(today.checkOutTime) : "—"}
          </span>
        </div>

        <div className="rounded-xl bg-neutral-50/80 border border-neutral-100 p-2.5">
          <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider block">
            Total Hours
          </span>
          <span className="text-xs sm:text-sm font-semibold text-neutral-800 mt-0.5 block truncate">
            {today?.totalHours != null && today.totalHours > 0
              ? `${today.totalHours} hrs`
              : isOnDuty
              ? "Running"
              : "—"}
          </span>
        </div>
      </div>

      {/* Expandable Location Map */}
      {(today?.checkInLat != null || captured?.lat != null || liveCoords?.lat != null) && (
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={() => setShowMap(!showMap)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500 hover:text-neutral-800 transition-colors"
          >
            <span>{showMap ? "Hide Map" : "View Map"}</span>
            {showMap ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          {showMap && (
            <div className="mt-2.5">
              <LocationMap
                lat={today?.checkInLat ?? captured?.lat ?? liveCoords?.lat ?? officeLat}
                lng={today?.checkInLng ?? captured?.lng ?? liveCoords?.lng ?? officeLng}
                label={
                  today?.checkInTime
                    ? `Punched In Location`
                    : `Registered Location`
                }
                height={180}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

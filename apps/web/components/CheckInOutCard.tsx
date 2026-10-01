"use client";

import { useEffect, useState } from "react";
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

      const addressLabel = place.address
        ? `${place.name} — ${place.address}`
        : place.name;

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
      <Card className="border-neutral-200 bg-white shadow-sm">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          <p className="mt-4 text-caption text-neutral-500">Checking attendance status...</p>
        </CardContent>
      </Card>
    );
  }

  const checkedIn = Boolean(today?.checkInTime);
  const checkedOut = Boolean(today?.checkOutTime);
  const employeeName = session?.user?.name ?? "Team Member";

  return (
    <Card className="overflow-hidden border border-neutral-200/80 bg-white shadow-sm transition-all">
      <CardContent className="p-6 sm:p-8">
        <div className="flex flex-col items-center text-center">
          {/* Header Info */}
          <div className="mb-2 flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wider text-primary">
            <Building className="h-3.5 w-3.5" />
            <span>Realty Smartz Private Limited</span>
          </div>

          <p className="text-caption text-neutral-500">
            Welcome, <span className="font-semibold text-neutral-900">{employeeName}</span>
          </p>

          {/* Current Time Display */}
          <div className="my-5">
            <div className="flex items-center justify-center gap-2">
              <Clock className="h-5 w-5 text-neutral-400" />
              <span className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-neutral-900">
                {currentTime || "10:00:00 AM"}
              </span>
            </div>
            <p className="mt-1 text-sm font-medium text-neutral-500">{currentDate}</p>
          </div>

          {/* Status Indicator Circle */}
          <div className="relative my-4 flex h-36 w-36 items-center justify-center">
            {busy ? (
              // Location capture loading state with animated pin
              <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-indigo-50 border-2 border-primary/30 shadow-inner">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/20 opacity-75" />
                <div className="flex flex-col items-center">
                  <MapPin className="h-10 w-10 animate-bounce text-primary" />
                  <span className="mt-1 text-[11px] font-semibold text-primary">Locating</span>
                </div>
              </div>
            ) : checkedOut ? (
              // Checked out completed state
              <div className="flex h-32 w-32 items-center justify-center rounded-full bg-emerald-50 border-2 border-emerald-500/40 shadow-inner">
                <div className="flex flex-col items-center text-emerald-700">
                  <CheckCircle2 className="h-11 w-11" />
                  <span className="mt-1 text-xs font-semibold">Done for Today</span>
                </div>
              </div>
            ) : checkedIn ? (
              // Checked in active state
              <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-indigo-50/80 border-2 border-primary/40 shadow-inner">
                <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-teal/15" />
                <div className="flex flex-col items-center text-primary">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                  <span className="mt-1 text-xs font-bold uppercase tracking-wider text-primary">
                    On Duty
                  </span>
                  <span className="text-[11px] text-neutral-500">
                    {today?.checkInTime
                      ? new Date(today.checkInTime).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : ""}
                  </span>
                </div>
              </div>
            ) : (
              // Idle / ready to check in state
              <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-indigo-50 border-2 border-primary/30 shadow-inner transition-transform hover:scale-105">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/25 opacity-70" />
                <div className="flex flex-col items-center text-primary">
                  <LogIn className="h-10 w-10" />
                  <span className="mt-1 text-xs font-bold uppercase tracking-wider">Ready</span>
                </div>
              </div>
            )}
          </div>

          {/* Loading status description */}
          {busy && (
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-1.5 text-sm font-medium text-primary">
              <Navigation className="h-4 w-4 animate-spin text-primary" />
              <span>Getting your location…</span>
            </div>
          )}

          {/* Geofence & Location Confirmation State Pill */}
          {checkedIn && (
            <div className="my-3 flex flex-col items-center gap-2">
              <div className="inline-flex max-w-md items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50/80 px-4 py-1.5 text-xs text-neutral-700 shadow-2xs">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                <span className="truncate">
                  {today?.checkInAddress || "Near Realty Smartz Private Limited HQ, Gurugram"}
                </span>
              </div>

              {/* Status colored dot badge */}
              <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border border-neutral-200 bg-white">
                <span
                  className={`h-2 w-2 rounded-full ${
                    today?.withinGeofence ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                  }`}
                />
                <span className={today?.withinGeofence ? "text-emerald-700" : "text-amber-800"}>
                  {today?.withinGeofence ? "Within office premises" : "Outside usual location"}
                </span>
              </div>

              {/* Checkout details if already checked out */}
              {checkedOut && today?.checkOutTime && (
                <div className="mt-2 rounded-xl bg-emerald-50/90 border border-emerald-200/90 px-4 py-2.5 text-xs text-emerald-900 shadow-2xs max-w-sm">
                  <div className="flex items-center justify-center gap-1.5 font-semibold text-emerald-800">
                    <span>
                      ✓ Checked out at {formatTimeIST(today.checkOutTime)}
                    </span>
                    {today.totalHours != null && (
                      <span className="font-normal text-emerald-700">
                        ({today.totalHours} hrs worked)
                      </span>
                    )}
                  </div>
                  {today.notes?.includes("Auto checked out") && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-300">
                      ⚡ Shift End Auto Punch-Out (7:00 PM IST)
                    </span>
                  )}
                  {today.checkInTime && (
                    <p className="text-[11px] text-emerald-700/80 mt-1">
                      Punched in at {formatTimeIST(today.checkInTime)}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Permission Denied Inline Warning Card */}
          {isPermissionDenied && (
            <div className="my-4 w-full max-w-md rounded-xl border border-amber-300 bg-amber-50/80 p-4 text-left shadow-2xs">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-amber-900">
                    Location access is required to check in
                  </h4>
                  <p className="text-xs text-amber-800">
                    Realty Smartz Private Limited requires geolocation verification to validate office attendance.
                    Please enable location permissions in your browser settings.
                  </p>
                  <div className="pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-amber-300 bg-white text-xs text-amber-900 hover:bg-amber-100"
                      onClick={() => captureAndSubmit(checkedIn ? "out" : "in")}
                    >
                      <RotateCw className="mr-1.5 h-3 w-3" />
                      Try Again
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Generic error message if not permission denied */}
          {error && !isPermissionDenied && (
            <p className="my-3 text-xs font-medium text-maroon" role="alert">
              {error}
            </p>
          )}

          {/* Primary Action Button & Explicit Third State (Completed Shift) */}
          {!isPermissionDenied && (
            <div className="mt-3 w-full max-w-xs">
              {checkedOut ? (
                <div className="flex flex-col items-center gap-2">
                  <Button
                    disabled
                    className="h-12 w-full gap-2 text-base font-semibold bg-emerald-50 text-emerald-800 border-2 border-emerald-500/30 opacity-100 cursor-default shadow-xs"
                  >
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <span>Attendance Completed</span>
                  </Button>
                  <p className="text-xs text-neutral-500">
                    Your attendance is completed for today. Resets automatically at midnight.
                  </p>
                </div>
              ) : !checkedIn ? (
                <Button
                  className="h-12 w-full gap-2 text-base font-semibold shadow-md bg-gradient-to-r from-[#FF7A70] to-[#FFA07A] hover:opacity-95 text-white active:scale-98 transition-all"
                  disabled={busy}
                  onClick={() => captureAndSubmit("in")}
                >
                  <LogIn className="h-5 w-5" />
                  {busy ? "Getting your location…" : "Check In"}
                </Button>
              ) : (
                <Button
                  className="h-12 w-full gap-2 text-base font-semibold shadow-md bg-neutral-900 hover:bg-black text-white active:scale-98 transition-all"
                  disabled={busy}
                  onClick={() => captureAndSubmit("out")}
                >
                  <LogOut className="h-5 w-5" />
                  {busy ? "Getting your location…" : "Check Out"}
                </Button>
              )}
            </div>
          )}

          {/* Map toggle if coordinates available */}
          {(today?.checkInLat != null || captured?.lat != null) && (
            <div className="mt-4 w-full max-w-md pt-2">
              <button
                type="button"
                onClick={() => setShowMap(!showMap)}
                className="text-xs font-medium text-neutral-500 hover:text-primary transition-colors underline"
              >
                {showMap ? "Hide verification map" : "View attendance map"}
              </button>
              {showMap && (
                <div className="mt-3 overflow-hidden rounded-xl border border-neutral-200">
                  <LocationMap
                    lat={today?.checkInLat ?? captured?.lat ?? 0}
                    lng={today?.checkInLng ?? captured?.lng ?? 0}
                    label={today?.checkInAddress ?? captured?.name ?? "Check-in Location"}
                    height={180}
                  />
                </div>
              )}
            </div>
          )}

          {/* Office config footnote */}
          {settings && (
            <p className="mt-6 text-[11px] text-neutral-400">
              Office Geofence: {settings.officeName} ({settings.geofenceRadiusM}m perimeter)
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

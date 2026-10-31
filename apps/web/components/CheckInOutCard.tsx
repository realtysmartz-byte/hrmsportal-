"use client";

import { useEffect, useState } from "react";
import { MapPin, Loader2, AlertCircle, CalendarClock, ArrowDownLeft, Sparkles } from "lucide-react";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc";
import {
  acquirePunchFix,
  getServerAdjustedFixTimestamp,
  geolocationErrorMessage,
  setServerTimeReference,
  startPunchLocationPrewarm,
  stopPunchLocationPrewarm,
} from "@/lib/geolocation";
import { subscribeToLocationReminders } from "@/lib/push";
import {
  getNativeMockLocationFlag,
  startNativeDutyTracking,
  stopNativeDutyTracking,
} from "@/lib/native-duty-tracking";
import { notifyClockIn, notifyClockOut } from "@/lib/client-notifications";
import { toast } from "@/lib/toast";
import { TRPCClientError } from "@trpc/client";
import {
  formatTimeIST,
  TIMEZONE_IST,
  getISTDateParts,
} from "@realty-smartz/shared";
import { cn } from "@/lib/utils";

function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function formatClock(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export function CheckInOutCard() {
  const { data: session } = useSession();
  const utils = trpc.useUtils();
  const { data: today, isLoading } = trpc.attendance.today.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: (data) => {
      const onDuty = Boolean(data?.checkInTime && !data?.checkOutTime);
      if (!onDuty) return false;
      return getISTDateParts(new Date()).hour >= 19 ? 60_000 : false;
    },
  });
  const { data: workLoc } = trpc.attendance.myWorkLocation.useQuery(undefined, {
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
  const reportLocationDisabled = trpc.attendance.reportLocationDisabled.useMutation();
  const savePush = trpc.attendance.savePushSubscription.useMutation();

  const [tick, setTick] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"idle" | "locating" | "saving">("idle");
  const [punchQuote, setPunchQuote] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"active" | "ready" | "denied" | "prompt" | "unsupported">("prompt");

  const isOnDuty = Boolean(today?.checkInTime && !today?.checkOutTime);
  const hasCompletedSession = Boolean(today?.checkInTime && today?.checkOutTime);
  const pastShiftEnd = getISTDateParts(new Date()).hour >= 19;

  useEffect(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setGpsStatus("unsupported");
      return;
    }

    let permStatus: PermissionStatus | null = null;

    const handleState = (state: PermissionState) => {
      if (state === "granted") {
        setGpsStatus(isOnDuty ? "active" : "ready");
      } else if (state === "denied") {
        setGpsStatus("denied");
      } else {
        setGpsStatus("prompt");
      }
    };

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((perm) => {
          permStatus = perm;
          handleState(perm.state);
          perm.onchange = () => {
            handleState(perm.state);
          };
        })
        .catch(() => {
          navigator.geolocation.getCurrentPosition(
            () => setGpsStatus(isOnDuty ? "active" : "ready"),
            (err) => {
              if (err.code === err.PERMISSION_DENIED) setGpsStatus("denied");
              else setGpsStatus("prompt");
            },
            { timeout: 4000, maximumAge: 60000 }
          );
        });
    } else {
      navigator.geolocation.getCurrentPosition(
        () => setGpsStatus(isOnDuty ? "active" : "ready"),
        (err) => {
          if (err.code === err.PERMISSION_DENIED) setGpsStatus("denied");
          else setGpsStatus("prompt");
        },
        { timeout: 4000, maximumAge: 60000 }
      );
    }

    return () => {
      if (permStatus) {
        permStatus.onchange = null;
      }
    };
  }, [isOnDuty]);



  useEffect(() => {
    if (workLoc?.serverTime) setServerTimeReference(workLoc.serverTime);
  }, [workLoc?.serverTime]);

  useEffect(() => {
    startPunchLocationPrewarm();
    return () => stopPunchLocationPrewarm();
  }, []);

  useEffect(() => {
    if (!isOnDuty) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [isOnDuty]);

  const onCheckInSuccess = (res?: { quote?: string | null; status?: string }) => {
    setError("");
    const now = new Date();
    if (res?.quote) {
      setPunchQuote(res.quote);
    }
    utils.attendance.today.setData(undefined, (old) => {
      if (!old) {
        return {
          id: "optimistic-" + Date.now(),
          employeeId: "",
          date: now,
          status: (res?.status as any) || "PRESENT",
          checkInTime: now,
          checkOutTime: null,
          checkInLat: 0,
          checkInLng: 0,
          checkInAddress: null,
          checkOutLat: null,
          checkOutLng: null,
          checkOutAddress: null,
          totalHours: null,
          withinGeofence: true,
          notes: null,
          createdAt: now,
          updatedAt: now,
          punches: [{ id: "temp", checkInTime: now, checkOutTime: null, attendanceLogId: "temp", checkInAddress: null, checkOutAddress: null }],
          quote: res?.quote ?? null,
        } as unknown as typeof old;
      }
      return {
        ...old,
        checkInTime: old.checkInTime || now,
        checkOutTime: null,
        status: (res?.status as any) || old.status,
        quote: res?.quote ?? old.quote,
      } as unknown as typeof old;
    });
    void utils.attendance.today.invalidate();
    void utils.attendance.myMonth.invalidate();
    void utils.attendance.myRecentWeek.invalidate();
  };

  const onCheckOutSuccess = () => {
    setError("");
    const now = new Date();
    utils.attendance.today.setData(undefined, (old) => {
      if (!old) return old;
      return {
        ...old,
        checkOutTime: now,
      };
    });
    void utils.attendance.today.invalidate();
    void utils.attendance.myMonth.invalidate();
    void utils.attendance.myRecentWeek.invalidate();
  };

  const checkIn = trpc.attendance.checkIn.useMutation({ onSuccess: onCheckInSuccess });
  const checkOut = trpc.attendance.checkOut.useMutation({ onSuccess: onCheckOutSuccess });

  async function punch(mode: "in" | "out") {
    if (busy) return;
    if (mode === "in") void subscribeToLocationReminders(savePush.mutateAsync).catch(() => {});
    setError("");
    setBusy(true);
    setPhase("locating");
    try {
      const fix = await acquirePunchFix();
      const lat = fix.lat;
      const lng = fix.lng;
      const isMockLocation = await getNativeMockLocationFlag(fix);
      setPhase("saving");

      const payload = {
        lat,
        lng,
        address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        accuracyM: fix.accuracy,
        fixTimestamp: getServerAdjustedFixTimestamp(fix.timestamp),
        isMockLocation,
      };

      setGpsStatus(mode === "in" ? "active" : "ready");
      if (mode === "in") {
        const res = await checkIn.mutateAsync(payload);
        if (res && "quote" in res && typeof res.quote === "string") {
          setPunchQuote(res.quote);
        }
        const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const name = session?.user?.name ? ` ${session.user.name}` : "";
        const title = "✨ Clocked In Successfully!";
        const body = `Welcome to work${name}! Checked in at ${timeStr} (Realty Smartz Pvt Ltd). Wishing you a productive day!`;
        void startNativeDutyTracking({ title, body });
        void notifyClockIn({
          employeeName: session?.user?.name || undefined,
          timeStr,
          locationName: "Realty Smartz Pvt Ltd",
        });
      } else {
        await checkOut.mutateAsync(payload);
        const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const name = session?.user?.name ? ` ${session.user.name}` : "";
        const durationStr = elapsed > 0 ? formatDuration(elapsed) : undefined;
        const durationText = durationStr ? ` • Total duty: ${durationStr}` : "";
        const title = "👋 Clocked Out Successfully!";
        const body = `Great job today${name}! Clocked out at ${timeStr}${durationText}. Have a wonderful evening!`;
        void stopNativeDutyTracking({ title, body });
        void notifyClockOut({
          employeeName: session?.user?.name || undefined,
          timeStr,
          durationStr,
        });
      }
    } catch (err: unknown) {
      if ((err as { code?: number })?.code === 1) {
        setGpsStatus("denied");
        reportLocationDisabled.mutate({
          reason: "Location permission denied during punch attempt",
          deviceInfo: navigator.userAgent,
        });
      }
      const message = geolocationErrorMessage(err);
      setError(message);
      if (!(err instanceof TRPCClientError)) toast("error", message);
    } finally {
      setBusy(false);
      setPhase("idle");
    }
  }

  void tick;
  const now = new Date();
  const elapsed =
    isOnDuty && today?.checkInTime
      ? Math.max(0, Math.floor((now.getTime() - new Date(today.checkInTime).getTime()) / 1000))
      : 0;

  const hours =
    today?.totalHours != null && today.totalHours > 0
      ? `${today.totalHours}h`
      : isOnDuty
        ? formatDuration(elapsed)
        : isLoading
          ? "…"
          : "0h 00m";

  const assignedSites = (workLoc?.sites ?? []).filter((s) => s.source === "ASSIGNED");
  const locationLabel =
    assignedSites.length > 0
      ? `Office or ${assignedSites.map((s) => s.name).join(", ")} (200m)`
      : workLoc?.name ?? (isLoading ? "…" : "Realty Smartz Pvt Ltd");

  const busyLabel =
    phase === "saving" ? "Saving…" : phase === "locating" ? "Getting location…" : null;

  const activeQuote =
    punchQuote || (today as { quote?: string | null } | undefined)?.quote;

  return (
    <div className="w-full rounded-2xl bg-white border border-[#ECE5F8] p-3.5 sm:p-4 shadow-[0_8px_30px_rgba(78,36,201,0.06)] transition-all">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold tracking-wider text-[#7A6E9B] uppercase">
          10:00 AM - 07:00 PM • GENERAL
        </p>
        {gpsStatus === "active" && (
          <span
            className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 border border-emerald-200/80 transition-colors"
            title="GPS location tracking is actively connected"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            GPS Active
          </span>
        )}
        {gpsStatus === "ready" && (
          <span
            className="flex shrink-0 items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[9px] font-bold text-teal-700 border border-teal-200/80 transition-colors"
            title="GPS location is available and ready for attendance"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
            GPS Ready
          </span>
        )}
        {gpsStatus === "denied" && (
          <button
            type="button"
            onClick={() => {
              toast("error", 
                "Location access is blocked. Please allow location permissions in browser/phone settings to check in."
              );
            }}
            className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-bold text-rose-700 border border-rose-200/90 hover:bg-rose-100 transition-colors"
            title="Location permission denied. Click for details."
          >
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            GPS Disabled
          </button>
        )}
        {gpsStatus === "prompt" && (
          <button
            type="button"
            onClick={() => {
              navigator.geolocation.getCurrentPosition(
                () => {
                  setGpsStatus(isOnDuty ? "active" : "ready");
                  toast("success", "GPS location connected");
                },
                (err) => {
                  if (err.code === err.PERMISSION_DENIED) {
                    setGpsStatus("denied");
                    toast("error", "Location permission was denied.");
                  }
                },
                { timeout: 8000 }
              );
            }}
            className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700 border border-amber-200/90 hover:bg-amber-100 transition-colors"
            title="Click to connect GPS"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Connect GPS
          </button>
        )}
        {gpsStatus === "unsupported" && (
          <span
            className="flex shrink-0 items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[9px] font-bold text-neutral-600 border border-neutral-200"
            title="Geolocation is not supported by your browser"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
            GPS Unavailable
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#5225C5] text-white shadow-[0_3px_10px_rgba(82,37,197,0.3)]">
          <CalendarClock className="h-4.5 w-4.5 stroke-[2.2px]" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold tracking-tight text-[#1C113B] leading-snug">
            {now.toLocaleDateString("en-IN", {
              timeZone: TIMEZONE_IST,
              day: "numeric",
              month: "short",
            })}{" "}
            <span className="font-semibold text-[#1C113B]">
              {now.toLocaleDateString("en-IN", {
                timeZone: TIMEZONE_IST,
                weekday: "short",
              })}
            </span>
          </p>
          <p className="text-[10px] font-medium text-[#7A6E9B] leading-none mt-0.5">{hours} worked</p>
        </div>
      </div>

      {error && (
        <div className="mt-2 flex items-start gap-1.5 rounded-xl bg-rose-50 px-2.5 py-1.5 text-[11px] font-medium text-rose-700 border border-rose-200/60">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isOnDuty && pastShiftEnd ? (
        <div className="mt-2.5 flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 text-[11px] font-semibold text-amber-900 shadow-2xs">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Shift ended 7:00 PM — auto clock-out…
        </div>
      ) : (
        <div className="mt-2.5 flex gap-2">
          {/* Left Solid Deep Purple Clock In / Out Button */}
          <button
            type="button"
            disabled={busy || isLoading}
            onClick={() => punch(isOnDuty ? "out" : "in")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 h-9 sm:h-10 rounded-xl font-bold text-xs text-white transition-all duration-200 active:scale-98 disabled:opacity-70",
              isOnDuty
                ? "bg-rose-500 hover:bg-rose-600 shadow-[0_4px_14px_rgba(244,63,94,0.3)]"
                : "bg-[#5225C5] hover:bg-[#431EB3] shadow-[0_4px_14px_rgba(82,37,197,0.3)]"
            )}
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>
              {busyLabel
                ? busyLabel
                : isOnDuty
                  ? "Clock Out"
                  : hasCompletedSession
                    ? "Clock In Again"
                    : "Clock In"}
            </span>
          </button>

          {/* Right White Pill with Purple Border Showing Current Time */}
          <div className="flex flex-1 items-center justify-center rounded-xl border border-[#E7E0F8] bg-[#FAF8FE] h-9 sm:h-10 px-2 shadow-2xs">
            <span className="tabular-nums text-xs font-bold text-[#5225C5]">
              {isOnDuty
                ? formatClock(elapsed)
                : now.toLocaleTimeString("en-IN", {
                    timeZone: TIMEZONE_IST,
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  }).toLowerCase()}
            </span>
            {today?.checkInTime && (
              <span className="ml-1.5 flex items-center gap-0.5 text-[9px] font-semibold text-neutral-500">
                <ArrowDownLeft className="h-2.5 w-2.5 text-emerald-600" />
                {formatTimeIST(today.checkInTime)}
              </span>
            )}
          </div>
        </div>
      )}

      {activeQuote && (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-[#FAF8FE] px-2 py-1 text-[10px] text-neutral-600 border border-purple-100/80">
          <Sparkles className="h-3 w-3 text-[#5225C5] shrink-0" />
          <p className="truncate italic leading-none">&ldquo;{activeQuote}&rdquo;</p>
        </div>
      )}

      <div className="mt-2 flex items-center gap-1.5 text-[10px] font-medium text-[#7D7398]">
        <MapPin className="h-3 w-3 text-[#8E84A8] shrink-0" />
        <span className="truncate">{locationLabel}</span>
      </div>
    </div>
  );
}

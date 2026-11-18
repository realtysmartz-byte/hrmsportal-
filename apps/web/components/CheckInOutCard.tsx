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
    setError("");

    if (mode === "in") {
      const istHour = getISTDateParts(new Date()).hour;
      if (istHour >= 19) {
        setError("Clock-in is not allowed after 7:00 PM. Shift ends at 7:00 PM.");
        return;
      }
    }

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
        try { localStorage.setItem("rs_last_location_ping_at", String(Date.now())); } catch { }
        if (res && "quote" in res && typeof res.quote === "string") {
          setPunchQuote(res.quote);
        }
        const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        void startNativeDutyTracking();
        void notifyClockIn({
          employeeName: session?.user?.name || undefined,
          timeStr,
          locationName: "Realty Smartz Pvt Ltd",
        });
      } else {
        await checkOut.mutateAsync(payload);
        try { localStorage.setItem("rs_last_location_ping_at", String(Date.now())); } catch { }
        const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const durationStr = elapsed > 0 ? formatDuration(elapsed) : undefined;
        void stopNativeDutyTracking();
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

  const punches = (today as { punches?: Array<{ id: string; checkInTime: Date | string; checkOutTime: Date | string | null; checkInAddress?: string | null; checkOutAddress?: string | null }> } | undefined)?.punches ?? [];

  // Completed punch sessions total in seconds
  let completedDurationSec = 0;
  for (const p of punches) {
    if (p.checkInTime && p.checkOutTime) {
      const diff = Math.max(
        0,
        Math.floor((new Date(p.checkOutTime).getTime() - new Date(p.checkInTime).getTime()) / 1000)
      );
      completedDurationSec += diff;
    }
  }

  // Active open punch session
  const activePunch = punches.find((p) => p.checkInTime && !p.checkOutTime);
  const activeElapsedSec =
    isOnDuty
      ? Math.max(
        0,
        Math.floor(
          (now.getTime() - new Date(activePunch?.checkInTime ?? today?.checkInTime ?? now).getTime()) / 1000
        )
      )
      : 0;

  const totalWorkedSec = completedDurationSec + activeElapsedSec;
  const elapsed = totalWorkedSec;

  const hours =
  isOnDuty
    ? formatDuration(totalWorkedSec)
    : today?.totalHours != null && today.totalHours > 0
      ? `${today.totalHours}h`
      : totalWorkedSec > 0
    ? formatDuration(totalWorkedSec)
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

  const formattedDate = `${now.toLocaleDateString("en-IN", {
    timeZone: TIMEZONE_IST,
    day: "numeric",
    month: "short",
  })} ${now.toLocaleDateString("en-IN", {
    timeZone: TIMEZONE_IST,
    weekday: "short",
  })}`;

  const currentTimeStr = now.toLocaleTimeString("en-IN", {
    timeZone: TIMEZONE_IST,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).toLowerCase();

  return (
    <section className="w-full rounded-[4px] border border-[var(--line)] bg-[var(--bg)] p-5 text-[var(--ink)]">
      {/* Row 1: Date & GPS Ready */}
      <div className="flex justify-between items-center text-[13px] text-[var(--muted)]">
        <span>{formattedDate}</span>
        <div className="flex items-center gap-1.5 text-[var(--ink)] font-semibold text-[12px]">
          <i
            className={cn(
              "w-2 h-2 rounded-full inline-block",
              gpsStatus === "denied"
                ? "bg-[var(--danger)]"
                : gpsStatus === "ready" || gpsStatus === "active"
                  ? "bg-[var(--ok)]"
                  : "bg-amber-500"
            )}
          />
          <span>{gpsStatus === "denied" ? "GPS ready" : "GPS ready"}</span>
        </div>
      </div>

      {/* Big Display Time */}
      <div className="mt-3.5 mb-1 text-[46px] leading-none font-bold tracking-[-0.03em] tabular-nums text-[var(--ink)]">
        {isOnDuty ? formatClock(elapsed) : currentTimeStr}
      </div>

      {/* Shift & Work Meta */}
      <div className="text-[13px] text-[var(--muted)]">10:00 AM - 07:00 PM • General</div>
      <div className="text-[13px] text-[var(--muted)] mt-0.5">{hours} worked</div>

      {/* Error if any */}
      {error && (
        <div className="mt-2.5 flex items-start gap-1.5 rounded-[2px] bg-rose-50 px-2.5 py-1.5 text-[11px] font-medium text-rose-700 border border-rose-200">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Chamfered Clock In / Out Button */}
      {isOnDuty && pastShiftEnd ? (
        <div className="mt-4 flex h-[54px] w-full items-center justify-center gap-2 rounded-[2px] border border-amber-300 bg-amber-50 text-[13px] font-semibold text-amber-900">
          <Loader2 className="h-4 w-4 animate-spin" />
          Shift ended 7:00 PM — auto clock-out…
        </div>
      ) : !isOnDuty && pastShiftEnd ? (
        <div className="w-full h-[54px] my-4 mb-3.5 rounded-[4px] bg-neutral-100 text-neutral-500 border border-neutral-200 text-[14px] font-semibold flex items-center justify-center gap-2 select-none cursor-not-allowed">
          Shift ended at 7:00 PM · Clock-in closed
        </div>
      ) : (
        <button
          type="button"
          disabled={busy || isLoading}
          onClick={() => punch(isOnDuty ? "out" : "in")}
          className={cn(
            "w-full h-[54px] my-4 mb-3.5 border-0 text-white text-[16px] font-semibold cursor-pointer active:brightness-92 transition-all flex items-center justify-center gap-2 select-none",
            isOnDuty ? "bg-[var(--danger)]" : "bg-[var(--accent)]"
          )}
          style={{
            clipPath:
              "polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)",
          }}
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
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
      )}

      {/* Work Location */}
      <div className="flex items-center gap-2 text-[13px] text-[var(--muted)]">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4 h-4 shrink-0"
        >
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <span className="truncate">{locationLabel}</span>
      </div>

      {/* Today's Punches History */}
      {punches.length > 0 && (
        <div className="mt-4 pt-3.5 border-t border-[var(--line)]">
          <div className="flex items-center justify-between text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mb-2">
            <span>Today's Punches ({punches.length})</span>
            <span className="text-[var(--accent)] font-semibold">
              {isOnDuty ? "Active Duty" : "Completed"}
            </span>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
            {punches.map((p, idx) => {
              const inStr = p.checkInTime ? formatTimeIST(p.checkInTime) : "—";
              const outStr = p.checkOutTime ? formatTimeIST(p.checkOutTime) : "Active";
              const isSessionActive = !p.checkOutTime;
              const durationSec = p.checkInTime && p.checkOutTime
                ? Math.max(0, Math.floor((new Date(p.checkOutTime).getTime() - new Date(p.checkInTime).getTime()) / 1000))
                : p.checkInTime
                  ? Math.max(0, Math.floor((now.getTime() - new Date(p.checkInTime).getTime()) / 1000))
                  : 0;

              return (
                <div
                  key={p.id || idx}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-[4px] border text-[12px] transition-all",
                    isSessionActive
                      ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
                      : "bg-[var(--soft)]/50 border-[var(--line)] text-[var(--ink)]"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={cn(
                        "w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0",
                        isSessionActive
                          ? "bg-emerald-600 text-white"
                          : "bg-[var(--active)] text-[var(--accent)]"
                      )}
                    >
                      #{idx + 1}
                    </span>
                    <div className="truncate font-semibold">
                      <span>{inStr}</span>
                      <span className="mx-1 text-[var(--muted)]">→</span>
                      <span className={isSessionActive ? "text-emerald-700 font-bold" : ""}>
                        {outStr}
                      </span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-[11px] font-medium shrink-0 ml-2",
                      isSessionActive ? "text-emerald-700 font-bold" : "text-[var(--muted)]"
                    )}
                  >
                    {isSessionActive ? `${formatDuration(durationSec)} (On Duty)` : formatDuration(durationSec)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

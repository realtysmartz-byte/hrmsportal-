"use client";

import { useEffect, useState } from "react";
import { MapPin, Loader2, AlertCircle, CalendarClock, ArrowDownLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  geolocationErrorMessage,
  getPunchPosition,
} from "@/lib/geolocation";
import { subscribeToLocationReminders } from "@/lib/push";
import {
  startNativeDutyTracking,
  stopNativeDutyTracking,
} from "@/lib/native-duty-tracking";
import { toast } from "@/lib/toast";
import { TRPCClientError } from "@trpc/client";
import {
  formatTimeIST,
  TIMEZONE_IST,
  getISTDateParts,
  haversineDistanceM,
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

  const isOnDuty = Boolean(today?.checkInTime && !today?.checkOutTime);
  const hasCompletedSession = Boolean(today?.checkInTime && today?.checkOutTime);
  const pastShiftEnd = getISTDateParts(new Date()).hour >= 19;

  // Live elapsed clock ONLY while on duty — no timer on page load
  useEffect(() => {
    if (!isOnDuty) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [isOnDuty]);

  const onSuccess = async () => {
    setError("");
    await Promise.all([
      utils.attendance.today.refetch(),
      utils.attendance.myMonth.invalidate(),
      utils.attendance.myRecentWeek.invalidate(),
    ]);
  };
  const checkIn = trpc.attendance.checkIn.useMutation({ onSuccess });
  const checkOut = trpc.attendance.checkOut.useMutation({ onSuccess });

  async function punch(mode: "in" | "out") {
    if (busy) return;
    if (mode === "in") void subscribeToLocationReminders(savePush.mutateAsync).catch(() => {});
    setError("");
    setBusy(true);
    try {
      const pos = await getPunchPosition();
      const { latitude: lat, longitude: lng } = pos.coords;

      const sites = workLoc?.sites?.length
        ? workLoc.sites
        : workLoc
          ? [workLoc]
          : [];
      const matchedSite = sites.find(
        (s) => haversineDistanceM(lat, lng, s.lat, s.lng) <= s.radiusM
      );

      if (mode === "in" && sites.length > 0 && !matchedSite) {
        const nearest = sites
          .map((s) => ({ s, d: haversineDistanceM(lat, lng, s.lat, s.lng) }))
          .sort((a, b) => a.d - b.d)[0];
        const names = sites.map((s) => s.name).join(" or ");
        const message = `You are ${Math.round(nearest.d)} m away from ${nearest.s.name}. Move within ${nearest.s.radiusM} m of ${names} to punch in.`;
        setError(message);
        toast("error", message);
        return;
      }

      // Skip reverse-geocode on punch — keeps clock-in/out under ~5s
      const address = matchedSite?.name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

      if (mode === "in") {
        await checkIn.mutateAsync({ lat, lng, address });
        void startNativeDutyTracking();
      } else {
        await checkOut.mutateAsync({ lat, lng, address });
        void stopNativeDutyTracking();
      }
    } catch (err: unknown) {
      if ((err as { code?: number })?.code === 1) {
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
    }
  }

  void tick; // drive re-render while on duty
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
      : workLoc?.name ?? (isLoading ? "…" : "Company office");

  return (
    <div className="w-full rounded-xl bg-[#F3F0FC] p-4">
      <p className="text-xs text-neutral-600">10:00 AM - 07:00 PM • GENERAL</p>

      <div className="mt-3 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#5D3EBC] text-white">
          <CalendarClock className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-900">
            {now.toLocaleDateString("en-IN", {
              timeZone: TIMEZONE_IST,
              day: "numeric",
              month: "short",
            })}{" "}
            <span className="font-normal text-neutral-500">
              {now.toLocaleDateString("en-IN", {
                timeZone: TIMEZONE_IST,
                weekday: "short",
              })}
            </span>
          </p>
          <p className="text-sm text-neutral-700">{hours} worked</p>
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isOnDuty && pastShiftEnd ? (
        <div className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 text-sm font-semibold text-amber-900">
          <Loader2 className="h-4 w-4 animate-spin" />
          Shift ended 7:00 PM — auto clock-out…
        </div>
      ) : (
        <button
          type="button"
          disabled={busy || isLoading}
          onClick={() => punch(isOnDuty ? "out" : "in")}
          className={cn(
            "mt-4 flex h-12 w-full overflow-hidden rounded-lg border text-left disabled:opacity-70",
            isOnDuty ? "border-rose-500" : "border-[#5D3EBC]"
          )}
        >
          <span
            className={cn(
              "flex flex-1 items-center justify-center gap-2 text-sm font-semibold text-white",
              isOnDuty ? "bg-rose-500" : "bg-[#5D3EBC]"
            )}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy
              ? "Getting location…"
              : isOnDuty
                ? "Clock Out"
                : hasCompletedSession
                  ? "Clock In Again"
                  : "Clock In"}
          </span>
          <span className="flex w-[42%] flex-col items-center justify-center bg-white">
            <span className="tabular-nums text-base font-semibold text-neutral-900">
              {isOnDuty
                ? formatClock(elapsed)
                : now.toLocaleTimeString("en-IN", {
                    timeZone: TIMEZONE_IST,
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  })}
            </span>
            {today?.checkInTime && (
              <span className="flex items-center gap-0.5 text-[11px] text-neutral-500">
                <ArrowDownLeft className="h-3 w-3 text-emerald-600" />
                {formatTimeIST(today.checkInTime)}
                {hasCompletedSession &&
                  today.checkOutTime &&
                  ` - ${formatTimeIST(today.checkOutTime)}`}
              </span>
            )}
          </span>
        </button>
      )}

      <div className="mt-3 flex items-center gap-1.5 text-xs text-neutral-500">
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{locationLabel}</span>
      </div>

    </div>
  );
}

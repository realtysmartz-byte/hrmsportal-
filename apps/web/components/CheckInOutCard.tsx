"use client";

import { useEffect, useState } from "react";
import { MapPin, Loader2, AlertCircle, CalendarClock, ArrowDownLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  geolocationErrorMessage,
  getCurrentPosition,
  reverseGeocodePlace,
} from "@/lib/geolocation";
import { subscribeToLocationReminders } from "@/lib/push";
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
  const { data: today, isLoading } = trpc.attendance.today.useQuery();
  const { data: workLoc } = trpc.attendance.myWorkLocation.useQuery();
  const reportLocationDisabled = trpc.attendance.reportLocationDisabled.useMutation();
  const savePush = trpc.attendance.savePushSubscription.useMutation();

  const [now, setNow] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isOnDuty = Boolean(today?.checkInTime && !today?.checkOutTime);
  const hasCompletedSession = Boolean(today?.checkInTime && today?.checkOutTime);

  useEffect(() => {
    let lastRefresh = 0;
    const tick = () => {
      const d = new Date();
      setNow(d);
      // Server auto punches out at 7:00 PM IST; refresh (at most once a minute) so the card reflects it
      if (isOnDuty && getISTDateParts(d).hour >= 19 && d.getTime() - lastRefresh > 60_000) {
        lastRefresh = d.getTime();
        void utils.attendance.today.invalidate();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isOnDuty, utils]);

  const onSuccess = async () => {
    setError("");
    await Promise.all([
      utils.attendance.today.invalidate(),
      utils.attendance.myMonth.invalidate(),
      utils.attendance.myRecentWeek.invalidate(),
    ]);
  };
  const checkIn = trpc.attendance.checkIn.useMutation({ onSuccess });
  const checkOut = trpc.attendance.checkOut.useMutation({ onSuccess });

  async function punch(mode: "in" | "out") {
    if (mode === "in") void subscribeToLocationReminders(savePush.mutateAsync).catch(() => {});
    setError("");
    setBusy(true);
    try {
      const pos = await getCurrentPosition();
      const { latitude: lat, longitude: lng } = pos.coords;

      if (mode === "in" && workLoc) {
        const dist = haversineDistanceM(lat, lng, workLoc.lat, workLoc.lng);
        if (dist > workLoc.radiusM) {
          const message = `You are ${Math.round(dist)} m away from ${workLoc.name}. Move within ${workLoc.radiusM} m to punch in.`;
          setError(message);
          toast("error", message);
          return;
        }
      }

      const needsAddress =
        mode === "out" &&
        (!workLoc || haversineDistanceM(lat, lng, workLoc.lat, workLoc.lng) > workLoc.radiusM);
      let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      if (needsAddress) {
        const place = await reverseGeocodePlace(lat, lng);
        address =
          place.name === place.address ? place.address : `${place.name} — ${place.address}`;
      }

      if (mode === "in") {
        await checkIn.mutateAsync({ lat, lng, address });
      } else {
        await checkOut.mutateAsync({ lat, lng, address });
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

  if (isLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center rounded-lg border border-neutral-200 bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const elapsed =
    isOnDuty && today?.checkInTime && now
      ? Math.max(0, Math.floor((now.getTime() - new Date(today.checkInTime).getTime()) / 1000))
      : 0;

  const hours =
    today?.totalHours != null && today.totalHours > 0
      ? `${today.totalHours}h`
      : isOnDuty
      ? formatDuration(elapsed)
      : "0h 00m";

  return (
    <div className="w-full rounded-xl bg-[#F3F0FC] p-4">
      <p className="text-xs text-neutral-600">10:00 AM - 07:00 PM • GENERAL</p>

      <div className="mt-3 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#5D3EBC] text-white">
          <CalendarClock className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-900">
            {now?.toLocaleDateString("en-IN", { timeZone: TIMEZONE_IST, day: "numeric", month: "short" })}{" "}
            <span className="font-normal text-neutral-500">
              {now?.toLocaleDateString("en-IN", { timeZone: TIMEZONE_IST, weekday: "short" })}
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

      <button
        type="button"
        disabled={busy}
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
          {busy ? "Getting location…" : isOnDuty ? "Clock Out" : "Clock In"}
        </span>
        <span className="flex w-[42%] flex-col items-center justify-center bg-white">
          <span className="tabular-nums text-base font-semibold text-neutral-900">
            {isOnDuty
              ? formatClock(elapsed)
              : now?.toLocaleTimeString("en-IN", {
                  timeZone: TIMEZONE_IST,
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                }) ?? "--:--"}
          </span>
          {today?.checkInTime && (
            <span className="flex items-center gap-0.5 text-[11px] text-neutral-500">
              <ArrowDownLeft className="h-3 w-3 text-emerald-600" />
              {formatTimeIST(today.checkInTime)}
              {hasCompletedSession && today.checkOutTime && ` - ${formatTimeIST(today.checkOutTime)}`}
            </span>
          )}
        </span>
      </button>

      <div className="mt-3 flex items-center gap-1.5 text-xs text-neutral-500">
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{workLoc?.name ?? "Loading work location…"}</span>
      </div>
    </div>
  );
}

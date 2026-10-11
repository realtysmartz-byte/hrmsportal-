"use client";

import { useEffect, useState } from "react";
import { MapPin, LogIn, LogOut, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  geolocationErrorMessage,
  getCurrentPosition,
  reverseGeocodePlace,
} from "@/lib/geolocation";
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

export function CheckInOutCard() {
  const utils = trpc.useUtils();
  const { data: today, isLoading } = trpc.attendance.today.useQuery();
  const { data: workLoc } = trpc.attendance.myWorkLocation.useQuery();
  const reportLocationDisabled = trpc.attendance.reportLocationDisabled.useMutation();

  const [now, setNow] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isOnDuty = Boolean(today?.checkInTime && !today?.checkOutTime);
  const hasCompletedSession = Boolean(today?.checkInTime && today?.checkOutTime);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow(d);
      // Server auto punches out at 7:00 PM IST; refresh so the card reflects it
      if (isOnDuty && getISTDateParts(d).hour >= 19) {
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
    setError("");
    setBusy(true);
    try {
      const pos = await getCurrentPosition();
      const { latitude: lat, longitude: lng } = pos.coords;

      if (mode === "in" && workLoc) {
        const dist = haversineDistanceM(lat, lng, workLoc.lat, workLoc.lng);
        if (dist > workLoc.radiusM) {
          setError(
            `You are ${Math.round(dist)} m away from ${workLoc.name}. Move within ${workLoc.radiusM} m to punch in.`
          );
          return;
        }
      }

      const place = await reverseGeocodePlace(lat, lng);
      const address =
        place.name === place.address ? place.address : `${place.name} — ${place.address}`;

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
      setError(geolocationErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center rounded-2xl border border-neutral-200 bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const elapsed =
    isOnDuty && today?.checkInTime && now
      ? Math.max(0, Math.floor((now.getTime() - new Date(today.checkInTime).getTime()) / 1000))
      : 0;

  const status = isOnDuty
    ? { label: "On duty", className: "bg-emerald-50 text-emerald-700" }
    : hasCompletedSession
    ? { label: "Punched out", className: "bg-neutral-100 text-neutral-600" }
    : { label: "Not punched in", className: "bg-neutral-100 text-neutral-600" };

  const hours =
    today?.totalHours != null && today.totalHours > 0
      ? `${today.totalHours} h`
      : isOnDuty
      ? formatDuration(elapsed)
      : "—";

  return (
    <div className="w-full rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-neutral-500">
          {now?.toLocaleDateString("en-IN", {
            timeZone: TIMEZONE_IST,
            weekday: "long",
            day: "numeric",
            month: "short",
          })}
        </span>
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", status.className)}>
          {status.label}
        </span>
      </div>

      <div className="mt-4 text-center">
        <div className="font-mono text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">
          {now?.toLocaleTimeString("en-IN", {
            timeZone: TIMEZONE_IST,
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          }) ?? "--:--"}
        </div>
        <div className="mt-2 inline-flex max-w-full items-center gap-1.5 text-sm text-neutral-500">
          <MapPin className="h-4 w-4 shrink-0 text-neutral-400" />
          <span className="truncate">{workLoc?.name ?? "Loading work location…"}</span>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button
        className={cn(
          "mt-5 h-12 w-full gap-2 rounded-xl text-base font-semibold",
          isOnDuty
            ? "bg-neutral-900 text-white hover:bg-black"
            : "bg-[#FF7A70] text-white hover:bg-[#FF6559]"
        )}
        disabled={busy}
        onClick={() => punch(isOnDuty ? "out" : "in")}
      >
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : isOnDuty ? (
          <LogOut className="h-5 w-5" />
        ) : (
          <LogIn className="h-5 w-5" />
        )}
        {busy ? "Getting location…" : isOnDuty ? "Punch Out" : "Punch In"}
      </Button>

      <div className="mt-5 grid grid-cols-3 divide-x divide-neutral-100 border-t border-neutral-100 pt-4 text-center">
        <div>
          <div className="text-xs text-neutral-400">In</div>
          <div className="mt-0.5 text-sm font-medium text-neutral-800">
            {today?.checkInTime ? formatTimeIST(today.checkInTime) : "—"}
          </div>
        </div>
        <div>
          <div className="text-xs text-neutral-400">Out</div>
          <div className="mt-0.5 text-sm font-medium text-neutral-800">
            {today?.checkOutTime ? formatTimeIST(today.checkOutTime) : "—"}
          </div>
        </div>
        <div>
          <div className="text-xs text-neutral-400">Hours</div>
          <div className="mt-0.5 text-sm font-medium text-neutral-800">{hours}</div>
        </div>
      </div>
    </div>
  );
}

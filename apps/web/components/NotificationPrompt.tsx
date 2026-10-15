"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { LOCATION_REMINDERS_ENABLED, subscribeToLocationReminders } from "@/lib/push";

export function NotificationPrompt() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported" | null>(null);
  const [busy, setBusy] = useState(false);
  const savePush = trpc.attendance.savePushSubscription.useMutation();

  const saveRef = savePush.mutateAsync;
  useEffect(() => {
    const current = "Notification" in window ? Notification.permission : "unsupported";
    setPermission(current);
    if (current === "granted") void subscribeToLocationReminders(saveRef, false).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (
    !LOCATION_REMINDERS_ENABLED ||
    permission === null ||
    permission === "granted" ||
    permission === "unsupported"
  ) {
    return null;
  }

  async function enable() {
    setBusy(true);
    try {
      await subscribeToLocationReminders(savePush.mutateAsync, true);
    } finally {
      setPermission(Notification.permission);
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <BellRing className="h-5 w-5 shrink-0 text-amber-600" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-neutral-900">Turn on notifications</p>
        <p className="text-xs text-neutral-600">
          {permission === "denied"
            ? "Notifications are blocked. Allow them for this app in your phone settings (App info → Notifications)."
            : "Needed for location update reminders while you are punched in."}
        </p>
      </div>
      {permission === "default" && (
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          className="shrink-0 rounded-lg bg-[#5D3EBC] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          {busy ? "…" : "Enable"}
        </button>
      )}
    </div>
  );
}

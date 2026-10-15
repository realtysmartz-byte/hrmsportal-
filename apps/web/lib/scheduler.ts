import { prisma } from "@realty-smartz/db";
import { ensureAutoPunchOut } from "@realty-smartz/api";
import { sendLocationReminders } from "./location-reminder";
import { LOCATION_REMINDERS_ENABLED } from "./push";

const AUTO_PUNCH_OUT_EVERY_MS = 60 * 1000;
const LOCATION_REMINDER_EVERY_MS = 30 * 60 * 1000;

let started = false;

/** In-process jobs for long-running servers (Hostinger); Vercel uses vercel.json crons instead. */
export function startScheduler() {
  if (started || process.env.VERCEL) return;
  started = true;

  setInterval(() => {
    void ensureAutoPunchOut(prisma);
  }, AUTO_PUNCH_OUT_EVERY_MS);

  if (LOCATION_REMINDERS_ENABLED) {
    setInterval(() => {
      sendLocationReminders(prisma).catch((err) =>
        console.error("[scheduler] location reminder failed:", err)
      );
    }, LOCATION_REMINDER_EVERY_MS);
  }

  console.log(
    `[scheduler] auto punch-out (every 1 min) started; location reminders ${LOCATION_REMINDERS_ENABLED ? "on (every 30 min)" : "off"}`
  );
}

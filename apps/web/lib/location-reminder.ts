import webpush from "web-push";
import type { PrismaClient } from "@realty-smartz/db";
import {
  AUTO_PUNCH_OUT_HOUR_IST,
  getISTDateParts,
  startOfDayUTC,
} from "@realty-smartz/shared";
import { LOCATION_REMINDERS_ENABLED } from "./push";

/**
 * Every run (30 min) asks punched-in employees to update their location.
 * Tapping the notification records the location without opening the app.
 */
export async function sendLocationReminders(prisma: PrismaClient) {
  if (!LOCATION_REMINDERS_ENABLED) return { onDuty: 0, sent: 0, removed: 0 };

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    return { error: "VAPID keys are not configured" as const };
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const now = new Date();
  if (getISTDateParts(now).hour >= AUTO_PUNCH_OUT_HOUR_IST) {
    return { onDuty: 0, sent: 0, removed: 0 };
  }

  const onDuty = await prisma.attendanceLog.findMany({
    where: {
      date: startOfDayUTC(now),
      checkInTime: { not: null },
      checkOutTime: null,
    },
    select: { employeeId: true },
  });
  if (onDuty.length === 0) return { onDuty: 0, sent: 0, removed: 0 };

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { employeeId: { in: onDuty.map((l) => l.employeeId) } },
  });

  const payload = JSON.stringify({
    title: "Update your location",
    body: "You are punched in. Tap to update your location.",
    url: "/employee-portal/dashboard",
    type: "location-ping",
  });

  let sent = 0;
  let removed = 0;
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 5 * 60 }
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          removed++;
        } else {
          console.error("[location-reminder] push failed:", status, err);
        }
      }
    })
  );

  return { onDuty: onDuty.length, sent, removed };
}

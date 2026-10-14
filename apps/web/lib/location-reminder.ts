import webpush from "web-push";
import type { PrismaClient } from "@realty-smartz/db";
import { startOfDayUTC } from "@realty-smartz/shared";

const STALE_AFTER_MS = 25 * 60 * 1000;

/**
 * Reminds punched-in employees whose last location is older than 25 minutes
 * to open the app so a fresh GPS fix is recorded.
 */
export async function sendLocationReminders(prisma: PrismaClient) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    return { error: "VAPID keys are not configured" as const };
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const now = new Date();
  const onDuty = await prisma.attendanceLog.findMany({
    where: {
      date: startOfDayUTC(now),
      checkInTime: { not: null },
      checkOutTime: null,
    },
    select: { employeeId: true },
  });

  let sent = 0;
  let removed = 0;
  for (const { employeeId } of onDuty) {
    const lastPing = await prisma.locationPing.findFirst({
      where: { employeeId },
      orderBy: { capturedAt: "desc" },
      select: { capturedAt: true },
    });
    if (lastPing && now.getTime() - lastPing.capturedAt.getTime() < STALE_AFTER_MS) continue;

    const subscriptions = await prisma.pushSubscription.findMany({ where: { employeeId } });
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: "Update your location",
            body: "You are punched in. Tap to share your current location.",
            url: "/employee-portal/dashboard",
          }),
          { TTL: 20 * 60 }
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
          removed++;
        } else {
          console.error("[location-reminder] push failed:", status, err);
        }
      }
    }
  }

  return { onDuty: onDuty.length, sent, removed };
}

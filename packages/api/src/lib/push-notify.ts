import webpush from "web-push";
import type { PrismaClient } from "@realty-smartz/db";

interface SendPushOptions {
  prisma: PrismaClient;
  employeeId: string | string[];
  title: string;
  body: string;
  url?: string;
  type?: string;
}

export async function sendEmployeePushNotification({
  prisma,
  employeeId,
  title,
  body,
  url = "/employee-portal/dashboard",
  type = "leave",
}: SendPushOptions): Promise<{ sent: number; failed: number }> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:hr@realtysmartz.in";

  if (!publicKey || !privateKey) {
    console.log("[Push Notification] Skipped: VAPID keys not configured in environment.");
    return { sent: 0, failed: 0 };
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  } catch (err) {
    console.error("[Push Notification] Failed to set VAPID details:", err);
    return { sent: 0, failed: 0 };
  }

  const employeeIds = Array.isArray(employeeId) ? employeeId : [employeeId];
  if (employeeIds.length === 0) return { sent: 0, failed: 0 };

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { employeeId: { in: employeeIds } },
  });

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const payload = JSON.stringify({
    title,
    body,
    url,
    type,
    timestamp: Date.now(),
  });

  let sent = 0;
  let failed = 0;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
          { TTL: 60 * 60 * 24 } // 24 hours
        );
        sent++;
      } catch (err: any) {
        failed++;
        // If expired or gone (404/410), clean up stale subscription
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          try {
            await prisma.pushSubscription.delete({ where: { id: sub.id } });
          } catch {
            // ignore cleanup failure
          }
        }
      }
    })
  );

  return { sent, failed };
}

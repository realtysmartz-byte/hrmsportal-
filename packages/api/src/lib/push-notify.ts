import webpush from "web-push";
import type { PrismaClient } from "@realty-smartz/db";
import { getRedisClient } from "./redis";

const recentPushDedupeCache = new Map<string, number>();

/**
 * Claims a once-only notification lock using Redis (7d TTL) with in-memory fallback.
 * Returns true if this is the first time `dedupeKey` is seen, false otherwise.
 */
export async function acquirePushDedupeLock(dedupeKey: string): Promise<boolean> {
  const now = Date.now();
  // Prune expired local entries
  for (const [k, exp] of recentPushDedupeCache.entries()) {
    if (exp <= now) recentPushDedupeCache.delete(k);
  }
  const existing = recentPushDedupeCache.get(dedupeKey);
  if (existing && existing > now) {
    return false;
  }

  const redis = getRedisClient();
  if (redis) {
    try {
      const acquired = await redis.set(`push:once:${dedupeKey}`, "1", {
        nx: true,
        ex: 60 * 60 * 24 * 7, // 7 days
      });
      if (!acquired) {
        recentPushDedupeCache.set(dedupeKey, now + 60 * 60 * 1000);
        return false;
      }
    } catch {
      // Fall back to in-memory lock if Redis is unreachable
    }
  }

  recentPushDedupeCache.set(dedupeKey, now + 60 * 60 * 1000);
  return true;
}

interface SendPushOptions {
  prisma: PrismaClient;
  employeeId: string | string[];
  title: string;
  body: string;
  url?: string;
  type?: string;
  tag?: string;
  dedupeKey?: string;
}

export async function sendEmployeePushNotification({
  prisma,
  employeeId,
  title,
  body,
  url = "/employee-portal/dashboard",
  type = "leave",
  tag,
  dedupeKey,
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

  if (dedupeKey) {
    const allowed = await acquirePushDedupeLock(`${dedupeKey}:${employeeIds.slice().sort().join(",")}`);
    if (!allowed) {
      return { sent: 0, failed: 0 };
    }
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { employeeId: { in: employeeIds } },
  });

  // Deduplicate by endpoint to avoid sending multiple identical notifications to the same client
  const uniqueSubs = Array.from(
    new Map(subscriptions.map((s) => [s.endpoint, s])).values()
  );

  if (uniqueSubs.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const resolvedTag = tag || dedupeKey || (type ? `hrms-${type}` : "hrms-notification");
  const payload = JSON.stringify({
    title,
    body,
    url,
    type,
    tag: resolvedTag,
    timestamp: Date.now(),
  });

  let sent = 0;
  let failed = 0;

  await Promise.all(
    uniqueSubs.map(async (sub) => {
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

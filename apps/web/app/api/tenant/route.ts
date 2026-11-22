import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@realty-smartz/db";
import { getTenantFromHost, invalidateTenantCache } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// Device/IP In-Memory Lockout Store (5 failed attempts => 5 minutes lockout)
type LockoutRecord = {
  failedAttempts: number;
  lockedUntil: number; // timestamp in ms
};

const companyCodeLockTable = new Map<string, LockoutRecord>();

// Periodic cleanup of expired entries (every 60s)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of companyCodeLockTable.entries()) {
      if (now > record.lockedUntil && record.lockedUntil > 0) {
        companyCodeLockTable.delete(key);
      }
    }
  }, 60_000).unref?.();
}

function getClientIdentifier(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : req.headers.get("x-real-ip") || "127.0.0.1";
  const deviceId = req.headers.get("x-device-id") || req.nextUrl.searchParams.get("deviceId") || "";
  return deviceId ? `${ip}:${deviceId}` : ip;
}

export async function GET(req: NextRequest) {
  try {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const orgParam = req.nextUrl.searchParams.get("org");
    const isFresh = req.nextUrl.searchParams.get("fresh") === "1";

    if (isFresh) {
      invalidateTenantCache(orgParam || undefined);
    }

    // 1. If user is verifying a specific company workspace code
    if (orgParam && orgParam.trim()) {
      const cleanSlug = orgParam.toLowerCase().trim();
      const clientKey = getClientIdentifier(req);
      const now = Date.now();

      // Check if this device/IP is currently locked out
      const lockRecord = companyCodeLockTable.get(clientKey);
      if (lockRecord && lockRecord.lockedUntil > now) {
        const remainingSeconds = Math.ceil((lockRecord.lockedUntil - now) / 1000);
        return NextResponse.json(
          {
            error: `Too many invalid attempts. Your device is temporarily locked for 5 minutes. Please try again in ${Math.ceil(remainingSeconds / 60)} minute(s).`,
            retryAfterSeconds: remainingSeconds,
            locked: true,
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(remainingSeconds),
            },
          }
        );
      }

      // Query database for this company slug
      const org = await prisma.organization.findUnique({
        where: { slug: cleanSlug },
        select: {
          id: true,
          name: true,
          slug: true,
          customDomain: true,
          logoUrl: true,
          brandColor: true,
          supportEmail: true,
          loginHeading: true,
          loginSubheading: true,
          loginBannerUrl: true,
          tagline: true,
          testimonialQuote: true,
          testimonialAuthor: true,
        },
      });

      // If company code is INVALID / NOT FOUND
      if (!org) {
        const currentFailed =
          ((lockRecord && lockRecord.lockedUntil <= now) ? 0 : lockRecord?.failedAttempts || 0) + 1;

        if (currentFailed >= 5) {
          // Lock device for 5 minutes (300,000 ms)
          const lockedUntil = now + 5 * 60 * 1000;
          companyCodeLockTable.set(clientKey, { failedAttempts: currentFailed, lockedUntil });
          return NextResponse.json(
            {
              error: "Too many failed attempts. Your device has been locked for 5 minutes to prevent unauthorized access.",
              retryAfterSeconds: 300,
              locked: true,
            },
            {
              status: 429,
              headers: {
                "Retry-After": "300",
              },
            }
          );
        } else {
          companyCodeLockTable.set(clientKey, { failedAttempts: currentFailed, lockedUntil: 0 });
          const attemptsLeft = 5 - currentFailed;
          return NextResponse.json(
            {
              error: `Company code "${orgParam}" not found. Please verify with HR.`,
              attemptsLeft,
              notFound: true,
            },
            {
              status: 404,
            }
          );
        }
      }

      // If company code is VALID: clear failed attempts and return organization details (HTTP 200)
      companyCodeLockTable.delete(clientKey);

      return NextResponse.json({
        id: org.id,
        name: org.name,
        slug: org.slug,
        customDomain: org.customDomain,
        logoUrl: org.logoUrl,
        brandColor: org.brandColor || "#7c3aed",
        supportEmail: org.supportEmail,
        loginHeading: org.loginHeading,
        loginSubheading: org.loginSubheading,
        loginBannerUrl: org.loginBannerUrl,
        tagline: org.tagline,
        testimonialQuote: org.testimonialQuote,
        testimonialAuthor: org.testimonialAuthor,
      });
    }

    // 2. Fallback: Hostname-based tenant resolution (when no explicit code query is passed)
    const tenant = await getTenantFromHost(host, null);
    return NextResponse.json({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      customDomain: tenant.customDomain,
      logoUrl: tenant.logoUrl,
      brandColor: tenant.brandColor,
      supportEmail: tenant.supportEmail,
      loginHeading: tenant.loginHeading,
      loginSubheading: tenant.loginSubheading,
      loginBannerUrl: tenant.loginBannerUrl,
      tagline: tenant.tagline,
      testimonialQuote: tenant.testimonialQuote,
      testimonialAuthor: tenant.testimonialAuthor,
    });
  } catch (error) {
    console.error("[api/tenant] Failed to resolve tenant:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

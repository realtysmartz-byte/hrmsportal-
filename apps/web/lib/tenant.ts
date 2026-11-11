import { prisma } from "@realty-smartz/db";

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  customDomain: string | null;
  logoUrl: string | null;
  brandColor: string;
  supportEmail: string | null;
  loginHeading: string | null;
  loginSubheading: string | null;
  loginBannerUrl: string | null;
  tagline: string | null;
  testimonialQuote: string | null;
  testimonialAuthor: string | null;
}

const DEFAULT_TENANT: TenantInfo = {
  id: "org_default_realty",
  name: "Realty Smartz",
  slug: "realty",
  customDomain: null,
  logoUrl: null,
  brandColor: "#7c3aed",
  supportEmail: "hr@realtysmartz.in",
  loginHeading: "Welcome back",
  loginSubheading: "Please enter your account details to access your workspace",
  loginBannerUrl: null,
  tagline: "ENTERPRISE HRMS",
  testimonialQuote:
    "Automated attendance, punctuality verification, and instant leave requests are now faster and more transparent than ever.",
  testimonialAuthor: "Realty Smartz Core Team · Gurugram Headquarters",
};

// In-memory cache for fast hostname lookups (1 minute TTL)
const cache = new Map<string, { tenant: TenantInfo; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

const tenantSelect = {
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
};

function formatTenant(org: any): TenantInfo {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    customDomain: org.customDomain,
    logoUrl: org.logoUrl,
    brandColor: org.brandColor || "#7c3aed",
    supportEmail: org.supportEmail,
    loginHeading: org.loginHeading || null,
    loginSubheading: org.loginSubheading || null,
    loginBannerUrl: org.loginBannerUrl || null,
    tagline: org.tagline || null,
    testimonialQuote: org.testimonialQuote || null,
    testimonialAuthor: org.testimonialAuthor || null,
  };
}

/**
 * Resolves the tenant/organization from an incoming request hostname or slug.
 * Supports:
 *  - Explicit slugOverride: `?org=smartz-spaces`
 *  - Subdomains on localhost: `smartz-spaces.localhost` -> slug "smartz-spaces"
 *  - Subdomains on domain: `smartz-spaces.smartzhrms.com` -> slug "smartz-spaces"
 *  - Custom domains: `hrms.clientcompany.com` -> customDomain match
 *  - Fallback / Plain Localhost: returns default Realty Smartz tenant
 */
export async function getTenantFromHost(
  hostname?: string | null,
  slugOverride?: string | null
): Promise<TenantInfo> {
  // If slugOverride is passed, use it directly
  if (slugOverride && slugOverride.trim()) {
    const cleanSlug = slugOverride.toLowerCase().trim();
    const cached = cache.get(`slug:${cleanSlug}`);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.tenant;
    }

    try {
      const org = await prisma.organization.findUnique({
        where: { slug: cleanSlug },
        select: tenantSelect,
      });

      if (org) {
        const tenant = formatTenant(org);
        cache.set(`slug:${cleanSlug}`, { tenant, expiresAt: Date.now() + CACHE_TTL_MS });
        return tenant;
      }
    } catch (err) {
      console.error("[getTenantFromHost] Error looking up slugOverride:", err);
    }
  }

  if (!hostname) return DEFAULT_TENANT;

  // Clean host (remove port if any)
  const host = hostname.toLowerCase().split(":")[0].trim();

  // Plain Localhost or direct IP addresses without subdomains map to default tenant
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    !host.includes(".")
  ) {
    return DEFAULT_TENANT;
  }

  // Check cache
  const cached = cache.get(host);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.tenant;
  }

  try {
    // 1. Try finding by custom domain first
    let org = await prisma.organization.findUnique({
      where: { customDomain: host },
      select: tenantSelect,
    });

    // 2. If not found by customDomain, extract subdomain (e.g. "smartz-spaces.localhost" or "smartz-spaces.domain.com")
    if (!org) {
      const parts = host.split(".");
      if (parts.length >= 3 || (parts.length === 2 && parts[1] === "localhost")) {
        const potentialSlug = parts[0];
        if (potentialSlug !== "www" && potentialSlug !== "app") {
          org = await prisma.organization.findUnique({
            where: { slug: potentialSlug },
            select: tenantSelect,
          });
        }
      }
    }

    const tenant = org ? formatTenant(org) : DEFAULT_TENANT;
    cache.set(host, { tenant, expiresAt: Date.now() + CACHE_TTL_MS });
    return tenant;
  } catch (err) {
    console.error("[getTenantFromHost] Error looking up tenant:", err);
    return DEFAULT_TENANT;
  }
}

/**
 * Clears cached tenant lookups so updates apply immediately.
 */
export function invalidateTenantCache(key?: string) {
  if (key) {
    const k = key.toLowerCase().trim();
    cache.delete(k);
    cache.delete(`slug:${k}`);
  } else {
    cache.clear();
  }
}

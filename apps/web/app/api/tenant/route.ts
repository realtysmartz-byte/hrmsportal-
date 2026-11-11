import { NextRequest, NextResponse } from "next/server";
import { getTenantFromHost, invalidateTenantCache } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const orgParam = req.nextUrl.searchParams.get("org");
    const isFresh = req.nextUrl.searchParams.get("fresh") === "1";

    if (isFresh) {
      invalidateTenantCache(orgParam || undefined);
    }

    const tenant = await getTenantFromHost(host, orgParam);
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
    return NextResponse.json({
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
    });
  }
}

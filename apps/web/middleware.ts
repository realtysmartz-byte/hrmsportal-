import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

function isLocalHost(hostname: string) {
  const h = hostname.toLowerCase();
  return ["localhost", "127.0.0.1", "::1"].includes(h) || h.endsWith(".localhost");
}

// In-Memory Sliding Window Rate Limiting Table
type RateBucket = { count: number; resetAt: number };
const rateLimitTable = new Map<string, RateBucket>();

// Periodic cleanup of expired rate limit buckets (every 60s)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of rateLimitTable.entries()) {
      if (now > bucket.resetAt) {
        rateLimitTable.delete(key);
      }
    }
  }, 60_000).unref?.();
}

function checkRateLimit(ip: string, limit: number, windowMs = 60_000): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const bucket = rateLimitTable.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateLimitTable.set(ip, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (bucket.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count++;
  return { ok: true, retryAfter: 0 };
}

// Known Malicious Scanner / Bot Signatures
const BAD_BOT_REGEX =
  /(sqlmap|nikto|wpscan|dirbuster|gobuster|masscan|zgrab|acunetix|nessus|metasploit|havij|hydra|nmap|morfeus|semrush|ahrefs|censys|shodan)/i;

// Probed Sensitive Paths
const PROBED_PATHS_REGEX =
  /(\.(env|git|aws|vscode|htaccess|bak|sql|config|ds_store)|(wp-admin|wp-login|xmlrpc\.php|phpmyadmin|cgi-bin|actuator))/i;

// Dangerous SQLi Signatures in Query Parameters
const SQLI_REGEX =
  /((\%27)|('))\s*(\+)?\s*(union|select|insert|update|delete|drop|alter|truncate|exec|information_schema|benchmark|sleep)/i;

// Dangerous XSS Signatures in Query Parameters
const XSS_REGEX =
  /(<script|%3cscript|javascript:|vbscript:|onload=|onerror=|onclick=)/i;

// Path Traversal Signatures
const PATH_TRAVERSAL_REGEX =
  /(\.\.\/|\.\.\\|%2e%2e)/i;

  // Allowed Origin Whitelist Patterns (CORS / Access-Control-Allow-Origin)
  const ALLOWED_ORIGIN_PATTERNS = [
    /^https?:\/\/localhost(:\d+)?$/,
    /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
    /^https?:\/\/.*\.localhost(:\d+)?$/,
    /^https?:\/\/(.*\.)?rshrms\.in$/,
    /^https?:\/\/(.*\.)?realtysmartz\.in$/,
    /^https?:\/\/(.*\.)?smartzhrms\.com$/,
    /^capacitor:\/\/localhost$/,
    /^ionic:\/\/localhost$/,
  ];

  function isOriginAllowed(origin: string | null, host: string | null): boolean {
    if (!origin) return true; // Direct non-browser requests or same-origin standard requests without Origin header
    if (origin === "null") return true; // Sandboxed WebView or local origin

    const cleanHost = host ? host.toLowerCase().split(":")[0] : "";
    try {
      const originUrl = new URL(origin);
      const originHostname = originUrl.hostname.toLowerCase();
      if (cleanHost && originHostname === cleanHost) return true;
    } catch {
      return false;
    }

    return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
  }

  function applySecurityHeaders(
    res: NextResponse,
    origin?: string | null,
    isAllowed = true
  ): NextResponse {
    // Strict Web Security Headers
    res.headers.set("X-Frame-Options", "SAMEORIGIN");
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    res.headers.set("Permissions-Policy", "geolocation=(self), camera=(self), microphone=()");
    res.headers.set("X-XSS-Protection", "1; mode=block");
    res.headers.set("X-DNS-Prefetch-Control", "on");

    // Allow-Origin / CORS Protection
    if (origin && isAllowed) {
      res.headers.set("Access-Control-Allow-Origin", origin);
      res.headers.set("Access-Control-Allow-Credentials", "true");
      res.headers.set(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS, PATCH"
      );
      res.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, x-trpc-source, x-client-version, x-device-id, x-hrms-api-key, x-forwarded-host"
      );
      res.headers.set("Access-Control-Max-Age", "86400");
    }

    return res;
  }

  export async function middleware(req: NextRequest) {
    const path = req.nextUrl.pathname;
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const isAllowed = isOriginAllowed(origin, host);

    // 1. Handle CORS Preflight OPTIONS requests
    if (req.method === "OPTIONS") {
      if (origin && !isAllowed) {
        return new NextResponse(
          JSON.stringify({ error: "Access Denied: Cross-Origin Resource Sharing (CORS) origin not permitted." }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
      const preflightRes = new NextResponse(null, { status: 204 });
      return applySecurityHeaders(preflightRes, origin, isAllowed);
    }

    // 2. Reject unauthorized cross-origin API calls (Origin Protection)
    if (origin && !isAllowed && path.startsWith("/api")) {
      return applySecurityHeaders(
        new NextResponse(
          JSON.stringify({ error: "Access Denied: Cross-Origin request rejected by Realty Smartz origin protection policy." }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        ),
        origin,
        false
      );
    }

    // 3. Skip static assets, health check, and service worker internals
    if (
      path.startsWith("/_next") ||
      path.startsWith("/favicon.ico") ||
      path.startsWith("/sw.js") ||
      path === "/manifest.webmanifest" ||
      path === "/api/health"
    ) {
      return NextResponse.next();
    }

    // 4. Client IP Resolution
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";

    // 5. User-Agent Scanner / Malicious Bot Blocker
    const userAgent = req.headers.get("user-agent") || "";
    if (BAD_BOT_REGEX.test(userAgent)) {
      return applySecurityHeaders(
        new NextResponse(
          JSON.stringify({ error: "Access Denied: Malicious bot or vulnerability scanner blocked by Realty Smartz WAF" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
      ),
        origin,
        isAllowed
    );
    }

    // 6. Probed Path Blocking (e.g. .env, .git, phpmyadmin, wp-login)
    if (PROBED_PATHS_REGEX.test(path)) {
      return applySecurityHeaders(
        new NextResponse(
          JSON.stringify({ error: "Access Denied: Restricted system path" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
      ),
        origin,
        isAllowed
    );
    }

    // 7. Query Parameter SQL Injection, XSS & Path Traversal Guard
    const rawSearch = req.nextUrl.search || "";
    let decodedSearch = rawSearch;
    try {
      decodedSearch = decodeURIComponent(rawSearch).replace(/\+/g, " ");
    } catch {
      // If malformed URI encoding, treat as suspicious
      return applySecurityHeaders(
        new NextResponse(
          JSON.stringify({ error: "Bad Request: Malformed URI encoding detected" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
      ),
        origin,
        isAllowed
    );
    }

    if (rawSearch) {
      if (
        SQLI_REGEX.test(rawSearch) ||
        SQLI_REGEX.test(decodedSearch) ||
        XSS_REGEX.test(rawSearch) ||
        XSS_REGEX.test(decodedSearch) ||
        PATH_TRAVERSAL_REGEX.test(rawSearch) ||
        PATH_TRAVERSAL_REGEX.test(decodedSearch)
      ) {
        return applySecurityHeaders(
          new NextResponse(
            JSON.stringify({ error: "Bad Request: Potential SQLi / XSS injection detected and blocked" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        ),
          origin,
          isAllowed
      );
      }
    }

    // 8. Request Body Size Protection (Anti-DoS)
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > 10 * 1024 * 1024) {
      return applySecurityHeaders(
        new NextResponse(
          JSON.stringify({ error: "Payload Too Large: Maximum allowed request size is 10MB" }),
          { status: 413, headers: { "Content-Type": "application/json" } }
      ),
        origin,
        isAllowed
    );
    }

    // 9. Sliding-Window Rate Limiter
    const isAuthRoute = path.startsWith("/api/auth") || path === "/login";
    const isIntegrationRoute = path.startsWith("/api/integrations");
    const isSensitiveRoute = isAuthRoute || isIntegrationRoute;

    // 30 requests/min for sensitive auth/integration routes, 150 requests/min for general app
    const rateLimit = isSensitiveRoute ? 30 : 150;
    const rateLimitKey = `${clientIp}:${isSensitiveRoute ? "sensitive" : "general"}`;
    const rateResult = checkRateLimit(rateLimitKey, rateLimit);

    if (!rateResult.ok) {
      return applySecurityHeaders(
        new NextResponse(
          JSON.stringify({
            error: "Too Many Requests: Rate limit exceeded to prevent system overload. Please try again shortly.",
            retryAfterSeconds: rateResult.retryAfter,
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": String(rateResult.retryAfter),
            },
          }
      ),
        origin,
        isAllowed
    );
    }

    // 10. Enforce HTTPS in Production
    const forwardedProtos = req.headers.get("x-forwarded-proto")?.split(",");
    const forwardedProto = forwardedProtos?.[forwardedProtos.length - 1]
      ?.trim()
      .toLowerCase();
    const protocol = forwardedProto || req.nextUrl.protocol.replace(":", "");
    if (
      process.env.NODE_ENV === "production" &&
      !isLocalHost(req.nextUrl.hostname) &&
      protocol !== "https"
    ) {
      const secureUrl = req.nextUrl.clone();
      secureUrl.protocol = "https:";
      return NextResponse.redirect(secureUrl, 308);
    }

    // 11. Session & Role Protected Routes
    const isAdminPage = path.startsWith("/admin-portal");
    const isEmployeePage = path.startsWith("/employee-portal");
    if (!isAdminPage && !isEmployeePage) {
      return applySecurityHeaders(NextResponse.next(), origin, isAllowed);
    }

    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token || token.error || !token.id) {
      const signInUrl = new URL("/login", req.url);
      if (token?.error === "SessionExpired") {
        signInUrl.searchParams.set("error", "SessionExpired");
      } else if (token?.error === "AccountInactive") {
        signInUrl.searchParams.set("error", "AccountInactive");
      } else {
        signInUrl.searchParams.set("callbackUrl", req.nextUrl.href);
      }
      return NextResponse.redirect(signInUrl);
    }

    const role = token.role as string | undefined;
    if (isAdminPage && role !== "ADMIN" && role !== "HR") {
      return NextResponse.redirect(
        new URL("/employee-portal/dashboard", req.url)
      );
    }

    return applySecurityHeaders(NextResponse.next(), origin, isAllowed);
  }

  export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
  };

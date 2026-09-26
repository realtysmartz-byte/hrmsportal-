"use client";

import { signIn, getSession, getProviders } from "next-auth/react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Sparkles,
  MapPin,
  Lock,
  Mail,
  Building2,
} from "lucide-react";
import {
  canAccessAdminPortal,
  homePathForRole,
} from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";
import { cn } from "@/lib/utils";

type Portal = "employee" | "admin";

const GOOGLE_ERRORS: Record<string, string> = {
  GoogleNotLinked:
    "No employee account matches this Google email. Ask HR to add you first.",
  GoogleEmployeeOnly:
    "Google sign-in is for employees only. Admin/HR must use email & password.",
  AccountInactive: "This account is inactive. Contact HR.",
  OAuthAccountNotLinked:
    "This Google account could not be linked. Use your company email.",
  AccessDenied: "Google sign-in was denied.",
  Callback: "Sign-in callback failed. Please try again with email and password.",
};

const TESTIMONIALS = [
  {
    quote:
      "Automated attendance, geofence compliance, and instant leave requests are now faster and more transparent than ever.",
    author: "Realty Smartz Core Team",
    role: "Gurugram Headquarters",
  },
  {
    quote:
      "Empowering every team member with self-service profiles, shift tracking, and real-time operations.",
    author: "Operations & HR Division",
    role: "Realty Smartz Private Limited",
  },
];

function LoginForm() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [mounted, setMounted] = useState(false);
  const [portal, setPortal] = useState<Portal>("employee");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [activeTestimonialIdx, setActiveTestimonialIdx] = useState(0);

  // Sync state cleanly after initial hydration to prevent SSR hydration mismatch
  useEffect(() => {
    setMounted(true);
    const portalParam = searchParams.get("portal");
    if (portalParam === "admin") {
      setPortal("admin");
    } else if (portalParam === "employee") {
      setPortal("employee");
    }
  }, [searchParams]);

  // Show Google error once, then clean the URL
  useEffect(() => {
    const code = searchParams.get("error");
    if (code) {
      setError(GOOGLE_ERRORS[code] || `Sign-in error: ${code}`);
      const portalParam = searchParams.get("portal") || "employee";
      router.replace(`${pathname}?portal=${portalParam}`);
    }
  }, [searchParams, pathname, router]);

  useEffect(() => {
    void getProviders().then((p) => {
      setGoogleEnabled(Boolean(p?.google));
    });
  }, []);

  function switchPortal(next: Portal) {
    setPortal(next);
    setError("");
    router.replace(`${pathname}?portal=${next}`);
  }

  async function waitForSession(retries = 8) {
    for (let i = 0; i < retries; i++) {
      const session = await getSession();
      if (session?.user?.id) return session;
      await new Promise((r) => setTimeout(r, 150));
    }
    return getSession();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setLoading(false);
      setError("Please enter your email and password");
      return;
    }

    const callbackParam = searchParams.get("callbackUrl");

    const result = await signIn("credentials", {
      email: cleanEmail,
      password: cleanPassword,
      redirect: false,
      callbackUrl:
        callbackParam && callbackParam.startsWith("/") && !callbackParam.includes("/login")
          ? callbackParam
          : portal === "admin"
          ? "/admin-portal/dashboard"
          : "/employee-portal/dashboard",
    });

    if (result?.error) {
      setLoading(false);
      // NextAuth returns the actual error message from authorize() in result.error
      // For CredentialsSignin, the error is the generic type; real message is in result.error
      if (result.error === "CredentialsSignin") {
        setError("Invalid email or password. Please verify and try again.");
      } else {
        // Surface the real error (e.g. DB connection failure, rate limit, etc.)
        setError(result.error);
      }
      return;
    }

    // Determine target destination
    let destination = "/";
    if (callbackParam && callbackParam.startsWith("/") && !callbackParam.startsWith("//") && !callbackParam.includes("/login")) {
      destination = callbackParam;
    }

    try {
      const session = await waitForSession(3);
      if (session?.user?.role) {
        const role = session.user.role as Role;
        if (destination === "/" || destination.includes("/login")) {
          destination = homePathForRole(role);
        }
      }
    } catch {
      // Destination will fallback to "/" which handles server-side role redirection
    }

    setLoading(false);
    // Top-level document navigation ensures Safari/iOS WebKit flushes session cookies
    // to the HTTP request headers for Next.js middleware and RSC layouts
    window.location.href = destination;
  }

  async function onGoogleSignIn() {
    setError("");
    setGoogleLoading(true);
    await signIn("google", {
      callbackUrl: "/employee-portal/dashboard",
    });
  }

  const currentTestimonial = TESTIMONIALS[activeTestimonialIdx];

  // Active portal display (default to employee on SSR to avoid hydration divergence)
  const activePortal = mounted ? portal : "employee";

  return (
    <div className="relative z-10 w-full max-w-5xl rounded-[32px] sm:rounded-[36px] bg-[#181926]/95 backdrop-blur-2xl border border-white/10 shadow-[0_25px_80px_rgba(0,0,0,0.45)] overflow-hidden grid grid-cols-1 lg:grid-cols-12 text-white">
      {/* LEFT COLUMN: Modern Login Form (~6.5/12 cols) */}
      <div className="p-7 sm:p-10 lg:p-12 lg:col-span-7 flex flex-col justify-between">
        <div>
          {/* Top Brand Logo */}
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Realty Smartz Private Limited"
              width={40}
              height={40}
              className="h-10 w-10 object-contain drop-shadow-md"
            />
            <div>
              <span className="font-display text-sm font-bold tracking-wider uppercase text-white block">
                Realty Smartz
              </span>
              <span className="text-[10px] text-neutral-400 font-medium tracking-wide block -mt-0.5">
                Private Limited · HRMS
              </span>
            </div>
          </div>

          {/* Heading */}
          <div className="mt-8">
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Welcome back
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-neutral-400">
              Please enter your account details to access your workspace
            </p>
          </div>

          {/* Portal Switcher Capsule (Image 3 Style) */}
          <div className="mt-6 flex items-center rounded-full bg-[#11121A] p-1 border border-white/10 max-w-xs shadow-inner">
            <button
              type="button"
              onClick={() => switchPortal("employee")}
              className={`flex-1 rounded-full py-2 text-xs font-semibold transition-all duration-200 ${
                activePortal === "employee"
                  ? "bg-[#252836] text-white shadow-sm font-bold border border-white/10"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Employee
            </button>
            <button
              type="button"
              onClick={() => switchPortal("admin")}
              className={`flex-1 rounded-full py-2 text-xs font-semibold transition-all duration-200 ${
                activePortal === "admin"
                  ? "bg-[#252836] text-white shadow-sm font-bold border border-white/10"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Admin Portal
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mt-5 rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-300 flex items-start gap-2.5 transition-all">
              <div className="h-4 w-4 shrink-0 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold">
                !
              </div>
              <p className="leading-tight">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-xs font-medium text-neutral-300"
              >
                Email
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={
                    activePortal === "admin"
                      ? "admin@realtysmartz.com"
                      : "you@realtysmartz.com"
                  }
                  required
                  className="w-full rounded-2xl border border-white/10 bg-[#11121A] px-4 py-3 text-xs sm:text-sm text-white placeholder-neutral-500 shadow-inner outline-none transition-all focus:border-[#FF7A70] focus:ring-1 focus:ring-[#FF7A70]"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-xs font-medium text-neutral-300"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full rounded-2xl border border-white/10 bg-[#11121A] px-4 py-3 pr-11 text-xs sm:text-sm text-white placeholder-neutral-500 shadow-inner outline-none transition-all focus:border-[#FF7A70] focus:ring-1 focus:ring-[#FF7A70]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white transition-colors"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me & Assistance Row */}
            <div className="flex items-center justify-between pt-1 text-xs text-neutral-400">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-neutral-700 bg-[#11121A] text-[#FF7A70] accent-[#FF7A70] focus:ring-0"
                />
                <span>Keep me logged in</span>
              </label>
              <span className="text-neutral-400 hover:text-white transition-colors cursor-pointer underline text-[11px]">
                Forgot Password?
              </span>
            </div>

            {/* Radiant Coral Gradient Submit Button (Image 3 Style) */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-gradient-to-r from-[#FF7A70] via-[#FF8B7D] to-[#FFA07A] py-3.5 text-xs sm:text-sm font-bold text-white shadow-[0_8px_24px_rgba(255,122,112,0.35)] transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-50"
              >
                {loading ? "Authenticating..." : "Sign in"}
              </button>
            </div>
          </form>

          {/* Social Sign-in (Google OAuth) */}
          {activePortal === "employee" && (
            <div className="mt-6 pt-5 border-t border-white/10 text-center">
              <p className="text-[11px] text-neutral-400 mb-3">
                Or continue with enterprise sign-in
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={googleLoading}
                  onClick={onGoogleSignIn}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-neutral-900 shadow-md hover:scale-105 active:scale-95 transition-transform"
                  title="Sign in with Google"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3h3.88c2.27-2.09 3.66-5.17 3.66-9.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.09C3.26 21.36 7.37 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.32c-.25-.72-.38-1.49-.38-2.32s.13-1.6.38-2.32V6.59H1.26C.46 8.18 0 9.99 0 12s.46 3.82 1.26 5.41l4.02-3.09z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.26 2.64 1.26 6.59l4.02 3.09c.95-2.83 3.6-4.93 6.72-4.93z"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Note */}
        <div className="mt-8 text-center lg:text-left text-[11px] text-neutral-500">
          Realty Smartz Private Limited · Corporate Attendance & HRMS
        </div>
      </div>

      {/* RIGHT COLUMN: Signature Feature Banner & Floating Notch Card (Image 3 Style) */}
      <div className="hidden lg:flex lg:col-span-5 bg-[#0C0D14] rounded-[28px] m-3 p-8 relative flex-col justify-between overflow-hidden border border-white/5">
        {/* Subtle Watermark Logo inside Right Card */}
        <div className="absolute -top-10 -right-10 pointer-events-none opacity-[0.08] select-none">
          <img
            src="/logo.png"
            alt=""
            width={288}
            height={288}
            className="w-72 h-72 object-contain"
          />
        </div>

        {/* Top Section: Quote and Mission */}
        <div className="relative z-10 space-y-5">
          <div className="font-serif text-4xl text-[#FF7A70] leading-none font-bold">
            “
          </div>
          <h2 className="font-display text-2xl font-bold text-white tracking-tight leading-snug">
            What our Team Says.
          </h2>
          <p className="text-xs text-neutral-300 leading-relaxed">
            "{currentTestimonial.quote}"
          </p>

          <div className="pt-2">
            <p className="text-xs font-bold text-white">
              {currentTestimonial.author}
            </p>
            <p className="text-[11px] text-neutral-400">
              {currentTestimonial.role}
            </p>
          </div>

          {/* Carousel Arrows */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() =>
                setActiveTestimonialIdx((prev) =>
                  prev === 0 ? TESTIMONIALS.length - 1 : prev - 1
                )
              }
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF7A70]/90 text-white hover:bg-[#FF7A70] transition-colors"
              title="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                setActiveTestimonialIdx((prev) =>
                  (prev + 1) % TESTIMONIALS.length
                )
              }
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#181C26] text-neutral-400 hover:text-white border border-white/10 transition-colors"
              title="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* BOTTOM FLOATING NOTCH CARD (Signature Element from Image 3) */}
        <div className="relative z-10 mt-8 rounded-2xl bg-white p-5 text-neutral-900 shadow-2xl space-y-2 border border-neutral-100 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#0F5C74]">
              <Sparkles className="h-3 w-3 text-amber-500" />
              Verified Enterprise HRMS
            </span>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>

          <h3 className="font-display text-sm font-bold text-neutral-900 leading-snug">
            Real-time Workforce Presence & Operations
          </h3>

          <p className="text-[11px] text-neutral-600 leading-relaxed">
            Experience precise geofence validation, automated leave quotas, and seamless employee operations.
          </p>

          <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
            <div className="flex -space-x-1.5 overflow-hidden">
              <div className="inline-block h-6 w-6 rounded-full bg-indigo-500 ring-2 ring-white text-[9px] font-bold text-white flex items-center justify-center">
                RS
              </div>
              <div className="inline-block h-6 w-6 rounded-full bg-rose-500 ring-2 ring-white text-[9px] font-bold text-white flex items-center justify-center">
                HQ
              </div>
              <div className="inline-block h-6 w-6 rounded-full bg-amber-500 ring-2 ring-white text-[9px] font-bold text-white flex items-center justify-center">
                HR
              </div>
              <div className="inline-block h-6 w-6 rounded-full bg-neutral-900 ring-2 ring-white text-[9px] font-bold text-white flex items-center justify-center">
                +24
              </div>
            </div>
            <span className="text-[10px] font-semibold text-neutral-700 bg-neutral-100 rounded-full px-2.5 py-0.5">
              Gurugram HQ
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden bg-[#F5F7FB]">
      {/* 1. AMBIENT MESH GRADIENT (Matching Image 3 Warm Sunset Aura) */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Top Left Peach / Coral Glow */}
        <div className="absolute -top-32 -left-32 w-[550px] h-[550px] rounded-full bg-gradient-to-br from-[#FF8B7D]/25 to-[#FFA07A]/15 blur-[120px]" />
        {/* Center Lavender / Violet Glow */}
        <div className="absolute top-1/3 right-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-[#0F5C74]/15 via-[#8A2BE2]/10 to-transparent blur-[140px]" />
        {/* Bottom Rose Ambient Glow */}
        <div className="absolute -bottom-32 -right-32 w-[650px] h-[650px] rounded-full bg-gradient-to-tl from-[#FF7A70]/20 to-[#FFA07A]/10 blur-[130px]" />
        {/* Subtle Grid Texture Overlay */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `radial-gradient(rgba(0, 0, 0, 0.4) 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      {/* 2. WHOLE BACKGROUND COMPANY LOGO WATERMARK (As explicitly requested by user) */}
      <div className="fixed inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0">
        <img
          src="/logo.png"
          alt=""
          width={800}
          height={800}
          className="w-[750px] h-[750px] sm:w-[900px] sm:h-[900px] object-contain opacity-[0.05] select-none filter blur-[0.5px] transform -rotate-12 transition-transform duration-1000"
        />
      </div>

      {/* 3. CENTER FLOATING CARD CONTAINER */}
      <Suspense
        fallback={
          <div className="relative z-10 text-xs font-semibold text-neutral-500 animate-pulse">
            Loading workspace...
          </div>
        }
      >
        <LoginForm />
      </Suspense>

      {/* Footer */}
      <footer
        suppressHydrationWarning
        className="relative z-10 mt-6 text-center text-xs text-neutral-500"
      >
        © 2026 Realty Smartz Private Limited · All rights reserved.
      </footer>
    </div>
  );
}

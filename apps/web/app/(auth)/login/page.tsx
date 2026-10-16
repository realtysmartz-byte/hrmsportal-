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

const GOOGLE_ERRORS: Record<string, string> = {
  GoogleNotLinked:
    "No employee account matches this Google email. Ask HR to add you first.",
  GoogleEmployeeOnly:
    "Google sign-in is for employees only. Admin/HR must use email & password.",
  AccountInactive:
    "Your account is inactive (Terminated / Resigned / Exit). You cannot log in until HR sets status to Active.",
  OAuthAccountNotLinked:
    "This Google account could not be linked. Use your company email.",
  AccessDenied: "Google sign-in was denied.",
  Callback: "Sign-in callback failed. Please try again with email and password.",
};

const TESTIMONIALS = [
  {
    quote:
      "Automated attendance, punctuality verification, and instant leave requests are now faster and more transparent than ever.",
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [activeTestimonialIdx, setActiveTestimonialIdx] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show Google error once, then clean the URL
  useEffect(() => {
    const code = searchParams.get("error");
    if (code) {
      setError(GOOGLE_ERRORS[code] || `Sign-in error: ${code}`);
      router.replace(pathname);
    }
  }, [searchParams, pathname, router]);

  useEffect(() => {
    void getProviders().then((p) => {
      setGoogleEnabled(Boolean(p?.google));
    });
  }, []);

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
          : "/employee-portal/dashboard",
    });

    if (result?.error) {
      setLoading(false);
      if (
        result.error === "AccountInactive" ||
        result.error.includes("AccountInactive")
      ) {
        setError(GOOGLE_ERRORS.AccountInactive);
      } else if (result.error === "CredentialsSignin") {
        setError("Invalid email or password. Please verify and try again.");
      } else {
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

  return (
    <div className="relative z-10 w-full max-w-5xl rounded-[24px] sm:rounded-[36px] bg-[#181926]/95 backdrop-blur-2xl border border-white/10 overflow-hidden grid grid-cols-1 lg:grid-cols-12 text-white">
      {/* LEFT COLUMN: Modern Login Form (~6.5/12 cols) */}
      <div className="p-5 sm:p-10 lg:p-12 lg:col-span-7 flex flex-col justify-between min-h-0">
        <div className="min-w-0">
          {/* Top Brand Logo */}
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Realty Smartz Private Limited"
              width={40}
              height={40}
              className="h-10 w-10 object-contain"
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
          <div className="mt-5 sm:mt-8">
            <h1 className="font-display text-xl sm:text-3xl font-extrabold tracking-tight text-white">
              Welcome back
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-neutral-400">
              Please enter your account details to access your workspace
            </p>
          </div>

          {/* Universal Single Sign-In Capsule */}
          <div className="mt-4 sm:mt-5 inline-flex max-w-full items-center gap-2 rounded-full bg-[#11121A] px-3 py-1.5 border border-white/10">
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] sm:text-xs font-medium text-neutral-300 truncate">
              Universal Sign-In · Employee, Candidate & Admin
            </span>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mt-4 sm:mt-5 rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-300 flex items-start gap-2.5 transition-all">
              <div className="h-4 w-4 shrink-0 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold">
                !
              </div>
              <p className="leading-tight">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={onSubmit} className="mt-5 sm:mt-6 space-y-3.5 sm:space-y-4">
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
                  placeholder="you@realtysmartz.com"
                  required
                  className="w-full rounded-lg border border-white/10 bg-[#11121A] px-4 py-3 text-xs sm:text-sm text-white placeholder-neutral-500 outline-none transition-all focus:border-[#5D3EBC] focus:ring-1 focus:ring-[#5D3EBC]"
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
                  className="w-full rounded-lg border border-white/10 bg-[#11121A] px-4 py-3 pr-11 text-xs sm:text-sm text-white placeholder-neutral-500 outline-none transition-all focus:border-[#5D3EBC] focus:ring-1 focus:ring-[#5D3EBC]"
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
                  className="h-3.5 w-3.5 rounded border-neutral-700 bg-[#11121A] text-[#5D3EBC] accent-[#5D3EBC] focus:ring-0"
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
                className="w-full rounded-full bg-gradient-to-r from-[#5D3EBC] via-[#FF8B7D] to-[#7B5CD6] py-3.5 text-xs sm:text-sm font-bold text-white transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-50"
              >
                {loading ? "Authenticating..." : "Sign in"}
              </button>
            </div>
          </form>

          {/* Social Sign-in (Google OAuth) */}
          <div className="mt-6 pt-5 border-t border-white/10 text-center">
            <p className="text-[11px] text-neutral-400 mb-3">
              Or continue with enterprise sign-in
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={googleLoading}
                onClick={onGoogleSignIn}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-neutral-900 hover:scale-105 active:scale-95 transition-transform"
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
        </div>

        {/* Footer Note */}
        <div className="mt-6 sm:mt-8 pb-1 text-center lg:text-left text-[11px] text-neutral-500">
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
          <div className="font-serif text-4xl text-[#5D3EBC] leading-none font-bold">
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
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#5D3EBC]/90 text-white hover:bg-[#5D3EBC] transition-colors"
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
        <div className="relative z-10 mt-8 rounded-lg bg-white p-5 text-neutral-900 space-y-2 border border-neutral-100 transition-all duration-300">
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
            Experience automated attendance verification, leave quotas, and seamless employee operations.
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
    <div
      className="relative min-h-dvh w-full flex flex-col items-center justify-start sm:justify-center overflow-x-hidden overflow-y-auto bg-[#0c0d14]"
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
      }}
    >
      {/* 1. BACKGROUND VIDEO ANIMATION */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="h-full w-full object-cover object-center"
        >
          <source src="/icons/loginbackgroundanimations.mp4" type="video/mp4" />
        </video>
        {/* Dark Vignette & Backdrop Filter Overlay for Contrast */}
        <div className="absolute inset-0 bg-[#0C0D14]/50 backdrop-blur-[2px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0C0D14] via-transparent to-[#0C0D14]/70" />
      </div>

      {/* 2. CENTER FLOATING CARD — scrolls on short / APK screens */}
      <div className="relative z-10 w-full max-w-5xl flex flex-col items-center py-2 sm:py-4">
        <Suspense
          fallback={
            <div className="text-xs font-semibold text-neutral-400 animate-pulse">
              Loading workspace...
            </div>
          }
        >
          <LoginForm />
        </Suspense>

        <footer
          suppressHydrationWarning
          className="mt-4 sm:mt-6 mb-2 text-center text-[11px] sm:text-xs text-neutral-400 font-medium px-2"
        >
          © 2026 Realty Smartz Private Limited · All rights reserved.
        </footer>
      </div>
    </div>
  );
}

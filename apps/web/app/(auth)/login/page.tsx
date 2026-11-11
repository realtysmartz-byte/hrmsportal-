"use client";

import { userFacingErrorMessage } from "@/lib/user-facing-error";
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
  Briefcase,
  Info,
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
  "Your account is inactive (Terminated / Resigned / Absconding). You cannot log in until HR sets status to Active.",
  SessionExpired:
    "Your password was changed or your session expired. Please sign in with your new password.",
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
  const [tenant, setTenant] = useState<{
    name: string;
    slug: string;
    logoUrl: string | null;
    brandColor: string;
    loginHeading: string | null;
    loginSubheading: string | null;
    loginBannerUrl: string | null;
    tagline: string | null;
    testimonialQuote: string | null;
    testimonialAuthor: string | null;
  }>({
    name: "Realty Smartz",
    slug: "realty",
    logoUrl: null,
    brandColor: "#7c3aed",
    loginHeading: null,
    loginSubheading: null,
    loginBannerUrl: null,
    tagline: null,
    testimonialQuote: null,
    testimonialAuthor: null,
  });

  const [workspaceStep, setWorkspaceStep] = useState<"loading" | "enter_code" | "login">("loading");
  const [workspaceCodeInput, setWorkspaceCodeInput] = useState("");
  const [workspaceCodeError, setWorkspaceCodeError] = useState("");
  const [verifyingCode, setVerifyingCode] = useState(false);

  useEffect(() => {
    let org = searchParams?.get("org");
    if (!org && typeof window !== "undefined") {
      org = localStorage.getItem("rs_tenant_slug");
    }

    if (org && org.trim()) {
      fetch(`/api/tenant?org=${encodeURIComponent(org.trim())}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.name) {
            setTenant({
              name: data.name,
              slug: data.slug || org,
              logoUrl: data.logoUrl || null,
              brandColor: data.brandColor || "#7c3aed",
              loginHeading: data.loginHeading || null,
              loginSubheading: data.loginSubheading || null,
              loginBannerUrl: data.loginBannerUrl || null,
              tagline: data.tagline || null,
              testimonialQuote: data.testimonialQuote || null,
              testimonialAuthor: data.testimonialAuthor || null,
            });
            if (typeof window !== "undefined") {
              localStorage.setItem("rs_tenant_slug", data.slug);
            }
            setWorkspaceStep("login");
          } else {
            setWorkspaceStep("enter_code");
          }
        })
        .catch(() => {
          setWorkspaceStep("enter_code");
        });
    } else {
      // First time opening APK / Web without any company code set
      setWorkspaceStep("enter_code");
    }
  }, [searchParams]);

  async function handleVerifyCode(codeToVerify?: string) {
    const raw = (codeToVerify ?? workspaceCodeInput).trim().toLowerCase();
    if (!raw) {
      setWorkspaceCodeError("Please enter your company workspace code.");
      return;
    }
    setVerifyingCode(true);
    setWorkspaceCodeError("");

    try {
      const res = await fetch(`/api/tenant?org=${encodeURIComponent(raw)}`);
      const data = await res.json();
      if (!res.ok || !data || (data.slug !== raw && raw !== "realty")) {
        setWorkspaceCodeError(`Company code "${raw}" not found. Please verify with HR.`);
        setVerifyingCode(false);
        return;
      }

      setTenant({
        name: data.name,
        slug: data.slug || raw,
        logoUrl: data.logoUrl || null,
        brandColor: data.brandColor || "#7c3aed",
        loginHeading: data.loginHeading || null,
        loginSubheading: data.loginSubheading || null,
        loginBannerUrl: data.loginBannerUrl || null,
        tagline: data.tagline || null,
        testimonialQuote: data.testimonialQuote || null,
        testimonialAuthor: data.testimonialAuthor || null,
      });

      if (typeof window !== "undefined") {
        localStorage.setItem("rs_tenant_slug", data.slug || raw);
      }
      setWorkspaceStep("login");
    } catch (err) {
      setWorkspaceCodeError("Connection error while finding company. Please try again.");
    } finally {
      setVerifyingCode(false);
    }
  }

  function handleChangeWorkspace() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("rs_tenant_slug");
    }
    setWorkspaceCodeInput("");
    setWorkspaceCodeError("");
    setWorkspaceStep("enter_code");
  }
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
      setError(GOOGLE_ERRORS[code] || "Could not sign in. Please try again.");
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
    if (loading) return;
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

    try {
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
        } else if (
          result.error === "CredentialsSignin" ||
          result.error.toLowerCase().includes("credentials")
        ) {
          setError("Invalid email or password. Please verify and try again.");
        } else if (
          result.error.includes("Too many failed") ||
          result.error.includes("Locked out")
        ) {
          setError(result.error);
        } else {
          setError(userFacingErrorMessage(result.error, "Invalid email or password. Please verify and try again."));
        }
        return;
      }

      let destination = "/employee-portal/dashboard";
      if (
        callbackParam &&
        callbackParam.startsWith("/") &&
        !callbackParam.startsWith("//") &&
        !callbackParam.includes("/login")
      ) {
        destination = callbackParam;
      }

      try {
        const session = await waitForSession(2);
        if (session?.user?.role) {
          const role = session.user.role as Role;
          if (destination === "/" || destination.includes("/login")) {
            destination = homePathForRole(role);
          }
        }
      } catch (sessionErr) {
        console.warn("[auth:session-check-warning]", sessionErr);
      }

      // Keep loading=true until navigation — prevents double-clicks making login slower
      window.location.href = destination;
    } catch (err) {
      console.error("[auth:login-error]", err);
      setLoading(false);
      setError(
        userFacingErrorMessage(
          err,
          "Invalid email or password or connection issue. Please try again."
        )
      );
    }
  }

  async function onGoogleSignIn() {
    setError("");
    setGoogleLoading(true);
    await signIn("google", {
      callbackUrl: "/employee-portal/dashboard",
    });
  }

  const currentTestimonial = TESTIMONIALS[activeTestimonialIdx];
  const tenantInitials = (tenant.name || "RS")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  if (workspaceStep === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-white space-y-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#5D3EBC] border-t-transparent" />
        <p className="text-xs text-neutral-400 font-medium">Connecting to workspace...</p>
      </div>
    );
  }

  if (workspaceStep === "enter_code") {
    return (
      <div className="relative z-10 w-full max-w-[460px] rounded-[32px] bg-white/95 backdrop-blur-2xl border border-blue-200/80 p-7 sm:p-9 shadow-[0_25px_70px_rgba(15,23,42,0.45),0_0_0_1px_rgba(255,255,255,0.9)_inset,0_0_40px_rgba(59,130,246,0.18)] text-slate-900 space-y-6">
        {/* Top Floating User Icon Badge (from /icons/user.svg) */}
        <div className="h-16 w-16 mx-auto -mt-2 rounded-2xl bg-gradient-to-b from-[#1e3a8a] via-[#172554] to-[#0f172a] border-2 border-blue-400/60 shadow-xl shadow-blue-950/40 flex items-center justify-center p-3.5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            className="h-8 w-8 text-white fill-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.4)]"
          >
            <path d="M12,12A6,6,0,1,0,6,6,6.006,6.006,0,0,0,12,12ZM12,2A4,4,0,1,1,8,6,4,4,0,0,1,12,2Z" />
            <path d="M12,14a9.01,9.01,0,0,0-9,9,1,1,0,0,0,2,0,7,7,0,0,1,14,0,1,1,0,0,0,2,0A9.01,9.01,0,0,0,12,14Z" />
          </svg>
        </div>

        {/* Headline & Subtitle — Crisp Pure Black & Website Blue */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            <span className="text-slate-900">Enter </span>
            <span className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 bg-clip-text text-transparent">
              Company Code
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-xs mx-auto leading-relaxed font-normal">
            Enter your company's unique workspace code to access your customized login screen.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleVerifyCode();
          }}
          className="space-y-4 pt-1"
        >
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Building2 className="h-3.5 w-3.5 text-blue-600" />
              <span>Company Workspace Code</span>
            </label>
            <div className="flex items-center rounded-2xl border border-slate-200/90 bg-slate-50/80 px-4 py-3.5 focus-within:border-blue-600 focus-within:ring-4 focus-within:ring-blue-500/15 focus-within:bg-white transition-all shadow-sm">
              <Briefcase className="h-4 w-4 text-blue-600 shrink-0" />
              <div className="h-5 w-[1px] bg-slate-200 mx-3 shrink-0" />
              <input
                type="text"
                value={workspaceCodeInput}
                onChange={(e) => {
                  setWorkspaceCodeInput(e.target.value);
                  if (workspaceCodeError) setWorkspaceCodeError("");
                }}
                placeholder="Enter company code"
                className="w-full bg-transparent text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none"
                required
                autoFocus
              />
            </div>
          </div>

          {workspaceCodeError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-start gap-2.5 font-medium shadow-sm">
              <div className="h-4 w-4 shrink-0 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-[10px]">
                !
              </div>
              <p className="leading-tight">{workspaceCodeError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={verifyingCode}
            className="w-full rounded-full bg-gradient-to-r from-[#0f172a] via-[#1e40af] to-[#2563eb] hover:from-[#1e3a8a] hover:via-[#2563eb] hover:to-[#3b82f6] text-white font-bold py-3.5 sm:py-4 text-xs sm:text-sm shadow-xl shadow-blue-900/30 flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer"
          >
            {verifyingCode ? (
              "Verifying..."
            ) : (
              <>
                <span>Continue to Login Screen</span>
                <ArrowRight className="h-4 w-4 text-white font-bold" />
              </>
            )}
          </button>
        </form>

        {/* Footer Note */}
        <div className="pt-2 flex items-center justify-center gap-2 text-[10px] sm:text-[11px] text-slate-500 font-medium">
          <div className="h-[1px] flex-1 bg-slate-200" />
          <span className="flex items-center gap-1.5 shrink-0 px-1 text-slate-500">
            <Info className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <span>This preference will be saved on this device for a direct login next time.</span>
          </span>
          <div className="h-[1px] flex-1 bg-slate-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-10 w-full max-w-5xl rounded-[24px] sm:rounded-[36px] bg-[#181926]/95 backdrop-blur-2xl border border-white/10 overflow-hidden grid grid-cols-1 lg:grid-cols-12 text-white">
      {/* LEFT COLUMN: Modern Login Form (~6.5/12 cols) */}
      <div className="p-5 sm:p-10 lg:p-12 lg:col-span-7 flex flex-col justify-between min-h-0">
        <div className="min-w-0">
          {/* Top Brand Logo & Workspace Switcher */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {tenant.logoUrl ? (
                <img
                  src={tenant.logoUrl}
                  alt={tenant.name}
                  className="h-10 w-auto max-h-10 max-w-[150px] object-contain rounded"
                />
              ) : (
                <img
                  src="/logo.png"
                  alt={tenant.name}
                  width={40}
                  height={40}
                  className="h-10 w-10 object-contain"
                />
              )}
              <div className="min-w-0">
                <span className="font-display text-sm font-bold tracking-wider uppercase text-white block truncate">
                  {tenant.name}
                </span>
                <span className="text-[10px] text-neutral-400 font-medium tracking-wide block -mt-0.5">
                  Workspace Portal · HRMS
                </span>
              </div>
            </div>

            {/* Change Workspace Button */}
            <button
              type="button"
              onClick={handleChangeWorkspace}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#11121A] px-2.5 py-1 text-[10px] text-neutral-400 hover:text-white hover:border-white/20 transition-all shrink-0"
              title="Switch company or workspace"
            >
              <Building2 className="h-3 w-3 text-indigo-400" />
              <span className="hidden sm:inline">Workspace:</span>
              <span className="font-semibold text-neutral-200">{tenant.slug}</span>
              <span className="text-[9px] text-indigo-400 underline ml-0.5">Change</span>
            </button>
          </div>

          {/* Heading */}
          <div className="mt-5 sm:mt-8">
            <h1 className="font-display text-xl sm:text-3xl font-extrabold tracking-tight text-white">
              {tenant.loginHeading || "Welcome back"}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-neutral-400">
              {tenant.loginSubheading || "Please enter your account details to access your workspace"}
            </p>
          </div>

          {/* Universal Single Sign-In Capsule */}
          <div className="mt-4 sm:mt-5 inline-flex max-w-full items-center gap-2 rounded-full bg-[#11121A] px-3 py-1.5 border border-white/10">
            <span
              className="h-2 w-2 shrink-0 rounded-full animate-pulse"
              style={{ backgroundColor: tenant.brandColor || "#10b981" }}
            />
            <span className="text-[11px] sm:text-xs font-medium text-neutral-300 truncate">
              {tenant.tagline || "Universal Sign-In · Employee, Candidate & Admin"}
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

            {/* Dynamic Brand Color / Gradient Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                style={{
                  background:
                    tenant.brandColor && tenant.brandColor !== "#7c3aed"
                      ? `linear-gradient(135deg, ${tenant.brandColor}, #4338ca)`
                      : "linear-gradient(to right, #5D3EBC, #FF8B7D, #7B5CD6)",
                  boxShadow: `0 10px 25px -5px ${tenant.brandColor || "#5D3EBC"}55`,
                }}
                className="w-full rounded-full py-3.5 text-xs sm:text-sm font-bold text-white transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-50"
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
          {tenant.name} · Corporate Attendance & HRMS
        </div>
      </div>

      {/* RIGHT COLUMN: Signature Feature Banner & Floating Notch Card */}
      <div className="hidden lg:flex lg:col-span-5 bg-[#0C0D14] rounded-[28px] m-3 p-8 relative flex-col justify-between overflow-hidden border border-white/5">
        {/* Tenant Custom Banner Background Photo (if provided) */}
        {tenant.loginBannerUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center transition-all duration-700"
            style={{ backgroundImage: `url(${tenant.loginBannerUrl})` }}
          >
            <div className="absolute inset-0 bg-[#0C0D14]/75 backdrop-blur-[1px]" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0C0D14] via-transparent to-[#0C0D14]/70" />
          </div>
        ) : null}

        {/* Subtle Watermark Logo inside Right Card */}
        <div className="absolute -top-10 -right-10 pointer-events-none opacity-[0.08] select-none">
          <img
            src={tenant.logoUrl || "/logo.png"}
            alt=""
            width={288}
            height={288}
            className="w-72 h-72 object-contain"
          />
        </div>

        {/* Top Section: Quote and Mission */}
        <div className="relative z-10 space-y-5">
          <div
            className="font-serif text-4xl leading-none font-bold"
            style={{ color: tenant.brandColor || "#5D3EBC" }}
          >
            “
          </div>
          <h2 className="font-display text-2xl font-bold text-white tracking-tight leading-snug">
            What our Team Says.
          </h2>
          <p className="text-xs text-neutral-300 leading-relaxed">
            "{tenant.testimonialQuote || currentTestimonial.quote}"
          </p>

          <div className="pt-2">
            <p className="text-xs font-bold text-white">
              {tenant.testimonialAuthor || currentTestimonial.author}
            </p>
            <p className="text-[11px] text-neutral-400">
              {tenant.testimonialAuthor ? `${tenant.name} Team` : currentTestimonial.role}
            </p>
          </div>

          {/* Carousel Arrows (only if no static custom quote override) */}
          {!tenant.testimonialQuote && (
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() =>
                  setActiveTestimonialIdx((prev) =>
                    prev === 0 ? TESTIMONIALS.length - 1 : prev - 1
                  )
                }
                style={{ backgroundColor: tenant.brandColor || "#5D3EBC" }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white hover:opacity-90 transition-opacity"
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
          )}
        </div>

        {/* BOTTOM FLOATING NOTCH CARD */}
        <div className="relative z-10 mt-8 rounded-lg bg-white p-5 text-neutral-900 space-y-2 border border-neutral-100 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ color: tenant.brandColor || "#0F5C74" }}
            >
              <Sparkles className="h-3 w-3 text-amber-500" />
              {tenant.name} · Verified Enterprise HRMS
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
              <div
                className="inline-block h-6 w-6 rounded-full ring-2 ring-white text-[9px] font-bold text-white flex items-center justify-center"
                style={{ backgroundColor: tenant.brandColor || "#6366f1" }}
              >
                {tenantInitials}
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
              {tenant.name}
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
        {/* Luxury Sapphire Navy Backdrop Overlay for Contrast */}
        <div className="absolute inset-0 bg-[#060b18]/60 backdrop-blur-[1px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#060b18] via-[#09122a]/40 to-[#060b18]/80" />
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
          © {new Date().getFullYear()} Corporate HRMS Workspace · All rights reserved.
        </footer>
      </div>
    </div>
  );
}

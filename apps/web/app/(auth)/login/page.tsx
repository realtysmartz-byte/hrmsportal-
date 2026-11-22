"use client";

import { userFacingErrorMessage } from "@/lib/user-facing-error";
import { signIn, getSession, getProviders } from "next-auth/react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  Briefcase,
} from "lucide-react";
import { homePathForRole } from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";

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

function HexagonLogoMark() {
  return (
    <svg
      width="34"
      height="34"
      viewBox="0 0 34 34"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
      aria-hidden="true"
    >
      {/* Hexagon outline (stroke #2F7FB5, 2.6) */}
      <polygon
        points="17,2.5 29.5,9.75 29.5,24.25 17,31.5 4.5,24.25 4.5,9.75"
        stroke="#2F7FB5"
        strokeWidth="2.6"
        strokeLinejoin="round"
        fill="none"
      />
      {/* 3 vertical rounded bars inside in red #D6283A (stroke 3.4) */}
      <line
        x1="11.5"
        y1="13"
        x2="11.5"
        y2="21"
        stroke="#D6283A"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <line
        x1="17"
        y1="9.5"
        x2="17"
        y2="24.5"
        stroke="#D6283A"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <line
        x1="22.5"
        y1="13"
        x2="22.5"
        y2="21"
        stroke="#D6283A"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

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
  }>({
    name: "Realty Smartz",
    slug: "realty",
    logoUrl: null,
    brandColor: "#2B2FD1",
    loginHeading: null,
    loginSubheading: null,
    loginBannerUrl: null,
    tagline: null,
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
        .then(async (res) => {
          if (!res.ok) throw new Error("Tenant lookup failed");
          return res.json();
        })
        .then((data) => {
            if (data && data.name && data.slug) {
              setTenant({
                name: data.name,
                slug: data.slug || org,
                logoUrl: data.logoUrl || null,
                brandColor: data.brandColor || "#2B2FD1",
                loginHeading: data.loginHeading || null,
                loginSubheading: data.loginSubheading || null,
                loginBannerUrl: data.loginBannerUrl || null,
                tagline: data.tagline || null,
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

        if (res.status === 429 || data.locked) {
          setWorkspaceCodeError(
            data.error || "Too many failed attempts. Your device is locked for 5 minutes."
          );
          setVerifyingCode(false);
          return;
        }

        if (!res.ok || data.notFound || !data.slug) {
          const attemptsMsg =
            typeof data.attemptsLeft === "number"
              ? ` (${data.attemptsLeft} attempt${data.attemptsLeft === 1 ? "" : "s"} remaining before 5-minute lockout)`
              : "";
          setWorkspaceCodeError(
            data.error || `Company code "${raw}" not found. Please verify with HR.${attemptsMsg}`
          );
          setVerifyingCode(false);
          return;
        }

        setTenant({
          name: data.name,
          slug: data.slug || raw,
          logoUrl: data.logoUrl || null,
          brandColor: data.brandColor || "#2B2FD1",
          loginHeading: data.loginHeading || null,
          loginSubheading: data.loginSubheading || null,
          loginBannerUrl: data.loginBannerUrl || null,
          tagline: data.tagline || null,
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

    useEffect(() => {
      setMounted(true);
    }, []);

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

        try {
          if (typeof window !== "undefined") {
            sessionStorage.clear();
          }
        } catch {
          // ignore storage errors
        }

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

    if (workspaceStep === "loading") {
      return (
        <div className="flex flex-col items-center justify-center py-20 space-y-3" style={{ color: "var(--login-ink)" }}>
          <div
            className="h-7 w-7 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: "var(--login-accent)", borderTopColor: "transparent" }}
          />
          <p className="text-xs font-medium" style={{ color: "var(--login-muted)" }}>
            Connecting to workspace...
          </p>
        </div>
      );
    }

    if (workspaceStep === "enter_code") {
      return (
        <div
          className="w-full max-w-[420px] p-6 sm:p-8 border"
          style={{
            backgroundColor: "var(--login-card)",
            borderColor: "var(--login-line)",
            borderRadius: "4px",
            color: "var(--login-ink)",
          }}
        >
          <div className="flex items-center gap-3">
            <HexagonLogoMark />
            <div>
              <div className="text-[14px] font-bold tracking-[0.04em]" style={{ color: "var(--login-ink)" }}>
                REALTY SMARTZ
              </div>
              <div className="text-[11px]" style={{ color: "var(--login-muted)" }}>
                Workspace Portal · HRMS
              </div>
            </div>
          </div>

          <div className="mt-5">
            <h1 className="text-[20px] font-bold tracking-[-0.02em]" style={{ color: "var(--login-ink)" }}>
              Enter Workspace
            </h1>
            <p className="mt-1 text-[13px]" style={{ color: "var(--login-muted)" }}>
              Enter your company workspace code to access your portal.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleVerifyCode();
            }}
            className="mt-4 space-y-2.5"
          >
            <div className="relative">
              <span className="absolute left-[14px] top-1/2 -translate-y-1/2" style={{ color: "var(--login-muted)" }}>
                <Briefcase size={16} strokeWidth={1.8} />
              </span>
              <input
                type="text"
                value={workspaceCodeInput}
                onChange={(e) => {
                  setWorkspaceCodeInput(e.target.value);
                  if (workspaceCodeError) setWorkspaceCodeError("");
                }}
                placeholder="Company code (e.g. realty)"
                className="login-input"
                required
                autoFocus
              />
            </div>

            {workspaceCodeError && (
              <div
                className="p-2 text-xs border"
                style={{
                  borderColor: "#EF4444",
                  backgroundColor: "var(--login-field)",
                  color: "#EF4444",
                }}
              >
                {workspaceCodeError}
              </div>
            )}

            <button
              type="submit"
              disabled={verifyingCode}
              className="login-chamfer-btn mt-2"
            >
              {verifyingCode ? "Verifying..." : "Continue"}
            </button>
          </form>
        </div>
      );
    }

    return (
      <div
        className="login-card-container w-full"
        style={{
          maxWidth: "920px",
          minHeight: "460px",
          backgroundColor: "var(--login-card)",
          borderColor: "var(--login-line)",
        }}
      >
        {/* LEFT COLUMN: Login Form */}
        <div className="login-form-side flex flex-col justify-center">
          <div>
            {/* 1. Logo + text row */}
            <div className="flex items-center gap-3">
              {tenant.logoUrl ? (
                <img
                  src={tenant.logoUrl}
                  alt={tenant.name}
                  className="h-[34px] w-auto max-w-[120px] object-contain shrink-0"
                />
              ) : (
                <HexagonLogoMark />
              )}
              <div>
                <div
                  className="text-[14px] font-bold uppercase tracking-[0.04em] leading-tight"
                  style={{ color: "var(--login-ink)" }}
                >
                  REALTY SMARTZ
                </div>
                <div
                  className="text-[11px] leading-tight mt-0.5"
                  style={{ color: "var(--login-muted)" }}
                >
                  Workspace Portal · HRMS
                </div>
              </div>
            </div>

            {/* 2. Heading */}
            <h1
              className="text-[22px] sm:text-[24px] font-bold tracking-[-0.02em] leading-tight mt-4 sm:mt-5"
              style={{ color: "var(--login-ink)" }}
            >
              Welcome back
            </h1>

            {/* 3. Sub text */}
            <p
              className="text-[13px] mt-1 leading-normal"
              style={{ color: "var(--login-muted)" }}
            >
              Please enter your account details to access your workspace.
            </p>

            {/* 4. Line: Workspace: realty Change */}
            <div className="text-[12px] mt-2" style={{ color: "var(--login-muted)" }}>
              <span>Workspace: </span>
              <strong className="font-semibold" style={{ color: "var(--login-ink)" }}>
                {tenant.slug || "realty"}
              </strong>{" "}
              <button
                type="button"
                onClick={handleChangeWorkspace}
                className="underline hover:opacity-80 transition-opacity ml-1 cursor-pointer"
                style={{
                  color: "var(--login-accent)",
                  textDecorationThickness: "1px",
                  textUnderlineOffset: "3px",
                }}
              >
                Change
              </button>
            </div>

            {/* Error Banner */}
            {error && (
              <div
                className="mt-3 p-2.5 text-xs border"
                style={{
                  borderColor: "#EF4444",
                  backgroundColor: "var(--login-field)",
                  color: "#EF4444",
                }}
              >
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={onSubmit} className="mt-4 space-y-2.5">
              {/* 5. Email input with mail icon on left */}
              <div className="relative">
                <span
                  className="absolute left-[14px] top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: "var(--login-muted)" }}
                >
                  <Mail size={16} strokeWidth={1.8} />
                </span>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  required
                  className="login-input"
                />
              </div>

              {/* 6. Password input with lock icon on left and eye / eye-off toggle button on right */}
              <div className="relative">
                <span
                  className="absolute left-[14px] top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: "var(--login-muted)" }}
                >
                  <Lock size={16} strokeWidth={1.8} />
                </span>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  className="login-input"
                  style={{ paddingRight: "40px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-[14px] top-1/2 -translate-y-1/2 transition-colors cursor-pointer"
                  style={{ color: "var(--login-muted)" }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff size={16} strokeWidth={1.8} />
                  ) : (
                    <Eye size={16} strokeWidth={1.8} />
                  )}
                </button>
              </div>

              {/* 7. Checkbox: Keep me logged in */}
              <div className="flex items-center pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none text-[12px]" style={{ color: "var(--login-muted)" }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="login-checkbox"
                  />
                  <span>Keep me logged in</span>
                </label>
              </div>

              {/* 8. Button "Sign in" */}
              <div className="pt-1.5">
                <button
                  type="submit"
                  disabled={loading}
                  className="login-chamfer-btn"
                >
                  {loading ? "Signing in..." : "Sign in"}
                </button>
              </div>
            </form>

            {/* 9. Divider line with text */}
            <div className="relative my-3.5 text-center">
              <div
                className="absolute inset-0 flex items-center"
                aria-hidden="true"
              >
                <div className="w-full border-t" style={{ borderColor: "var(--login-line)" }} />
              </div>
              <div className="relative flex justify-center text-[11px]">
                <span
                  className="px-2.5"
                  style={{
                    backgroundColor: "var(--login-card)",
                    color: "var(--login-muted)",
                  }}
                >
                  Or continue with enterprise sign-in
                </span>
              </div>
            </div>

            {/* 10. ONLY the Google icon button: 44x44, 1px border, sharp corners */}
            <div className="flex justify-center">
              <button
                type="button"
                disabled={googleLoading}
                onClick={onGoogleSignIn}
                aria-label="Continue with Google"
                title="Continue with Google"
                className="login-google-btn"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
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

            {/* 11. Footer small muted centered text */}
            <div
              className="mt-4 sm:mt-5 text-center text-[11px]"
              style={{ color: "var(--login-muted)" }}
            >
              Realty Smartz · Corporate Attendance & HRMS
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Transparent image fitting the panel */}
        <div
          className="login-image-side hidden lg:flex items-center justify-center relative w-full h-full overflow-hidden p-6 lg:p-8 border-l"
          style={{
            backgroundColor: "var(--login-card)",
            borderColor: "var(--login-line)",
          }}
        >
          <img
            src={tenant.loginBannerUrl || "/assets/login-side.png"}
            alt="Realty Smartz Workspace"
            className="w-full h-full max-h-[360px] object-contain block select-none pointer-events-none"
            loading="eager"
          />
        </div>
      </div>
    );
  }

  export default function LoginPage() {
    return (
      <>
        <style
          dangerouslySetInnerHTML={{
            __html: `
            @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap');

            :root {
              --login-bg: #F5F5F3;
              --login-card: #FFFFFF;
              --login-ink: #111318;
              --login-muted: #6B7078;
              --login-line: #E3E4E1;
              --login-field: #FAFAF9;
              --login-accent: #2B2FD1;
              --login-accent-text: #FFFFFF;
              --login-ring: rgba(43, 47, 209, 0.18);
            }

            @media (prefers-color-scheme: dark) {
              :root {
                --login-bg: #0B0C0F;
                --login-card: #121419;
                --login-ink: #F2F3F5;
                --login-muted: #8A8F98;
                --login-line: #23262D;
                --login-field: #0D0F13;
                --login-accent: #6C70F5;
                --login-accent-text: #FFFFFF;
                --login-ring: rgba(108, 112, 245, 0.18);
              }
            }

            .dark {
              --login-bg: #0B0C0F;
              --login-card: #121419;
              --login-ink: #F2F3F5;
              --login-muted: #8A8F98;
              --login-line: #23262D;
              --login-field: #0D0F13;
              --login-accent: #6C70F5;
              --login-accent-text: #FFFFFF;
              --login-ring: rgba(108, 112, 245, 0.18);
            }

            .login-page-root {
              font-family: 'Manrope', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background-color: var(--login-bg);
              color: var(--login-ink);
            }

            .login-card-container {
              border: 1px solid var(--login-line);
              border-radius: 4px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              overflow: hidden;
            }

            .login-form-side {
              padding: 32px 42px;
            }

            @media (max-width: 819px) {
              .login-card-container {
                display: block;
                max-width: 100% !important;
                min-height: 100vh !important;
                border: none !important;
                border-radius: 0 !important;
              }
              .login-form-side {
                padding: 32px 20px;
                min-height: 100vh;
              }
              .login-image-side {
                display: none !important;
              }
            }

            .login-input {
              width: 100%;
              height: 44px;
              border: 1px solid var(--login-line);
              background-color: var(--login-field);
              border-radius: 0;
              color: var(--login-ink);
              padding-left: 40px;
              padding-right: 14px;
              font-size: 13px;
              outline: none;
              transition: border-color 0.15s ease, box-shadow 0.15s ease;
            }

            .login-input::placeholder {
              color: var(--login-muted);
            }

            .login-input:focus {
              border-color: var(--login-accent);
              box-shadow: 0 0 0 3px var(--login-ring);
            }

            .login-checkbox {
              accent-color: var(--login-accent);
              width: 15px;
              height: 15px;
              border-radius: 2px;
              cursor: pointer;
            }

            .login-chamfer-btn {
              width: 100%;
              height: 44px;
              background-color: var(--login-accent);
              color: var(--login-accent-text);
              font-size: 14px;
              font-weight: 600;
              border: none;
              border-radius: 0;
              cursor: pointer;
              transition: filter 0.15s ease;
              clip-path: polygon(
                14px 0,
                100% 0,
                100% calc(100% - 14px),
                calc(100% - 14px) 100%,
                0 100%,
                0 14px
              );
            }

            .login-chamfer-btn:hover:not(:disabled) {
              filter: brightness(1.08);
            }

            .login-chamfer-btn:disabled {
              opacity: 0.6;
              cursor: not-allowed;
            }

            .login-chamfer-btn:focus-visible {
              outline: 2px solid var(--login-accent);
              outline-offset: 2px;
            }

            .login-google-btn {
              width: 44px;
              height: 44px;
              display: flex;
              align-items: center;
              justify-content: center;
              border: 1px solid var(--login-line);
              border-radius: 0;
              background-color: transparent;
              cursor: pointer;
              transition: background-color 0.15s ease;
            }

            .login-google-btn:hover {
              background-color: var(--login-field);
            }

            .login-google-btn:focus-visible {
              outline: 2px solid var(--login-accent);
              outline-offset: 2px;
            }
          `,
          }}
        />

        <div
          className="login-page-root min-h-screen w-full flex items-center justify-center p-0 sm:p-4 lg:p-6"
          style={{
            paddingTop: "max(1rem, env(safe-area-inset-top))",
            paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
            paddingLeft: "max(1rem, env(safe-area-inset-left))",
            paddingRight: "max(1rem, env(safe-area-inset-right))",
          }}
        >
          <Suspense
            fallback={
              <div
                className="text-xs font-semibold animate-pulse py-20"
                style={{ color: "var(--login-muted)" }}
              >
                Loading workspace...
              </div>
            }
          >
            <LoginForm />
          </Suspense>
        </div>
      </>
    );
  }

"use client";

import { signIn, getSession, getProviders } from "next-auth/react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

function LoginForm() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [portal, setPortal] = useState<Portal>(
    searchParams.get("portal") === "admin" ? "admin" : "employee"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  // Show Google error once, then clean the URL so it doesn't stick
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
    setPassword("");
    setEmail("");
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
      setError("Enter email and password");
      return;
    }

    const result = await signIn("credentials", {
      email: cleanEmail,
      password: cleanPassword,
      redirect: false,
      callbackUrl:
        portal === "admin"
          ? "/admin-portal/dashboard"
          : "/employee-portal/dashboard",
    });

    if (result?.error) {
      setLoading(false);
      setError("Invalid email or password. Please try again.");
      return;
    }

    const session = await waitForSession();
    const role = (session?.user?.role ?? "EMPLOYEE") as Role;

    if (!session?.user?.id) {
      setLoading(false);
      setError("Signed in, but session failed to load. Please refresh the page.");
      return;
    }

    if (portal === "admin" && !canAccessAdminPortal(role)) {
      setLoading(false);
      setError(
        "Admin Portal is for Admin/HR only. Managers use Employee Portal → My Team."
      );
      return;
    }

    const destination =
      portal === "employee"
        ? "/employee-portal/dashboard"
        : homePathForRole(role);

    setLoading(false);
    router.push(destination);
    router.refresh();
  }

  async function onGoogleSignIn() {
    setError("");
    setGoogleLoading(true);
    await signIn("google", {
      callbackUrl: "/employee-portal/dashboard",
    });
  }

  return (
    <Card className="w-full max-w-md border-neutral-200 shadow-elevated">
      <CardHeader className="space-y-4 text-center">
        <div className="flex justify-center">
          <Logo />
        </div>
        <div>
          <CardTitle className="font-display text-heading-lg">
            Sign in to HRMS
          </CardTitle>
          <CardDescription>
            Choose Employee App or Admin Portal
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-1">
          <button
            type="button"
            className={cn(
              "rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
              portal === "employee"
                ? "bg-white text-teal-800 shadow-sm"
                : "text-neutral-500"
            )}
            onClick={() => switchPortal("employee")}
          >
            Employee
          </button>
          <button
            type="button"
            className={cn(
              "rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
              portal === "admin"
                ? "bg-white text-teal-800 shadow-sm"
                : "text-neutral-500"
            )}
            onClick={() => switchPortal("admin")}
          >
            Admin
          </button>
        </div>

        {portal === "employee" && googleEnabled && (
          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              disabled={googleLoading}
              onClick={onGoogleSignIn}
            >
              <span className="text-[11px] font-bold text-[#4285F4]">G</span>
              {googleLoading ? "Redirecting…" : "Sign in with Google"}
            </Button>
            <p className="text-center text-[11px] text-neutral-500">
              Google is for employees only. Admin/HR must use email &amp;
              password.
            </p>
            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-neutral-200" />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase tracking-wide">
                <span className="bg-white px-2 text-neutral-400">or email</span>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@realtysmartz.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          {error && (
            <p className="text-sm text-maroon-600" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-teal-50 via-neutral-50 to-maroon-50/30 p-4">
      <Suspense
        fallback={<div className="text-caption text-neutral-500">Loading...</div>}
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}

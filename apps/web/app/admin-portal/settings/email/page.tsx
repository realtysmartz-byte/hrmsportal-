"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  UserCheck,
  Clock,
  Sparkles,
  Lock,
} from "lucide-react";

export default function EmailSettingsPage() {
  const { data: status, isLoading } = trpc.emailSettings.getStatus.useQuery();

  const [testEmail, setTestEmail] = useState("");
  const [testStatus, setTestStatus] = useState<{
    success?: boolean;
    message?: string;
  } | null>(null);

  const testMutation = trpc.emailSettings.sendTestEmail.useMutation({
    onSuccess: (res) => {
      setTestStatus({
        success: res.success,
        message: res.message,
      });
    },
    onError: (err) => {
      setTestStatus({
        success: false,
        message: err.message || "Test email request failed",
      });
    },
  });

  function handleSendTest(e: React.FormEvent) {
    e.preventDefault();
    if (!testEmail) return;
    setTestStatus(null);
    testMutation.mutate({ targetEmail: testEmail });
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-neutral-500">
        Checking email service status...
      </div>
    );
  }

  const isConfigured = Boolean(status?.isConfigured);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div>
        <h1 className="text-lg sm:text-xl font-semibold text-neutral-900">
          Email Service Status
        </h1>
        <p className="mt-0.5 text-xs sm:text-sm text-neutral-500">
          Operational health and deliverability verification for automated company notifications.
        </p>
      </div>

      {/* Operational Status Banner */}
      <div
        className={`rounded-lg border p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
          isConfigured
            ? "border-emerald-200 bg-emerald-50/70 text-emerald-900"
            : "border-amber-200 bg-amber-50/70 text-amber-900"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              isConfigured ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"
            }`}
          >
            {isConfigured ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base">
              {isConfigured
                ? "Email Service: Active & Ready"
                : "Email Service: Not Configured in Environment"}
            </h3>
            <p className="text-xs opacity-90 mt-0.5">
              {isConfigured
                ? "The notification service is active and ready to dispatch official employee emails."
                : "Email credentials are not configured in backend environment variables (.env). Notifications are in silent mode."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold shrink-0">
          <span
            className={`px-3 py-1 rounded-full border shadow-sm ${
              isConfigured
                ? "bg-emerald-100/90 text-emerald-800 border-emerald-300"
                : "bg-amber-100/90 text-amber-800 border-amber-300"
            }`}
          >
            {isConfigured ? "● Service Online" : "○ Configuration Pending"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Test & Security Notice */}
        <div className="lg:col-span-2 space-y-6">
          {/* Test Email Verification Card */}
          <Card className="border-neutral-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Send className="h-4 w-4 text-[#5D3EBC]" />
                Test Email Deliverability
              </CardTitle>
              <CardDescription className="text-xs">
                Send an operational test email to verify mailbox deliverability without exposing server credentials.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSendTest} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-700 block">
                    Recipient Email Address
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      type="email"
                      required
                      placeholder="name@company.com"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      className="text-xs flex-1"
                    />
                    <Button
                      type="submit"
                      disabled={testMutation.isLoading || !testEmail}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-2 shrink-0"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      {testMutation.isLoading ? "Sending..." : "Send Test Email"}
                    </Button>
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    A verification message will be sent through the backend mail service to test inbox placement.
                  </p>
                </div>

                {testStatus && (
                  <div
                    className={`rounded-lg p-3 text-xs flex items-start gap-2 ${
                      testStatus.success
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-red-50 text-red-800 border border-red-200"
                    }`}
                  >
                    {testStatus.success ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold">
                        {testStatus.success
                          ? "Test Email Sent Successfully!"
                          : "Email Delivery Notice"}
                      </p>
                      <p className="mt-0.5">{testStatus.message}</p>
                    </div>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Secure Environment Notice Card */}
          <Card className="border-neutral-200 bg-neutral-50/50 shadow-sm">
            <CardContent className="p-5 flex items-start gap-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-200/80 text-neutral-700">
                <Lock className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-neutral-800">
                  Zero-Exposure Configuration Policy
                </h4>
                <p className="text-[12px] text-neutral-600 leading-relaxed">
                  All SMTP servers, ports, authentication keys, and sender accounts are isolated exclusively within backend environment variables (<code className="font-mono text-neutral-800">.env</code>). Credentials are never rendered in any user interface, bundle script, or client network payload.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Features & Anti-Spam Details */}
        <div className="space-y-6">
          {/* Anti-Spam Guarantee Card */}
          <Card className="border-neutral-200 shadow-sm bg-gradient-to-br from-neutral-900 to-slate-900 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-white">
                <ShieldCheck className="h-4 w-4 text-[#5D3EBC]" />
                Deliverability Standards
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-neutral-300">
              <p>
                Our outgoing notifications follow anti-spam best practices for inbox delivery:
              </p>
              <ul className="space-y-2 text-[11px] list-disc pl-4 text-neutral-300">
                <li>
                  <strong>Domain Verification:</strong> Outgoing senders match authenticated domain records for SPF & DKIM validation.
                </li>
                <li>
                  <strong>Multipart MIME:</strong> Delivers synchronized plain-text and HTML versions to pass corporate spam filters.
                </li>
                <li>
                  <strong>Header Compliance:</strong> Includes RFC-compliant Message-ID, priority, and auto-submitted tags.
                </li>
                <li>
                  <strong>Corporate Signature:</strong> Verified legal footer with company identity and contact information.
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Automated Emails Overview */}
          <Card className="border-neutral-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#5D3EBC]" />
                Automated System Triggers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-2.5 text-xs">
                <UserCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-neutral-900 block font-semibold">
                    New Employee Welcome
                  </strong>
                  <span className="text-neutral-500 text-[11px]">
                    Sends initial portal login credentials and company guidelines upon employee onboarding.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs">
                <Clock className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-neutral-900 block font-semibold">
                    Daily Punch Confirmation
                  </strong>
                  <span className="text-neutral-500 text-[11px]">
                    Sends instant check-in confirmation with time and office boundary verification.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-neutral-900 block font-semibold">
                    Late Attendance Alert
                  </strong>
                  <span className="text-neutral-500 text-[11px]">
                    Automatic notification when check-in occurs after shift start time.
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


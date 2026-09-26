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
  Server,
  Lock,
  UserCheck,
  Clock,
  Sparkles,
  ExternalLink,
} from "lucide-react";

export default function EmailSettingsPage() {
  const utils = trpc.useUtils();
  const { data: config, isLoading } = trpc.emailSettings.getConfig.useQuery();

  const [password, setPassword] = useState("");
  const [testEmail, setTestEmail] = useState("geetasingh12412@gmail.com");
  const [saveStatus, setSaveStatus] = useState<{
    success?: boolean;
    message?: string;
  } | null>(null);
  const [testStatus, setTestStatus] = useState<{
    success?: boolean;
    message?: string;
  } | null>(null);

  const updateMutation = trpc.emailSettings.updateConfig.useMutation({
    onSuccess: (res) => {
      setSaveStatus({
        success: true,
        message: "SMTP configuration updated successfully!",
      });
      utils.emailSettings.getConfig.invalidate();
    },
    onError: (err) => {
      setSaveStatus({
        success: false,
        message: err.message || "Failed to update configuration",
      });
    },
  });

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

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveStatus(null);
    updateMutation.mutate({
      host: "smtp.hostinger.com",
      port: 465,
      secure: true,
      user: "info@realtysmartz.in",
      pass: password || undefined,
      from: "Realty Smartz HRMS <info@realtysmartz.in>",
    });
  }

  function handleSendTest(e: React.FormEvent) {
    e.preventDefault();
    if (!testEmail) return;
    setTestStatus(null);
    testMutation.mutate({ targetEmail: testEmail });
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-neutral-500">
        Loading email settings...
      </div>
    );
  }

  const isConfigured = config?.hasPassword;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
          <span>Realty Smartz Private Limited</span>
          <span>·</span>
          <span className="text-[#FF7A70] font-bold">Mail Delivery Engine</span>
        </div>
        <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900">
          Email & SMTP Configuration
        </h1>
        <p className="mt-0.5 text-xs sm:text-sm text-neutral-500">
          Hostinger SMTP settings, anti-spam deliverability, new employee welcome credentials, and attendance punch notifications.
        </p>
      </div>

      {/* Status Banner */}
      <div
        className={`rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
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
                ? "Hostinger Outgoing Mail is Active & Ready"
                : "SMTP Password Required"}
            </h3>
            <p className="text-xs opacity-90 mt-0.5">
              {isConfigured
                ? "Emails are sent via smtp.hostinger.com:465 with domain authentication for info@realtysmartz.in."
                : "Enter the email password for info@realtysmartz.in below to activate live email delivery."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold shrink-0">
          <span className="px-2.5 py-1 rounded-full bg-white/80 border border-current shadow-sm">
            Server: smtp.hostinger.com:465 (SSL)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Configuration Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-neutral-200 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Server className="h-4 w-4 text-[#FF7A70]" />
                  Hostinger SMTP Credentials
                </CardTitle>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  SSL / Port 465
                </span>
              </div>
              <CardDescription className="text-xs">
                Hostinger email server settings for official company communication.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-neutral-600 block mb-1">
                      SMTP Hostname
                    </label>
                    <Input
                      disabled
                      value="smtp.hostinger.com"
                      className="bg-neutral-50 text-neutral-600 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-neutral-600 block mb-1">
                      Port & Security
                    </label>
                    <Input
                      disabled
                      value="465 (SSL / TLS Enabled)"
                      className="bg-neutral-50 text-neutral-600 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-neutral-600 block mb-1">
                    Outgoing Sender Email (Username)
                  </label>
                  <Input
                    disabled
                    value="info@realtysmartz.in"
                    className="bg-neutral-50 text-neutral-900 font-medium text-xs"
                  />
                  <p className="text-[11px] text-neutral-400 mt-1">
                    Authentication username for Hostinger webmail.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-neutral-700 block mb-1">
                    Email Account Password <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="password"
                    placeholder={
                      config?.hasPassword
                        ? "•••••••••••••••• (Password is saved)"
                        : "Enter password for info@realtysmartz.in"
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="text-xs font-mono"
                  />
                  <p className="text-[11px] text-neutral-500 mt-1">
                    Enter the password created for <code className="font-mono">info@realtysmartz.in</code> in your Hostinger control panel.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-neutral-600 block mb-1">
                    HR Copy Notification Receiver
                  </label>
                  <Input
                    disabled
                    value={config?.hrNotifyEmail || "geetasingh12412@gmail.com"}
                    className="bg-neutral-50 text-neutral-700 text-xs"
                  />
                  <p className="text-[11px] text-neutral-400 mt-1">
                    All late punches, leave submissions, and new employee registrations are copied to this email.
                  </p>
                </div>

                {saveStatus && (
                  <div
                    className={`rounded-lg p-3 text-xs flex items-center gap-2 ${
                      saveStatus.success
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-red-50 text-red-800 border border-red-200"
                    }`}
                  >
                    {saveStatus.success ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                    )}
                    <span>{saveStatus.message}</span>
                  </div>
                )}

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={updateMutation.isLoading || !password}
                    className="bg-[#0F172A] hover:bg-neutral-800 text-white text-xs font-semibold gap-2"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    {updateMutation.isLoading
                      ? "Saving..."
                      : "Save SMTP Password"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Test Email Card */}
          <Card className="border-neutral-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Send className="h-4 w-4 text-[#FF7A70]" />
                Test Email Deliverability
              </CardTitle>
              <CardDescription className="text-xs">
                Send a real test email to verify Hostinger connection and ensure messages land directly in Inbox (not Spam).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSendTest} className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    type="email"
                    required
                    placeholder="Enter recipient email (e.g. geetasingh12412@gmail.com)"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    className="text-xs flex-1"
                  />
                  <Button
                    type="submit"
                    disabled={testMutation.isLoading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-2 shrink-0"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {testMutation.isLoading ? "Sending..." : "Send Test Email"}
                  </Button>
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
                          : "Email Delivery Error"}
                      </p>
                      <p className="mt-0.5">{testStatus.message}</p>
                    </div>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Features & Anti-Spam Details */}
        <div className="space-y-6">
          {/* Anti-Spam Guarantee Card */}
          <Card className="border-neutral-200 shadow-sm bg-gradient-to-br from-neutral-900 to-slate-900 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-white">
                <ShieldCheck className="h-4 w-4 text-[#FF7A70]" />
                Anti-Spam Deliverability
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-neutral-300">
              <p>
                Our notification engine applies strict email standards so messages land in the <strong>Primary Inbox</strong>:
              </p>
              <ul className="space-y-2 text-[11px] list-disc pl-4 text-neutral-300">
                <li>
                  <strong>Domain Match:</strong> Sender address <code className="text-[#FF7A70]">info@realtysmartz.in</code> matches authenticated Hostinger domain for SPF & DKIM pass.
                </li>
                <li>
                  <strong>Multipart MIME:</strong> Generates synchronized plain-text alternative alongside HTML (filters reject HTML-only emails).
                </li>
                <li>
                  <strong>Valid Header Tags:</strong> Unique <code className="text-neutral-200">Message-ID</code>, <code className="text-neutral-200">X-Mailer</code>, and auto-submitted tags.
                </li>
                <li>
                  <strong>Corporate Signature:</strong> Full legal footer with company name and contact info.
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Automated Emails Overview */}
          <Card className="border-neutral-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#FF7A70]" />
                Automated System Emails
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
                    Dispatches login credentials, temporary password, employee code, and company guidelines as soon as an employee is created.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs">
                <Clock className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-neutral-900 block font-semibold">
                    Daily Punching Details
                  </strong>
                  <span className="text-neutral-500 text-[11px]">
                    Instant confirmation to the employee with exact punch time, GPS coordinates, and office geofence verification.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-neutral-900 block font-semibold">
                    Late Punch Alert
                  </strong>
                  <span className="text-neutral-500 text-[11px]">
                    Automatic warning notice if check-in occurs at or after 10:00 AM, with copy to HR.
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

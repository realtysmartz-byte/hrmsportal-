"use client";

import { useState } from "react";
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Calendar,
  Clock,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

export default function GoogleSheetsSettingsPage() {
  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.googleSheets.getSettings.useQuery();

  const [selectedDate, setSelectedDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  const [syncStatusMsg, setSyncStatusMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const syncMutation = trpc.googleSheets.syncDailyReport.useMutation({
    onSuccess: (data) => {
      setSyncStatusMsg({
        type: "success",
        text: `Attendance for date "${data.date}" successfully synced (${data.rowCount} employee records).`,
      });
      utils.googleSheets.getSettings.invalidate();
    },
    onError: (err) => {
      setSyncStatusMsg({
        type: "error",
        text: err.message,
      });
    },
  });

  const testConnectionMutation = trpc.googleSheets.testConnection.useMutation({
    onSuccess: (data) => {
      setSyncStatusMsg({
        type: "success",
        text: `Connection verified! Successfully synced ${data.rowCount} employee records.`,
      });
      utils.googleSheets.getSettings.invalidate();
    },
    onError: (err) => {
      setSyncStatusMsg({
        type: "error",
        text: err.message,
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-neutral-500">
        Loading sync status...
      </div>
    );
  }

  const isConfigured = Boolean(settings?.isConfigured);
  const lastSync = settings?.lastSync;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
          <span>Realty Smartz Private Limited</span>
          <span>·</span>
          <span className="text-[#FF7A70] font-bold">Data Integrations</span>
        </div>
        <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900">
          Google Sheets Attendance Sync
        </h1>
        <p className="mt-0.5 text-xs sm:text-sm text-neutral-500">
          Automated daily attendance synchronization and operational health status.
        </p>
      </div>

      {/* Operational Connection Status Badge Banner */}
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
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm sm:text-base">
                {isConfigured ? "Google Sheets Sync: Connected" : "Google Sheets Sync: Disconnected"}
              </h3>
              <Badge
                variant="outline"
                className={
                  isConfigured
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-[10px]"
                    : "bg-amber-100 text-amber-800 border-amber-300 font-bold text-[10px]"
                }
              >
                {isConfigured ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="text-xs opacity-90 mt-0.5">
              {isConfigured
                ? "Daily attendance reports are automatically synced to your designated company spreadsheet."
                : "Backend environment variables are not configured. Contact your system administrator."}
            </p>
          </div>
        </div>

        {isConfigured && (
          <Button
            size="sm"
            variant="outline"
            disabled={testConnectionMutation.isLoading}
            onClick={() => testConnectionMutation.mutate()}
            className="gap-2 text-xs font-semibold shrink-0 bg-white"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${
                testConnectionMutation.isLoading ? "animate-spin" : ""
              }`}
            />
            {testConnectionMutation.isLoading ? "Testing..." : "Verify Connection"}
          </Button>
        )}
      </div>

      {/* Sync Status Feedback Alert */}
      {syncStatusMsg && (
        <div
          className={`rounded-xl border p-4 text-xs font-medium flex items-center justify-between ${
            syncStatusMsg.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
              : "bg-red-50 text-red-900 border-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {syncStatusMsg.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            )}
            <span>{syncStatusMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setSyncStatusMsg(null)}
            className="text-neutral-400 hover:text-neutral-600 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Grid: Operational Actions & Last Sync Telemetry */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: On-Demand Manual Sync */}
        <Card className="border-neutral-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-[#FF7A70]" />
              Trigger On-Demand Sync
            </CardTitle>
            <CardDescription className="text-xs">
              Manually trigger attendance synchronization for today or any past date.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Button
                disabled={syncMutation.isLoading || !isConfigured}
                onClick={() => syncMutation.mutate({})}
                className="w-full bg-[#0F172A] hover:bg-neutral-800 text-white font-bold text-xs gap-2"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${
                    syncMutation.isLoading ? "animate-spin" : ""
                  }`}
                />
                {syncMutation.isLoading ? "Syncing..." : "Sync Today's Report Now"}
              </Button>
            </div>

            <div className="pt-3 border-t border-neutral-100">
              <label className="text-xs font-medium text-neutral-600 block mb-1.5">
                Or select a specific date to synchronize:
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-800 flex-1 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={syncMutation.isLoading || !isConfigured || !selectedDate}
                  onClick={() => syncMutation.mutate({ date: selectedDate })}
                  className="text-xs font-semibold shrink-0"
                >
                  Sync Date
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Last Sync Telemetry */}
        <Card className="border-neutral-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#FF7A70]" />
              Latest Sync Outcome
            </CardTitle>
            <CardDescription className="text-xs">
              Operational details from the most recent synchronization cycle.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {lastSync ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-50 border border-neutral-100 text-xs">
                  <span className="text-neutral-500">Report Date:</span>
                  <span className="font-bold text-neutral-800">{lastSync.date}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-50 border border-neutral-100 text-xs">
                  <span className="text-neutral-500">Target Tab:</span>
                  <span className="font-mono font-semibold text-neutral-800">
                    {lastSync.sheetTitle}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-50 border border-neutral-100 text-xs">
                  <span className="text-neutral-500">Records Synced:</span>
                  <span className="font-bold text-emerald-700">
                    {lastSync.rowCount} employees
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-50 border border-neutral-100 text-xs">
                  <span className="text-neutral-500">Timestamp:</span>
                  <span className="text-neutral-600">
                    {new Date(lastSync.syncedAt).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center text-xs text-neutral-400">
                <Layers className="h-8 w-8 text-neutral-300 mb-2" />
                <p>No sync activity recorded yet during this server session.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Copy,
  Check,
  HelpCircle,
  Key,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

export default function GoogleSheetsSettingsPage() {
  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.googleSheets.getSettings.useQuery();

  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [serviceAccountEmail, setServiceAccountEmail] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");

  const [selectedDate, setSelectedDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  const [copiedCode, setCopiedCode] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{
    type: "success" | "error";
    text: string;
    url?: string;
  } | null>(null);

  const syncMutation = trpc.googleSheets.syncDailyReport.useMutation({
    onSuccess: (data) => {
      setSyncStatusMsg({
        type: "success",
        text: `Tab "${data.sheetTitle}" successfully created with ${data.rowCount} employee records!`,
        url: data.spreadsheetUrl,
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

  const saveSettingsMutation = trpc.googleSheets.saveSettings.useMutation({
    onSuccess: () => {
      setSyncStatusMsg({
        type: "success",
        text: "Google Sheet settings saved successfully.",
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
        text: `Connection test passed! Created tab "${data.sheetTitle}" with ${data.rowCount} records.`,
        url: data.spreadsheetUrl,
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

  function copyAppsScript() {
    const script = `/**
 * Realty Smartz HRMS - Daily Attendance Sync Webhook
 * Extensions > Apps Script > Paste this code > Deploy as Web App
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheetTitle = data.sheetTitle || data.date || Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd");
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Check if sheet for this date exists, otherwise create it
    var sheet = ss.getSheetByName(sheetTitle);
    if (!sheet) {
      sheet = ss.insertSheet(sheetTitle);
      sheet.setFrozenRows(1);
    } else {
      sheet.clearContents();
    }
    
    // Write raw values
    if (data.rawValues && data.rawValues.length > 0) {
      sheet.getRange(1, 1, data.rawValues.length, data.rawValues[0].length).setValues(data.rawValues);
      
      // Format header row (Obsidian / Coral style)
      var headerRange = sheet.getRange(1, 1, 1, data.rawValues[0].length);
      headerRange.setBackground("#181C26");
      headerRange.setFontColor("#FFFFFF");
      headerRange.setFontWeight("bold");
      headerRange.setHorizontalAlignment("center");
      
      // Auto-fit columns
      for (var col = 1; col <= data.rawValues[0].length; col++) {
        sheet.autoResizeColumn(col);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: true, sheetTitle: sheetTitle }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;
    navigator.clipboard.writeText(script);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  }

  const effectiveSpreadsheetId = settings?.spreadsheetId || spreadsheetId;
  const isConfigured = settings?.isConfigured;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
            <span>Realty Smartz Private Limited</span>
            <span>·</span>
            <span className="text-[#FF7A70] font-bold">Cloud Integration</span>
          </div>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 flex items-center gap-2.5">
            <FileSpreadsheet className="h-7 w-7 text-emerald-600" />
            Google Sheets Daily Sync
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-neutral-500">
            Automatically generates a new date tab daily in your Google Sheet with full employee attendance and hours.
          </p>
        </div>

        {settings?.spreadsheetUrl && (
          <a
            href={settings.spreadsheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-all"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Open Google Sheet
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {/* Sync Status Banner */}
      {syncStatusMsg && (
        <div
          className={`flex items-start justify-between rounded-xl p-4 text-xs font-medium border ${
            syncStatusMsg.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-maroon-50 text-maroon-800 border-maroon-200"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {syncStatusMsg.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-maroon-600 shrink-0" />
            )}
            <div>
              <p>{syncStatusMsg.text}</p>
              {syncStatusMsg.url && (
                <a
                  href={syncStatusMsg.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 font-bold underline hover:opacity-80"
                >
                  View tab in Google Sheet <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSyncStatusMsg(null)}
            className="text-neutral-400 hover:text-neutral-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* Bento Grid: Actions & Status */}
      <div className="grid gap-5 md:grid-cols-3">
        {/* Card 1: 1-Click Sync Today */}
        <Card className="rounded-2xl border-neutral-200/80 shadow-sm relative overflow-hidden bg-gradient-to-br from-white to-emerald-50/40">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800 font-bold text-[10px]">
                Live Sync
              </Badge>
              <Sparkles className="h-4 w-4 text-emerald-600" />
            </div>
            <CardTitle className="text-base font-bold text-neutral-900 mt-2">
              Sync Today's Report
            </CardTitle>
            <CardDescription className="text-xs">
              Creates or updates today's date tab ({new Date().toISOString().slice(0, 10)}) with all punches.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <Button
              className="w-full bg-[#181C26] hover:bg-neutral-800 text-white gap-2 font-bold text-xs rounded-xl"
              disabled={syncMutation.isLoading}
              onClick={() => syncMutation.mutate({})}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${syncMutation.isLoading ? "animate-spin" : ""}`}
              />
              {syncMutation.isLoading ? "Writing to Sheet..." : "Sync Today Now"}
            </Button>
          </CardContent>
        </Card>

        {/* Card 2: Custom Date Sync */}
        <Card className="rounded-2xl border-neutral-200/80 shadow-sm bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-[10px]">
                Historical / Past Date
              </Badge>
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-base font-bold text-neutral-900 mt-2">
              Sync Past Date
            </CardTitle>
            <CardDescription className="text-xs">
              Pick any previous date to generate its own separate tab in the sheet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-9 text-xs"
            />
            <Button
              variant="outline"
              className="w-full border-neutral-200 text-xs font-bold gap-2 rounded-xl"
              disabled={syncMutation.isLoading || !selectedDate}
              onClick={() => syncMutation.mutate({ date: selectedDate })}
            >
              Export {selectedDate} Tab
            </Button>
          </CardContent>
        </Card>

        {/* Card 3: Auto Sync & Cron Schedule */}
        <Card className="rounded-2xl border-neutral-200/80 shadow-sm bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Badge
                variant={isConfigured ? "success" : "secondary"}
                className="text-[10px]"
              >
                {isConfigured ? "Configured" : "Needs Credentials"}
              </Badge>
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <CardTitle className="text-base font-bold text-neutral-900 mt-2">
              Automated Daily Run
            </CardTitle>
            <CardDescription className="text-xs">
              Automated scheduler runs at 23:59 daily.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2 text-xs space-y-2 text-neutral-600">
            <div className="rounded-lg bg-neutral-50 p-2.5 font-mono text-[11px] border border-neutral-100 break-all text-neutral-700">
              GET /api/cron/sync-google-sheets
            </div>
            <p className="text-[11px] text-neutral-400">
              Can be hooked up to Vercel Cron, GitHub Actions, or Windows Task Scheduler to run daily.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Configuration Form */}
      <Card className="rounded-2xl border-neutral-200/80 shadow-sm bg-white">
        <CardHeader>
          <CardTitle className="text-base font-bold text-neutral-900 flex items-center gap-2">
            <Key className="h-4 w-4 text-[#FF7A70]" />
            Google Sheet Credentials
          </CardTitle>
          <CardDescription className="text-xs">
            Configure Google Cloud Service Account credentials or Google Apps Script Webhook.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Spreadsheet ID */}
            <div>
              <Label className="text-xs font-semibold">Google Spreadsheet ID</Label>
              <Input
                type="text"
                placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                defaultValue={settings?.spreadsheetId}
                onChange={(e) => setSpreadsheetId(e.target.value)}
                className="mt-1 text-xs"
              />
              <p className="mt-1 text-[11px] text-neutral-400">
                Found in the sheet URL: docs.google.com/spreadsheets/d/
                <span className="font-bold text-neutral-700">&#123;SPREADSHEET_ID&#125;</span>/edit
              </p>
            </div>

            {/* Service Account Email */}
            <div>
              <Label className="text-xs font-semibold">Service Account Email</Label>
              <Input
                type="email"
                placeholder="realty-smartz@project-id.iam.gserviceaccount.com"
                defaultValue={settings?.serviceAccountEmail}
                onChange={(e) => setServiceAccountEmail(e.target.value)}
                className="mt-1 text-xs"
              />
              <p className="mt-1 text-[11px] text-neutral-400">
                Must be added as an <strong>Editor</strong> in your Google Sheet sharing options.
              </p>
            </div>
          </div>

          {/* Private Key */}
          <div>
            <Label className="text-xs font-semibold">
              Service Account Private Key (PEM format)
            </Label>
            <textarea
              rows={4}
              placeholder="-----BEGIN PRIVATE KEY-----&#10;MIIEvgIBADANBgkqhkiG9w0BAQEFAASC...&#10;-----END PRIVATE KEY-----"
              onChange={(e) => setPrivateKey(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-200 p-2.5 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="mt-1 text-[11px] text-neutral-400">
              {settings?.hasPrivateKey
                ? "✓ Private key is configured and active in the system."
                : "Paste the private_key from your downloaded service account JSON file."}
            </p>
          </div>

          <div className="pt-2 border-t border-neutral-100">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-neutral-500" />
              Alternative Option: Google Apps Script Webhook URL (No Google Cloud setup required)
            </Label>
            <Input
              type="url"
              placeholder="https://script.google.com/macros/s/.../exec"
              defaultValue={settings?.webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="mt-1 text-xs"
            />
            <p className="mt-1 text-[11px] text-neutral-400">
              If you don't want to create a Google Cloud Service Account, you can paste an Apps Script Webhook URL here.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={testConnectionMutation.isLoading}
              onClick={() => testConnectionMutation.mutate()}
              className="text-xs font-bold gap-1.5 border-neutral-200"
            >
              <RefreshCw
                className={`h-3 w-3 ${testConnectionMutation.isLoading ? "animate-spin" : ""}`}
              />
              Test Connection
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={saveSettingsMutation.isLoading}
              onClick={() =>
                saveSettingsMutation.mutate({
                  spreadsheetId: spreadsheetId || undefined,
                  serviceAccountEmail: serviceAccountEmail || undefined,
                  privateKey: privateKey || undefined,
                  webhookUrl: webhookUrl || undefined,
                })
              }
              className="bg-[#181C26] hover:bg-neutral-800 text-white font-bold text-xs"
            >
              Save Credentials
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Complete Step-by-Step Procedure Instructions */}
      <Card className="rounded-2xl border-neutral-200/80 shadow-sm bg-white">
        <CardHeader>
          <CardTitle className="text-base font-bold text-neutral-900 flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-[#FF7A70]" />
            Complete Setup Procedure (How it Works)
          </CardTitle>
          <CardDescription className="text-xs">
            Follow either of the two easy methods below to connect your Google Sheet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-xs text-neutral-700">
          {/* Method 1 */}
          <div className="rounded-xl border border-neutral-200/80 p-4 space-y-3 bg-neutral-50/50">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[11px] font-bold">
                1
              </span>
              <h4 className="font-bold text-neutral-900 text-sm">
                Method A: Google Cloud Service Account (Official Google Sheets API v4)
              </h4>
            </div>
            <ol className="list-decimal pl-5 space-y-1.5 text-neutral-600">
              <li>
                Go to the{" "}
                <a
                  href="https://console.cloud.google.com/apis/library/sheets.googleapis.com"
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-primary underline"
                >
                  Google Cloud Console
                </a>{" "}
                and enable the <strong>Google Sheets API</strong>.
              </li>
              <li>
                Go to <strong>IAM & Admin &gt; Service Accounts</strong> and click{" "}
                <strong>Create Service Account</strong> (e.g. name it <code>realty-hrms-sheets</code>).
              </li>
              <li>
                Click on the newly created Service Account &gt; <strong>Keys</strong> tab &gt;{" "}
                <strong>Add Key &gt; Create new key (JSON)</strong>. A JSON file will download.
              </li>
              <li>
                Create a new Google Sheet (or open an existing one). Click the blue{" "}
                <strong>Share</strong> button at top right, and paste your Service Account Email
                (e.g. <code>realty-hrms-sheets@project-id.iam.gserviceaccount.com</code>) with{" "}
                <strong>Editor</strong> permission.
              </li>
              <li>
                Copy the Spreadsheet ID from the URL and paste it into the settings box above or your <code>.env</code> file:
                <div className="mt-1 rounded-md bg-[#181C26] p-2 text-white font-mono text-[11px]">
                  GOOGLE_SHEETS_SPREADSHEET_ID="your_spreadsheet_id_here"<br />
                  GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL="your_service_account_email"<br />
                  GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
                </div>
              </li>
              <li>
                Click <strong>"Test Connection"</strong> or <strong>"Sync Today Now"</strong> above. A new tab with today's date will appear in your Google Sheet immediately!
              </li>
            </ol>
          </div>

          {/* Method 2 */}
          <div className="rounded-xl border border-neutral-200/80 p-4 space-y-3 bg-neutral-50/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white text-[11px] font-bold">
                  2
                </span>
                <h4 className="font-bold text-neutral-900 text-sm">
                  Method B: Google Apps Script Webhook (Zero Cloud Console setup in 2 mins)
                </h4>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={copyAppsScript}
                className="gap-1.5 text-xs font-bold border-neutral-300"
              >
                {copiedCode ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                {copiedCode ? "Copied Script!" : "Copy Apps Script"}
              </Button>
            </div>

            <ol className="list-decimal pl-5 space-y-1.5 text-neutral-600">
              <li>Open your Google Spreadsheet.</li>
              <li>In the top menu, click <strong>Extensions &gt; Apps Script</strong>.</li>
              <li>Delete any sample code and paste the copied Realty Smartz script.</li>
              <li>Click <strong>Deploy &gt; New deployment</strong>.</li>
              <li>Select type <strong>Web app</strong>. Set:
                <ul className="list-disc pl-4 mt-0.5 space-y-0.5">
                  <li><strong>Execute as:</strong> Me (your email)</li>
                  <li><strong>Who has access:</strong> Anyone</li>
                </ul>
              </li>
              <li>Click <strong>Deploy</strong>, grant permission, and copy the <strong>Web App URL</strong>.</li>
              <li>Paste that URL into the <strong>Alternative Webhook URL</strong> field above and click <strong>Save Credentials</strong>!</li>
            </ol>
          </div>

          {/* How the daily report structure works */}
          <div className="space-y-2">
            <h4 className="font-bold text-neutral-900 text-sm">
              📊 How Daily Tab Creation & Columns Work:
            </h4>
            <p className="text-neutral-600 leading-relaxed">
              Every day when the sync triggers, Realty Smartz checks if a tab with that date (e.g. <code>{new Date().toISOString().slice(0, 10)}</code>) exists. If not, it creates a new tab, freezes the header row, styles it with Realty Smartz branding, and populates every employee's status, check-in/out timestamps, GPS office location, and working hours.
            </p>
            <div className="overflow-x-auto rounded-lg border border-neutral-200">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-[#181C26] text-white">
                  <tr>
                    <th className="p-2">Sr No</th>
                    <th className="p-2">Employee Code</th>
                    <th className="p-2">Name</th>
                    <th className="p-2">Department</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Check-In</th>
                    <th className="p-2">Geofence</th>
                    <th className="p-2">Check-Out</th>
                    <th className="p-2">Total Hours</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-100 text-neutral-700">
                  <tr>
                    <td className="p-2">1</td>
                    <td className="p-2 font-mono">RS-0001</td>
                    <td className="p-2 font-medium">Abhishek Boora</td>
                    <td className="p-2">Engineering</td>
                    <td className="p-2 font-bold text-emerald-600">PRESENT</td>
                    <td className="p-2">09:15 AM</td>
                    <td className="p-2">Inside Office</td>
                    <td className="p-2">06:30 PM</td>
                    <td className="p-2">9.25 hrs</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

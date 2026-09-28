"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import {
  geolocationErrorMessage,
  getCurrentPosition,
} from "@/lib/geolocation";
import { canManageCompanySettings } from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";
import Link from "next/link";
import { FileSpreadsheet, Mail } from "lucide-react";
import { LocationMap } from "@/components/LocationMap";

export default function CompanySettingsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const role = (session?.user?.role ?? "EMPLOYEE") as Role;
  const allowed = canManageCompanySettings(role);

  const { data, isLoading } = trpc.companySettings.get.useQuery(undefined, {
    enabled: allowed,
  });
  const utils = trpc.useUtils();

  const [officeName, setOfficeName] = useState("");
  const [officeLat, setOfficeLat] = useState("");
  const [officeLng, setOfficeLng] = useState("");
  const [geofenceRadiusM, setGeofenceRadiusM] = useState("200");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (status === "authenticated" && !allowed) {
      router.replace("/admin-portal/dashboard");
    }
  }, [status, allowed, router]);

  useEffect(() => {
    if (data) {
      setOfficeName(data.officeName);
      setOfficeLat(String(data.officeLat));
      setOfficeLng(String(data.officeLng));
      setGeofenceRadiusM(String(data.geofenceRadiusM));
    }
  }, [data]);

  const update = trpc.companySettings.update.useMutation({
    onSuccess: () => {
      setSuccess("Company settings saved.");
      setError("");
      utils.companySettings.get.invalidate();
    },
    onError: (err) => {
      setError(err.message);
      setSuccess("");
    },
  });

  async function useMyLocation() {
    setError("");
    try {
      const pos = await getCurrentPosition();
      setOfficeLat(String(pos.coords.latitude));
      setOfficeLng(String(pos.coords.longitude));
    } catch (err) {
      setError(geolocationErrorMessage(err));
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    update.mutate({
      officeName: officeName.trim(),
      officeLat: parseFloat(officeLat),
      officeLng: parseFloat(officeLng),
      geofenceRadiusM: parseInt(geofenceRadiusM, 10),
    });
  }

  if (status === "loading" || !allowed || isLoading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 overflow-hidden">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
          <span>Realty Smartz Private Limited</span>
          <span>·</span>
          <span className="text-[#FF7A70] font-bold">System Configuration</span>
        </div>
        <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900">
          Company Settings
        </h1>
        <p className="mt-0.5 text-xs sm:text-sm text-neutral-500">
          Office location and geofence radius for attendance check-ins
        </p>
      </div>

      <Card className="rounded-2xl border border-neutral-200/80 bg-white/95 backdrop-blur-md shadow-2xs overflow-hidden">
        <CardHeader className="p-5 sm:p-6 pb-2">
          <CardTitle className="font-display text-lg font-bold text-neutral-900">
            Office Geofence & Boundary
          </CardTitle>
          <CardDescription className="text-xs text-neutral-500">
            Staff within this radius are authorized to log attendance check-ins
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 sm:p-6 pt-3 space-y-5">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-neutral-700">Office Name</Label>
              <Input
                value={officeName}
                onChange={(e) => setOfficeName(e.target.value)}
                placeholder="e.g. Realty Smartz Private Limited HQ"
                required
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-neutral-700">Latitude</Label>
                <Input
                  type="number"
                  step="any"
                  value={officeLat}
                  onChange={(e) => setOfficeLat(e.target.value)}
                  placeholder="28.4595"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-neutral-700">Longitude</Label>
                <Input
                  type="number"
                  step="any"
                  value={officeLng}
                  onChange={(e) => setOfficeLng(e.target.value)}
                  placeholder="77.0266"
                  required
                />
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={useMyLocation}
              className="rounded-xl border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Use My Current GPS Location
            </Button>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-neutral-700">Geofence Radius (meters)</Label>
              <Input
                type="number"
                min={50}
                max={5000}
                value={geofenceRadiusM}
                onChange={(e) => setGeofenceRadiusM(e.target.value)}
                required
              />
            </div>

            <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 p-3.5 text-xs text-amber-900">
              <p className="font-bold flex items-center gap-1.5">
                <span>Weekly Off: Tuesday</span>
              </p>
              <p className="mt-1 text-amber-800/80 leading-relaxed">
                Saturday and Sunday are standard working days for Realty Smartz Private Limited. Leave and attendance
                tracking calendars skip Tuesday only.
              </p>
            </div>

            {error && (
              <p className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-medium text-rose-600">
                {error}
              </p>
            )}
            {success && (
              <p className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-medium text-emerald-600">
                {success}
              </p>
            )}

            <button
              type="submit"
              disabled={update.isLoading}
              className="w-full flex items-center justify-center rounded-xl bg-gradient-to-r from-[#FF7A70] to-[#FFA07A] py-2.5 px-4 text-sm font-bold text-white shadow-[0_4px_16px_rgba(255,122,112,0.3)] hover:opacity-95 active:scale-98 transition-all disabled:opacity-50"
            >
              {update.isLoading ? "Saving Settings..." : "Save Company Settings"}
            </button>
          </form>

          {officeLat && officeLng && !Number.isNaN(parseFloat(officeLat)) && (
            <div className="mt-4 rounded-xl overflow-hidden border border-neutral-200 shadow-2xs">
              <LocationMap
                lat={parseFloat(officeLat)}
                lng={parseFloat(officeLng)}
                label={officeName || "Office"}
                height={220}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Google Sheets Daily Sync Integration Card */}
      <Card className="rounded-2xl border-neutral-200/80 shadow-sm bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border">
        <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-bold text-neutral-900 text-sm">
                Google Sheets Daily Report Sync
              </h4>
              <p className="text-xs text-neutral-500 mt-0.5">
                Automatically generate a new date tab daily in your Google Sheet with full employee attendance and hours.
              </p>
            </div>
          </div>
          <Link href="/admin-portal/settings/google-sheets" className="shrink-0">
            <Button size="sm" className="bg-[#181C26] hover:bg-neutral-800 text-white font-bold text-xs gap-1.5 w-full sm:w-auto">
              View Sync Status →
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Email Notification Service Card */}
      <Card className="rounded-2xl border-neutral-200/80 shadow-sm bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent border">
        <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Mail className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-bold text-neutral-900 text-sm">
                Email Notification Service
              </h4>
              <p className="text-xs text-neutral-500 mt-0.5">
                Verify mail deliverability, check service status, and test automated punch and welcome notifications.
              </p>
            </div>
          </div>
          <Link href="/admin-portal/settings/email" className="shrink-0">
            <Button size="sm" className="bg-[#181C26] hover:bg-neutral-800 text-white font-bold text-xs gap-1.5 w-full sm:w-auto">
              View Email Service →
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

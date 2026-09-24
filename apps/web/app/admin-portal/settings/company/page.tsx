"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import {
  geolocationErrorMessage,
  getCurrentPosition,
} from "@/lib/geolocation";
import { canManageCompanySettings } from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";
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
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Company Settings</h1>
        <p className="text-muted-foreground">
          Office location and geofence radius for attendance check-ins
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Office geofence</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Office name</Label>
              <Input
                value={officeName}
                onChange={(e) => setOfficeName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Latitude</Label>
                <Input
                  type="number"
                  step="any"
                  value={officeLat}
                  onChange={(e) => setOfficeLat(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Longitude</Label>
                <Input
                  type="number"
                  step="any"
                  value={officeLng}
                  onChange={(e) => setOfficeLng(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button type="button" variant="outline" onClick={useMyLocation}>
              Use my current location
            </Button>
            <div className="space-y-2">
              <Label>Geofence radius (meters)</Label>
              <Input
                type="number"
                min={50}
                max={5000}
                value={geofenceRadiusM}
                onChange={(e) => setGeofenceRadiusM(e.target.value)}
                required
              />
            </div>
            <div className="rounded-lg border border-teal-100 bg-teal-50/60 px-3 py-2 text-caption text-teal-900">
              <p className="font-semibold">Weekly off: Tuesday</p>
              <p className="mt-0.5 text-teal-800/80">
                Saturday and Sunday are working days. Leave and attendance
                calendars skip Tuesday only.
              </p>
            </div>
            {error && <p className="text-sm text-brand-maroon">{error}</p>}
            {success && <p className="text-sm text-brand-success">{success}</p>}
            <Button type="submit" disabled={update.isLoading}>
              {update.isLoading ? "Saving..." : "Save settings"}
            </Button>
          </form>
          {officeLat && officeLng && !Number.isNaN(parseFloat(officeLat)) && (
            <div className="mt-4">
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
    </div>
  );
}

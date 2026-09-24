"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { MapPin, LogIn, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  geolocationErrorMessage,
  getCurrentPosition,
  reverseGeocodePlace,
  type GeoPlace,
} from "@/lib/geolocation";
import { LocationMap } from "@/components/LocationMap";

export function CheckInOutCard() {
  const { data: session } = useSession();
  const utils = trpc.useUtils();
  const { data: today, isLoading } = trpc.attendance.today.useQuery();
  const { data: settings } = trpc.companySettings.get.useQuery();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [captured, setCaptured] = useState<GeoPlace | null>(null);

  const checkIn = trpc.attendance.checkIn.useMutation({
    onSuccess: () => {
      utils.attendance.today.invalidate();
      utils.attendance.myMonth.invalidate();
    },
  });
  const checkOut = trpc.attendance.checkOut.useMutation({
    onSuccess: () => {
      utils.attendance.today.invalidate();
      utils.attendance.myMonth.invalidate();
    },
  });

  async function captureAndSubmit(mode: "in" | "out") {
    setError("");
    setBusy(true);
    try {
      const pos = await getCurrentPosition();
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const place = await reverseGeocodePlace(lat, lng);
      setCaptured(place);

      // Store "Place name — full address" so history shows a readable name
      const addressLabel = `${place.name} — ${place.address}`;

      if (mode === "in") {
        await checkIn.mutateAsync({ lat, lng, address: addressLabel });
      } else {
        await checkOut.mutateAsync({ lat, lng, address: addressLabel });
      }
    } catch (err) {
      setError(geolocationErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return (
      <p className="text-caption text-neutral-500">Loading attendance...</p>
    );
  }

  const checkedIn = Boolean(today?.checkInTime);
  const checkedOut = Boolean(today?.checkOutTime);
  const employeeName = session?.user?.name ?? "Employee";

  return (
    <Card className="border-teal-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-heading-md">
          <MapPin className="h-4 w-4 text-teal-600" />
          Today&apos;s Attendance
        </CardTitle>
        <p className="text-caption text-neutral-500">
          Checking in as <span className="font-semibold text-neutral-800">{employeeName}</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {settings && (
          <p className="text-caption text-neutral-500">
            Office: {settings.officeName} · Geofence {settings.geofenceRadiusM}m
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {today ? (
            <>
              <Badge variant="secondary">{today.status.replace("_", " ")}</Badge>
              {today.checkInTime && (
                <Badge variant={today.withinGeofence ? "success" : "warning"}>
                  {today.withinGeofence ? "Within geofence" : "Outside geofence"}
                </Badge>
              )}
            </>
          ) : (
            <Badge variant="outline">Not checked in</Badge>
          )}
        </div>

        {captured && (
          <div className="space-y-3">
            <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-3 text-sm">
              <p className="font-semibold text-teal-900">{captured.name}</p>
              <p className="mt-0.5 text-caption text-neutral-600">
                {captured.address}
              </p>
              <p className="mt-1 text-caption text-neutral-500">
                Exact coords: {captured.lat.toFixed(6)}, {captured.lng.toFixed(6)}
              </p>
            </div>
            <LocationMap
              lat={captured.lat}
              lng={captured.lng}
              label={`${captured.name} — ${captured.address}`}
              height={180}
            />
          </div>
        )}

        {today?.checkInTime && (
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-caption font-semibold text-neutral-500">
                Check-in
              </p>
              <p>{new Date(today.checkInTime).toLocaleTimeString()}</p>
              {today.checkInAddress && (
                <p className="text-caption text-neutral-600">
                  {today.checkInAddress}
                </p>
              )}
            </div>
            {today.checkInLat != null && today.checkInLng != null && (
              <LocationMap
                lat={today.checkInLat}
                lng={today.checkInLng}
                label={today.checkInAddress}
                height={180}
              />
            )}
            {today.checkOutTime && (
              <div className="space-y-2">
                <div>
                  <p className="text-caption font-semibold text-neutral-500">
                    Check-out
                  </p>
                  <p>
                    {new Date(today.checkOutTime).toLocaleTimeString()}
                    {today.totalHours != null ? ` · ${today.totalHours}h` : ""}
                  </p>
                  {today.checkOutAddress && (
                    <p className="text-caption text-neutral-600">
                      {today.checkOutAddress}
                    </p>
                  )}
                </div>
                {today.checkOutLat != null && today.checkOutLng != null && (
                  <LocationMap
                    lat={today.checkOutLat}
                    lng={today.checkOutLng}
                    label={today.checkOutAddress}
                    height={160}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {!checkedIn && (
          <Button
            className="w-full gap-2 sm:w-auto"
            disabled={busy}
            onClick={() => captureAndSubmit("in")}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            {busy ? "Getting your location..." : "Check In"}
          </Button>
        )}

        {checkedIn && !checkedOut && (
          <Button
            className="w-full gap-2 sm:w-auto"
            variant="secondary"
            disabled={busy}
            onClick={() => captureAndSubmit("out")}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            {busy ? "Getting your location..." : "Check Out"}
          </Button>
        )}

        {checkedOut && (
          <p className="text-sm text-success">
            You have completed attendance for today.
          </p>
        )}

        {error && (
          <p className="text-sm text-maroon-600" role="alert">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

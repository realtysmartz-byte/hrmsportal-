"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, MapPin, XCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  geolocationErrorMessage,
  getCurrentPosition,
  reverseGeocodePlace,
} from "@/lib/geolocation";

export default function LocationPingPage() {
  const [state, setState] = useState<"working" | "done" | "error">("working");
  const [message, setMessage] = useState("Updating your location…");
  const ping = trpc.attendance.locationPing.useMutation();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      try {
        const pos = await getCurrentPosition();
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        const place = await reverseGeocodePlace(lat, lng);
        await ping.mutateAsync({
          lat,
          lng,
          address: place.address,
          accuracyM: accuracy,
          capturedAt: new Date(pos.timestamp),
        });
        setState("done");
        setMessage("Location updated");
        setTimeout(() => window.close(), 1200);
      } catch (err) {
        setState("error");
        setMessage(geolocationErrorMessage(err));
      }
    })();
  }, [ping]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white p-6 text-center">
      {state === "working" && <Loader2 className="h-10 w-10 animate-spin text-[#5D3EBC]" />}
      {state === "done" && <CheckCircle2 className="h-10 w-10 text-emerald-600" />}
      {state === "error" && <XCircle className="h-10 w-10 text-rose-600" />}
      <p className="flex items-center gap-1.5 text-sm font-semibold text-neutral-800">
        <MapPin className="h-4 w-4" />
        {message}
      </p>
      {state === "done" && (
        <p className="text-xs text-neutral-500">You can close this screen.</p>
      )}
    </div>
  );
}

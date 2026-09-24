"use client";

import { ExternalLink, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

type LocationMapProps = {
  lat?: number | null;
  lng?: number | null;
  label?: string | null;
  className?: string;
  height?: number;
};

function mapsQuery(lat: number, lng: number, label?: string | null) {
  if (label?.trim()) {
    return encodeURIComponent(`${label} @${lat},${lng}`);
  }
  return `${lat},${lng}`;
}

/** Google Maps preview: static image (with API key) or embed iframe. */
export function LocationMap({
  lat,
  lng,
  label,
  className,
  height = 200,
}: LocationMapProps) {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const openUrl = `https://www.google.com/maps?q=${lat},${lng}&z=16`;
  const embedUrl = `https://www.google.com/maps?q=${mapsQuery(lat, lng, label)}&z=16&output=embed`;
  const staticUrl = apiKey
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=16&size=640x320&scale=2&maptype=roadmap&markers=color:0x0f5c74%7C${lat},${lng}&key=${apiKey}`
    : null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-neutral-100 bg-white px-3 py-2">
        <p className="flex items-center gap-1.5 text-caption font-semibold text-neutral-700">
          <MapPin className="h-3.5 w-3.5 text-teal-700" />
          Google Maps
        </p>
        <a
          href={openUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:underline"
        >
          Open in Maps
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {staticUrl ? (
        <a href={openUrl} target="_blank" rel="noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={staticUrl}
            alt={label || `Map at ${lat.toFixed(5)}, ${lng.toFixed(5)}`}
            className="w-full object-cover"
            style={{ height }}
          />
        </a>
      ) : (
        <iframe
          title={label || "Location map"}
          src={embedUrl}
          className="w-full border-0"
          style={{ height }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      )}

      <div className="space-y-0.5 bg-white px-3 py-2">
        {label && (
          <p className="line-clamp-2 text-caption text-neutral-700">{label}</p>
        )}
        <p className="text-[11px] text-neutral-500">
          {lat.toFixed(6)}, {lng.toFixed(6)}
        </p>
      </div>
    </div>
  );
}

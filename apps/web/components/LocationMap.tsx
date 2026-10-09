"use client";

import { useState } from "react";
import { ExternalLink, MapPin, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

type LocationMapProps = {
  lat?: number | null;
  lng?: number | null;
  label?: string | null;
  className?: string;
  height?: number | string;
  showCard?: boolean;
  showHeader?: boolean;
  showFooter?: boolean;
  interactive?: boolean;
};

/**
 * Robust LocationMap component:
 * - Uses exact GPS coordinates for iframe embed (preventing search string lookup failures)
 * - Supports Google Maps and OpenStreetMap view toggle
 * - Clean responsive layout without broken overflow or nested card borders
 */
export function LocationMap({
  lat,
  lng,
  label,
  className,
  height = 220,
  showCard = true,
  showHeader = true,
  showFooter = true,
  interactive = true,
}: LocationMapProps) {
  const [mapProvider, setMapProvider] = useState<"google" | "osm">("google");

  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl bg-neutral-100 text-xs text-neutral-400 border border-neutral-200",
          className
        )}
        style={{ height }}
      >
        <span>No GPS coordinates available</span>
      </div>
    );
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const openUrl = `https://www.google.com/maps?q=${lat},${lng}&z=17`;

  // Exact coordinates pin for Google Maps embed (never pass unparsed strings)
  const googleEmbedUrl = `https://maps.google.com/maps?q=${lat},${lng}&hl=en&z=16&output=embed`;

  // OpenStreetMap embed for crystal-clear satellite/mapnik rendering
  const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.006}%2C${lat - 0.004}%2C${lng + 0.006}%2C${lat + 0.004}&layer=mapnik&marker=${lat}%2C${lng}`;

  const staticUrl = apiKey
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=16&size=640x320&scale=2&maptype=roadmap&markers=color:0x0f5c74%7C${lat},${lng}&key=${apiKey}`
    : null;

  const currentEmbedUrl = mapProvider === "google" ? googleEmbedUrl : osmEmbedUrl;

  const mapContent = (
    <div className="relative w-full overflow-hidden bg-neutral-100" style={{ height }}>
      {staticUrl ? (
        <a href={openUrl} target="_blank" rel="noreferrer" className="block w-full h-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={staticUrl}
            alt={label || `Map at ${lat.toFixed(5)}, ${lng.toFixed(5)}`}
            className="w-full h-full object-cover"
          />
        </a>
      ) : (
        <iframe
          title={label || `Location map (${lat}, ${lng})`}
          src={currentEmbedUrl}
          className={cn("w-full h-full border-0", !interactive && "pointer-events-none")}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      )}

      {/* Layer Switcher Pill */}
      <button
        type="button"
        onClick={() => setMapProvider((prev) => (prev === "google" ? "osm" : "google"))}
        className="absolute bottom-2 right-2 z-10 flex items-center gap-1 rounded-md bg-white/95 px-2 py-1 text-[10px] font-bold text-neutral-700 shadow-sm border border-neutral-200 hover:bg-neutral-50 transition-colors"
        title="Toggle Map Provider"
      >
        <Layers className="h-3 w-3 text-neutral-500" />
        <span>{mapProvider === "google" ? "Google" : "OSM"}</span>
      </button>
    </div>
  );

  if (!showCard) {
    return (
      <div className={cn("overflow-hidden rounded-xl", className)}>
        {mapContent}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-neutral-200/90 bg-neutral-50 shadow-2xs",
        className
      )}
    >
      {showHeader && (
        <div className="flex items-center justify-between gap-2 border-b border-neutral-100 bg-white px-3 py-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700">
            <MapPin className="h-3.5 w-3.5 text-[#FF7A70]" />
            <span>Map Location</span>
          </p>
          <a
            href={openUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#FF7A70] hover:underline"
          >
            <span>Open in Google Maps</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {mapContent}

      {showFooter && (
        <div className="space-y-0.5 bg-white px-3 py-2 border-t border-neutral-100">
          {label && (
            <p className="line-clamp-2 text-xs font-medium text-neutral-800">{label}</p>
          )}
          <p className="text-[10px] font-mono text-neutral-500">
            {lat.toFixed(6)}, {lng.toFixed(6)}
          </p>
        </div>
      )}
    </div>
  );
}

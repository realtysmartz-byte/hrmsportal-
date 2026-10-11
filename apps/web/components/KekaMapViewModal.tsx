"use client";

import { useState, useMemo } from "react";
import {
  X,
  MapPin,
  Clock,
  ArrowUpRight,
  ExternalLink,
  Layers,
  Check,
  RefreshCw,
  Navigation,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { formatDateIST, formatTimeIST } from "@realty-smartz/shared";

interface KekaMapViewModalProps {
  employeeId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  onClose: () => void;
}

export function KekaMapViewModal({
  employeeId,
  employeeName,
  date,
  onClose,
}: KekaMapViewModalProps) {
  const { data, isLoading, refetch, isFetching } =
    trpc.attendance.employeeDailyMapTrace.useQuery({
      employeeId,
      date: new Date(date),
    });

  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [mapProvider, setMapProvider] = useState<"google" | "osm">("google");

  const log = data?.log;
  const events = data?.events ?? [];

  // Parse check-in, check-out, and periodic location punches
  const checkInEvent = events.find((e) => e.type === "CHECK_IN");
  const checkOutEvent = events.find((e) => e.type === "CHECK_OUT");
  const locationPunches = events.filter((e) => e.type === "PING");

  // Assign letters exactly like Keka: A for Clock In, C, D, E, F... for Location Punches, B for Clock Out
  const punchItemsWithBadges = useMemo(() => {
    // Alphabet letters after C: C, D, E, F, G, H, I, J, K, L, M, N, O...
    const letters = "CDEFGHIJKLMNOPQRSTUVWXYZ";
    return locationPunches.map((item, idx) => {
      const letter = letters[idx % letters.length] ?? String(idx + 1);
      return {
        ...item,
        badgeLetter: letter,
      };
    });
  }, [locationPunches]);

  // Selected item or fallback to checkIn / first punch
  const activePoint = useMemo(() => {
    if (selectedPinId) {
      const found = events.find((e) => e.id === selectedPinId);
      if (found) return found;
    }
    return checkInEvent ?? punchItemsWithBadges[0] ?? checkOutEvent ?? null;
  }, [selectedPinId, events, checkInEvent, punchItemsWithBadges, checkOutEvent]);

  // Coordinates for map display
  const mapCenterLat = activePoint
    ? activePoint.lat
    : data?.employee.workLocationLat ?? data?.settings?.officeLat ?? 0;
  const mapCenterLng = activePoint
    ? activePoint.lng
    : data?.employee.workLocationLng ?? data?.settings?.officeLng ?? 0;

  // Header formatted date e.g. "10 OCT 2026"
  const formattedHeaderDate = useMemo(() => {
    try {
      const d = new Date(date);
      return d.toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).toUpperCase();
    } catch {
      return date;
    }
  }, [date]);

  const googleEmbedUrl = `https://maps.google.com/maps?q=${mapCenterLat},${mapCenterLng}&hl=en&z=17&output=embed`;
  const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${mapCenterLng - 0.005}%2C${mapCenterLat - 0.003}%2C${mapCenterLng + 0.005}%2C${mapCenterLat + 0.003}&layer=mapnik&marker=${mapCenterLat}%2C${mapCenterLng}`;
  const currentEmbedUrl = mapProvider === "google" ? googleEmbedUrl : osmEmbedUrl;

  const googleMapsExternalUrl = activePoint
    ? `https://www.google.com/maps?q=${activePoint.lat},${activePoint.lng}&z=17`
    : `https://www.google.com/maps?q=${mapCenterLat},${mapCenterLng}&z=17`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-1 sm:p-4 animate-in fade-in duration-150">
      <div className="relative flex flex-col w-full max-w-6xl h-[94vh] rounded-2xl bg-white shadow-2xl border border-neutral-300 overflow-hidden">
        {/* Top Header - Exact Keka Style */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-200 bg-white shrink-0">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-neutral-800 tracking-wide uppercase">
            <span>MAP VIEW</span>
            <span>-</span>
            <span>{formattedHeaderDate}</span>
            <span>-</span>
            <span className="text-neutral-900 font-extrabold">{employeeName}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refetch()}
              disabled={isFetching}
              title="Refresh GPS logs"
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin text-[#FF7A70]")} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Left Sidebar + Right Map */}
        <div className="flex flex-col md:flex-row flex-1 min-h-0 bg-white">
          {/* Left Pane (Keka Sidebar) */}
          <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-neutral-200 flex flex-col bg-white overflow-y-auto shrink-0 select-none">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-xs text-neutral-400 gap-2">
                <RefreshCw className="h-6 w-6 animate-spin text-[#FF7A70]" />
                <span>Loading location timeline...</span>
              </div>
            ) : (
              <div className="p-4 space-y-6">
                {/* 1. REMOTE CLOCK IN / CLOCK OUT */}
                <div>
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-3">
                    REMOTE CLOCK IN
                  </h3>

                  {/* Clock In Item */}
                  {checkInEvent ? (
                    <div
                      onClick={() => setSelectedPinId(checkInEvent.id)}
                      className={cn(
                        "flex items-start justify-between gap-3 p-2.5 rounded-xl border cursor-pointer transition-all mb-2",
                        activePoint?.id === checkInEvent.id
                          ? "bg-purple-50/70 border-purple-300 shadow-2xs"
                          : "bg-white border-neutral-100 hover:bg-neutral-50/80"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900">
                          <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 stroke-[3]" />
                          <span>{formatTimeIST(checkInEvent.time)}</span>
                        </div>
                        <p className="font-mono text-[11px] text-neutral-500 mt-0.5 truncate">
                          {checkInEvent.lat.toFixed(6)}, {checkInEvent.lng.toFixed(6)}
                        </p>
                        <p className="text-[10px] text-neutral-400 truncate mt-0.5">
                          {checkInEvent.address}
                        </p>
                      </div>

                      {/* Purple Pin A */}
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#5D3EBC] text-white text-[11px] font-bold shadow-2xs">
                        A
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl border border-dashed border-neutral-200 text-xs text-neutral-400 mb-2">
                      No Clock-In recorded
                    </div>
                  )}

                  {/* Clock Out / Missing */}
                  {checkOutEvent ? (
                    <div
                      onClick={() => setSelectedPinId(checkOutEvent.id)}
                      className={cn(
                        "flex items-start justify-between gap-3 p-2.5 rounded-xl border cursor-pointer transition-all",
                        activePoint?.id === checkOutEvent.id
                          ? "bg-purple-50/70 border-purple-300 shadow-2xs"
                          : "bg-white border-neutral-100 hover:bg-neutral-50/80"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900">
                          <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 stroke-[3]" />
                          <span>{formatTimeIST(checkOutEvent.time)}</span>
                        </div>
                        <p className="font-mono text-[11px] text-neutral-500 mt-0.5 truncate">
                          {checkOutEvent.lat.toFixed(6)}, {checkOutEvent.lng.toFixed(6)}
                        </p>
                        <p className="text-[10px] text-neutral-400 truncate mt-0.5">
                          {checkOutEvent.address}
                        </p>
                      </div>

                      {/* Purple Pin B */}
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#5D3EBC] text-white text-[11px] font-bold shadow-2xs">
                        B
                      </div>
                    </div>
                  ) : log?.checkInTime ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-bold text-rose-500">
                      <ArrowUpRight className="h-3.5 w-3.5 stroke-[2.5]" />
                      <span>MISSING</span>
                    </div>
                  ) : null}
                </div>

                {/* 2. LOCATION PUNCH (Every 30 mins) */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                      LOCATION PUNCH
                    </h3>
                    <span className="text-[10px] font-semibold text-neutral-400">
                      {punchItemsWithBadges.length} captures
                    </span>
                  </div>

                  {punchItemsWithBadges.length === 0 ? (
                    <div className="p-3 rounded-xl border border-neutral-100 bg-neutral-50 text-center text-xs text-neutral-400">
                      No 30-min location punches available for this date.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {punchItemsWithBadges.map((punch) => {
                        const isSelected = activePoint?.id === punch.id;
                        return (
                          <div
                            key={punch.id}
                            onClick={() => setSelectedPinId(punch.id)}
                            className={cn(
                              "flex items-start justify-between gap-3 p-2.5 rounded-xl border cursor-pointer transition-all",
                              isSelected
                                ? "bg-neutral-100 border-neutral-400 shadow-2xs ring-1 ring-neutral-400"
                                : "bg-white border-neutral-100 hover:bg-neutral-50"
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1 text-xs font-semibold text-neutral-800">
                                <span className="text-emerald-600 font-bold">↓</span>
                                <span>{formatTimeIST(punch.time)}</span>
                              </div>
                              <p className="font-mono text-[11px] text-neutral-500 mt-0.5 truncate">
                                {punch.lat.toFixed(6)}, {punch.lng.toFixed(6)}
                              </p>
                              <p className="text-[10px] text-neutral-400 truncate mt-0.5">
                                {punch.address}
                              </p>
                            </div>

                            {/* Grey Badge Letter (C, D, E, F...) matching Screenshot 1 */}
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#757575] text-white text-[11px] font-bold shadow-2xs">
                              {punch.badgeLetter}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Pane (Google Map View) */}
          <div className="flex-1 relative flex flex-col bg-neutral-100 min-h-[350px]">
            {/* Map Provider Toggle & External Link Bar */}
            <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
              <a
                href={googleMapsExternalUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 rounded-lg bg-white/95 px-2.5 py-1.5 text-xs font-bold text-neutral-800 shadow-md border border-neutral-200 hover:bg-neutral-50 transition-colors"
              >
                <span>Google Maps</span>
                <ExternalLink className="h-3 w-3 text-neutral-500" />
              </a>

              <button
                type="button"
                onClick={() => setMapProvider((p) => (p === "google" ? "osm" : "google"))}
                className="flex items-center gap-1 rounded-lg bg-white/95 px-2.5 py-1.5 text-xs font-bold text-neutral-700 shadow-md border border-neutral-200 hover:bg-neutral-50 transition-colors"
                title="Toggle satellite/map provider"
              >
                <Layers className="h-3 w-3 text-neutral-500" />
                <span>{mapProvider === "google" ? "Google View" : "OSM View"}</span>
              </button>
            </div>

            {/* Active Pin Info Overlay */}
            {activePoint && (
              <div className="absolute top-3 left-3 z-20 max-w-sm rounded-xl bg-white/95 backdrop-blur-xs p-3 text-xs shadow-md border border-neutral-200">
                <div className="flex items-center gap-1.5 font-bold text-neutral-900">
                  <MapPin className="h-3.5 w-3.5 text-[#FF7A70]" />
                  <span>
                    {activePoint.type === "CHECK_IN"
                      ? "Clock-In Point (A)"
                      : activePoint.type === "CHECK_OUT"
                      ? "Clock-Out Point (B)"
                      : "Location Punch"}
                  </span>
                  <span className="text-neutral-400">·</span>
                  <span className="text-neutral-600 font-medium">
                    {formatTimeIST(activePoint.time)}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[11px] text-neutral-500">
                  {activePoint.lat.toFixed(6)}, {activePoint.lng.toFixed(6)}
                </p>
                <p className="mt-0.5 text-[11px] text-neutral-700 font-medium break-words">
                  {activePoint.address}
                </p>
              </div>
            )}

            {/* Google Maps / OSM Embed */}
            <div className="w-full h-full min-h-[400px]">
              <iframe
                title={`Keka Map View for ${employeeName}`}
                src={currentEmbedUrl}
                className="w-full h-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

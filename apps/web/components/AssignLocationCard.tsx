"use client";

import { useState, useEffect, useRef } from "react";
import {
  MapPin,
  Search,
  Building,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Navigation,
  Sparkles,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LocationMap } from "@/components/LocationMap";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const HQ_OFFICE = {
  name: "REALTY SMARTZ PVT LTD (HQ)",
  address: "REALTY SMARTZ PVT LTD, Badshahpur, Sector 66, Gurugram, Haryana 122101",
  lat: 28.3997196,
  lng: 77.0385682,
};

interface SearchResult {
  name: string;
  displayName: string;
  lat: number;
  lng: number;
  address: string;
  tag?: string;
}

interface AssignLocationCardProps {
  employeeId: string;
  employeeName: string;
  currentLocationName: string | null;
  currentLat: number | null;
  currentLng: number | null;
  canManage: boolean;
  onUpdated?: () => void;
}

export function AssignLocationCard({
  employeeId,
  employeeName,
  currentLocationName,
  currentLat,
  currentLng,
  canManage,
  onUpdated,
}: AssignLocationCardProps) {
  const utils = trpc.useUtils();

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Form states for assignment
  const [selectedName, setSelectedName] = useState(
    currentLocationName || HQ_OFFICE.name
  );
  const [selectedLat, setSelectedLat] = useState<number | null>(
    currentLat ?? HQ_OFFICE.lat
  );
  const [selectedLng, setSelectedLng] = useState<number | null>(
    currentLng ?? HQ_OFFICE.lng
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search for places / projects
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/geocode?q=${encodeURIComponent(query.trim())}`
        );
        if (res.ok) {
          const json = (await res.json()) as { results?: SearchResult[] };
          setSuggestions(json.results || []);
          setIsOpen(true);
        }
      } catch (err) {
        console.error("Failed to fetch location suggestions", err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  // Click outside to close suggestion dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const updateMutation = trpc.employee.update.useMutation({
    onSuccess: () => {
      setSuccessMessage(
        `Work location successfully assigned to ${selectedName}! Employee can now login under 200m.`
      );
      utils.employee.profileHub.invalidate({ id: employeeId });
      utils.employee.byId.invalidate({ id: employeeId });
      onUpdated?.();
      setTimeout(() => setSuccessMessage(null), 5000);
    },
  });

  const handleSelect = (item: SearchResult) => {
    setSelectedName(item.name || item.displayName.split(",")[0]);
    setSelectedLat(item.lat);
    setSelectedLng(item.lng);
    setQuery("");
    setIsOpen(false);
  };

  const handleResetToHQ = () => {
    setSelectedName(HQ_OFFICE.name);
    setSelectedLat(HQ_OFFICE.lat);
    setSelectedLng(HQ_OFFICE.lng);
    setQuery("");
    setIsOpen(false);
  };

  const handleSave = () => {
    if (selectedLat == null || selectedLng == null) return;
    updateMutation.mutate({
      id: employeeId,
      workLocationName: selectedName,
      workLocationLat: selectedLat,
      workLocationLng: selectedLng,
    });
  };

  const activeLat = selectedLat ?? HQ_OFFICE.lat;
  const activeLng = selectedLng ?? HQ_OFFICE.lng;
  const activeName = selectedName || HQ_OFFICE.name;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 md:p-6 shadow-2xs space-y-5">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-neutral-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
              <Building className="h-4 w-4" />
            </div>
            <h3 className="font-display text-base font-bold text-neutral-900">
              Assign Work Location (200m Geofence)
            </h3>
            <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800 flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              200m Radius Enforced
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Allocate an official project/site for {employeeName}. The employee will only be permitted to check in when physically within 200 meters of this location or the HQ office.
          </p>
        </div>

        <a
          href={`https://www.google.com/maps?q=${activeLat},${activeLng}&z=17`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 self-start sm:self-center rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors"
        >
          <span>Open in Google Maps</span>
          <ExternalLink className="h-3 w-3 text-neutral-400" />
        </a>
      </div>

      {/* Success banner */}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* 2. Admin Assignment Form */}
      {canManage && (
        <div className="space-y-4 rounded-xl bg-neutral-50/70 p-4 border border-neutral-200/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-700 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#FF7A70]" />
              Search & Auto-Fetch Site Location
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetToHQ}
              className="h-7 text-xs gap-1 border-neutral-300 hover:bg-white"
            >
              <Building className="h-3 w-3 text-neutral-500" />
              <span>Reset to HQ Office (200m)</span>
            </Button>
          </div>

          {/* Search box with auto-suggest dropdown */}
          <div ref={containerRef} className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <Input
                type="text"
                placeholder="Search project or site (e.g. type 'm3m', 'm3m urbana', 'cyber city')..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => {
                  if (suggestions.length > 0) setIsOpen(true);
                }}
                className="pl-9 pr-9 bg-white text-xs sm:text-sm h-10 rounded-xl border-neutral-300 shadow-2xs"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 animate-spin" />
              )}
            </div>

            {/* Suggestions dropdown */}
            {isOpen && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-xl">
                <div className="p-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-100 bg-neutral-50/70 px-3 py-1.5">
                  Suggested Locations (Click to Auto-Fetch Coordinates)
                </div>
                <div className="divide-y divide-neutral-100">
                  {suggestions.map((item, idx) => (
                    <button
                      key={`${item.lat}-${item.lng}-${idx}`}
                      type="button"
                      onClick={() => handleSelect(item)}
                      className="w-full text-left p-3 hover:bg-neutral-50 transition-colors flex items-start gap-2.5 group"
                    >
                      <MapPin className="h-4 w-4 text-[#FF7A70] shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-neutral-900 truncate">
                            {item.name}
                          </p>
                          {item.tag && (
                            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[9px] font-semibold text-neutral-600 shrink-0">
                              {item.tag}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-500 line-clamp-1 mt-0.5">
                          {item.displayName}
                        </p>
                        <p className="font-mono text-[10px] text-neutral-400 mt-0.5">
                          {item.lat.toFixed(5)}, {item.lng.toFixed(5)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Location details form */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="sm:col-span-1 space-y-1">
              <label className="text-[11px] font-bold text-neutral-700">
                Assigned Site Name
              </label>
              <Input
                type="text"
                value={selectedName}
                onChange={(e) => setSelectedName(e.target.value)}
                placeholder="e.g. M3M Urbana"
                className="bg-white text-xs h-9 rounded-lg"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-neutral-700">
                Latitude (Lat)
              </label>
              <Input
                type="number"
                step="any"
                value={selectedLat ?? ""}
                onChange={(e) =>
                  setSelectedLat(e.target.value ? Number(e.target.value) : null)
                }
                placeholder="28.39972"
                className="bg-white text-xs font-mono h-9 rounded-lg"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-neutral-700">
                Longitude (Lng)
              </label>
              <Input
                type="number"
                step="any"
                value={selectedLng ?? ""}
                onChange={(e) =>
                  setSelectedLng(e.target.value ? Number(e.target.value) : null)
                }
                placeholder="77.03857"
                className="bg-white text-xs font-mono h-9 rounded-lg"
              />
            </div>
          </div>

          {/* Action Button */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
              <Info className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
              <span>
                Employee punch-in will be restricted to within <strong>200 meters</strong> of these coordinates.
              </span>
            </div>

            <Button
              type="button"
              onClick={handleSave}
              disabled={
                updateMutation.isLoading ||
                selectedLat == null ||
                selectedLng == null
              }
              className="gap-2 bg-[#FF7A70] hover:bg-[#FF6559] text-white font-bold text-xs h-9 px-4 rounded-xl shadow-xs shrink-0"
            >
              {updateMutation.isLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Navigation className="h-3.5 w-3.5" />
                  <span>Assign Location (200m Perimeter)</span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* 3. Interactive Map Preview of Assigned Location */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-neutral-700">
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-[#FF7A70]" />
            Assigned Site Map Preview ({activeName})
          </span>
          <span className="text-[11px] font-mono text-neutral-500">
            {activeLat.toFixed(5)}, {activeLng.toFixed(5)}
          </span>
        </div>

        <div className="rounded-xl overflow-hidden border border-neutral-200">
          <LocationMap
            lat={activeLat}
            lng={activeLng}
            label={`${activeName} (200m Geofence Perimeter)`}
            height={240}
          />
        </div>
      </div>
    </div>
  );
}

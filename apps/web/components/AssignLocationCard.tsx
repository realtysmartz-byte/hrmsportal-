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
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LocationMap } from "@/components/LocationMap";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

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
  const { data: office } = trpc.companySettings.get.useQuery(undefined, {
    enabled: canManage,
  });

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Empty name + null coords means "no assignment": employee punches in at the company office.
  const [selectedName, setSelectedName] = useState(currentLocationName ?? "");
  const [selectedLat, setSelectedLat] = useState<number | null>(currentLat);
  const [selectedLng, setSelectedLng] = useState<number | null>(currentLng);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedName(currentLocationName ?? "");
    setSelectedLat(currentLat);
    setSelectedLng(currentLng);
    setQuery("");
    setSuggestions([]);
    setErrorMessage(null);
  }, [employeeId, currentLocationName, currentLat, currentLng]);

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

  const [savedPopup, setSavedPopup] = useState<{
    locationName: string;
    lat: number;
    lng: number;
  } | null>(null);

  const updateMutation = trpc.employee.update.useMutation({
    onSuccess: async (updated) => {
      const isAssigned = updated.workLocationLat != null && updated.workLocationLng != null;
      const savedName = isAssigned
        ? updated.workLocationName || "Assigned site"
        : office?.officeName ?? "Company office";

      setSuccessMessage(
        isAssigned
          ? `Work location assigned: ${savedName}. The employee can now punch in only from this site.`
          : `Assignment cleared. The employee will punch in from the company office (${savedName}).`
      );
      setErrorMessage(null);
      if (isAssigned) {
        setSavedPopup({
          locationName: savedName,
          lat: updated.workLocationLat!,
          lng: updated.workLocationLng!,
        });
      }

      await Promise.allSettled([
        utils.employee.list.invalidate(),
        utils.attendance.livePersonnelOverview.invalidate(),
        utils.attendance.allLocationPings.invalidate(),
        utils.employee.profileHub.invalidate({ id: employeeId }),
        utils.employee.byId.invalidate({ id: employeeId }),
      ]);

      onUpdated?.();
      setTimeout(() => setSuccessMessage(null), 8000);
    },
    onError: (err) => {
      setSuccessMessage(null);
      setErrorMessage(err.message || "Failed to update work location. Please verify your connection.");
    },
  });

  const handleSelect = (item: SearchResult) => {
    setSelectedName(item.name || item.displayName.split(",")[0]);
    setSelectedLat(item.lat);
    setSelectedLng(item.lng);
    setQuery("");
    setIsOpen(false);
    setErrorMessage(null);
  };

  const handleUseCustomName = async (customName: string) => {
    const trimmed = customName.trim();
    if (!trimmed) return;
    setSelectedName(trimmed);
    setQuery("");
    setIsOpen(false);
    setErrorMessage(null);

    // Auto-fetch coordinates for custom typed site name
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`);
      if (res.ok) {
        const json = (await res.json()) as { results?: SearchResult[] };
        if (json.results && json.results.length > 0) {
          setSelectedLat(json.results[0].lat);
          setSelectedLng(json.results[0].lng);
        }
      }
    } catch (e) {
      console.error("Geocode error", e);
    }
  };

  const handleResetToOffice = () => {
    setSelectedName("");
    setSelectedLat(null);
    setSelectedLng(null);
    setQuery("");
    setIsOpen(false);
    setErrorMessage(null);
  };

  const handleSave = async () => {
    let lat = selectedLat;
    let lng = selectedLng;
    let name = selectedName;

    // If there is uncommitted text in the search input, auto-resolve it
    if (query.trim().length >= 2) {
      if (suggestions.length > 0) {
        const top = suggestions[0];
        name = top.name || top.displayName.split(",")[0];
        lat = top.lat;
        lng = top.lng;
        setSelectedName(name);
        setSelectedLat(lat);
        setSelectedLng(lng);
      } else {
        name = query.trim();
        setSelectedName(name);
        try {
          const res = await fetch(`/api/geocode?q=${encodeURIComponent(name)}`);
          if (res.ok) {
            const json = (await res.json()) as { results?: SearchResult[] };
            if (json.results && json.results.length > 0) {
              lat = json.results[0].lat;
              lng = json.results[0].lng;
              setSelectedLat(lat);
              setSelectedLng(lng);
            }
          }
        } catch {
          // keep existing coords
        }
      }
      setQuery("");
      setIsOpen(false);
    }

    const hasCoords = lat != null && lng != null;
    if (!hasCoords && name.trim()) {
      setErrorMessage("Could not find coordinates for this site. Pick a search result or enter latitude and longitude.");
      return;
    }

    updateMutation.mutate({
      id: employeeId,
      workLocationName: hasCoords ? name.trim() || null : null,
      workLocationLat: hasCoords ? lat : null,
      workLocationLng: hasCoords ? lng : null,
    });
  };

  if (!canManage) {
    return null;
  }

  const isAssigned = selectedLat != null && selectedLng != null;
  const activeLat = isAssigned ? selectedLat : office?.officeLat ?? null;
  const activeLng = isAssigned ? selectedLng : office?.officeLng ?? null;
  const activeName = isAssigned
    ? selectedName || "Assigned site"
    : `${office?.officeName ?? "Company office"} (default)`;

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
              Assign Work Location
            </h3>
            <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800 flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              Workplace Verification Active
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Allocate an official project/site for {employeeName}. The employee will only be permitted to punch in when physically present at this location. Without an assignment, the company office is used.
          </p>
        </div>

        {activeLat != null && activeLng != null && (
          <a
            href={`https://www.google.com/maps?q=${activeLat},${activeLng}&z=17`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 self-start sm:self-center rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            <span>Open in Google Maps</span>
            <ExternalLink className="h-3 w-3 text-neutral-400" />
          </a>
        )}
      </div>

      {/* Success banner */}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Error banner */}
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-800 animate-in fade-in">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 2. Admin Assignment Form */}
      {(
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
              onClick={handleResetToOffice}
              className="h-7 text-xs gap-1 border-neutral-300 hover:bg-white"
            >
              <Building className="h-3 w-3 text-neutral-500" />
              <span>Use Company Office (default)</span>
            </Button>
          </div>

          {/* Search box with auto-suggest dropdown */}
          <div ref={containerRef} className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <Input
                type="text"
                placeholder="Search ANY location worldwide (e.g. 'Times Square', 'Burj Khalifa', 'Sector 82', street, or paste Google Maps link)..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => {
                  if (suggestions.length > 0 || query.trim().length >= 2) setIsOpen(true);
                }}
                className="pl-9 pr-9 bg-white text-xs sm:text-sm h-10 rounded-xl border-neutral-300 shadow-2xs"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 animate-spin" />
              )}
            </div>

            {/* Suggestions dropdown */}
            {isOpen && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-xl">
                <div className="flex items-center justify-between p-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-100 bg-neutral-50/70 px-3 py-1.5 sticky top-0 z-10">
                  <span>Worldwide Search Results ({suggestions.length})</span>
                  <span>Click to Set Location</span>
                </div>

                {/* Option to directly use typed query as custom site name */}
                {query.trim().length >= 2 && (
                  <button
                    type="button"
                    onClick={() => handleUseCustomName(query)}
                    className="w-full text-left p-2.5 px-3 bg-teal-50/60 hover:bg-teal-50 border-b border-teal-100 transition-colors flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                      <span className="text-xs font-semibold text-teal-900">
                        Use custom site: <strong className="font-bold underline">{query.trim()}</strong>
                      </span>
                    </div>
                    <span className="text-[10px] font-bold uppercase text-teal-700 bg-white px-1.5 py-0.5 rounded border border-teal-200">
                      Set Site Name
                    </span>
                  </button>
                )}

                {suggestions.length === 0 && !isSearching ? (
                  <div className="p-4 text-center text-xs text-neutral-400">
                    No registry match found. Click "Use custom site" above to assign this name or enter coordinates below.
                  </div>
                ) : (
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
                )}
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
                {isAssigned
                  ? "Employee punch-in will be authorized only at this location."
                  : "No site selected: saving will make the employee punch in from the company office."}
              </span>
            </div>

            <Button
              type="button"
              onClick={handleSave}
              disabled={updateMutation.isLoading}
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
                  <span>Assign Location</span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* 3. Interactive Map Preview of Assigned Location */}
      {activeLat != null && activeLng != null && (
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
              label={`${activeName} (Authorized Work Location)`}
              height={240}
            />
          </div>
        </div>
      )}

      {/* Location Saved Confirmation Popup Modal */}
      {savedPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-neutral-100 text-center animate-in zoom-in-95 duration-200">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-4 ring-8 ring-emerald-50/50">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900">
              Work Location Successfully Allocated!
            </h3>
            <p className="text-xs text-neutral-500 mt-1">
              Workplace location verification is now active for this employee.
            </p>

            <div className="mt-4 rounded-2xl bg-neutral-50 p-4 border border-neutral-100 text-left space-y-2">
              <div>
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">Target Employee</span>
                <span className="text-xs font-bold text-neutral-900">{employeeName}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">Allocated Worksite</span>
                <span className="text-xs font-semibold text-neutral-800">{savedPopup.locationName}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-neutral-200/60 font-mono text-neutral-500">
                <span>GPS Coordinates</span>
                <span>{savedPopup.lat.toFixed(5)}, {savedPopup.lng.toFixed(5)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                <span>Strict Workplace Verification Active</span>
              </div>
            </div>

            <div className="mt-5 flex gap-2.5">
              <a
                href={`https://www.google.com/maps?q=${savedPopup.lat},${savedPopup.lng}&z=17`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-1.5 h-11 rounded-xl border border-neutral-200 bg-white text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                <span>Verify in Maps</span>
                <ExternalLink className="h-3.5 w-3.5 text-neutral-400" />
              </a>
              <Button
                onClick={() => setSavedPopup(null)}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-[#FF7A70] to-[#FFA07A] text-white text-xs font-bold shadow-md hover:opacity-95"
              >
                Got It, Continue
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

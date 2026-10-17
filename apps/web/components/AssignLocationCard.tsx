"use client";

import { useState, useEffect, useRef } from "react";
import { MapPin, Search, Loader2, ExternalLink, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LocationMap } from "@/components/LocationMap";
import { trpc } from "@/lib/trpc";
import { isGoogleMapsLink, isUnnamedPin, reverseGeocodePlace } from "@/lib/geolocation";

interface SearchResult {
  name: string;
  displayName: string;
  lat: number;
  lng: number;
  address: string;
  tag?: string;
}

type SiteSlot = { name: string; lat: number | null; lng: number | null };

interface AssignLocationCardProps {
  employeeId: string;
  employeeName: string;
  currentLocationName: string | null;
  currentLat: number | null;
  currentLng: number | null;
  /** Up to 3 sites from assignedLocations JSON */
  currentSites?: { name: string; lat: number; lng: number }[] | null;
  canManage: boolean;
  onUpdated?: () => void;
}

const LINK_ERROR =
  "Couldn't read a location from this link. Open the place in Google Maps and copy the link again.";

const EMPTY_SLOT: SiteSlot = { name: "", lat: null, lng: null };

function sitesFromProps(
  currentSites: AssignLocationCardProps["currentSites"],
  name: string | null,
  lat: number | null,
  lng: number | null
): SiteSlot[] {
  if (currentSites && currentSites.length > 0) {
    return currentSites.slice(0, 3).map((s) => ({
      name: s.name,
      lat: s.lat,
      lng: s.lng,
    }));
  }
  if (lat != null && lng != null) {
    return [{ name: name || "Assigned site", lat, lng }];
  }
  return [{ ...EMPTY_SLOT }];
}

async function fetchPlaces(q: string): Promise<SearchResult[]> {
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  const json = (await res.json()) as { results?: SearchResult[] };
  return json.results ?? [];
}

async function nameForResult(item: SearchResult): Promise<string> {
  if (!isUnnamedPin(item.name)) return item.name || item.displayName.split(",")[0];
  return (await reverseGeocodePlace(item.lat, item.lng)).name;
}

export function AssignLocationCard({
  employeeId,
  employeeName,
  currentLocationName,
  currentLat,
  currentLng,
  currentSites,
  canManage,
  onUpdated,
}: AssignLocationCardProps) {
  const utils = trpc.useUtils();
  const { data: office } = trpc.companySettings.get.useQuery(undefined, {
    enabled: canManage,
  });

  const [slots, setSlots] = useState<SiteSlot[]>(() =>
    sitesFromProps(currentSites, currentLocationName, currentLat, currentLng)
  );
  const [activeSlot, setActiveSlot] = useState(0);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(
    null
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSlots(sitesFromProps(currentSites, currentLocationName, currentLat, currentLng));
    setQuery("");
    setSuggestions([]);
    setMessage(null);
    setActiveSlot(0);
  }, [employeeId, currentLocationName, currentLat, currentLng, currentSites]);

  function select(item: SearchResult, itemName: string) {
    setSlots((prev) => {
      const next = [...prev];
      next[activeSlot] = { name: itemName, lat: item.lat, lng: item.lng };
      return next;
    });
    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
    setMessage(null);
  }

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await fetchPlaces(q);
        if (isGoogleMapsLink(q)) {
          if (results[0]) select(results[0], await nameForResult(results[0]));
          else setMessage({ type: "error", text: LINK_ERROR });
          return;
        }
        setSuggestions(results);
        setIsOpen(true);
      } catch {
        setMessage({ type: "error", text: "Search failed. Please try again." });
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const updateMutation = trpc.employee.update.useMutation({
    onSuccess: async (updated) => {
      const n = Array.isArray(updated.assignedLocations)
        ? updated.assignedLocations.length
        : updated.workLocationLat != null
          ? 1
          : 0;
      setMessage({
        type: "ok",
        text:
          n > 0
            ? `Saved. ${employeeName} can punch at office + ${n} assigned site(s) (200m each).`
            : `Saved. ${employeeName} punches at company office only.`,
      });
      await Promise.allSettled([
        utils.employee.list.invalidate(),
        utils.attendance.livePersonnelOverview.invalidate(),
        utils.employee.profileHub.invalidate({ id: employeeId }),
        utils.employee.byId.invalidate({ id: employeeId }),
      ]);
      onUpdated?.();
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  function handleSave() {
    const sites = slots
      .filter((s) => s.lat != null && s.lng != null)
      .map((s) => ({
        name: s.name.trim() || "Assigned site",
        lat: s.lat as number,
        lng: s.lng as number,
      }))
      .slice(0, 3);

    updateMutation.mutate({
      id: employeeId,
      assignedLocations: sites,
    });
  }

  function clearAll() {
    setSlots([{ ...EMPTY_SLOT }]);
    setActiveSlot(0);
    setQuery("");
    setMessage(null);
  }

  function addSlot() {
    if (slots.length >= 3) return;
    setSlots((prev) => [...prev, { ...EMPTY_SLOT }]);
    setActiveSlot(slots.length);
  }

  function removeSlot(index: number) {
    setSlots((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length ? next : [{ ...EMPTY_SLOT }];
    });
    setActiveSlot(0);
  }

  if (!canManage) return null;

  const filled = slots.filter((s) => s.lat != null && s.lng != null);
  const preview = filled[activeSlot] ?? filled[0] ?? null;
  const previewLat = preview?.lat ?? office?.officeLat ?? null;
  const previewLng = preview?.lng ?? office?.officeLng ?? null;
  const previewName =
    preview?.name ||
    (filled.length ? "Assigned site" : office?.officeName ?? "Company office");

  return (
    <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-neutral-900">Work locations</h3>
          <p className="mt-0.5 text-sm text-neutral-500">
            Assign up to 3 sites. Office is always allowed (200m). Assigned sites also allow punch
            within 200m.
          </p>
        </div>
        {filled.length > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={clearAll}>
            Clear — office only
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {slots.map((slot, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActiveSlot(i)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
              activeSlot === i
                ? "border-[#5D3EBC] bg-[#F3F0FC] text-[#5D3EBC]"
                : "border-neutral-200 text-neutral-600"
            }`}
          >
            Site {i + 1}
            {slot.lat != null ? " ✓" : ""}
            {slots.length > 1 && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  removeSlot(i);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.stopPropagation();
                    removeSlot(i);
                  }
                }}
                className="ml-1 text-neutral-400 hover:text-rose-600"
              >
                <Trash2 className="h-3 w-3" />
              </span>
            )}
          </button>
        ))}
        {slots.length < 3 && (
          <Button type="button" variant="outline" size="sm" onClick={addSlot} className="gap-1">
            <Plus className="h-3.5 w-3.5" />
            Add site
          </Button>
        )}
      </div>

      <div ref={containerRef} className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <Input
          type="text"
          placeholder={`Search place for Site ${activeSlot + 1} or paste Google Maps link`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          className="h-10 pl-9 pr-9"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-neutral-400" />
        )}

        {isOpen && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-xl border border-neutral-200 bg-white">
            {suggestions.map((item, idx) => (
              <button
                key={`${item.lat}-${item.lng}-${idx}`}
                type="button"
                onClick={async () => select(item, await nameForResult(item))}
                className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-neutral-50"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-900">{item.name}</p>
                  <p className="truncate text-xs text-neutral-500">{item.displayName}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-600">
            Site {activeSlot + 1} name
          </label>
          <Input
            value={slots[activeSlot]?.name ?? ""}
            onChange={(e) =>
              setSlots((prev) => {
                const next = [...prev];
                next[activeSlot] = { ...next[activeSlot], name: e.target.value };
                return next;
              })
            }
            placeholder="e.g. M3M Urbana"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-600">Latitude</label>
          <Input
            type="number"
            step="any"
            value={slots[activeSlot]?.lat ?? ""}
            onChange={(e) =>
              setSlots((prev) => {
                const next = [...prev];
                next[activeSlot] = {
                  ...next[activeSlot],
                  lat: e.target.value ? Number(e.target.value) : null,
                };
                return next;
              })
            }
            className="tabular-nums"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-600">Longitude</label>
          <Input
            type="number"
            step="any"
            value={slots[activeSlot]?.lng ?? ""}
            onChange={(e) =>
              setSlots((prev) => {
                const next = [...prev];
                next[activeSlot] = {
                  ...next[activeSlot],
                  lng: e.target.value ? Number(e.target.value) : null,
                };
                return next;
              })
            }
            className="tabular-nums"
          />
        </div>
      </div>

      {message && (
        <p
          className={
            message.type === "ok"
              ? "rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
              : "rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"
          }
        >
          {message.text}
        </p>
      )}

      <div className="flex items-center justify-end">
        <Button
          type="button"
          onClick={handleSave}
          disabled={updateMutation.isLoading}
          className="bg-[#5D3EBC] text-white hover:bg-[#FF6559]"
        >
          {updateMutation.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save locations
        </Button>
      </div>

      {previewLat != null && previewLng != null && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-neutral-700">{previewName}</span>
            <a
              href={`https://www.google.com/maps?q=${previewLat},${previewLng}&z=17`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800"
            >
              Open in Maps
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <LocationMap
            lat={previewLat}
            lng={previewLng}
            label={previewName}
            height={220}
            showCard={false}
            className="border border-neutral-200"
          />
        </div>
      )}
    </div>
  );
}

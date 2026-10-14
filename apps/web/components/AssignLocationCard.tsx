"use client";

import { useState, useEffect, useRef } from "react";
import { MapPin, Search, Loader2, ExternalLink } from "lucide-react";
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

interface AssignLocationCardProps {
  employeeId: string;
  employeeName: string;
  currentLocationName: string | null;
  currentLat: number | null;
  currentLng: number | null;
  canManage: boolean;
  onUpdated?: () => void;
}

const LINK_ERROR =
  "Couldn't read a location from this link. Open the place in Google Maps and copy the link again.";

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
  const [name, setName] = useState(currentLocationName ?? "");
  const [lat, setLat] = useState<number | null>(currentLat);
  const [lng, setLng] = useState<number | null>(currentLng);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setName(currentLocationName ?? "");
    setLat(currentLat);
    setLng(currentLng);
    setQuery("");
    setSuggestions([]);
    setMessage(null);
  }, [employeeId, currentLocationName, currentLat, currentLng]);

  function select(item: SearchResult, itemName: string) {
    setName(itemName);
    setLat(item.lat);
    setLng(item.lng);
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
      const assigned = updated.workLocationLat != null && updated.workLocationLng != null;
      setMessage({
        type: "ok",
        text: assigned
          ? `Saved. ${employeeName} can punch in only at ${updated.workLocationName || "this site"}.`
          : `Saved. ${employeeName} will punch in at the company office.`,
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

  async function handleSave() {
    let saveName = name.trim();
    let saveLat = lat;
    let saveLng = lng;

    // Resolve text still sitting in the search box
    const q = query.trim();
    if (q.length >= 2) {
      const results = suggestions.length > 0 ? suggestions : await fetchPlaces(q);
      const top = results[0];
      if (!top) {
        setMessage({ type: "error", text: isGoogleMapsLink(q) ? LINK_ERROR : "No place found for this search." });
        return;
      }
      saveName = await nameForResult(top);
      saveLat = top.lat;
      saveLng = top.lng;
      select(top, saveName);
    }

    const hasSite = saveLat != null && saveLng != null;
    if (!hasSite && (saveLat != null || saveLng != null || saveName)) {
      setMessage({ type: "error", text: "Pick a place from search or enter both latitude and longitude." });
      return;
    }

    updateMutation.mutate({
      id: employeeId,
      workLocationName: hasSite ? saveName || null : null,
      workLocationLat: hasSite ? saveLat : null,
      workLocationLng: hasSite ? saveLng : null,
    });
  }

  function clearToOffice() {
    setName("");
    setLat(null);
    setLng(null);
    setQuery("");
    setMessage(null);
  }

  if (!canManage) {
    return null;
  }

  const isAssigned = lat != null && lng != null;
  const previewLat = isAssigned ? lat : office?.officeLat ?? null;
  const previewLng = isAssigned ? lng : office?.officeLng ?? null;
  const previewName = isAssigned ? name || "Assigned site" : office?.officeName ?? "Company office";

  return (
    <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-neutral-900">Work location</h3>
          <p className="mt-0.5 text-sm text-neutral-500">
            {isAssigned
              ? `Punch-in allowed only at ${previewName}.`
              : `No site assigned. Punch-in at ${previewName}.`}
          </p>
        </div>
        {isAssigned && (
          <Button type="button" variant="outline" size="sm" onClick={clearToOffice}>
            Use company office
          </Button>
        )}
      </div>

      <div ref={containerRef} className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <Input
          type="text"
          placeholder="Search a place or paste a Google Maps link"
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
          <label className="text-xs font-medium text-neutral-600">Site name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. M3M Urbana" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-600">Latitude</label>
          <Input
            type="number"
            step="any"
            value={lat ?? ""}
            onChange={(e) => setLat(e.target.value ? Number(e.target.value) : null)}
            className="tabular-nums"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-600">Longitude</label>
          <Input
            type="number"
            step="any"
            value={lng ?? ""}
            onChange={(e) => setLng(e.target.value ? Number(e.target.value) : null)}
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
          Save
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

"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
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
  Users,
  Compass,
  ArrowRight,
  Filter,
  Check,
  RotateCcw,
  AlertCircle,
  Edit3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LocationMap } from "@/components/LocationMap";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

// Official Registered Office of Realty Smartz Private Limited
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

export default function AllocateLocationsPage() {
  const { data: session } = useSession();
  const utils = trpc.useUtils();

  // 1. Fetch all active employees
  const { data: employeesData, isLoading: isLoadingEmployees, refetch } = trpc.employee.list.useQuery({
    pageSize: 100,
    status: "ACTIVE",
  });

  const employees = useMemo(() => employeesData?.items ?? [], [employeesData]);

  // Selected employee for allocation studio
  const [selectedEmpId, setSelectedEmpId] = useState<string>("");
  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === selectedEmpId) ?? null,
    [employees, selectedEmpId]
  );

  // Auto-select first employee once loaded if none selected
  useEffect(() => {
    if (!selectedEmpId && employees.length > 0) {
      setSelectedEmpId(employees[0].id);
    }
  }, [employees, selectedEmpId]);

  // Search input and geocode results
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Target coordinates and site name
  const [targetName, setTargetName] = useState(HQ_OFFICE.name);
  const [targetLat, setTargetLat] = useState<number>(HQ_OFFICE.lat);
  const [targetLng, setTargetLng] = useState<number>(HQ_OFFICE.lng);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync target values when selected employee changes
  useEffect(() => {
    if (selectedEmployee) {
      if (selectedEmployee.workLocationLat && selectedEmployee.workLocationLng) {
        setTargetName(selectedEmployee.workLocationName || "Assigned Project Site");
        setTargetLat(selectedEmployee.workLocationLat);
        setTargetLng(selectedEmployee.workLocationLng);
      } else {
        setTargetName(HQ_OFFICE.name);
        setTargetLat(HQ_OFFICE.lat);
        setTargetLng(HQ_OFFICE.lng);
      }
      setQuery("");
      setSuggestions([]);
      setSuccessMsg(null);
      setErrorMsg(null);
    }
  }, [selectedEmployee]);

  // Debounced search for places / projects or direct coordinates
  const searchContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const json = (await res.json()) as { results?: SearchResult[] };
          setSuggestions(json.results ?? []);
          setIsOpen(true);
        }
      } catch (err) {
        console.error("Geocode error", err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update employee location mutation
  const updateLocation = trpc.employee.update.useMutation({
    onSuccess: async (_, variables) => {
      await utils.employee.list.invalidate();
      await utils.attendance.livePersonnelOverview.invalidate();
      const emp = employees.find((e) => e.id === variables.id);
      const updatedName = emp ? `${emp.firstName} ${emp.lastName}` : "Employee";
      setErrorMsg(null);
      setSuccessMsg(`✓ Location successfully allocated for ${updatedName}! 200-meter geofence active.`);
      setTimeout(() => setSuccessMsg(null), 6000);
    },
    onError: (err) => {
      setSuccessMsg(null);
      setErrorMsg(err.message || "Failed to save location. Please verify your permissions and input values.");
    },
  });

  const handleApplyLocation = async () => {
    if (!selectedEmpId) {
      setErrorMsg("Please select an employee first.");
      return;
    }

    const lat = Number(targetLat);
    const lng = Number(targetLng);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      setErrorMsg("Invalid Latitude. Must be between -90 and 90.");
      return;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      setErrorMsg("Invalid Longitude. Must be between -180 and 180.");
      return;
    }

    // Ensure name never exceeds schema max (200 characters)
    const cleanName = (targetName.trim() || HQ_OFFICE.name).slice(0, 180);

    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await updateLocation.mutateAsync({
        id: selectedEmpId,
        workLocationName: cleanName,
        workLocationLat: lat,
        workLocationLng: lng,
      });
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setErrorMsg(errObj.message || "Failed to update employee location.");
    }
  };

  const handleSetHQ = () => {
    setTargetName(HQ_OFFICE.name);
    setTargetLat(HQ_OFFICE.lat);
    setTargetLng(HQ_OFFICE.lng);
    setQuery("");
    setIsOpen(false);
    setErrorMsg(null);
  };

  const handleSelectSuggestion = (place: SearchResult) => {
    // Truncate cleanly so it never causes validation overflow
    const safeName = (place.displayName || place.name).slice(0, 180);
    setTargetName(safeName);
    setTargetLat(place.lat);
    setTargetLng(place.lng);
    setQuery("");
    setIsOpen(false);
    setErrorMsg(null);
  };

  // Table filters
  const [tableSearch, setTableSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "hq" | "site">("all");

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
      const code = (emp.employeeCode || "").toLowerCase();
      const dept = (emp.department?.name || "").toLowerCase();
      const loc = (emp.workLocationName || "").toLowerCase();
      const matchesSearch =
        fullName.includes(tableSearch.toLowerCase()) ||
        code.includes(tableSearch.toLowerCase()) ||
        dept.includes(tableSearch.toLowerCase()) ||
        loc.includes(tableSearch.toLowerCase());

      if (!matchesSearch) return false;

      const hasCustomSite = Boolean(emp.workLocationLat && emp.workLocationLng);
      const isHQ = !hasCustomSite || (emp.workLocationName && emp.workLocationName.includes("HQ"));

      if (filterType === "hq") return isHQ;
      if (filterType === "site") return hasCustomSite && !isHQ;
      return true;
    });
  }, [employees, tableSearch, filterType]);

  // Metrics
  const totalCount = employees.length;
  const projectSiteCount = employees.filter(
    (e) => e.workLocationLat && e.workLocationLng && !e.workLocationName?.includes("HQ")
  ).length;
  const hqCount = totalCount - projectSiteCount;

  const studioRef = useRef<HTMLDivElement>(null);

  const handleEditForEmployee = (empId: string) => {
    setSelectedEmpId(empId);
    studioRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-tr from-[#FF7A70] to-[#FFA07A] text-white shadow-2xs">
              <Navigation className="h-3.5 w-3.5" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#FF7A70]">
              REALTY SMARTZ PVT LTD · Workplace Geofencing
            </span>
          </div>
          <h1 className="font-display text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-neutral-900">
            Allocate Work Locations
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
            Dynamically allocate project sites (M3M projects, DLF tech hubs) or HQ office. Employees can punch in only within 200m.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="gap-2 rounded-xl text-xs h-9 font-medium"
          >
            <RefreshCw className="h-3.5 w-3.5 text-neutral-500" />
            <span>Refresh Roster</span>
          </Button>
        </div>
      </div>

      {/* 2. KPI Metrics Bento */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <Card className="p-3.5 sm:p-4 border-neutral-200/80 bg-white shadow-2xs rounded-2xl flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <Users className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Total Workforce</p>
            <p className="text-lg sm:text-2xl font-extrabold text-neutral-900 leading-tight">{totalCount}</p>
            <p className="text-[10px] text-neutral-500 truncate">Active staff</p>
          </div>
        </Card>

        <Card className="p-3.5 sm:p-4 border-neutral-200/80 bg-white shadow-2xs rounded-2xl flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Building className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Company HQ</p>
            <p className="text-lg sm:text-2xl font-extrabold text-neutral-900 leading-tight">{hqCount}</p>
            <p className="text-[10px] text-neutral-500 truncate">Realty Smartz HQ</p>
          </div>
        </Card>

        <Card className="p-3.5 sm:p-4 border-neutral-200/80 bg-white shadow-2xs rounded-2xl flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Compass className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Project Sites</p>
            <p className="text-lg sm:text-2xl font-extrabold text-neutral-900 leading-tight">{projectSiteCount}</p>
            <p className="text-[10px] text-neutral-500 truncate">M3M & Field Sites</p>
          </div>
        </Card>

        <Card className="p-3.5 sm:p-4 border-neutral-200/80 bg-white shadow-2xs rounded-2xl flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <ShieldCheck className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Geofence Radius</p>
            <p className="text-lg sm:text-2xl font-extrabold text-neutral-900 leading-tight">200m</p>
            <p className="text-[10px] text-emerald-600 font-semibold truncate">Strict Verification</p>
          </div>
        </Card>
      </div>

      {/* 3. Interactive Allocation Studio Card */}
      <div ref={studioRef}>
        <Card className="border border-neutral-200/80 bg-white shadow-sm rounded-2xl sm:rounded-3xl overflow-hidden">
          {/* Card Top Title Bar */}
          <div className="border-b border-neutral-100 bg-neutral-50/70 px-4 sm:px-6 py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#11121A] text-white">
                <Compass className="h-4 w-4 text-[#FF7A70]" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-neutral-900 truncate">Interactive Allocation Studio</h2>
                <p className="text-[11px] text-neutral-500 truncate">
                  Select employee, search or paste Google Maps location, and save geofence
                </p>
              </div>
            </div>

            {selectedEmployee && (
              <div className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-full bg-white border border-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-700 shadow-2xs">
                <span className="text-[#FF7A70]">●</span>
                <span className="truncate max-w-[200px] sm:max-w-xs">
                  {selectedEmployee.firstName} {selectedEmployee.lastName} ({selectedEmployee.employeeCode})
                </span>
              </div>
            )}
          </div>

          <div className="p-4 sm:p-6 space-y-5">
            {/* Notifications / Feedback */}
            {successMsg && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-2.5 text-xs font-semibold text-emerald-800 animate-in fade-in">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="flex-1">{successMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 flex items-center gap-2.5 text-xs font-semibold text-rose-800 animate-in fade-in">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span className="flex-1">{errorMsg}</span>
              </div>
            )}

            {/* Step 1 & Step 2 Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. Target Employee Dropdown */}
              <div>
                <label className="block text-[11px] font-bold text-neutral-700 mb-1.5 uppercase tracking-wider">
                  1. Target Employee
                </label>
                <select
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-neutral-200 bg-white text-xs sm:text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#FF7A70]/30 focus:border-[#FF7A70] transition-all"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} ({emp.employeeCode}) — {emp.department?.name || "General"}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-neutral-400 mt-1">
                  Currently assigned: <strong className="text-neutral-700">{selectedEmployee?.workLocationName || HQ_OFFICE.name}</strong>
                </p>
              </div>

              {/* 2. Search Site / Project (Auto-suggest + Google Maps link parsing) */}
              <div ref={searchContainerRef} className="relative">
                <label className="block text-[11px] font-bold text-neutral-700 mb-1.5 uppercase tracking-wider">
                  2. Search Site, Sector or Paste Maps Link
                </label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <Input
                    placeholder="Search 'm3m', 'sector 65', or paste Google Maps URL / lat,lng..."
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      if (!isOpen && e.target.value.length >= 2) setIsOpen(true);
                    }}
                    onFocus={() => {
                      if (suggestions.length > 0) setIsOpen(true);
                    }}
                    className="pl-10 pr-9 h-11 rounded-xl text-xs sm:text-sm border-neutral-200 focus:border-[#FF7A70] focus:ring-[#FF7A70]/30"
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-[#FF7A70]" />
                  )}
                </div>

                {/* Auto-suggest dropdown */}
                {isOpen && suggestions.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-neutral-200 rounded-xl shadow-xl overflow-hidden max-h-80 overflow-y-auto">
                    <div className="px-3.5 py-1.5 bg-neutral-50 border-b border-neutral-100 text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center justify-between sticky top-0 z-10">
                      <span>Matching Places & Micro-Sites ({suggestions.length})</span>
                      <span>200m Perimeter</span>
                    </div>
                    {suggestions.map((item, idx) => (
                      <button
                        key={`${item.lat}-${item.lng}-${idx}`}
                        type="button"
                        onClick={() => handleSelectSuggestion(item)}
                        className="w-full text-left px-3.5 py-2.5 hover:bg-neutral-50 flex items-start gap-2.5 border-b border-neutral-100 last:border-0 transition-colors group"
                      >
                        <MapPin className="h-4 w-4 text-[#FF7A70] shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-neutral-900 truncate">
                              {item.name}
                            </p>
                            {item.tag && (
                              <Badge variant="secondary" className="text-[9px] uppercase px-1.5 py-0 shrink-0 font-medium bg-neutral-100 text-neutral-600">
                                {item.tag}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                            {item.displayName || item.address}
                          </p>
                          <p className="font-mono text-[10px] text-neutral-400 mt-0.5">
                            {item.lat.toFixed(5)}, {item.lng.toFixed(5)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Empty State when search returns 0 results */}
                {isOpen && !isSearching && query.trim().length >= 2 && suggestions.length === 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-neutral-200 rounded-xl shadow-xl p-3.5 text-center">
                    <p className="text-xs font-semibold text-neutral-700">No matching site found</p>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Tip: Paste a Google Maps URL or enter GPS coordinates (e.g. 28.3997, 77.0385) directly.
                    </p>
                  </div>
                )}

                <p className="text-[11px] text-neutral-400 mt-1 truncate">
                  Auto-fetches coordinates for M3M projects, DLF hubs, sectors, or pasted URLs.
                </p>
              </div>
            </div>

            {/* Quick Presets Horizontal Swipeable Bar */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                Quick Project Presets:
              </div>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 pt-0.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSetHQ}
                  className="h-8 text-xs rounded-xl gap-1.5 border-neutral-200 bg-white hover:bg-neutral-50 font-semibold shrink-0 shadow-2xs"
                >
                  <Building className="h-3 w-3 text-neutral-700" />
                  <span>🏢 Realty Smartz HQ</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTargetName("M3M Urbana, Sector 67, Gurugram");
                    setTargetLat(28.397521);
                    setTargetLng(77.062085);
                  }}
                  className="h-8 text-xs rounded-xl gap-1.5 border-neutral-200 bg-white hover:bg-neutral-50 font-semibold shrink-0 shadow-2xs"
                >
                  <Sparkles className="h-3 w-3 text-[#FF7A70]" />
                  <span>M3M Urbana (Sec 67)</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTargetName("M3M Golf Estate, Sector 65, Gurugram");
                    setTargetLat(28.4011436);
                    setTargetLng(77.0664133);
                  }}
                  className="h-8 text-xs rounded-xl gap-1.5 border-neutral-200 bg-white hover:bg-neutral-50 font-semibold shrink-0 shadow-2xs"
                >
                  <Sparkles className="h-3 w-3 text-[#FF7A70]" />
                  <span>M3M Golf Estate (Sec 65)</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTargetName("M3M IFC, Sector 66, Gurugram");
                    setTargetLat(28.4049117);
                    setTargetLng(77.0584264);
                  }}
                  className="h-8 text-xs rounded-xl gap-1.5 border-neutral-200 bg-white hover:bg-neutral-50 font-semibold shrink-0 shadow-2xs"
                >
                  <Sparkles className="h-3 w-3 text-[#FF7A70]" />
                  <span>M3M IFC (Sec 66)</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTargetName("M3M Broadway, Sector 71, Gurugram");
                    setTargetLat(28.392941);
                    setTargetLng(77.017832);
                  }}
                  className="h-8 text-xs rounded-xl gap-1.5 border-neutral-200 bg-white hover:bg-neutral-50 font-semibold shrink-0 shadow-2xs"
                >
                  <Sparkles className="h-3 w-3 text-[#FF7A70]" />
                  <span>M3M Broadway (Sec 71)</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTargetName("DLF Cyber City, Sector 24, Gurugram");
                    setTargetLat(28.4906);
                    setTargetLng(77.0898);
                  }}
                  className="h-8 text-xs rounded-xl gap-1.5 border-neutral-200 bg-white hover:bg-neutral-50 font-semibold shrink-0 shadow-2xs"
                >
                  <Building className="h-3 w-3 text-neutral-600" />
                  <span>DLF Cyber City</span>
                </Button>
              </div>
            </div>

            {/* Target Location Details Card (Mobile-Optimized & Structured) */}
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 sm:p-5 space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-neutral-200/60 pb-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#FF7A70] text-white px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider shrink-0">
                    <MapPin className="h-3 w-3" />
                    Target Site
                  </span>
                  <span className="text-xs font-bold text-neutral-900 truncate">
                    {targetName}
                  </span>
                </div>

                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 self-start sm:self-auto">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>200m Perimeter Enforced</span>
                </div>
              </div>

              {/* Editable Name & Coordinates Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                    Worksite Name Label
                  </label>
                  <Input
                    value={targetName}
                    onChange={(e) => setTargetName(e.target.value.slice(0, 180))}
                    placeholder="e.g. M3M Urbana Site Office"
                    className="h-9 text-xs bg-white border-neutral-200"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                    Latitude
                  </label>
                  <Input
                    type="number"
                    step="0.000001"
                    value={targetLat}
                    onChange={(e) => setTargetLat(parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 28.399719"
                    className="h-9 text-xs font-mono bg-white border-neutral-200"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                    Longitude
                  </label>
                  <Input
                    type="number"
                    step="0.000001"
                    value={targetLng}
                    onChange={(e) => setTargetLng(parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 77.038568"
                    className="h-9 text-xs font-mono bg-white border-neutral-200"
                  />
                </div>
              </div>

              {/* Action Buttons Row (Responsive Stack on Mobile, Flex on Desktop) */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <a
                  href={`https://www.google.com/maps?q=${targetLat},${targetLng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center justify-center gap-1.5 text-xs text-neutral-700 hover:text-neutral-900 border border-neutral-200 rounded-xl px-3 bg-white font-semibold shadow-2xs hover:bg-neutral-50 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-[#FF7A70]" />
                  <span>Verify in Google Maps</span>
                </a>

                <Button
                  onClick={handleApplyLocation}
                  disabled={updateLocation.isPending || !selectedEmpId}
                  className="h-10 px-5 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-[#FF7A70] to-[#FFA07A] text-white hover:opacity-95 shadow-md active:scale-98 transition-all gap-2"
                >
                  {updateLocation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving Allocation…</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 stroke-[3]" />
                      <span>Save Allocation (200m Perimeter)</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Live Interactive Map Preview with 200m note */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-neutral-700 uppercase tracking-wider">
                  Live 200m Geofence Perimeter Map
                </span>
                <span className="text-[10px] text-neutral-400 font-mono">
                  {targetLat.toFixed(5)}, {targetLng.toFixed(5)}
                </span>
              </div>
              <div className="rounded-2xl overflow-hidden border border-neutral-200 shadow-2xs">
                <LocationMap
                  lat={targetLat}
                  lng={targetLng}
                  label={`${targetName} · 200m Perimeter`}
                  height={220}
                />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* 4. Personnel Worksite Allocation Roster */}
      <Card className="border border-neutral-200/80 bg-white shadow-sm rounded-2xl sm:rounded-3xl overflow-hidden">
        <div className="border-b border-neutral-100 p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-neutral-900">Personnel Worksite Allocation Roster</h3>
            <p className="text-xs text-neutral-500">Live directory of all active employees and their currently assigned check-in zones</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Filter by Site Type */}
            <div className="flex items-center rounded-xl bg-neutral-100 p-1 border border-neutral-200/60 text-xs">
              <button
                type="button"
                onClick={() => setFilterType("all")}
                className={cn(
                  "px-3 py-1 rounded-lg font-medium transition-all",
                  filterType === "all" ? "bg-white text-neutral-900 shadow-2xs font-bold" : "text-neutral-500 hover:text-neutral-900"
                )}
              >
                All ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterType("site")}
                className={cn(
                  "px-3 py-1 rounded-lg font-medium transition-all",
                  filterType === "site" ? "bg-white text-neutral-900 shadow-2xs font-bold" : "text-neutral-500 hover:text-neutral-900"
                )}
              >
                Sites ({projectSiteCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterType("hq")}
                className={cn(
                  "px-3 py-1 rounded-lg font-medium transition-all",
                  filterType === "hq" ? "bg-white text-neutral-900 shadow-2xs font-bold" : "text-neutral-500 hover:text-neutral-900"
                )}
              >
                HQ ({hqCount})
              </button>
            </div>

            {/* Search Filter */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
              <Input
                placeholder="Search staff, code, site..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="pl-8 h-8 w-full sm:w-52 text-xs rounded-xl border-neutral-200"
              />
            </div>
          </div>
        </div>

        {/* Content: Mobile Cards + Desktop Table */}
        {isLoadingEmployees ? (
          <div className="p-12 text-center text-xs text-neutral-400">Loading workforce roster...</div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-12 text-center text-xs text-neutral-400">No employees match your search query.</div>
        ) : (
          <>
            {/* Mobile View: Cards */}
            <div className="block md:hidden divide-y divide-neutral-100">
              {filteredEmployees.map((emp) => {
                const hasCustom = Boolean(emp.workLocationLat && emp.workLocationLng);
                const isAllocatedHQ = !hasCustom || (emp.workLocationName && emp.workLocationName.includes("HQ"));
                const isCurrentSelected = emp.id === selectedEmpId;

                return (
                  <div
                    key={emp.id}
                    className={cn(
                      "p-3.5 space-y-2.5 transition-colors",
                      isCurrentSelected && "bg-[#FF7A70]/5"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#FF7A70] to-[#FFA07A] text-white text-xs font-bold">
                          {emp.firstName[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-neutral-900 truncate">
                            {emp.firstName} {emp.lastName}
                          </p>
                          <p className="text-[10px] text-neutral-400 font-mono">
                            {emp.employeeCode} · {emp.department?.name || "General"}
                          </p>
                        </div>
                      </div>

                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                        <ShieldCheck className="h-2.5 w-2.5" />
                        200m
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-700 bg-neutral-50 rounded-lg p-2 border border-neutral-150">
                      {isAllocatedHQ ? (
                        <Building className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
                      ) : (
                        <MapPin className="h-3.5 w-3.5 text-[#FF7A70] shrink-0" />
                      )}
                      <span className="truncate text-xs font-semibold text-neutral-800">
                        {emp.workLocationName || HQ_OFFICE.name}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] font-mono text-neutral-400">
                        {emp.workLocationLat != null && emp.workLocationLng != null
                          ? `${emp.workLocationLat.toFixed(4)}, ${emp.workLocationLng.toFixed(4)}`
                          : `${HQ_OFFICE.lat.toFixed(4)}, ${HQ_OFFICE.lng.toFixed(4)}`}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditForEmployee(emp.id)}
                          className="h-7 text-[11px] rounded-lg gap-1 border-neutral-200 hover:border-[#FF7A70] hover:text-[#FF7A70]"
                        >
                          <Compass className="h-3 w-3" />
                          <span>Allocate Site</span>
                        </Button>

                        {!isAllocatedHQ && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              await updateLocation.mutateAsync({
                                id: emp.id,
                                workLocationName: HQ_OFFICE.name,
                                workLocationLat: HQ_OFFICE.lat,
                                workLocationLng: HQ_OFFICE.lng,
                              });
                            }}
                            title="Reset back to Company HQ"
                            className="h-7 w-7 p-0 text-neutral-400 hover:text-neutral-700"
                          >
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-bold text-neutral-700">Employee</TableHead>
                    <TableHead className="text-xs font-bold text-neutral-700">Department</TableHead>
                    <TableHead className="text-xs font-bold text-neutral-700">Allocated Worksite</TableHead>
                    <TableHead className="text-xs font-bold text-neutral-700">Coordinates</TableHead>
                    <TableHead className="text-xs font-bold text-neutral-700">Perimeter</TableHead>
                    <TableHead className="text-right text-xs font-bold text-neutral-700">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((emp) => {
                    const hasCustom = Boolean(emp.workLocationLat && emp.workLocationLng);
                    const isAllocatedHQ = !hasCustom || (emp.workLocationName && emp.workLocationName.includes("HQ"));
                    const isCurrentSelected = emp.id === selectedEmpId;

                    return (
                      <TableRow
                        key={emp.id}
                        className={cn(
                          "hover:bg-neutral-50/70 transition-colors",
                          isCurrentSelected && "bg-[#FF7A70]/5"
                        )}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#FF7A70] to-[#FFA07A] text-white text-xs font-bold">
                              {emp.firstName[0]}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-neutral-900 leading-tight">
                                {emp.firstName} {emp.lastName}
                              </p>
                              <p className="text-[10px] text-neutral-400 font-mono">
                                {emp.employeeCode} · {emp.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge variant="secondary" className="text-[10px] font-medium">
                            {emp.department?.name || "General"}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-1.5 max-w-xs">
                            {isAllocatedHQ ? (
                              <Building className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
                            ) : (
                              <MapPin className="h-3.5 w-3.5 text-[#FF7A70] shrink-0" />
                            )}
                            <span className="text-xs font-semibold text-neutral-800 truncate">
                              {emp.workLocationName || HQ_OFFICE.name}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <span className="text-[11px] font-mono text-neutral-500">
                            {emp.workLocationLat != null && emp.workLocationLng != null
                              ? `${emp.workLocationLat.toFixed(4)}, ${emp.workLocationLng.toFixed(4)}`
                              : `${HQ_OFFICE.lat.toFixed(4)}, ${HQ_OFFICE.lng.toFixed(4)}`}
                          </span>
                        </TableCell>

                        <TableCell>
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <ShieldCheck className="h-3 w-3" />
                            200m Radius
                          </span>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditForEmployee(emp.id)}
                              className="h-7 text-xs rounded-lg gap-1 border-neutral-200 hover:border-[#FF7A70] hover:text-[#FF7A70]"
                            >
                              <Compass className="h-3 w-3" />
                              <span>Allocate Site</span>
                            </Button>

                            {!isAllocatedHQ && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={async () => {
                                  await updateLocation.mutateAsync({
                                    id: emp.id,
                                    workLocationName: HQ_OFFICE.name,
                                    workLocationLat: HQ_OFFICE.lat,
                                    workLocationLng: HQ_OFFICE.lng,
                                  });
                                }}
                                title="Reset back to Company HQ"
                                className="h-7 w-7 p-0 text-neutral-400 hover:text-neutral-700"
                              >
                                <RotateCcw className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

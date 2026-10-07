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

  // 1. Fetch all employees
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
    }
  }, [selectedEmployee]);

  // Debounced search for places / projects
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
      const updatedName = employees.find((e) => e.id === variables.id)?.firstName || "Employee";
      setSuccessMsg(`Location successfully allocated for ${updatedName}! 200m geofence active.`);
      setTimeout(() => setSuccessMsg(null), 5000);
    },
  });

  const handleApplyLocation = async () => {
    if (!selectedEmpId) return;
    await updateLocation.mutateAsync({
      id: selectedEmpId,
      workLocationName: targetName,
      workLocationLat: targetLat,
      workLocationLng: targetLng,
    });
  };

  const handleSetHQ = () => {
    setTargetName(HQ_OFFICE.name);
    setTargetLat(HQ_OFFICE.lat);
    setTargetLng(HQ_OFFICE.lng);
    setQuery("");
    setIsOpen(false);
  };

  const handleSelectSuggestion = (place: SearchResult) => {
    setTargetName(place.displayName);
    setTargetLat(place.lat);
    setTargetLng(place.lng);
    setQuery("");
    setIsOpen(false);
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
    <div className="space-y-6 max-w-7xl mx-auto px-1 sm:px-0">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-[#FF7A70] to-[#FFA07A] text-white shadow-sm">
              <Navigation className="h-4 w-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#FF7A70]">
              REALTY SMARTZ PVT LTD · Workplace Allocation Studio
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900">
            Allocate Work Locations
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
            Dynamically allocate project sites (e.g. M3M Urbana, M3M Golf Estate) or HQ office. Employees can check in only within a 200m perimeter.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4 border-neutral-200/80 bg-white shadow-2xs rounded-2xl flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Total Workforce</p>
            <p className="text-xl sm:text-2xl font-extrabold text-neutral-900">{totalCount}</p>
            <p className="text-[10px] text-neutral-500">Active roster</p>
          </div>
        </Card>

        <Card className="p-4 border-neutral-200/80 bg-white shadow-2xs rounded-2xl flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Building className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Company HQ</p>
            <p className="text-xl sm:text-2xl font-extrabold text-neutral-900">{hqCount}</p>
            <p className="text-[10px] text-neutral-500">Realty Smartz HQ</p>
          </div>
        </Card>

        <Card className="p-4 border-neutral-200/80 bg-white shadow-2xs rounded-2xl flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Project Sites</p>
            <p className="text-xl sm:text-2xl font-extrabold text-neutral-900">{projectSiteCount}</p>
            <p className="text-[10px] text-neutral-500">M3M & remote hubs</p>
          </div>
        </Card>

        <Card className="p-4 border-neutral-200/80 bg-white shadow-2xs rounded-2xl flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Geofence Radius</p>
            <p className="text-xl sm:text-2xl font-extrabold text-neutral-900">200 Meters</p>
            <p className="text-[10px] text-emerald-600 font-semibold">Strict boundary</p>
          </div>
        </Card>
      </div>

      {/* 3. Dynamic Allocation Studio Card */}
      <div ref={studioRef}>
        <Card className="border border-neutral-200/80 bg-white shadow-sm rounded-2xl overflow-hidden">
          <div className="border-b border-neutral-100 bg-gradient-to-r from-neutral-50/80 via-white to-neutral-50/80 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#11121A] text-white">
                <Compass className="h-4 w-4 text-[#FF7A70]" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-neutral-900">Interactive Allocation Studio</h2>
                <p className="text-xs text-neutral-500">Select an employee, search their designated work site, and preview on map</p>
              </div>
            </div>

            {selectedEmployee && (
              <Badge variant="outline" className="self-start sm:self-auto bg-neutral-100 text-neutral-700 text-xs px-2.5 py-1">
                Allocating for: <strong className="ml-1 text-neutral-900">{selectedEmployee.firstName} {selectedEmployee.lastName}</strong> ({selectedEmployee.employeeCode})
              </Badge>
            )}
          </div>

          <div className="p-5 sm:p-6 space-y-6">
            {/* Top Row: Employee Select & Quick Search */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Employee Selector */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1.5 uppercase tracking-wider">
                  1. Target Employee
                </label>
                <select
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-neutral-200 bg-white text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#FF7A70]/30 focus:border-[#FF7A70] transition-all"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} ({emp.employeeCode}) — {emp.department?.name || "General"}
                      {emp.workLocationName ? ` [${emp.workLocationName.slice(0, 25)}]` : " [HQ]"}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-neutral-400 mt-1">
                  Choose any staff member to view or modify their allocated workplace.
                </p>
              </div>

              {/* Dynamic Location Search with Auto-Suggest */}
              <div ref={searchContainerRef} className="relative">
                <label className="block text-xs font-bold text-neutral-700 mb-1.5 uppercase tracking-wider">
                  2. Search Site / Project (Auto-suggest)
                </label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <Input
                    placeholder="Type site name (e.g. 'm3m', 'golf estate', 'ifc')..."
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      if (!isOpen && e.target.value.length >= 2) setIsOpen(true);
                    }}
                    onFocus={() => {
                      if (suggestions.length > 0) setIsOpen(true);
                    }}
                    className="pl-10 pr-9 h-11 rounded-xl text-sm border-neutral-200 focus:border-[#FF7A70] focus:ring-[#FF7A70]/30"
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-[#FF7A70]" />
                  )}
                </div>

                {/* Auto-suggest dropdown */}
                {isOpen && suggestions.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-neutral-200 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                    <div className="px-3 py-1.5 bg-neutral-50 border-b border-neutral-100 text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center justify-between">
                      <span>Matching Project Sites</span>
                      <span>200m Geofenced</span>
                    </div>
                    {suggestions.map((item, idx) => (
                      <button
                        key={`${item.name}-${idx}`}
                        type="button"
                        onClick={() => handleSelectSuggestion(item)}
                        className="w-full text-left px-3.5 py-2.5 hover:bg-neutral-50 flex items-start gap-2.5 border-b border-neutral-100 last:border-0 transition-colors"
                      >
                        <MapPin className="h-4 w-4 text-[#FF7A70] shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-neutral-900 truncate">
                            {item.displayName}
                          </p>
                          <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                            {item.address}
                          </p>
                        </div>
                        {item.tag && (
                          <Badge variant="secondary" className="text-[9px] uppercase px-1.5 py-0 shrink-0">
                            {item.tag}
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                <p className="text-[11px] text-neutral-400 mt-1">
                  Fetches live coordinates instantly from Realty Smartz verified locations.
                </p>
              </div>
            </div>

            {/* Quick Action Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-neutral-100">
              <span className="text-xs text-neutral-500 font-semibold">Quick Presets:</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSetHQ}
                className="h-7 text-xs rounded-lg gap-1.5 border-neutral-200 bg-neutral-50 hover:bg-neutral-100 font-medium"
              >
                <Building className="h-3 w-3 text-neutral-600" />
                🏢 Realty Smartz HQ (Gurugram)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setTargetName("M3M Urbana, Sector 67, Gurugram");
                  setTargetLat(28.3975);
                  setTargetLng(77.0543);
                }}
                className="h-7 text-xs rounded-lg gap-1.5 border-neutral-200 bg-neutral-50 hover:bg-neutral-100 font-medium"
              >
                <Sparkles className="h-3 w-3 text-[#FF7A70]" />
                M3M Urbana (Sec 67)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setTargetName("M3M Golf Estate, Sector 65, Gurugram");
                  setTargetLat(28.4069);
                  setTargetLng(77.0682);
                }}
                className="h-7 text-xs rounded-lg gap-1.5 border-neutral-200 bg-neutral-50 hover:bg-neutral-100 font-medium"
              >
                <Sparkles className="h-3 w-3 text-[#FF7A70]" />
                M3M Golf Estate (Sec 65)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setTargetName("M3M IFC, Sector 66, Gurugram");
                  setTargetLat(28.3995);
                  setTargetLng(77.0425);
                }}
                className="h-7 text-xs rounded-lg gap-1.5 border-neutral-200 bg-neutral-50 hover:bg-neutral-100 font-medium"
              >
                <Sparkles className="h-3 w-3 text-[#FF7A70]" />
                M3M IFC (Sec 66)
              </Button>
            </div>

            {/* Current Target Details Banner */}
            <div className="rounded-xl border border-neutral-200/90 bg-neutral-50/70 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge className="bg-[#FF7A70] hover:bg-[#FF7A70] text-white text-[10px] uppercase font-bold tracking-wider">
                    Target Site
                  </Badge>
                  <span className="text-xs font-bold text-neutral-900 truncate">{targetName}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-neutral-500">
                  <span>Lat: <strong className="text-neutral-800">{targetLat.toFixed(5)}</strong></span>
                  <span>Lng: <strong className="text-neutral-800">{targetLng.toFixed(5)}</strong></span>
                  <span className="text-emerald-700 font-medium">✓ 200m Perimeter Allowed</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`https://www.google.com/maps?q=${targetLat},${targetLng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-900 border border-neutral-200 rounded-lg px-2.5 py-1.5 bg-white font-medium shadow-2xs"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Open in Maps</span>
                </a>

                <Button
                  onClick={handleApplyLocation}
                  disabled={updateLocation.isPending || !selectedEmpId}
                  className="gap-2 h-9 px-4 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#FF7A70] to-[#FFA07A] text-white hover:opacity-95 shadow-sm active:scale-95 transition-all"
                >
                  {updateLocation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  <span>{updateLocation.isPending ? "Allocating…" : "Save Allocation (200m)"}</span>
                </Button>
              </div>
            </div>

            {/* Success alert */}
            {successMsg && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 flex items-center gap-2.5 text-xs font-semibold text-emerald-800 animate-in fade-in">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Live Interactive Map Preview with 200m note */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                  Live 200-Meter Geofence Perimeter Preview
                </span>
                <span className="text-[11px] text-neutral-400">
                  Google Maps Satellite / Roadmap View
                </span>
              </div>
              <div className="rounded-xl overflow-hidden border border-neutral-200 shadow-2xs">
                <LocationMap
                  lat={targetLat}
                  lng={targetLng}
                  label={`${targetName} · 200m Allowed Perimeter`}
                  height={240}
                />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* 4. Live Personnel Allocation Roster Table */}
      <Card className="border border-neutral-200/80 bg-white shadow-sm rounded-2xl overflow-hidden">
        <div className="border-b border-neutral-100 p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-neutral-900">Personnel Worksite Allocation Roster</h3>
            <p className="text-xs text-neutral-500">Live directory of all active employees and their currently assigned check-in zones</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
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
                Project Sites ({projectSiteCount})
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
                className="pl-8 h-8 w-full sm:w-56 text-xs rounded-xl border-neutral-200"
              />
            </div>
          </div>
        </div>

        {/* Table Content */}
        {isLoadingEmployees ? (
          <div className="p-12 text-center text-xs text-neutral-400">Loading workforce roster...</div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-12 text-center text-xs text-neutral-400">No employees match your search query.</div>
        ) : (
          <div className="overflow-x-auto">
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
        )}
      </Card>
    </div>
  );
}

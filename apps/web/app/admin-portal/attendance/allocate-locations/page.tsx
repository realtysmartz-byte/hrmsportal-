"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building,
  Compass,
  MapPin,
  Navigation,
  RefreshCw,
  ShieldCheck,
  Users,
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
import { AssignLocationCard } from "@/components/AssignLocationCard";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

function parseSites(raw: unknown): { name: string; lat: number; lng: number }[] {
  if (!Array.isArray(raw)) return [];
  const out: { name: string; lat: number; lng: number }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const lat = Number(o.lat);
    const lng = Number(o.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    out.push({ name: String(o.name || "Assigned site"), lat, lng });
    if (out.length >= 3) break;
  }
  return out;
}

export default function AllocateLocationsPage() {
  const utils = trpc.useUtils();
  const { data: officeSettings } = trpc.companySettings.get.useQuery();
  const officeLabel = officeSettings?.officeName ?? "Company office";

  const {
    data: employeesData,
    isLoading,
    refetch,
    isFetching,
  } = trpc.employee.list.useQuery({
    pageSize: 100,
    status: "ACTIVE",
  });

  const employees = useMemo(() => employeesData?.items ?? [], [employeesData]);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "hq" | "site">("all");

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === selectedEmpId) ?? null,
    [employees, selectedEmpId]
  );

  useEffect(() => {
    if (!selectedEmpId && employees.length > 0) {
      setSelectedEmpId(employees[0].id);
    }
  }, [employees, selectedEmpId]);

  const selectedSites = useMemo(() => {
    if (!selectedEmployee) return [];
    const fromJson = parseSites(
      (selectedEmployee as { assignedLocations?: unknown }).assignedLocations
    );
    if (fromJson.length) return fromJson;
    if (selectedEmployee.workLocationLat != null && selectedEmployee.workLocationLng != null) {
      return [
        {
          name: selectedEmployee.workLocationName || "Assigned site",
          lat: selectedEmployee.workLocationLat,
          lng: selectedEmployee.workLocationLng,
        },
      ];
    }
    return [];
  }, [selectedEmployee]);

  const filteredEmployees = useMemo(() => {
    const q = tableSearch.toLowerCase().trim();
    return employees.filter((emp) => {
      const sites = parseSites((emp as { assignedLocations?: unknown }).assignedLocations);
      const hasSite =
        sites.length > 0 ||
        (emp.workLocationLat != null && emp.workLocationLng != null);
      const hay = `${emp.firstName} ${emp.lastName} ${emp.employeeCode} ${emp.department?.name ?? ""} ${emp.workLocationName ?? ""}`.toLowerCase();
      if (q && !hay.includes(q)) return false;
      if (filterType === "hq") return !hasSite;
      if (filterType === "site") return hasSite;
      return true;
    });
  }, [employees, tableSearch, filterType]);

  const totalCount = employees.length;
  const projectSiteCount = employees.filter((e) => {
    const sites = parseSites((e as { assignedLocations?: unknown }).assignedLocations);
    return (
      sites.length > 0 || (e.workLocationLat != null && e.workLocationLng != null)
    );
  }).length;
  const hqCount = totalCount - projectSiteCount;

  async function refreshAll() {
    await Promise.allSettled([
      refetch(),
      utils.attendance.livePersonnelOverview.invalidate(),
    ]);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#5D3EBC]">
            Workplace geofencing
          </p>
          <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
            Allocate Work Locations
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Assign up to 3 sites per employee. Office is always allowed (200m).
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refreshAll()}
          disabled={isFetching}
          className="h-9 gap-2 rounded-lg text-xs"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Workforce", value: totalCount, sub: "Active", icon: Users, tone: "bg-teal-50 text-teal-700" },
          { label: "Office only", value: hqCount, sub: officeLabel, icon: Building, tone: "bg-indigo-50 text-indigo-700" },
          { label: "With sites", value: projectSiteCount, sub: "1–3 assigned", icon: Compass, tone: "bg-amber-50 text-amber-700" },
          { label: "Verification", value: "On", sub: "200m geofence", icon: ShieldCheck, tone: "bg-emerald-50 text-emerald-700" },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="flex items-center gap-3 rounded-xl border-neutral-200/80 p-3.5">
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", kpi.tone)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                  {kpi.label}
                </p>
                <p className="text-xl font-bold text-neutral-900">{kpi.value}</p>
                <p className="truncate text-[10px] text-neutral-500">{kpi.sub}</p>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="overflow-hidden rounded-xl border-neutral-200/80">
        <div className="flex flex-col gap-3 border-b border-neutral-100 bg-neutral-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#5D3EBC] text-white">
              <Navigation className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-neutral-900">Allocation studio</h2>
              <p className="text-[11px] text-neutral-500">Pick employee → set up to 3 sites → save</p>
            </div>
          </div>
          <select
            value={selectedEmpId}
            onChange={(e) => setSelectedEmpId(e.target.value)}
            className="h-10 w-full max-w-md rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-900 outline-none focus:border-[#5D3EBC] focus:ring-2 focus:ring-[#5D3EBC]/20"
          >
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.firstName} {emp.lastName} ({emp.employeeCode})
                {emp.department?.name ? ` — ${emp.department.name}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="p-4 sm:p-5">
          {selectedEmployee ? (
            <AssignLocationCard
              employeeId={selectedEmployee.id}
              employeeName={`${selectedEmployee.firstName} ${selectedEmployee.lastName}`}
              currentLocationName={selectedEmployee.workLocationName}
              currentLat={selectedEmployee.workLocationLat}
              currentLng={selectedEmployee.workLocationLng}
              currentSites={selectedSites}
              canManage
              onUpdated={() => void refreshAll()}
              className="border-0 p-0"
            />
          ) : (
            <p className="py-10 text-center text-sm text-neutral-500">
              {isLoading ? "Loading employees…" : "Select an employee to allocate sites."}
            </p>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden rounded-xl border-neutral-200/80">
        <div className="flex flex-col gap-3 border-b border-neutral-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <h2 className="text-sm font-bold text-neutral-900">Roster</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="Search name, code, site…"
              className="h-9 w-full max-w-xs text-sm"
            />
            {(["all", "hq", "site"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilterType(f)}
                className={cn(
                  "h-8 rounded-lg px-3 text-xs font-semibold",
                  filterType === f
                    ? "bg-[#5D3EBC] text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                )}
              >
                {f === "all" ? "All" : f === "hq" ? "Office only" : "Has sites"}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-neutral-50/80">
                <TableHead className="text-xs">Employee</TableHead>
                <TableHead className="text-xs">Assigned sites</TableHead>
                <TableHead className="w-24 text-xs">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((emp) => {
                const sites = parseSites(
                  (emp as { assignedLocations?: unknown }).assignedLocations
                );
                const legacy =
                  sites.length === 0 &&
                  emp.workLocationLat != null &&
                  emp.workLocationLng != null
                    ? [{ name: emp.workLocationName || "Assigned site" }]
                    : [];
                const labels = (sites.length ? sites : legacy).map((s) => s.name);
                return (
                  <TableRow key={emp.id} className="hover:bg-neutral-50/60">
                    <TableCell>
                      <p className="text-sm font-semibold text-neutral-900">
                        {emp.firstName} {emp.lastName}
                      </p>
                      <p className="text-[11px] text-neutral-500">
                        {emp.employeeCode}
                        {emp.department?.name ? ` · ${emp.department.name}` : ""}
                      </p>
                    </TableCell>
                    <TableCell>
                      {labels.length === 0 ? (
                        <Badge variant="secondary" className="text-[11px] font-medium">
                          {officeLabel} (default)
                        </Badge>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {labels.map((name, i) => (
                            <span
                              key={`${emp.id}-${i}`}
                              className="inline-flex max-w-[180px] items-center gap-1 truncate rounded-md border border-[#5D3EBC]/20 bg-[#F3F0FC] px-2 py-0.5 text-[11px] font-medium text-[#5D3EBC]"
                              title={name}
                            >
                              <MapPin className="h-3 w-3 shrink-0" />
                              {name}
                            </span>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 text-xs"
                        onClick={() => {
                          setSelectedEmpId(emp.id);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredEmployees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-12 text-center text-sm text-neutral-500">
                    No employees match this filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

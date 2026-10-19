"use client";

import { userFacingErrorMessage } from "@/lib/user-facing-error";
import { FormEvent, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { canManageLeaveTypes } from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";

export default function LeaveTypesPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const role = (session?.user?.role ?? "EMPLOYEE") as Role;
  const allowed = canManageLeaveTypes(role);

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.leave.types.useQuery(undefined, {
    enabled: allowed,
  });

  const [name, setName] = useState("");
  const [annualQuota, setAnnualQuota] = useState("12");
  const [carryForward, setCarryForward] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "authenticated" && !allowed) {
      router.replace("/admin-portal/dashboard");
    }
  }, [status, allowed, router]);

  const createMutation = trpc.leave.createType.useMutation({
    onSuccess: () => {
      setName("");
      setAnnualQuota("12");
      setCarryForward(false);
      setRequiresApproval(true);
      setError("");
      utils.leave.types.invalidate();
    },
    onError: (err) => setError(userFacingErrorMessage(err)),
  });

  const updateMutation = trpc.leave.updateType.useMutation({
    onSuccess: () => {
      setEditingId(null);
      utils.leave.types.invalidate();
    },
    onError: (err) => setError(userFacingErrorMessage(err)),
  });

  const deleteMutation = trpc.leave.deleteType.useMutation({
    onSuccess: () => utils.leave.types.invalidate(),
    onError: (err) => setError(userFacingErrorMessage(err)),
  });

  function onCreate(e: FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      name: name.trim(),
      annualQuota: parseInt(annualQuota, 10),
      carryForwardAllowed: carryForward,
      requiresApproval,
    });
  }

  if (status === "loading" || !allowed) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* 1. TOP HEADER (Dashboards V3 Style) */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-neutral-900">
            Leave Types
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-neutral-500">
            Manage corporate leave classifications, annual quotas, and carry-forward entitlements
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200/80 bg-white p-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-4">
          Add New Leave Classification
        </h2>
        <form onSubmit={onCreate} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-neutral-700">Category Name</Label>
            <Input
              placeholder="e.g. Annual Vacation, Sick Leave, Bereavement"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-neutral-700">Annual Quota (Days)</Label>
            <Input
              type="number"
              min={0}
              value={annualQuota}
              onChange={(e) => setAnnualQuota(e.target.value)}
              required
            />
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-neutral-700 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={carryForward}
              onChange={(e) => setCarryForward(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-[#5D3EBC] accent-[#5D3EBC]"
            />
            Carry forward unused days allowed
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-neutral-700 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={requiresApproval}
              onChange={(e) => setRequiresApproval(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-[#5D3EBC] accent-[#5D3EBC]"
            />
            Requires managerial approval
          </label>
          <div className="sm:col-span-2 pt-2">
            <button
              type="submit"
              disabled={createMutation.isLoading || !name.trim()}
              className="flex items-center gap-2 rounded-xl bg-[#5D3EBC] px-5 py-2.5 text-xs font-bold text-white hover:opacity-95 active:scale-95 disabled:opacity-50 transition-all"
            >
              <Plus className="h-4 w-4" />
              {createMutation.isLoading ? "Saving..." : "Add Leave Type"}
            </button>
          </div>
        </form>
      </div>

      {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}

      <div className="rounded-lg border border-neutral-200/80 bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Quota</TableHead>
              <TableHead>Carry forward</TableHead>
              <TableHead>Approval</TableHead>
              <TableHead className="w-40">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5}>Loading...</TableCell>
              </TableRow>
            )}
            {data?.map((lt) => (
              <TableRow key={lt.id}>
                <TableCell>
                  {editingId === lt.id ? (
                    <Input
                      defaultValue={lt.name}
                      id={`name-${lt.id}`}
                      className="max-w-xs"
                    />
                  ) : (
                    lt.name
                  )}
                </TableCell>
                <TableCell>
                  {editingId === lt.id ? (
                    <Input
                      type="number"
                      defaultValue={lt.annualQuota}
                      id={`quota-${lt.id}`}
                      className="w-24"
                    />
                  ) : (
                    lt.annualQuota
                  )}
                </TableCell>
                <TableCell>{lt.carryForwardAllowed ? "Yes" : "No"}</TableCell>
                <TableCell>{lt.requiresApproval ? "Yes" : "No"}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {editingId === lt.id ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          const nameEl = document.getElementById(
                            `name-${lt.id}`
                          ) as HTMLInputElement | null;
                          const quotaEl = document.getElementById(
                            `quota-${lt.id}`
                          ) as HTMLInputElement | null;
                          updateMutation.mutate({
                            id: lt.id,
                            name: nameEl?.value.trim() || lt.name,
                            annualQuota: parseInt(
                              quotaEl?.value || String(lt.annualQuota),
                              10
                            ),
                            carryForwardAllowed: lt.carryForwardAllowed,
                            requiresApproval: lt.requiresApproval,
                          });
                        }}
                      >
                        Save
                      </Button>
                    ) : (
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => setEditingId(lt.id)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="destructive"
                      onClick={() => {
                        if (confirm(`Delete "${lt.name}"?`)) {
                          deleteMutation.mutate({ id: lt.id });
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

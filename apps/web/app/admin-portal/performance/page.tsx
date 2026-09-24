"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Plus, Target, CheckCircle2, Lock, ArrowRight, Calendar, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/utils";
import type { CycleType } from "@realty-smartz/shared";

export default function AdminPerformanceCyclesPage() {
  const utils = trpc.useUtils();
  const { data: cycles, isLoading } = trpc.performance.cycleList.useQuery();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    cycleType: "APPRAISAL" as CycleType,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10),
  });
  const [error, setError] = useState("");

  const createMutation = trpc.performance.createCycle.useMutation({
    onSuccess: () => {
      setShowCreate(false);
      setForm({
        name: "",
        cycleType: "APPRAISAL",
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
      });
      setError("");
      utils.performance.cycleList.invalidate();
    },
    onError: (err) => setError(err.message),
  });

  const activateMutation = trpc.performance.activateCycle.useMutation({
    onSuccess: () => utils.performance.cycleList.invalidate(),
  });

  const closeMutation = trpc.performance.closeCycle.useMutation({
    onSuccess: () => utils.performance.cycleList.invalidate(),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    createMutation.mutate({
      name: form.name.trim(),
      cycleType: form.cycleType,
      startDate: new Date(form.startDate),
      endDate: new Date(form.endDate),
    });
  }

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="section-gap">
      <div className="page-header">
        <div>
          <h1 className="page-title">Performance Cycles</h1>
          <p className="page-subtitle">
            Manage company appraisal &amp; OKR review cycles
          </p>
        </div>
        <Button
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          {showCreate ? "Cancel" : "New Cycle"}
        </Button>
      </div>

      {showCreate && (
        <Card className="border-teal-200 bg-teal-50/20">
          <CardHeader>
            <CardTitle className="text-heading-md">
              Create Performance Cycle
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Cycle Name</Label>
                  <Input
                    placeholder="e.g. H1 2026 Appraisal, Q1 2026 OKRs"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cycle Type</Label>
                  <Select
                    value={form.cycleType}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        cycleType: e.target.value as CycleType,
                      })
                    }
                  >
                    <option value="APPRAISAL">Appraisal (Review &amp; Rating)</option>
                    <option value="OKR">OKR (Objectives &amp; Key Results)</option>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={form.startDate}
                    onChange={(e) =>
                      setForm({ ...form, startDate: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={form.endDate}
                    onChange={(e) =>
                      setForm({ ...form, endDate: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              {error && <p className="text-sm text-maroon-600">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isLoading}>
                  {createMutation.isLoading ? "Creating..." : "Create Cycle (Draft)"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {!cycles?.length ? (
        <EmptyState
          title="No performance cycles yet"
          description="Create your first performance cycle to enable goals and reviews."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cycles.map((cycle) => {
            const isDraft = cycle.status === "DRAFT";
            const isActive = cycle.status === "ACTIVE";
            const isClosed = cycle.status === "CLOSED";

            return (
              <Card
                key={cycle.id}
                className="flex flex-col justify-between transition-colors hover:border-teal-300"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            isActive ? "success" : isDraft ? "warning" : "secondary"
                          }
                        >
                          {cycle.status}
                        </Badge>
                        <Badge variant="outline">{cycle.cycleType}</Badge>
                      </div>
                      <h2 className="mt-2 text-heading-md font-bold text-neutral-900">
                        {cycle.name}
                      </h2>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-caption text-neutral-500">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {formatDate(cycle.startDate)} – {formatDate(cycle.endDate)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <div className="flex items-center justify-between border-t border-neutral-100 pt-3 text-caption text-neutral-600">
                    <div className="flex items-center gap-1.5">
                      <Target className="h-4 w-4 text-teal-600" />
                      <span>{cycle._count.goals} Goals set</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-teal-600" />
                      <span>{cycle._count.reviews} Reviews</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3">
                    <div className="flex gap-2">
                      {isDraft && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-teal-300 text-teal-700 hover:bg-teal-50"
                          onClick={() => activateMutation.mutate({ id: cycle.id })}
                          disabled={activateMutation.isLoading}
                        >
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                          Activate
                        </Button>
                      )}
                      {isActive && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-maroon-200 text-maroon-700 hover:bg-maroon-50"
                          onClick={() => {
                            if (
                              window.confirm(
                                "Are you sure you want to close this cycle? Further edits will be locked."
                              )
                            ) {
                              closeMutation.mutate({ id: cycle.id });
                            }
                          }}
                          disabled={closeMutation.isLoading}
                        >
                          <Lock className="mr-1 h-3.5 w-3.5" />
                          Close Cycle
                        </Button>
                      )}
                    </div>
                    <Link href={`/admin-portal/performance/${cycle.id}`}>
                      <Button size="sm" className="inline-flex items-center gap-1">
                        View Details
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

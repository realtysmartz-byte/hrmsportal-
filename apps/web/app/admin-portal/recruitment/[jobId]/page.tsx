"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { PIPELINE_STAGES } from "@realty-smartz/shared";

export default function JobDetailPage() {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: job, isLoading } = trpc.recruitment.jobById.useQuery({
    id: params.jobId,
  });

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    resumeUrl: "",
    source: "DIRECT",
  });
  const [error, setError] = useState("");

  const updateJob = trpc.recruitment.updateJob.useMutation({
    onSuccess: () => utils.recruitment.jobById.invalidate({ id: params.jobId }),
  });
  const createCandidate = trpc.recruitment.createCandidate.useMutation({
    onSuccess: () => {
      setShowAdd(false);
      setForm({
        fullName: "",
        email: "",
        phone: "",
        resumeUrl: "",
        source: "DIRECT",
      });
      utils.recruitment.jobById.invalidate({ id: params.jobId });
    },
    onError: (err) => setError(err.message),
  });
  const updateStage = trpc.recruitment.updateStage.useMutation({
    onSuccess: () => utils.recruitment.jobById.invalidate({ id: params.jobId }),
  });

  const byStage = useMemo(() => {
    const map: Record<string, NonNullable<typeof job>["candidates"]> = {};
    for (const stage of PIPELINE_STAGES) map[stage] = [];
    for (const c of (job?.candidates ?? []) as any[]) {
      map[c.currentStage]?.push(c);
    }
    return map;
  }, [job]);

  function onAdd(e: FormEvent) {
    e.preventDefault();
    createCandidate.mutate({
      jobPostingId: params.jobId,
      fullName: form.fullName,
      email: form.email,
      phone: form.phone,
      resumeUrl: form.resumeUrl || null,
      source: form.source as "DIRECT" | "REFERRAL" | "JOB_BOARD" | "LINKEDIN" | "OTHER",
    });
  }

  if (isLoading || !job) {
    return <p className="text-caption text-neutral-500">Loading job...</p>;
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto overflow-hidden">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/admin-portal/recruitment"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF7A70] hover:underline mb-1"
          >
            ← Back to Openings
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900">
              {job.title}
            </h1>
            <Badge
              variant={
                job.status === "OPEN"
                  ? "success"
                  : job.status === "CLOSED"
                    ? "secondary"
                    : "warning"
              }
            >
              {job.status}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs sm:text-sm text-neutral-500">
            {job.department?.name ?? "Company-wide"} · {job.location} ·{" "}
            {job.employmentType.replace("_", " ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => setShowAdd((v) => !v)}
            className="rounded-xl shadow-[0_4px_16px_rgba(255,122,112,0.3)]"
          >
            {showAdd ? "Cancel" : "+ Add Candidate"}
          </Button>
          {job.status === "OPEN" ? (
            <Button
              variant="outline"
              className="rounded-xl text-rose-600 border-rose-200 hover:bg-rose-50"
              onClick={() => updateJob.mutate({ id: job.id, status: "CLOSED" })}
            >
              Close Job
            </Button>
          ) : (
            <Button
              variant="outline"
              className="rounded-xl text-emerald-600 border-emerald-200 hover:bg-emerald-50"
              onClick={() => updateJob.mutate({ id: job.id, status: "OPEN" })}
            >
              Reopen
            </Button>
          )}
        </div>
      </div>

      {showAdd && (
        <Card>
          <CardHeader>
            <CardTitle>Add candidate</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onAdd} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Full name</Label>
                <Input
                  value={form.fullName}
                  onChange={(e) =>
                    setForm({ ...form, fullName: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Source</Label>
                <Select
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                >
                  <option value="DIRECT">Direct</option>
                  <option value="LINKEDIN">LinkedIn</option>
                  <option value="JOB_BOARD">Job board</option>
                  <option value="OTHER">Other</option>
                </Select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Resume URL</Label>
                <Input
                  type="url"
                  value={form.resumeUrl}
                  onChange={(e) =>
                    setForm({ ...form, resumeUrl: e.target.value })
                  }
                  placeholder="https://..."
                />
              </div>
              {error && (
                <p className="text-sm text-maroon-600 sm:col-span-2">{error}</p>
              )}
              <div className="sm:col-span-2">
                <Button type="submit" disabled={createCandidate.isLoading}>
                  Save candidate
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2">
        {PIPELINE_STAGES.map((stage) => (
            <div
              key={stage}
              className="w-64 shrink-0 rounded-xl border border-neutral-200 bg-neutral-50/80"
            >
              <div className="border-b border-neutral-200 px-3 py-2">
                <p className="text-caption font-semibold text-neutral-600">
                  {stage.replace("_", " ")} ({byStage[stage]?.length ?? 0})
                </p>
              </div>
              <div className="space-y-2 p-2">
                {(byStage[stage] ?? []).map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm"
                  >
                    <Link
                      href={`/admin-portal/recruitment/${params.jobId}/candidates/${c.id}`}
                      className="font-medium text-teal-800 hover:underline"
                    >
                      {c.fullName}
                    </Link>
                    <p className="text-caption text-neutral-500">
                      {c.source}
                      {c.referredBy
                        ? ` · ref ${c.referredBy.firstName}`
                        : ""}
                    </p>
                    <Select
                      className="mt-2 h-9 text-caption"
                      value={c.currentStage}
                      onChange={(e) =>
                        updateStage.mutate({
                          id: c.id,
                          currentStage: e.target
                            .value as (typeof PIPELINE_STAGES)[number],
                        })
                      }
                    >
                      {PIPELINE_STAGES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                    {c.currentStage === "OFFER" && (
                      <Button
                        size="sm"
                        className="mt-2 w-full"
                        onClick={() =>
                          router.push(
                            `/admin-portal/employees/new?hireFrom=${c.id}&name=${encodeURIComponent(c.fullName)}&email=${encodeURIComponent(c.email)}&phone=${encodeURIComponent(c.phone)}`
                          )
                        }
                      >
                        Mark as Hired → Create employee
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

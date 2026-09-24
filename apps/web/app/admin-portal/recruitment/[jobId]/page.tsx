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
    for (const c of job?.candidates ?? []) {
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
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">{job.title}</h1>
          <p className="page-subtitle">
            {job.department?.name ?? "No department"} · {job.location} ·{" "}
            {job.employmentType.replace("_", " ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setShowAdd((v) => !v)}>
            Add candidate
          </Button>
          {job.status === "OPEN" ? (
            <Button
              variant="destructive"
              onClick={() => updateJob.mutate({ id: job.id, status: "CLOSED" })}
            >
              Close job
            </Button>
          ) : (
            <Button
              onClick={() => updateJob.mutate({ id: job.id, status: "OPEN" })}
            >
              Reopen
            </Button>
          )}
        </div>
      </div>

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

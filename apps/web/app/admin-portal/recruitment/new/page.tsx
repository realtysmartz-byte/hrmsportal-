"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

export default function NewJobPage() {
  const router = useRouter();
  const { data: departments } = trpc.department.list.useQuery();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    departmentId: "",
    description: "",
    requirements: "",
    location: "Gurugram",
    employmentType: "FULL_TIME",
  });

  const create = trpc.recruitment.createJob.useMutation({
    onSuccess: (job) => router.push(`/admin-portal/recruitment/${job.id}`),
    onError: (err) => setError(err.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate({
      title: form.title,
      departmentId: form.departmentId || null,
      description: form.description,
      requirements: form.requirements,
      location: form.location,
      employmentType: form.employmentType as
        | "FULL_TIME"
        | "PART_TIME"
        | "CONTRACT"
        | "INTERNSHIP",
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 overflow-hidden">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
          <span>Realty Smartz Private Limited</span>
          <span>·</span>
          <span className="text-[#FF7A70] font-bold">ATS & Hiring</span>
        </div>
        <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900">
          New Job Opening
        </h1>
        <p className="mt-0.5 text-xs sm:text-sm text-neutral-500">
          Publish an opening to the recruitment pipeline
        </p>
      </div>
      <Card className="rounded-2xl border border-neutral-200/80 bg-white/95 backdrop-blur-md shadow-2xs overflow-hidden">
        <CardHeader className="p-5 sm:p-6 pb-2">
          <CardTitle className="font-display text-lg font-bold text-neutral-900">Position Details</CardTitle>
        </CardHeader>
        <CardContent className="p-5 sm:p-6 pt-3">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Department</Label>
                <Select
                  value={form.departmentId}
                  onChange={(e) =>
                    setForm({ ...form, departmentId: e.target.value })
                  }
                >
                  <option value="">Select</option>
                  {departments?.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Employment type</Label>
                <Select
                  value={form.employmentType}
                  onChange={(e) =>
                    setForm({ ...form, employmentType: e.target.value })
                  }
                >
                  <option value="FULL_TIME">Full time</option>
                  <option value="PART_TIME">Part time</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="INTERNSHIP">Internship</option>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Requirements</Label>
              <Textarea
                value={form.requirements}
                onChange={(e) =>
                  setForm({ ...form, requirements: e.target.value })
                }
                required
              />
            </div>
            {error && <p className="text-sm text-maroon-600">{error}</p>}
            <Button type="submit" disabled={create.isLoading}>
              Create posting
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

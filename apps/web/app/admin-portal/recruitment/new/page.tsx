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
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">New job posting</h1>
          <p className="page-subtitle">Publish an opening to the ATS</p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
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

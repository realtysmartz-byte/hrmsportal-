"use client";

import { userFacingErrorMessage } from "@/lib/user-facing-error";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";

export default function ReferPage() {
  const { data: jobs } = trpc.recruitment.jobList.useQuery({ status: "OPEN" });
  const [form, setForm] = useState({
    jobPostingId: "",
    fullName: "",
    email: "",
    phone: "",
    resumeUrl: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const refer = trpc.recruitment.referCandidate.useMutation({
    onSuccess: () => {
      setSuccess("Referral submitted — thank you!");
      setError("");
      setForm({
        jobPostingId: "",
        fullName: "",
        email: "",
        phone: "",
        resumeUrl: "",
      });
    },
    onError: (err) => {
      setError(userFacingErrorMessage(err));
      setSuccess("");
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    refer.mutate({
      jobPostingId: form.jobPostingId,
      fullName: form.fullName,
      email: form.email,
      phone: form.phone,
      resumeUrl: form.resumeUrl || null,
    });
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="page-title">Refer a candidate</h1>
        <p className="page-subtitle">
          Recommend someone for an open role at Realty Smartz Private Limited
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Referral form</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Open job</Label>
              <Select
                value={form.jobPostingId}
                onChange={(e) =>
                  setForm({ ...form, jobPostingId: e.target.value })
                }
                required
              >
                <option value="">Select job</option>
                {jobs?.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title} · {j.location}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Candidate name</Label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Resume URL (optional)</Label>
              <Input
                type="url"
                value={form.resumeUrl}
                onChange={(e) =>
                  setForm({ ...form, resumeUrl: e.target.value })
                }
                placeholder="https://..."
              />
            </div>
            {error && <p className="text-sm text-maroon-600">{error}</p>}
            {success && <p className="text-sm text-success">{success}</p>}
            <Button type="submit" className="w-full" disabled={refer.isLoading}>
              Submit referral
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { formatDate, fullName } from "@/lib/utils";
import { PIPELINE_STAGES } from "@realty-smartz/shared";

export default function CandidateDetailPage() {
  const params = useParams<{ jobId: string; candidateId: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: c, isLoading } = trpc.recruitment.candidateById.useQuery({
    id: params.candidateId,
  });
  const { data: managers } = trpc.employee.managerOptions.useQuery();

  const [note, setNote] = useState("");
  const [roundName, setRoundName] = useState("Technical Round 1");
  const [interviewerId, setInterviewerId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [error, setError] = useState("");

  const updateStage = trpc.recruitment.updateStage.useMutation({
    onSuccess: () =>
      utils.recruitment.candidateById.invalidate({ id: params.candidateId }),
  });
  const addNote = trpc.recruitment.addNote.useMutation({
    onSuccess: () => {
      setNote("");
      utils.recruitment.candidateById.invalidate({ id: params.candidateId });
    },
  });
  const schedule = trpc.recruitment.scheduleInterview.useMutation({
    onSuccess: () => {
      setScheduledAt("");
      utils.recruitment.candidateById.invalidate({ id: params.candidateId });
    },
    onError: (err) => setError(err.message),
  });

  if (isLoading || !c) {
    return <p className="text-caption text-neutral-500">Loading...</p>;
  }

  const [firstName, ...rest] = c.fullName.split(" ");
  const lastName = rest.join(" ") || firstName;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <Link
            href={`/admin-portal/recruitment/${params.jobId}`}
            className="text-caption font-semibold text-teal-700 hover:underline"
          >
            ← Back to pipeline
          </Link>
          <h1 className="page-title mt-2">{c.fullName}</h1>
          <p className="page-subtitle">
            {c.email} · {c.phone} · {c.jobPosting.title}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            className="w-40"
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
              onClick={() =>
                router.push(
                  `/admin-portal/employees/new?hireFrom=${c.id}&firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}&email=${encodeURIComponent(c.email)}&phone=${encodeURIComponent(c.phone)}`
                )
              }
            >
              Mark as Hired
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{c.source}</Badge>
        <Badge>{c.currentStage}</Badge>
        {c.referredBy && (
          <Badge variant="info">
            Referred by {fullName(c.referredBy.firstName, c.referredBy.lastName)}
          </Badge>
        )}
        {c.resumeUrl && (
          <a
            href={c.resumeUrl}
            target="_blank"
            rel="noreferrer"
            className="text-caption font-semibold text-teal-700 hover:underline"
          >
            Open resume
          </a>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Schedule interview</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                if (!interviewerId || !scheduledAt) return;
                schedule.mutate({
                  candidateId: c.id,
                  roundName,
                  interviewerId,
                  scheduledAt: new Date(scheduledAt),
                });
              }}
            >
              <div className="space-y-1">
                <Label>Round name</Label>
                <Input
                  value={roundName}
                  onChange={(e) => setRoundName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Interviewer</Label>
                <Select
                  value={interviewerId}
                  onChange={(e) => setInterviewerId(e.target.value)}
                  required
                >
                  <option value="">Select employee</option>
                  {managers?.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.firstName} {m.lastName} ({m.employeeCode})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Date & time</Label>
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-maroon-600">{error}</p>}
              <Button type="submit" disabled={schedule.isLoading}>
                Schedule & notify
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!note.trim()) return;
                addNote.mutate({ candidateId: c.id, content: note.trim() });
              }}
            >
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note..."
              />
              <Button type="submit" size="sm">
                Add note
              </Button>
            </form>
            {c.notes.map((n) => (
              <div
                key={n.id}
                className="rounded-lg border border-neutral-200 p-3 text-sm"
              >
                <p>{n.content}</p>
                <p className="mt-1 text-caption text-neutral-500">
                  {fullName(n.author.firstName, n.author.lastName)} ·{" "}
                  {formatDate(n.createdAt)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Interview rounds</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {c.interviews.map((iv) => (
            <div
              key={iv.id}
              className="rounded-xl border border-neutral-200 p-4 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{iv.roundName}</p>
                <Badge variant="secondary">{iv.status}</Badge>
              </div>
              <p className="text-caption text-neutral-500">
                {fullName(
                  iv.interviewer.firstName,
                  iv.interviewer.lastName
                )}{" "}
                · {new Date(iv.scheduledAt).toLocaleString()}
              </p>
              {iv.feedback && (
                <p className="mt-2">
                  Feedback: {iv.feedback}
                  {iv.rating != null ? ` · Rating ${iv.rating}/5` : ""}
                </p>
              )}
            </div>
          ))}
          {!c.interviews.length && (
            <p className="text-caption text-neutral-500">No interviews yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

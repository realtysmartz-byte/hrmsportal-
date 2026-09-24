"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Star,
  Target,
  User,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { formatDate, fullName } from "@/lib/utils";
import { isManager } from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";

export default function TeamReviewsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const role = (session?.user?.role ?? "EMPLOYEE") as Role;
  const allowed = isManager(role) || role === "ADMIN" || role === "HR";

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.performance.teamReviewsForCycle.useQuery(
    {},
    { enabled: allowed }
  );

  const [expandedEmpId, setExpandedEmpId] = useState<string | null>(null);

  // Review form state
  const [reviewForms, setReviewForms] = useState<
    Record<
      string,
      {
        rating: number;
        strengths: string;
        improvements: string;
        comments: string;
      }
    >
  >({});
  const [errorMsg, setErrorMsg] = useState<Record<string, string>>({});

  useEffect(() => {
    if (status === "authenticated" && !allowed) {
      router.replace("/employee-portal/dashboard");
    }
  }, [status, allowed, router]);

  const submitManagerReview = trpc.performance.submitManagerReview.useMutation({
    onSuccess: (_, variables) => {
      setErrorMsg((prev) => ({ ...prev, [variables.employeeId]: "" }));
      utils.performance.teamReviewsForCycle.invalidate();
    },
    onError: (err, variables) => {
      setErrorMsg((prev) => ({ ...prev, [variables.employeeId]: err.message }));
    },
  });

  if (status === "loading" || !allowed) return <PageSkeleton />;
  if (isLoading) return <PageSkeleton />;

  const cycle = data?.cycle;
  const team = data?.team ?? [];

  if (!cycle) {
    return (
      <div className="section-gap">
        <div className="page-header">
          <div>
            <h1 className="page-title">Team Performance Reviews</h1>
            <p className="page-subtitle">
              Conduct appraisals and reviews for your direct reports
            </p>
          </div>
        </div>
        <EmptyState
          title="No active cycle for reviews"
          description="There is currently no active cycle open for manager evaluations."
        />
      </div>
    );
  }

  function handleFormChange(
    empId: string,
    field: "rating" | "strengths" | "improvements" | "comments",
    val: unknown
  ) {
    setReviewForms((prev) => ({
      ...prev,
      [empId]: {
        rating: prev[empId]?.rating ?? 4,
        strengths: prev[empId]?.strengths ?? "",
        improvements: prev[empId]?.improvements ?? "",
        comments: prev[empId]?.comments ?? "",
        [field]: val,
      },
    }));
  }

  return (
    <div className="section-gap">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="page-title">Team Reviews</h1>
            <Badge variant="success">Active Cycle</Badge>
          </div>
          <p className="page-subtitle flex items-center gap-1.5">
            <span>Cycle: {cycle.name}</span>
            <span>·</span>
            <Calendar className="h-4 w-4" />
            <span>
              {formatDate(cycle.startDate)} – {formatDate(cycle.endDate)}
            </span>
          </p>
        </div>
      </div>

      {!team.length ? (
        <EmptyState
          title="No direct reports found"
          description="You do not have any active direct reports assigned to you."
        />
      ) : (
        <div className="space-y-4">
          {team.map((member) => {
            const emp = member.employee;
            const isExpanded = expandedEmpId === emp.id;
            const selfSubmitted = member.selfReview?.status === "SUBMITTED";
            const mgrSubmitted = member.managerReview?.status === "SUBMITTED";

            const formState = reviewForms[emp.id] ?? {
              rating: member.managerReview?.rating ?? 4,
              strengths: member.managerReview?.strengths ?? "",
              improvements: member.managerReview?.improvements ?? "",
              comments: member.managerReview?.comments ?? "",
            };

            return (
              <Card
                key={emp.id}
                className={`transition-all ${
                  isExpanded ? "border-teal-300 shadow-elevated" : "hover:border-neutral-300"
                }`}
              >
                <CardHeader className="cursor-pointer pb-4" onClick={() => setExpandedEmpId(isExpanded ? null : emp.id)}>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-heading-md font-bold text-teal-800">
                        {emp.firstName[0]}
                        {emp.lastName[0]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-heading-md font-bold text-neutral-900">
                            {fullName(emp.firstName, emp.lastName)}
                          </h2>
                          <Badge variant="outline">{emp.employeeCode}</Badge>
                        </div>
                        <p className="text-caption text-neutral-500">
                          {emp.designation?.title ?? "—"} ·{" "}
                          {emp.department?.name ?? "—"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-right text-caption">
                        <span className="font-semibold text-neutral-700">
                          {member.goalsCount} Goals
                        </span>
                        <p className="text-neutral-500">
                          {member.averageGoalProgress}% avg progress
                        </p>
                      </div>

                      <div className="flex gap-2">
                        {selfSubmitted ? (
                          <Badge variant="success">Self-Review Done</Badge>
                        ) : (
                          <Badge variant="secondary">Self Pending</Badge>
                        )}

                        {mgrSubmitted ? (
                          <Badge variant="success">Manager Review Done</Badge>
                        ) : (
                          <Badge variant="warning">Manager Review Needed</Badge>
                        )}
                      </div>

                      <Button variant="ghost" size="icon" className="text-neutral-400">
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5" />
                        ) : (
                          <ChevronDown className="h-5 w-5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="border-t border-neutral-100 pt-6 space-y-6">
                    {/* Side-by-Side Review Section */}
                    <div className="grid gap-6 lg:grid-cols-2">
                      {/* Left Side: Self-Review (Read-Only) */}
                      <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                          <h3 className="font-semibold text-neutral-900">
                            {emp.firstName}&apos;s Self-Review
                          </h3>
                          {selfSubmitted ? (
                            <div className="flex items-center gap-1.5 text-caption font-bold text-teal-800">
                              <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                              Self-Rating: {member.selfReview?.rating} / 5
                            </div>
                          ) : (
                            <Badge variant="secondary">Not submitted yet</Badge>
                          )}
                        </div>

                        {selfSubmitted ? (
                          <div className="space-y-3 text-caption">
                            <div>
                              <p className="font-semibold text-neutral-700">
                                Self-Reported Strengths &amp; Wins:
                              </p>
                              <p className="mt-0.5 whitespace-pre-wrap text-neutral-600">
                                {member.selfReview?.strengths || "—"}
                              </p>
                            </div>

                            <div>
                              <p className="font-semibold text-neutral-700">
                                Areas for Improvement:
                              </p>
                              <p className="mt-0.5 whitespace-pre-wrap text-neutral-600">
                                {member.selfReview?.improvements || "—"}
                              </p>
                            </div>

                            {member.selfReview?.comments && (
                              <div>
                                <p className="font-semibold text-neutral-700">
                                  Additional Comments:
                                </p>
                                <p className="mt-0.5 whitespace-pre-wrap text-neutral-600">
                                  {member.selfReview.comments}
                                </p>
                              </div>
                            )}

                            <p className="text-[11px] text-neutral-400 pt-1">
                              Submitted {formatDate(member.selfReview?.submittedAt)}
                            </p>
                          </div>
                        ) : (
                          <p className="text-caption text-neutral-500 py-4 text-center">
                            The employee has not submitted their self-appraisal
                            yet. You can still submit your evaluation below.
                          </p>
                        )}
                      </div>

                      {/* Right Side: Manager Review Form */}
                      <div className="rounded-xl border border-teal-200 bg-white p-4 space-y-4">
                        <div className="flex items-center justify-between border-b border-teal-100 pb-2">
                          <h3 className="font-semibold text-teal-900">
                            Your Evaluation as Manager
                          </h3>
                          {mgrSubmitted && (
                            <Badge variant="success">Submitted</Badge>
                          )}
                        </div>

                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            submitManagerReview.mutate({
                              cycleId: cycle.id,
                              employeeId: emp.id,
                              rating: formState.rating,
                              strengths: formState.strengths.trim(),
                              improvements: formState.improvements.trim(),
                              comments: formState.comments.trim() || undefined,
                            });
                          }}
                          className="space-y-3"
                        >
                          <div className="space-y-1">
                            <Label className="text-caption">
                              Overall Rating (1 to 5 Stars)
                            </Label>
                            <div className="flex gap-1.5">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  type="button"
                                  onClick={() =>
                                    handleFormChange(emp.id, "rating", star)
                                  }
                                  className={`flex h-9 w-9 items-center justify-center rounded-lg border text-caption font-bold transition-all ${
                                    formState.rating >= star
                                      ? "border-amber-400 bg-amber-50 text-amber-700 shadow-sm"
                                      : "border-neutral-200 text-neutral-400 hover:border-neutral-300"
                                  }`}
                                >
                                  ★ {star}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-caption">
                              Observed Strengths &amp; Contributions
                            </Label>
                            <Textarea
                              placeholder="Key deliverables met, teamwork, client service, leadership..."
                              value={formState.strengths}
                              onChange={(e) =>
                                handleFormChange(emp.id, "strengths", e.target.value)
                              }
                              rows={2}
                              required
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-caption">
                              Focus Areas &amp; Performance Guidance
                            </Label>
                            <Textarea
                              placeholder="Areas where the employee should focus, technical skills, targets..."
                              value={formState.improvements}
                              onChange={(e) =>
                                handleFormChange(
                                  emp.id,
                                  "improvements",
                                  e.target.value
                                )
                              }
                              rows={2}
                              required
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-caption">
                              Manager Comments / Recommendations (optional)
                            </Label>
                            <Textarea
                              placeholder="Promotion readiness, bonuses, training needs..."
                              value={formState.comments}
                              onChange={(e) =>
                                handleFormChange(emp.id, "comments", e.target.value)
                              }
                              rows={2}
                            />
                          </div>

                          {errorMsg[emp.id] && (
                            <p className="text-caption text-maroon-600">
                              {errorMsg[emp.id]}
                            </p>
                          )}

                          <div className="flex justify-end pt-2">
                            <Button
                              type="submit"
                              size="sm"
                              disabled={submitManagerReview.isLoading}
                            >
                              {submitManagerReview.isLoading
                                ? "Saving..."
                                : mgrSubmitted
                                  ? "Update Manager Review"
                                  : "Submit Manager Review"}
                            </Button>
                          </div>
                        </form>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

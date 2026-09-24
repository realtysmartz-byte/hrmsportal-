"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  Star,
  Target,
  Trash2,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/utils";
import type { GoalCategory, GoalStatus } from "@realty-smartz/shared";

export default function EmployeePerformancePage() {
  const utils = trpc.useUtils();
  const { data: activeCycle, isLoading: cycleLoading } =
    trpc.performance.activeCycle.useQuery();

  const [activeTab, setActiveTab] = useState<"goals" | "reviews">("goals");

  // Goals state
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [goalForm, setGoalForm] = useState({
    title: "",
    description: "",
    category: "INDIVIDUAL" as GoalCategory,
    targetValue: "",
    keyResults: [{ description: "" }],
  });
  const [goalError, setGoalError] = useState("");

  // Self review state
  const [showSelfReviewForm, setShowSelfReviewForm] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    rating: 4,
    strengths: "",
    improvements: "",
    comments: "",
  });
  const [reviewError, setReviewError] = useState("");

  const cycleId = activeCycle?.id;

  const { data: goals, isLoading: goalsLoading } =
    trpc.performance.myGoals.useQuery(
      { cycleId: cycleId! },
      { enabled: !!cycleId }
    );

  const { data: reviews, isLoading: reviewsLoading } =
    trpc.performance.myReviews.useQuery(
      { cycleId: cycleId! },
      { enabled: !!cycleId }
    );

  const createGoal = trpc.performance.createGoal.useMutation({
    onSuccess: () => {
      setShowAddGoal(false);
      setGoalForm({
        title: "",
        description: "",
        category: "INDIVIDUAL",
        targetValue: "",
        keyResults: [{ description: "" }],
      });
      setGoalError("");
      utils.performance.myGoals.invalidate({ cycleId: cycleId! });
    },
    onError: (err) => setGoalError(err.message),
  });

  const updateGoal = trpc.performance.updateGoal.useMutation({
    onSuccess: () => utils.performance.myGoals.invalidate({ cycleId: cycleId! }),
  });

  const deleteGoal = trpc.performance.deleteGoal.useMutation({
    onSuccess: () => utils.performance.myGoals.invalidate({ cycleId: cycleId! }),
  });

  const updateKeyResult = trpc.performance.updateKeyResult.useMutation({
    onSuccess: () => utils.performance.myGoals.invalidate({ cycleId: cycleId! }),
  });

  const submitSelfReview = trpc.performance.submitSelfReview.useMutation({
    onSuccess: () => {
      setShowSelfReviewForm(false);
      setReviewError("");
      utils.performance.myReviews.invalidate({ cycleId: cycleId! });
    },
    onError: (err) => setReviewError(err.message),
  });

  if (cycleLoading) return <PageSkeleton />;

  if (!activeCycle) {
    return (
      <div className="section-gap">
        <div className="page-header">
          <div>
            <h1 className="page-title">Performance &amp; Goals</h1>
            <p className="page-subtitle">Track your goals and appraisal reviews</p>
          </div>
        </div>
        <EmptyState
          title="No active performance cycle"
          description="There is currently no open appraisal or OKR cycle. HR will notify you when the next cycle opens."
        />
      </div>
    );
  }

  function onAddGoalSubmit(e: FormEvent) {
    e.preventDefault();
    setGoalError("");
    const krs =
      activeCycle?.cycleType === "OKR"
        ? goalForm.keyResults
            .map((kr) => ({ description: kr.description.trim() }))
            .filter((kr) => kr.description.length > 0)
        : undefined;

    createGoal.mutate({
      cycleId: activeCycle!.id,
      title: goalForm.title.trim(),
      description: goalForm.description.trim() || undefined,
      category: goalForm.category,
      targetValue: goalForm.targetValue.trim() || undefined,
      keyResults: krs,
    });
  }

  function onSelfReviewSubmit(e: FormEvent) {
    e.preventDefault();
    setReviewError("");
    submitSelfReview.mutate({
      cycleId: activeCycle!.id,
      rating: reviewForm.rating,
      strengths: reviewForm.strengths.trim(),
      improvements: reviewForm.improvements.trim(),
      comments: reviewForm.comments.trim() || undefined,
    });
  }

  return (
    <div className="section-gap">
      {/* Active Cycle Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-teal-200 bg-white p-6 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="success">Active Cycle</Badge>
            <Badge variant="outline">{activeCycle.cycleType}</Badge>
          </div>
          <h1 className="font-display text-heading-lg text-neutral-900 mt-2">
            {activeCycle.name}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-caption text-neutral-600">
            <Calendar className="h-4 w-4 text-teal-600" />
            <span>
              {formatDate(activeCycle.startDate)} –{" "}
              {formatDate(activeCycle.endDate)}
            </span>
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex rounded-xl bg-neutral-100 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("goals")}
            className={`rounded-lg px-4 py-2 text-caption font-semibold transition-all ${
              activeTab === "goals"
                ? "bg-white text-teal-800 shadow-sm"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            My Goals ({goals?.length ?? 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("reviews")}
            className={`rounded-lg px-4 py-2 text-caption font-semibold transition-all ${
              activeTab === "reviews"
                ? "bg-white text-teal-800 shadow-sm"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            Appraisal Reviews
          </button>
        </div>
      </div>

      {/* GOALS TAB */}
      {activeTab === "goals" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-heading-md">My Cycle Objectives</h2>
            <Button
              onClick={() => setShowAddGoal((v) => !v)}
              className="inline-flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              {showAddGoal ? "Cancel" : "Add Goal"}
            </Button>
          </div>

          {/* Add Goal Form */}
          {showAddGoal && (
            <Card className="border-teal-200 bg-teal-50/20">
              <CardHeader>
                <CardTitle className="text-base">New Goal</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={onAddGoalSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Goal Title</Label>
                      <Input
                        placeholder="e.g. Expand luxury portfolio listings by 20%"
                        value={goalForm.title}
                        onChange={(e) =>
                          setGoalForm({ ...goalForm, title: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Category</Label>
                      <Select
                        value={goalForm.category}
                        onChange={(e) =>
                          setGoalForm({
                            ...goalForm,
                            category: e.target.value as GoalCategory,
                          })
                        }
                      >
                        <option value="INDIVIDUAL">Individual</option>
                        <option value="TEAM">Team</option>
                        <option value="COMPANY">Company</option>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Description / Success Criteria</Label>
                    <Textarea
                      placeholder="Details on what success looks like, key milestones..."
                      value={goalForm.description}
                      onChange={(e) =>
                        setGoalForm({
                          ...goalForm,
                          description: e.target.value,
                        })
                      }
                      rows={2}
                    />
                  </div>

                  <div className="space-y-1.5 sm:w-1/2">
                    <Label>Target Value (optional)</Label>
                    <Input
                      placeholder="e.g. 10 property transactions, 95% CSAT"
                      value={goalForm.targetValue}
                      onChange={(e) =>
                        setGoalForm({
                          ...goalForm,
                          targetValue: e.target.value,
                        })
                      }
                    />
                  </div>

                  {/* Key Results input for OKR cycles */}
                  {activeCycle.cycleType === "OKR" && (
                    <div className="space-y-2 border-t border-teal-100 pt-3">
                      <div className="flex items-center justify-between">
                        <Label>Key Results</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setGoalForm({
                              ...goalForm,
                              keyResults: [
                                ...goalForm.keyResults,
                                { description: "" },
                              ],
                            })
                          }
                        >
                          + Add Key Result
                        </Button>
                      </div>
                      {goalForm.keyResults.map((kr, idx) => (
                        <div key={idx} className="flex gap-2">
                          <Input
                            placeholder={`Key result #${idx + 1}`}
                            value={kr.description}
                            onChange={(e) => {
                              const updated = [...goalForm.keyResults];
                              updated[idx].description = e.target.value;
                              setGoalForm({ ...goalForm, keyResults: updated });
                            }}
                          />
                          {goalForm.keyResults.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setGoalForm({
                                  ...goalForm,
                                  keyResults: goalForm.keyResults.filter(
                                    (_, i) => i !== idx
                                  ),
                                });
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-maroon-600" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {goalError && (
                    <p className="text-sm text-maroon-600">{goalError}</p>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddGoal(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createGoal.isLoading}>
                      {createGoal.isLoading ? "Saving..." : "Save Goal"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Goals List */}
          {goalsLoading ? (
            <PageSkeleton />
          ) : !goals?.length ? (
            <EmptyState
              title="No goals set for this cycle"
              description="Click 'Add Goal' to set your personal or team objectives for this performance cycle."
            />
          ) : (
            <div className="space-y-4">
              {goals.map((g) => (
                <Card
                  key={g.id}
                  className="transition-colors hover:border-teal-200"
                >
                  <CardContent className="pt-5 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{g.category}</Badge>
                          <Badge
                            variant={
                              g.status === "COMPLETED"
                                ? "success"
                                : g.status === "IN_PROGRESS"
                                  ? "warning"
                                  : "secondary"
                            }
                          >
                            {g.status.replace("_", " ")}
                          </Badge>
                          {g.targetValue && (
                            <span className="text-caption font-medium text-teal-800">
                              Target: {g.targetValue}
                            </span>
                          )}
                        </div>
                        <h3 className="text-heading-md font-bold text-neutral-900">
                          {g.title}
                        </h3>
                        {g.description && (
                          <p className="text-body text-neutral-600">
                            {g.description}
                          </p>
                        )}
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-neutral-400 hover:text-maroon-600"
                        onClick={() => {
                          if (
                            window.confirm(
                              "Are you sure you want to delete this goal?"
                            )
                          ) {
                            deleteGoal.mutate({ id: g.id });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Progress Slider & Status control */}
                    <div className="space-y-2 rounded-xl bg-neutral-50 p-3">
                      <div className="flex items-center justify-between text-caption">
                        <span className="font-semibold text-neutral-700">
                          Progress: {g.progressPercent}%
                        </span>
                        <div className="flex items-center gap-2">
                          <Select
                            className="h-8 w-36 text-xs"
                            value={g.status}
                            onChange={(e) =>
                              updateGoal.mutate({
                                id: g.id,
                                status: e.target.value as GoalStatus,
                              })
                            }
                          >
                            <option value="NOT_STARTED">Not Started</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="MISSED">Missed</option>
                          </Select>
                        </div>
                      </div>

                      {/* Progress bar and slider */}
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={g.progressPercent}
                        onChange={(e) =>
                          updateGoal.mutate({
                            id: g.id,
                            progressPercent: parseInt(e.target.value, 10),
                          })
                        }
                        className="w-full accent-teal-600 cursor-pointer"
                      />
                    </div>

                    {/* Key Results list if OKR */}
                    {g.keyResults && g.keyResults.length > 0 && (
                      <div className="space-y-2 border-t border-neutral-100 pt-3">
                        <p className="text-caption font-semibold text-neutral-700">
                          Key Results:
                        </p>
                        <div className="space-y-1.5">
                          {g.keyResults.map((kr) => (
                            <div
                              key={kr.id}
                              className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-2.5 text-caption"
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={kr.completed}
                                  onChange={(e) =>
                                    updateKeyResult.mutate({
                                      id: kr.id,
                                      completed: e.target.checked,
                                      progressPercent: e.target.checked ? 100 : 0,
                                    })
                                  }
                                  className="h-4 w-4 rounded border-neutral-300 accent-teal-600"
                                />
                                <span
                                  className={
                                    kr.completed
                                      ? "line-through text-neutral-400"
                                      : "text-neutral-800"
                                  }
                                >
                                  {kr.description}
                                </span>
                              </div>
                              <span className="font-semibold text-teal-800">
                                {kr.progressPercent}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* REVIEWS TAB */}
      {activeTab === "reviews" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column: Self Review */}
          <Card className="h-fit">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-heading-md">Self Review</CardTitle>
                <p className="text-caption text-neutral-500">
                  Reflect on your achievements and areas of growth
                </p>
              </div>
              {reviews?.selfReview && (
                <Badge variant="success">Submitted</Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {reviews?.selfReview && !showSelfReviewForm ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-caption font-semibold text-neutral-700">
                      Self Rating:
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-3 py-1 text-sm font-bold text-teal-800">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                      {reviews.selfReview.rating} / 5
                    </span>
                  </div>

                  <div>
                    <p className="text-caption font-semibold text-neutral-800">
                      Key Strengths &amp; Wins:
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-body text-neutral-600">
                      {reviews.selfReview.strengths || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-caption font-semibold text-neutral-800">
                      Areas for Improvement:
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-body text-neutral-600">
                      {reviews.selfReview.improvements || "—"}
                    </p>
                  </div>

                  {reviews.selfReview.comments && (
                    <div>
                      <p className="text-caption font-semibold text-neutral-800">
                        Additional Comments:
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-body text-neutral-600">
                        {reviews.selfReview.comments}
                      </p>
                    </div>
                  )}

                  <div className="border-t border-neutral-100 pt-3 flex justify-between items-center text-caption text-neutral-500">
                    <span>
                      Submitted on {formatDate(reviews.selfReview.submittedAt)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setReviewForm({
                          rating: reviews.selfReview?.rating ?? 4,
                          strengths: reviews.selfReview?.strengths ?? "",
                          improvements: reviews.selfReview?.improvements ?? "",
                          comments: reviews.selfReview?.comments ?? "",
                        });
                        setShowSelfReviewForm(true);
                      }}
                    >
                      Edit Self Review
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={onSelfReviewSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Overall Self-Rating (1 to 5)</Label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() =>
                            setReviewForm({ ...reviewForm, rating: star })
                          }
                          className={`flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-bold transition-all ${
                            reviewForm.rating >= star
                              ? "border-amber-400 bg-amber-50 text-amber-700 shadow-sm"
                              : "border-neutral-200 text-neutral-400 hover:border-neutral-300"
                          }`}
                        >
                          ★ {star}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Key Strengths &amp; Wins This Cycle</Label>
                    <Textarea
                      placeholder="What were your biggest accomplishments, deal closings, or impactful work?"
                      value={reviewForm.strengths}
                      onChange={(e) =>
                        setReviewForm({
                          ...reviewForm,
                          strengths: e.target.value,
                        })
                      }
                      rows={3}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Areas for Improvement / Growth Opportunities</Label>
                    <Textarea
                      placeholder="Where can you improve, what skills would you like to develop?"
                      value={reviewForm.improvements}
                      onChange={(e) =>
                        setReviewForm({
                          ...reviewForm,
                          improvements: e.target.value,
                        })
                      }
                      rows={3}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Additional Comments (optional)</Label>
                    <Textarea
                      placeholder="Any feedback, team support needs, or next cycle aspirations..."
                      value={reviewForm.comments}
                      onChange={(e) =>
                        setReviewForm({
                          ...reviewForm,
                          comments: e.target.value,
                        })
                      }
                      rows={2}
                    />
                  </div>

                  {reviewError && (
                    <p className="text-sm text-maroon-600">{reviewError}</p>
                  )}

                  <div className="flex justify-end gap-2">
                    {reviews?.selfReview && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowSelfReviewForm(false)}
                      >
                        Cancel
                      </Button>
                    )}
                    <Button
                      type="submit"
                      disabled={submitSelfReview.isLoading}
                    >
                      {submitSelfReview.isLoading
                        ? "Submitting..."
                        : "Submit Self Review"}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Right Column: Manager Review */}
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-heading-md">Manager Review</CardTitle>
              <p className="text-caption text-neutral-500">
                Performance evaluation from your reporting manager
              </p>
            </CardHeader>
            <CardContent>
              {reviews?.managerReview ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-caption font-semibold text-neutral-700">
                        Manager Rating:
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-3 py-1 text-sm font-bold text-teal-800">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                        {reviews.managerReview.rating} / 5
                      </span>
                    </div>
                    <Badge variant="success">Submitted</Badge>
                  </div>

                  <div>
                    <p className="text-caption font-semibold text-neutral-800">
                      Observed Strengths:
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-body text-neutral-600">
                      {reviews.managerReview.strengths || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-caption font-semibold text-neutral-800">
                      Focus Areas &amp; Recommendations:
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-body text-neutral-600">
                      {reviews.managerReview.improvements || "—"}
                    </p>
                  </div>

                  {reviews.managerReview.comments && (
                    <div>
                      <p className="text-caption font-semibold text-neutral-800">
                        Manager Comments:
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-body text-neutral-600">
                        {reviews.managerReview.comments}
                      </p>
                    </div>
                  )}

                  <div className="border-t border-neutral-100 pt-3 text-caption text-neutral-500">
                    Reviewed by{" "}
                    <span className="font-semibold text-neutral-800">
                      {reviews.managerReview.reviewer?.firstName}{" "}
                      {reviews.managerReview.reviewer?.lastName}
                    </span>{" "}
                    on {formatDate(reviews.managerReview.submittedAt)}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-6 text-center">
                  <Clock className="mx-auto h-8 w-8 text-neutral-400" />
                  <p className="mt-2 text-heading-md font-semibold text-neutral-800">
                    Manager Review Pending
                  </p>
                  <p className="mt-1 text-caption text-neutral-500">
                    Your manager will review your goals and self-reflection near
                    the end of the cycle.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

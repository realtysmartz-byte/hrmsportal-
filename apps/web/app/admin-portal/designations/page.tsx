"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, Briefcase, Users, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { canManageOrg } from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";

export default function DesignationsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const role = (session?.user?.role ?? "EMPLOYEE") as Role;
  const allowed = canManageOrg(role);

  const [title, setTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [error, setError] = useState("");

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.designation.list.useQuery(undefined, {
    enabled: status === "authenticated" && allowed,
  });

  useEffect(() => {
    if (status === "authenticated" && !allowed) {
      router.replace("/admin-portal/dashboard");
    }
  }, [status, allowed, router]);

  const createMutation = trpc.designation.create.useMutation({
    onSuccess: () => {
      setTitle("");
      setError("");
      utils.designation.list.invalidate();
    },
    onError: (err) => setError(err.message),
  });

  const updateMutation = trpc.designation.update.useMutation({
    onSuccess: () => {
      setEditingId(null);
      setError("");
      utils.designation.list.invalidate();
    },
    onError: (err) => setError(err.message),
  });

  const deleteMutation = trpc.designation.delete.useMutation({
    onSuccess: () => utils.designation.list.invalidate(),
    onError: (err) => setError(err.message),
  });

  if (status === "loading" || !allowed) {
    return (
      <div className="flex h-48 items-center justify-center text-xs font-semibold text-neutral-400">
        Loading designations...
      </div>
    );
  }

  function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    createMutation.mutate({ title: title.trim() });
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto overflow-hidden">
      {/* 1. TOP HEADER (Dashboards V3 Style) */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
            <span>Realty Smartz Private Limited</span>
            <span>·</span>
            <span className="text-[#FF7A70] font-bold">Role Architecture</span>
          </div>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900">
            Designations
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-neutral-500">
            Standard corporate titles, seniority levels, and professional tracks
          </p>
        </div>

        <div className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-3.5 py-1.5 text-xs font-semibold text-neutral-700 border border-neutral-200/60">
          <Briefcase className="h-4 w-4 text-[#FF7A70]" />
          <span>{data?.length ?? 0} Defined Titles</span>
        </div>
      </div>

      {/* 2. ADD DESIGNATION CARD (Sleek Glass Bento Card) */}
      <div className="rounded-2xl border border-neutral-200/80 bg-white/90 backdrop-blur-md p-4 sm:p-5 shadow-2xs">
        <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3">
          Create New Designation
        </h2>
        <form onSubmit={onCreate} className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 sm:min-w-[200px] flex-1">
            <Input
              placeholder="e.g. Senior Associate, VP of Sales, Project Lead"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={createMutation.isLoading || !title.trim()}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF7A70] to-[#FFA07A] px-5 py-2.5 text-xs font-bold text-white shadow-[0_4px_16px_rgba(255,122,112,0.3)] hover:opacity-95 active:scale-95 disabled:opacity-50 transition-all"
          >
            <Plus className="h-4 w-4" />
            {createMutation.isLoading ? "Adding..." : "Add Designation"}
          </button>
        </form>

        {error && (
          <p className="mt-2 text-xs font-semibold text-rose-600">{error}</p>
        )}
      </div>

      {/* 3. DESIGNATIONS TABLE (Contained & Overflow-Hidden) */}
      <div className="rounded-2xl border border-neutral-200/80 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Designation Title</TableHead>
              <TableHead>Staff Holding Title</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-neutral-400">
                  Loading designations...
                </TableCell>
              </TableRow>
            )}

            {data?.map((desig) => (
              <TableRow key={desig.id} className="hover:bg-neutral-50/70 transition-colors">
                <TableCell>
                  {editingId === desig.id ? (
                    <div className="flex items-center gap-2 max-w-sm">
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="h-9"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateMutation.mutate({
                            id: desig.id,
                            title: editTitle.trim(),
                          })
                        }
                        className="rounded-lg bg-emerald-600 p-2 text-white hover:bg-emerald-700"
                        title="Save changes"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
                        <Briefcase className="h-4 w-4" />
                      </div>
                      <span className="font-bold text-neutral-900">{desig.title}</span>
                    </div>
                  )}
                </TableCell>

                <TableCell>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-700 border border-neutral-200/60">
                    <Users className="h-3 w-3 text-neutral-400" />
                    {desig._count.employees} Active Staff
                  </span>
                </TableCell>

                <TableCell className="text-right">
                  <div className="inline-flex items-center gap-1.5">
                    {editingId === desig.id ? (
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
                      >
                        Cancel
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(desig.id);
                            setEditTitle(desig.title);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-xl border border-neutral-200/80 bg-white text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 transition-colors shadow-2xs"
                          title="Edit designation title"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Delete designation "${desig.title}"?`)) {
                              deleteMutation.mutate({ id: desig.id });
                            }
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-xl border border-rose-200/60 bg-white text-rose-600 hover:bg-rose-50 transition-colors shadow-2xs"
                          title="Delete designation"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
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

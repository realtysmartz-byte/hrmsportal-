"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Network, Sparkles } from "lucide-react";
import { OrgChartNode } from "@/components/OrgChartNode";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";

function OrgChartInner() {
  const searchParams = useSearchParams();
  const highlight = searchParams.get("highlight");
  const { data, isLoading, error } = trpc.employee.orgChart.useQuery();

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto overflow-hidden">
      {/* 1. TOP HEADER (Dashboards V3 Style) */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
            <span>Realty Smartz Private Limited</span>
            <span>·</span>
            <span className="text-[#FF7A70] font-bold">Organizational Matrix</span>
          </div>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900">
            Org Chart
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-neutral-500">
            Interactive company hierarchy & reporting structure — click any member card to view profile
          </p>
        </div>

        <div className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-3.5 py-1.5 text-xs font-semibold text-neutral-700 border border-neutral-200/60">
          <Network className="h-4 w-4 text-[#FF7A70]" />
          <span>Interactive Hierarchy</span>
        </div>
      </div>

      {error && <p className="text-sm font-semibold text-rose-600">{error.message}</p>}

      {data && data.length > 0 ? (
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 md:p-10 shadow-sm overflow-hidden">
          <div className="overflow-x-auto pb-4 scrollbar-thin">
            <ul className="flex min-w-max justify-center gap-10">
              {data.map((root) => (
                <OrgChartNode
                  key={root.id}
                  node={root}
                  highlightId={highlight}
                  profileHref={(id) => `/admin-portal/employees/${id}`}
                />
              ))}
            </ul>
          </div>
        </div>
      ) : (
        !error && (
          <div className="rounded-2xl border border-neutral-200/80 bg-white p-12 text-center shadow-sm">
            <EmptyState
              title="No org chart data available"
              description="Add employees with assigned managers to build the reporting tree."
              className="border-0"
            />
          </div>
        )
      )}
    </div>
  );
}

export default function AdminOrgChartPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <OrgChartInner />
    </Suspense>
  );
}

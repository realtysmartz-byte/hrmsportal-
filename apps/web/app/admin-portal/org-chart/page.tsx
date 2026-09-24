"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
    <div className="section-gap">
      <div className="page-header">
        <div>
          <h1 className="page-title">Org Chart</h1>
          <p className="page-subtitle">
            Company hierarchy — click a node to open their profile
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-maroon-600">{error.message}</p>}

      {data && data.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white p-6 md:p-8">
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
      ) : (
        !error && (
          <EmptyState
            title="No org chart data"
            description="Add employees with managers to build the hierarchy."
          />
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

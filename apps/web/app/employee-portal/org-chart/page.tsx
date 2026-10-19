"use client";

import { userFacingErrorMessage } from "@/lib/user-facing-error";
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
      <div>
        <h1 className="page-title">Org Chart</h1>
        <p className="page-subtitle">
          See how teams connect across Realty Smartz Private Limited
        </p>
      </div>

      {error && (
        <p className="text-sm text-maroon-600">
          {userFacingErrorMessage(error)}
        </p>
      )}

      {data && data.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white p-6">
          <ul className="flex min-w-max justify-center gap-10">
            {data.map((root) => (
              <OrgChartNode
                key={root.id}
                node={root}
                highlightId={highlight}
                profileHref={(id) => `/employee-portal/directory/${id}`}
              />
            ))}
          </ul>
        </div>
      ) : (
        !error && (
          <EmptyState
            title="No org chart data"
            description="The company hierarchy will appear once employees are linked."
          />
        )
      )}
    </div>
  );
}

export default function EmployeeOrgChartPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <OrgChartInner />
    </Suspense>
  );
}

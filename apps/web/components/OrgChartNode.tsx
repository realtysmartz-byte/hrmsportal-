"use client";

import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn, fullName, initials } from "@/lib/utils";

export type OrgNodeData = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
  designation: { id: string; title: string } | null;
  department: { id: string; name: string } | null;
  children: OrgNodeData[];
};

export function OrgChartNode({
  node,
  depth = 0,
  profileHref,
  highlightId,
}: {
  node: OrgNodeData;
  depth?: number;
  profileHref?: (id: string) => string;
  highlightId?: string | null;
}) {
  const isHighlighted = highlightId === node.id;
  const [expanded, setExpanded] = useState(depth < 2 || isHighlighted);
  const hasChildren = node.children.length > 0;
  const href =
    profileHref?.(node.id) ??
    `/employee-portal/directory/${node.id}`;

  return (
    <li className="relative list-none">
      <div className="mb-4 flex flex-col items-center">
        <div
          className={cn(
            "relative rounded-lg border bg-white p-3 shadow-sm transition-all duration-150 hover:shadow-md",
            isHighlighted && "ring-2 ring-teal-600 border-teal-600"
          )}
        >
          {hasChildren && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="absolute -bottom-3 left-1/2 z-10 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white text-teal-700 shadow-sm transition-colors duration-150"
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          <Link
            href={href}
            className="flex w-48 flex-col items-center gap-2 text-center"
          >
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-teal-50 text-sm font-semibold text-teal-700">
              {node.profilePhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={node.profilePhotoUrl}
                  alt={fullName(node.firstName, node.lastName)}
                  className="h-full w-full object-cover"
                />
              ) : (
                initials(node.firstName, node.lastName)
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900">
                {fullName(node.firstName, node.lastName)}
              </p>
              <p className="text-xs text-neutral-500">
                {node.designation?.title ?? "—"}
              </p>
              <p className="text-[10px] text-teal-700">{node.employeeCode}</p>
            </div>
          </Link>
        </div>
      </div>

      {hasChildren && expanded && (
        <ul
          className={cn(
            "relative flex justify-center gap-6 pt-4",
            "before:absolute before:left-1/2 before:top-0 before:h-4 before:w-px before:-translate-x-1/2 before:bg-neutral-200"
          )}
        >
          {node.children.map((child) => (
            <div key={child.id} className="relative">
              <div className="absolute left-1/2 top-0 h-4 w-px -translate-x-1/2 bg-neutral-200" />
              <OrgChartNode
                node={child}
                depth={depth + 1}
                profileHref={profileHref}
                highlightId={highlightId}
              />
            </div>
          ))}
        </ul>
      )}
    </li>
  );
}

"use client";

import Link from "next/link";
import { ChevronDown, ChevronRight, Building2, Users, Edit3 } from "lucide-react";
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
  managerId?: string | null;
  isCompanyRoot?: boolean;
  children: OrgNodeData[];
};

export function OrgChartNode({
  node,
  depth = 0,
  profileHref,
  highlightId,
  onAssignManager,
  isForceExpanded,
}: {
  node: OrgNodeData;
  depth?: number;
  profileHref?: (id: string) => string;
  highlightId?: string | null;
  onAssignManager?: (node: OrgNodeData) => void;
  isForceExpanded?: boolean;
}) {
  const isHighlighted = highlightId === node.id;
  const [internalExpanded, setInternalExpanded] = useState(depth < 2 || isHighlighted);
  const expanded = isForceExpanded !== undefined ? isForceExpanded : internalExpanded;

  const hasChildren = node.children && node.children.length > 0;
  const href = profileHref?.(node.id) ?? `/admin-portal/employees/${node.id}`;

  return (
        <div className="flex flex-col items-center">
          {/* Node Card */}
          {node.isCompanyRoot ? (
            <div
              className={cn(
            "relative rounded-2xl bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 text-white p-4 shadow-xl border border-neutral-700/80 min-w-[280px] max-w-xs transition-all duration-150 hover:shadow-2xl",
                isHighlighted && "ring-4 ring-purple-500 border-purple-500"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-600/30 text-purple-300 border border-purple-500/40">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold tracking-wider uppercase text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded-full border border-purple-800/40">
                      Headquarters
                    </span>
                  </div>
                  <h3 className="text-base font-bold tracking-tight text-white mt-1">
                    {node.firstName} {node.lastName}
                  </h3>
                  <p className="text-xs text-neutral-400 font-medium">
                    {node.department?.name || "Corporate Overview"}
                  </p>
                </div>
              </div>

              {hasChildren && (
                <button
                  type="button"
                  onClick={() => setInternalExpanded((v) => !v)}
                  className="absolute -bottom-3 left-1/2 z-10 flex h-6 px-2.5 -translate-x-1/2 items-center justify-center gap-1 rounded-full border border-neutral-600 bg-neutral-900 text-neutral-200 text-[10px] font-bold shadow-md hover:bg-neutral-800 transition-colors"
                  aria-label={expanded ? "Collapse" : "Expand"}
                >
                  <span>{node.children.length} Depts</span>
                  {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </button>
              )}
        </div>
                ) : (
                <div
                  className={cn(
                    "group relative rounded-xl border bg-white p-3.5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-neutral-300 w-56 flex flex-col items-center text-center",
                    isHighlighted
                      ? "ring-2 ring-purple-600 border-purple-600 bg-purple-50/20 shadow-md"
                      : "border-neutral-200/90"
                  )}
                >
                  {/* Department Tag */}
                  <div className="w-full flex items-center justify-between gap-1 mb-2">
                    <span
                      className={cn(
                        "text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md truncate max-w-[140px]",
                        node.department?.name?.toLowerCase().includes("sales")
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : node.department?.name?.toLowerCase().includes("crm")
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : node.department?.name?.toLowerCase().includes("resource") || node.department?.name?.toLowerCase().includes("hr")
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : node.department?.name?.toLowerCase().includes("it")
                                ? "bg-cyan-50 text-cyan-700 border border-cyan-200"
                                : "bg-neutral-100 text-neutral-600 border border-neutral-200"
                      )}
                    >
                      {node.department?.name || "General"}
                    </span>

                    {/* Change Manager Action */}
                    {onAssignManager && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAssignManager(node);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-purple-700 hover:bg-purple-50 rounded transition-all"
                        title="Change Reporting Manager"
                      >
                        <Edit3 className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {/* Profile Photo / Avatar */}
                  <Link href={href} className="flex flex-col items-center group-hover:opacity-90">
                    <div className="relative mb-2">
                      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-purple-50 text-sm font-bold text-purple-700 ring-2 ring-white shadow-xs">
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
                    </div>

                      {/* Name & Designation */}
                      <p className="text-xs font-bold text-neutral-900 leading-tight line-clamp-1 hover:text-purple-700 transition-colors">
                        {fullName(node.firstName, node.lastName)}
                      </p>
                      <p className="text-[11px] font-medium text-neutral-500 mt-0.5 line-clamp-1">
                        {node.designation?.title ?? "Staff"}
                      </p>
                      <span className="text-[10px] font-mono text-neutral-400 mt-1">
                        {node.employeeCode}
                      </span>
                  </Link>

                  {/* Reports Count Pill */}
                  {hasChildren && (
                    <div className="mt-2.5 flex items-center gap-1 text-[10px] font-semibold text-neutral-500 bg-neutral-100/80 px-2 py-0.5 rounded-full border border-neutral-200">
                      <Users className="h-3 w-3 text-neutral-400" />
                      <span>{node.children.length} Reports</span>
                    </div>
          )}

              {/* Expand / Collapse Button */}
              {hasChildren && (
                <button
                  type="button"
                  onClick={() => setInternalExpanded((v) => !v)}
                  className="absolute -bottom-3 left-1/2 z-10 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-700 shadow-xs hover:bg-neutral-100 hover:text-purple-700 transition-colors"
                  aria-label={expanded ? "Collapse branch" : "Expand branch"}
                >
                  {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>
      )}

        {/* Children Branches & Visual Tree Connectors */}
        {hasChildren && expanded && (
        <div className="flex flex-col items-center w-full">
          {/* Vertical stem line dropping down from center of parent card */}
          <div className="w-0.5 h-6 bg-neutral-300 shrink-0" />

          {/* Sibling container with branching lines */}
          <div className="flex justify-center items-start relative pt-6 w-full">
            {node.children.map((child, index) => {
              const total = node.children.length;
              return (
                <div key={child.id} className="relative px-3 flex flex-col items-center">
                  {/* Horizontal Bar Connecting Siblings */}
                  {total > 1 && (
                    <>
                      {/* Left half bar */}
                      {index > 0 && (
                        <div className="absolute top-0 left-0 right-1/2 h-0.5 bg-neutral-300" />
                      )}
                      {/* Right half bar */}
                      {index < total - 1 && (
                        <div className="absolute top-0 left-1/2 right-0 h-0.5 bg-neutral-300" />
                      )}
                    </>
                  )}

                  {/* Vertical drop line directly into child card */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-neutral-300" />

                  {/* Child Node */}
                  <OrgChartNode
                    node={child}
                    depth={depth + 1}
                    profileHref={profileHref}
                    highlightId={highlightId}
                    onAssignManager={onAssignManager}
                    isForceExpanded={isForceExpanded}
                  />
                </div>
              );
            })}
          </div>
        </div>
        )}
    </div >
  );
}

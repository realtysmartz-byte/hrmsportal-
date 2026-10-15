"use client";

import { trpc } from "@/lib/trpc";
import { formatDate, fullName, initials } from "@/lib/utils";
import { PageSkeleton } from "@/components/ui/skeleton";

const BRAND = "#5D3EBC";

export default function IdCardPage() {
  const { data: emp, isLoading, error } = trpc.employee.myIdCard.useQuery();

  if (isLoading) return <PageSkeleton />;
  if (error || !emp) {
    return <p className="text-sm text-rose-600">{error?.message ?? "ID card not available"}</p>;
  }

  const details: { label: string; value: string | null }[] = [
    { label: "Department", value: emp.department?.name ?? null },
    { label: "Phone", value: emp.phone },
    { label: "Email", value: emp.email },
    { label: "Date of Joining", value: emp.dateOfJoining ? formatDate(emp.dateOfJoining) : null },
    { label: "Date of Birth", value: emp.dateOfBirth ? formatDate(emp.dateOfBirth) : null },
    {
      label: "Emergency",
      value: emp.emergencyContactPhone
        ? [emp.emergencyContactName, emp.emergencyContactPhone].filter(Boolean).join(" · ")
        : null,
    },
    { label: "Address", value: emp.address },
  ];

  return (
    <div className="flex flex-col items-center py-2">
      <h1 className="page-title mb-6 self-start">My ID Card</h1>

      <div className="relative w-full max-w-[340px]">
        {/* Lanyard */}
        <div className="absolute -top-10 left-1/2 flex -translate-x-1/2 gap-1">
          <div className="h-16 w-6 -rotate-[14deg] rounded-sm" style={{ background: BRAND }} />
          <div className="h-16 w-6 rotate-[14deg] rounded-sm" style={{ background: "#7B5FD6" }} />
        </div>

        <div className="relative overflow-hidden rounded-3xl bg-white shadow-[0_20px_50px_-15px_rgba(93,62,188,0.45)] ring-1 ring-neutral-200">
          {/* Clip slot */}
          <div className="absolute left-1/2 top-3 z-20 h-2.5 w-14 -translate-x-1/2 rounded-full bg-neutral-200" />

          {/* Diagonal tint */}
          <div
            className="absolute inset-x-0 top-0 h-64"
            style={{
              background: "linear-gradient(160deg, #F3F0FC 0%, #EAE4FB 100%)",
              clipPath: "polygon(0 0, 100% 0, 100% 45%, 0 100%)",
            }}
          />

          {/* Company */}
          <div className="relative z-10 flex items-center justify-center gap-2 pt-10">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full border-[5px]"
              style={{ borderColor: BRAND }}
            />
            <span className="text-lg font-extrabold tracking-wide text-neutral-900">
              REALTY SMARTZ
            </span>
          </div>

          {/* Photo with arc */}
          <div className="relative z-10 mx-auto mt-6 h-44 w-44">
            <div
              className="absolute -inset-4 rounded-full"
              style={{
                background: `conic-gradient(from 200deg, transparent 0deg, transparent 150deg, ${BRAND} 150deg, #8B6FE0 330deg, transparent 330deg)`,
                WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 22px), #000 calc(100% - 21px))",
                mask: "radial-gradient(farthest-side, transparent calc(100% - 22px), #000 calc(100% - 21px))",
              }}
            />
            <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full border-4 border-white bg-[#F3F0FC] text-4xl font-bold shadow-md" style={{ color: BRAND }}>
              {emp.profilePhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={emp.profilePhotoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initials(emp.firstName, emp.lastName)
              )}
            </div>
          </div>

          {/* Name */}
          <div className="relative z-10 mt-7 px-6 text-center">
            <p className="text-2xl font-extrabold leading-tight" style={{ color: "#2E1F66" }}>
              {fullName(emp.firstName, emp.lastName)}
            </p>
            {emp.designation?.title && (
              <p className="mt-1 text-sm font-medium text-neutral-700">{emp.designation.title}</p>
            )}
            <span
              className="mt-3 inline-block rounded-full px-5 py-1 text-sm font-bold tracking-wider text-white"
              style={{ background: `linear-gradient(90deg, ${BRAND}, #8B6FE0)` }}
            >
              {emp.employeeCode}
            </span>
          </div>

          {/* Details */}
          <dl className="relative z-10 mx-6 mt-5 space-y-1.5 border-t border-neutral-100 pt-4 text-xs">
            {details
              .filter((d) => d.value)
              .map((d) => (
                <div key={d.label} className="flex gap-3">
                  <dt className="w-24 shrink-0 font-semibold text-neutral-500">{d.label}</dt>
                  <dd className="min-w-0 break-words font-medium text-neutral-800">{d.value}</dd>
                </div>
              ))}
          </dl>

          {/* Corner arc */}
          <div
            className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full border-[22px]"
            style={{ borderColor: BRAND, opacity: 0.9 }}
          />

          {/* Logo */}
          <div className="relative z-10 flex justify-center pb-6 pt-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Realty Smartz" className="h-10 w-auto object-contain" />
          </div>
        </div>
      </div>
    </div>
  );
}

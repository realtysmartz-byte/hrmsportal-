"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Download, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatDate, fullName, initials } from "@/lib/utils";
import { PageSkeleton } from "@/components/ui/skeleton";

const BRAND = "#5D3EBC";
const BRAND_LIGHT = "#8B6FE0";
const BRAND_DARK = "#2E1F66";
const TRANSPARENT_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

export default function IdCardPage() {
  const { data: emp, isLoading, error } = trpc.employee.myIdCard.useQuery();
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  if (isLoading) return <PageSkeleton />;
  if (error || !emp) {
    return <p className="text-sm text-rose-600">{error?.message ?? "ID card not available"}</p>;
  }

  async function download() {
    if (!cardRef.current || !emp) return;
    setDownloading(true);
    setDownloadError("");
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 3,
        cacheBust: true,
        backgroundColor: "#ffffff",
        imagePlaceholder: TRANSPARENT_PIXEL,
      });
      const link = document.createElement("a");
      link.download = `ID-Card-${emp.employeeCode}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      setDownloadError("Could not create the image. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  const details: { label: string; value: string | null }[] = [
    { label: "Department", value: emp.department?.name ?? null },
    { label: "Phone", value: emp.phone },
    { label: "Email", value: emp.email },
    { label: "Joined", value: emp.dateOfJoining ? formatDate(emp.dateOfJoining) : null },
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
    <div className="flex flex-col items-center">
      <div className="mb-8 flex w-full max-w-[340px] items-center justify-between gap-3">
        <h1 className="page-title">My ID Card</h1>
        <button
          type="button"
          onClick={download}
          disabled={downloading}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-60"
          style={{ background: BRAND }}
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {downloading ? "Preparing…" : "Download"}
        </button>
      </div>
      {downloadError && <p className="mb-4 text-xs text-rose-600">{downloadError}</p>}

      {/* Lanyard */}
      <div className="relative z-10 -mb-3 flex gap-1.5">
        <div className="h-12 w-5 -rotate-12 rounded-t-sm" style={{ background: BRAND }} />
        <div className="h-12 w-5 rotate-12 rounded-t-sm" style={{ background: BRAND_LIGHT }} />
      </div>

      <div
        ref={cardRef}
        className="relative w-[320px] overflow-hidden rounded-[28px] bg-white shadow-[0_24px_60px_-20px_rgba(93,62,188,0.5)] ring-1 ring-neutral-200"
      >
        {/* Header band */}
        <div
          className="relative h-[150px]"
          style={{
            background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_LIGHT} 100%)`,
            clipPath: "polygon(0 0, 100% 0, 100% 72%, 0 100%)",
          }}
        >
          <div className="absolute left-1/2 top-3 h-2.5 w-14 -translate-x-1/2 rounded-full bg-white/40" />
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full border-[14px] border-white/10" />
          <div className="absolute -left-8 top-16 h-20 w-20 rounded-full border-[10px] border-white/10" />
          <div className="pt-9 text-center">
            <p className="text-lg font-extrabold tracking-[0.18em] text-white">REALTY SMARTZ</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-white/75">
              Employee ID Card
            </p>
          </div>
        </div>

        {/* Photo */}
        <div className="relative -mt-[62px] flex justify-center">
          <div className="rounded-full p-[5px]" style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND_LIGHT})` }}>
            <div
              className="flex h-[118px] w-[118px] items-center justify-center overflow-hidden rounded-full border-4 border-white bg-[#F3F0FC] text-3xl font-bold"
              style={{ color: BRAND }}
            >
              {emp.profilePhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={emp.profilePhotoUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                initials(emp.firstName, emp.lastName)
              )}
            </div>
          </div>
        </div>

        {/* Name */}
        <div className="mt-3 px-5 text-center">
          <p className="text-[22px] font-extrabold leading-tight" style={{ color: BRAND_DARK }}>
            {fullName(emp.firstName, emp.lastName)}
          </p>
          {emp.designation?.title && (
            <p className="mt-0.5 text-[13px] font-medium text-neutral-600">{emp.designation.title}</p>
          )}
          <span
            className="mt-2.5 inline-block rounded-full px-4 py-1 text-xs font-bold tracking-wider text-white"
            style={{ background: `linear-gradient(90deg, ${BRAND}, ${BRAND_LIGHT})` }}
          >
            {emp.employeeCode}
          </span>
        </div>

        {/* Details */}
        <div className="mx-5 mt-4 rounded-2xl bg-[#F7F5FD] px-4 py-3">
          <dl className="space-y-1.5 text-[11px] leading-snug">
            {details
              .filter((d) => d.value)
              .map((d) => (
                <div key={d.label} className="grid grid-cols-[82px_1fr] gap-2">
                  <dt className="font-semibold text-neutral-500">{d.label}</dt>
                  <dd className="break-words font-semibold text-neutral-800">{d.value}</dd>
                </div>
              ))}
          </dl>
        </div>

        {/* Logo */}
        <div className="flex justify-center pb-4 pt-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Realty Smartz" className="h-9 w-auto object-contain" />
        </div>

        {/* Bottom band */}
        <div className="h-2.5" style={{ background: `linear-gradient(90deg, ${BRAND}, ${BRAND_LIGHT})` }} />
      </div>
    </div>
  );
}

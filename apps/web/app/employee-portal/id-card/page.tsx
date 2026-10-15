"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Download, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { fullName, initials } from "@/lib/utils";
import { PageSkeleton } from "@/components/ui/skeleton";

const COMPANY_NUMBER = "80-10-841-841";
const COMPANY_WEBSITE = "www.realtysmartz.in";
const COMPANY_ADDRESS = "11th Floor, Spaze Palazo, Golf Course Ext Rd, Sector 69, Gurugram, 122001";
const TRANSPARENT_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

export default function IdCardPage() {
  const { data: emp, isLoading, error } = trpc.employee.myIdCard.useQuery();
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const [flipped, setFlipped] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  if (isLoading) return <PageSkeleton />;
  if (error || !emp) {
    return <p className="text-sm text-rose-600">{error?.message ?? "ID card not available"}</p>;
  }

  async function download() {
    if (!frontRef.current || !backRef.current || !emp) return;
    setDownloading(true);
    setDownloadError("");
    try {
      const options = { pixelRatio: 3, cacheBust: true, imagePlaceholder: TRANSPARENT_PIXEL };
      const [frontUrl, backUrl] = await Promise.all([
        toPng(frontRef.current, options),
        toPng(backRef.current, options),
      ]);
      const [front, back] = await Promise.all([loadImage(frontUrl), loadImage(backUrl)]);

      const gap = 60;
      const canvas = document.createElement("canvas");
      canvas.width = front.width + back.width + gap * 3;
      canvas.height = Math.max(front.height, back.height) + gap * 2;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(front, gap, gap);
      ctx.drawImage(back, gap * 2 + front.width, gap);

      const link = document.createElement("a");
      link.download = `ID-Card-${emp.employeeCode}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      setDownloadError("Could not create the image. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col items-center">
      <div className="mb-6 flex w-full max-w-[400px] items-center justify-between gap-3">
        <h1 className="page-title">My ID Card</h1>
        <button
          type="button"
          onClick={download}
          disabled={downloading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#5D3EBC] px-3 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-60"
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {downloading ? "Preparing…" : "Download"}
        </button>
      </div>
      {downloadError && <p className="mb-4 text-xs text-rose-600">{downloadError}</p>}

      <div
        role="button"
        tabIndex={0}
        onClick={() => setFlipped((f) => !f)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setFlipped((f) => !f);
          }
        }}
        className="h-[540px] w-[310px] cursor-pointer select-none outline-none [perspective:1400px]"
        aria-label="Flip ID card"
      >
        <div
          className="relative h-full w-full transition-transform duration-700 ease-in-out [transform-style:preserve-3d]"
          style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
        >
          <div className="absolute inset-0 [backface-visibility:hidden]">
            <CardShell>
              <FrontContent emp={emp} />
            </CardShell>
          </div>
          <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <CardShell>
              <BackContent />
            </CardShell>
          </div>
        </div>
      </div>

      <div aria-hidden className="pointer-events-none fixed -left-[10000px] top-0 flex gap-4">
        <CardShell cardRef={frontRef}>
          <FrontContent emp={emp} />
        </CardShell>
        <CardShell cardRef={backRef}>
          <BackContent />
        </CardShell>
      </div>
    </div>
  );
}

type IdCardEmployee = {
  employeeCode: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
  bloodGroup: string | null;
  emergencyContactPhone: string | null;
};

function FrontContent({ emp }: { emp: IdCardEmployee }) {
  return (
    <>
      <img
        src="/logo.png"
        alt=""
        className="absolute -left-14 bottom-20 h-48 w-auto opacity-[0.18]"
      />
      <div className="relative flex h-full flex-col items-center px-6 pt-6 text-left">
        <BrandRow />

        <div className="mt-6 h-[170px] w-[150px] overflow-hidden rounded-2xl border-[5px] border-[#1F5F7A] bg-white shadow-md">
          {emp.profilePhotoUrl ? (
            <img src={emp.profilePhotoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#EAF2F8] text-4xl font-bold text-[#1F5F7A]">
              {initials(emp.firstName, emp.lastName)}
            </div>
          )}
        </div>

        <p className="mt-5 text-center text-[26px] font-bold leading-tight text-neutral-900">
          {fullName(emp.firstName, emp.lastName)}
        </p>

        <div className="mt-9 w-full space-y-1.5 text-[13px] text-neutral-900">
          <InfoLine label="Employee Code" value={emp.employeeCode} />
          {emp.bloodGroup && <InfoLine label="Blood Group" value={emp.bloodGroup} />}
          {emp.emergencyContactPhone && (
            <InfoLine label="Emergency No." value={emp.emergencyContactPhone} />
          )}
        </div>
      </div>
    </>
  );
}

function BackContent() {
  return (
    <div className="relative flex h-full flex-col items-center px-6 pt-6 text-left">
      <img src="/logo.png" alt="" className="h-[105px] w-auto opacity-40" />

      <p className="mt-4 text-base font-bold tracking-wide text-neutral-900 underline underline-offset-4">
        NOTES
      </p>
      <p className="mt-2 text-center text-[12px] font-medium leading-snug text-neutral-800">
        Employees must immediately report a lost or stolen ID card to the issuing authority.
      </p>

      <div className="mt-6 w-full space-y-2 text-[13px] text-neutral-900">
        <BackLine label="Number" value={COMPANY_NUMBER} />
        <BackLine label="Website" value={COMPANY_WEBSITE} />
        <BackLine label="Address" value={COMPANY_ADDRESS} />
      </div>

      <div className="mt-auto flex w-full flex-col items-center pb-5 pt-8">
        <div className="w-40 border-t border-neutral-900" />
        <p className="mt-1 text-sm font-semibold tracking-wide text-neutral-900">SIGNATURE</p>
        <div className="mt-3">
          <BrandRow />
        </div>
      </div>
    </div>
  );
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function CardShell({
  cardRef,
  children,
}: {
  cardRef?: React.RefObject<HTMLDivElement>;
  children: React.ReactNode;
}) {
  return (
    <div
      ref={cardRef}
      className="relative h-[540px] w-[310px] overflow-hidden rounded-[28px] shadow-[0_18px_45px_-18px_rgba(31,95,122,0.45)] ring-1 ring-neutral-200"
      style={{
        background:
          "radial-gradient(circle at 85% 12%, #F8E8EE 0%, transparent 45%), radial-gradient(circle at 10% 90%, #E3EEF6 0%, transparent 50%), linear-gradient(165deg, #FFFFFF 0%, #F7F3F6 45%, #E6EEF4 100%)",
      }}
    >
      <Waves />
      {children}
    </div>
  );
}

function Waves() {
  const lines = Array.from({ length: 16 }, (_, i) => i);
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 310 520"
      preserveAspectRatio="none"
    >
      {lines.map((i) => (
        <path
          key={i}
          d={`M -20 ${250 + i * 2} C 60 ${150 + i * 6}, 160 ${330 - i * 4}, 330 ${170 + i * 3}`}
          fill="none"
          stroke="#7CC0E4"
          strokeWidth="0.6"
          opacity={0.35}
        />
      ))}
    </svg>
  );
}

function BrandRow() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col items-center">
        <img src="/logo.png" alt="Realty Smartz" className="h-9 w-auto" />
        <span className="mt-0.5 text-[10px] font-extrabold tracking-wide text-[#1F5F7A]">
          REALTY SMARTZ
        </span>
      </div>
      <div className="h-14 w-[3px] rounded-full bg-gradient-to-b from-[#C8323C] to-[#7CC0E4]" />
      <GreatPlaceToWork />
    </div>
  );
}

function GreatPlaceToWork() {
  return (
    <div className="flex w-[42px] flex-col overflow-hidden text-white">
      <div className="bg-[#E3343E] px-1 pb-1 pt-1 text-[7px] font-bold leading-[1.05]">
        Great
        <br />
        Place
        <br />
        To
        <br />
        Work.
      </div>
      <div
        className="bg-[#1D3B8F] px-1 pb-3 pt-0.5 text-center"
        style={{ clipPath: "polygon(0 0, 100% 0, 100% 78%, 50% 100%, 0 78%)" }}
      >
        <p className="text-[7px] font-bold leading-tight">Certified</p>
        <p className="text-[4px] leading-tight opacity-80">INDIA</p>
      </div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="font-bold">{label}:</span> <span className="font-semibold">{value}</span>
    </p>
  );
}

function BackLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[72px_1fr] gap-1">
      <span className="font-bold">{label} :</span>
      <span className="font-medium leading-snug">{value}</span>
    </div>
  );
}

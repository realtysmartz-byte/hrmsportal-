import { LogIn, LogOut } from "lucide-react";
import { formatTimeIST } from "@realty-smartz/shared";

export type Punch = {
  id: string;
  checkInTime: Date | string;
  checkOutTime: Date | string | null;
  checkInAddress?: string | null;
  checkOutAddress?: string | null;
};

function duration(p: Punch) {
  if (!p.checkOutTime) return "On Duty";
  const mins = Math.max(
    0,
    Math.round((new Date(p.checkOutTime).getTime() - new Date(p.checkInTime).getTime()) / 60000)
  );
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}

export function PunchList({ punches }: { punches: Punch[] }) {
  if (punches.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
        All Punches ({punches.length})
      </p>
      <ol className="space-y-1.5">
        {punches.map((p, i) => (
          <li
            key={p.id}
            className="rounded-lg border border-neutral-100 bg-white px-2.5 py-1.5 text-[11px]"
          >
            <div className="grid grid-cols-[24px_1fr_1fr_64px] items-center gap-2">
              <span className="font-bold text-neutral-400">#{i + 1}</span>
              <span className="flex items-center gap-1 font-semibold text-emerald-700">
                <LogIn className="h-3 w-3" />
                {formatTimeIST(p.checkInTime)}
              </span>
              <span className="flex items-center gap-1 font-semibold text-neutral-800">
                <LogOut className="h-3 w-3 text-rose-500" />
                {p.checkOutTime ? formatTimeIST(p.checkOutTime) : "—"}
              </span>
              <span
                className={
                  p.checkOutTime
                    ? "text-right text-neutral-500"
                    : "text-right font-bold text-[#5D3EBC]"
                }
              >
                {duration(p)}
              </span>
            </div>
            <p className="mt-1 pl-8 text-[10px] text-neutral-500">
              In: {p.checkInAddress || "Resolving address…"}
              {p.checkOutTime &&
                ` · Out: ${p.checkOutAddress || "Resolving address…"}`}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

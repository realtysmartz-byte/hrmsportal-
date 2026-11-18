import Image from "next/image";

export function EmployeePortalFooter() {
  return (
    <footer className="mt-8 pt-6 pb-4 flex flex-col items-center justify-center text-center select-none">
          <div className="inline-flex items-center justify-center gap-2.5 px-4 py-1.5 rounded-full bg-[var(--card)] border border-[var(--line)] shadow-xs">
            <span className="text-[11px] font-semibold text-[var(--muted)] whitespace-nowrap">
              A digital experience by
            </span>
            <div className="flex items-center justify-center bg-[#FFFFFF] rounded-[4px] px-[10px] py-[6px]">
              <img
                src="/images/engapexpert-logo@2x.png"
                alt="EngageXpert - Let's Build Your Empire"
                className="h-4 w-auto object-contain flex-none"
                loading="lazy"
              />
            </div>
          </div>
          <p className="mt-2 text-[10.5px] text-[var(--muted)] font-medium">
            Realty Smartz HRMS Portal · All Rights Reserved
          </p>
        </footer>
        );
}

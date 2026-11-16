import Image from "next/image";

export function EmployeePortalFooter() {
  return (
    <footer className="mt-8 pt-6 pb-4 flex flex-col items-center justify-center text-center select-none">
      <div className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-50/90 border border-neutral-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <span className="text-[10px] font-bold tracking-[0.16em] text-[#0a4fa3] uppercase whitespace-nowrap">
          A Digital Experience By
        </span>
        <img
          src="/images/engapexpert-logo@2x.png"
          alt="EngageXpert - Let's Build Your Empire"
          className="h-5 w-auto object-contain flex-none"
          loading="lazy"
        />
      </div>
      <p className="mt-2 text-[10.5px] text-neutral-400 font-medium">
        Realty Smartz HRMS Portal · All Rights Reserved
      </p>
    </footer>
  );
}

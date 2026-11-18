import { cn } from "@/lib/utils";

export function Logo({
  className,
  showText = true,
  size = 36,
  darkText = false,
}: {
  className?: string;
  showText?: boolean;
  size?: number;
  darkText?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <img
        src="/logo.png"
        alt="Realty Smartz Private Limited"
        width={size}
        height={size}
        className="shrink-0 object-contain"
        style={{ width: `${size}px`, height: `${size}px` }}
      />
      {showText && (
        <div className="flex flex-col leading-tight">
          <span
            className={cn(
              "text-sm font-bold tracking-wide uppercase font-display text-[var(--ink)]",
              darkText && "text-neutral-900"
            )}
          >
            REALTY SMARTZ
          </span>
          <span className="text-[10px] font-medium text-[var(--muted)]">
            Committed to Deliver Excellence
          </span>
        </div>
      )}
    </div>
  );
}

import { cn } from "@/lib/utils";

// PLACEHOLDER — replace with real logo.svg in /public once provided by the client.
export function Logo({
  className,
  showText = true,
}: {
  className?: string;
  showText?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <svg
        width="36"
        height="36"
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <polygon
          points="18,2 32,10 32,26 18,34 4,26 4,10"
          fill="#0F5C74"
        />
        <polygon
          points="18,8 26,13 26,23 18,28 10,23 10,13"
          fill="#A82A42"
          opacity="0.85"
        />
      </svg>
      {showText && (
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold tracking-wide text-brand-text">
            REALTY SMARTZ
          </span>
          <span className="text-[10px] text-muted-foreground">
            Committed to Deliver Excellence
          </span>
        </div>
      )}
    </div>
  );
}

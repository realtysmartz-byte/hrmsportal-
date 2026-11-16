import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  className,
  action,
}: {
  title: string;
  description?: string;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded border border-[var(--line)] bg-[var(--card)] px-6 py-10 text-center",
        className
      )}
    >
      <p className="text-sm font-semibold text-[var(--ink)]">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-[var(--muted)]">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

import { Inbox } from "lucide-react";
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
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50/80 px-6 py-12 text-center",
        className
      )}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-700">
        <Inbox className="h-5 w-5" />
      </div>
      <p className="font-display text-heading-md text-neutral-800">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-caption text-neutral-500">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

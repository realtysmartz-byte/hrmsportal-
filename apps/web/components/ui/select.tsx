import * as React from "react";
import { cn } from "@/lib/utils";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <select
      className={cn(
        "flex h-10 w-full rounded-xl border border-neutral-200/90 bg-white/90 backdrop-blur-xs px-3.5 py-2 text-xs sm:text-sm text-neutral-800 shadow-2xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5D3EBC]/30 focus-visible:border-[#5D3EBC] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = "Select";

export { Select };

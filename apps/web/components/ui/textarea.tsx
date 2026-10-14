import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        "flex min-h-[88px] w-full rounded-xl border border-neutral-200/90 bg-white/90 backdrop-blur-xs px-3.5 py-2.5 text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5D3EBC]/30 focus-visible:border-[#5D3EBC] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export { Textarea };

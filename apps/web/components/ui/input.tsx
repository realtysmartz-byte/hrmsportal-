import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-xl border border-neutral-200/90 bg-white/90 backdrop-blur-xs px-3.5 py-2 text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 shadow-2xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7A70]/30 focus-visible:border-[#FF7A70] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider transition-colors",
  {
    variants: {
      variant: {
        default: "bg-[#FF7A70]/10 text-[#FF7A70] border border-[#FF7A70]/25",
        secondary: "bg-neutral-100 text-neutral-700 border border-neutral-200/80",
        success: "bg-emerald-50 text-emerald-700 border border-emerald-200/80",
        warning: "bg-amber-50 text-amber-800 border border-amber-200/80",
        danger: "bg-rose-50 text-rose-700 border border-rose-200/80",
        info: "bg-sky-50 text-sky-700 border border-sky-200/80",
        outline: "border border-neutral-300 text-neutral-700 bg-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };

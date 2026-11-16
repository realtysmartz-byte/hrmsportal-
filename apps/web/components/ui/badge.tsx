import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-[var(--accent)]/14 text-[var(--accent)]",
        secondary: "bg-[var(--field)] text-[var(--muted)] border border-[var(--line)]",
        success: "chip-ok",
        warning: "chip-warn",
        danger: "chip-danger",
        info: "chip-info",
        outline: "border border-[var(--line)] text-[var(--ink)] bg-[var(--card)]",
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

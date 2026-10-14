import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.99]",
  {
    variants: {
      variant: {
        default:
          "bg-[#5D3EBC] text-white font-semibold hover:opacity-95 active:scale-[0.98]",
        destructive: "bg-rose-600 text-white hover:bg-rose-700 ",
        outline:
          "border border-neutral-200/90 bg-white text-neutral-800 hover:bg-neutral-50 hover:border-neutral-300",
        secondary:
          "bg-[#181926] text-white hover:bg-[#252836] ",
        ghost: "hover:bg-neutral-100 hover:text-neutral-900 ",
        link: "text-[#5D3EBC] underline-offset-4 hover:underline ",
      },
      size: {
        default: "h-10 rounded-xl px-4 py-2",
        sm: "h-8.5 rounded-xl px-3 text-xs font-semibold",
        lg: "h-11 rounded-lg px-8",
        icon: "h-10 w-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };

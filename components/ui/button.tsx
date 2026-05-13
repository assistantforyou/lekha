import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 text-sm font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8de3c2]/60 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-[#f5f3ef] !text-[#090a0a] shadow-[0_12px_34px_rgba(245,243,239,0.12)] hover:bg-white",
        secondary:
          "border border-white/12 bg-white/[0.045] text-[#f5f3ef] hover:border-white/22 hover:bg-white/[0.075]",
        ghost: "text-[#c9c3ba] hover:bg-white/[0.055] hover:text-white",
      },
      size: {
        default: "h-11 px-4",
        sm: "h-9 px-3 text-xs",
        lg: "h-12 px-5",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export function buttonVariantsForLink({
  className,
  variant,
  size,
}: VariantProps<typeof buttonVariants> & { className?: string }) {
  return cn(buttonVariants({ variant, size, className }));
}

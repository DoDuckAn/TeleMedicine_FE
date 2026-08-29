import type { ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-60",
  {
    defaultVariants: {
      size: "md",
      variant: "primary",
    },
    variants: {
      size: {
        lg: "min-h-12 px-6 py-3 text-base",
        md: "min-h-11 px-5 py-2.5 text-sm",
        sm: "min-h-10 px-3.5 py-2 text-sm",
      },
      variant: {
        destructive:
          "bg-destructive text-white hover:bg-red-700 focus-visible:outline-destructive",
        ghost:
          "text-slate-700 hover:bg-slate-100 hover:text-primary focus-visible:outline-primary",
        outline:
          "border border-border bg-white text-slate-800 hover:border-primary/60 hover:text-primary focus-visible:outline-primary",
        primary:
          "bg-primary text-primary-foreground shadow-sm hover:bg-blue-700 focus-visible:outline-primary",
        soft: "border border-blue-100 bg-blue-50 text-primary hover:bg-blue-100 focus-visible:outline-primary",
        success:
          "bg-green-600 text-white shadow-sm hover:bg-green-700 focus-visible:outline-green-600",
      },
    },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, size, variant, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ size, variant }), className)}
      type="button"
      {...props}
    />
  );
}

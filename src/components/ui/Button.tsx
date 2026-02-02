import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonSize = "md" | "lg" | "xl";

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-cta text-on-primary shadow-sm hover:bg-cta-hover",
  secondary:
    "border border-cta/70 text-ink bg-transparent hover:bg-cta/15",
  ghost: "text-ink hover:bg-cta/15",
};

const sizeStyles: Record<ButtonSize, string> = {
  md: "h-11 px-5 text-base",
  lg: "h-12 px-6 text-lg",
  xl: "h-14 px-8 text-xl",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    />
  );
}

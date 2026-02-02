import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type BadgeVariant = "new" | "prep" | "ready" | "delivery" | "urgent";

const variantStyles: Record<BadgeVariant, string> = {
  new: "bg-status-new text-on-accent",
  prep: "bg-status-prep text-on-primary",
  ready: "bg-status-ready text-on-accent",
  delivery: "bg-status-delivery text-on-accent",
  urgent: "border border-cta/70 text-ink bg-surface-2",
};

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export function Badge({ className, variant = "new", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold uppercase tracking-wide",
        variantStyles[variant],
        className,
      )}
      {...props}
    />
  );
}

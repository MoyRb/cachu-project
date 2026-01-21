import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type BadgeVariant = "new" | "prep" | "ready" | "delivery" | "urgent";

const variantStyles: Record<BadgeVariant, string> = {
  new: "bg-status-new text-ink",
  prep: "bg-status-prep text-ink",
  ready: "bg-status-ready text-ink",
  delivery: "bg-status-delivery text-ink",
  urgent: "border border-wood/70 text-ink bg-cream",
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

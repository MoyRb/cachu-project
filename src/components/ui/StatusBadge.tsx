import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type Status = "nuevo" | "en-preparacion" | "listo" | "en-reparto" | "urgente";

const styles: Record<Status, string> = {
  nuevo: "bg-status-new text-on-accent",
  "en-preparacion": "bg-status-prep text-on-primary",
  listo: "bg-status-ready text-on-accent",
  "en-reparto": "bg-status-delivery text-on-accent",
  urgente: "border border-cta/70 text-ink bg-surface-2",
};

const labels: Record<Status, string> = {
  nuevo: "Nuevo / en cola",
  "en-preparacion": "En preparación",
  listo: "Listo",
  "en-reparto": "En reparto",
  urgente: "Urgente",
};

export type StatusBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  status?: Status;
};

export function StatusBadge({
  className,
  status = "nuevo",
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold uppercase tracking-wide",
        styles[status],
        className,
      )}
      {...props}
    >
      {labels[status]}
    </span>
  );
}

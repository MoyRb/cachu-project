import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";

type OrderCardProps = HTMLAttributes<HTMLDivElement> & {
  orderNumber: string;
  status?: "nuevo" | "en-preparacion" | "listo" | "en-reparto" | "urgente";
  station?: string;
  items: string[];
  timeLabel?: string;
  channelLabel?: string;
};

export function OrderCard({
  className,
  orderNumber,
  status = "nuevo",
  station,
  items,
  timeLabel = "Hace 4 min",
  channelLabel = "Canal: Kiosco",
  ...props
}: OrderCardProps) {
  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-3xl border border-border bg-surface p-6 shadow-sm",
        className,
      )}
      {...props}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">
            Pedido
          </p>
          <p className="text-3xl font-bold text-ink">#{orderNumber}</p>
        </div>
        <StatusBadge status={status} />
      </header>
      <div className="rounded-2xl bg-surface-2 p-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">
          {station ?? "Estación"}
        </p>
        <ul className="mt-3 space-y-2 text-base font-semibold text-ink">
          {items.map((item) => (
            <li key={item} className="flex items-center justify-between">
              <span>{item}</span>
              <span className="text-sm text-muted">x1</span>
            </li>
          ))}
        </ul>
      </div>
      <footer className="flex items-center justify-between text-sm font-semibold text-muted">
        <span>{timeLabel}</span>
        <span>{channelLabel}</span>
      </footer>
    </article>
  );
}

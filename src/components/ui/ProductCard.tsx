import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

type ProductCardProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  description: string;
  price: string;
  tag?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
};

export function ProductCard({
  className,
  title,
  description,
  price,
  tag,
  actionLabel = "Agregar",
  onAction,
  actionDisabled = false,
  ...props
}: ProductCardProps) {
  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-3xl border border-border bg-card/90 p-6 shadow-sm",
        className,
      )}
      {...props}
    >
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xl font-semibold text-ink">{title}</p>
          <p className="text-sm text-ink/70">{description}</p>
        </div>
        {tag ? (
          <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-ink">
            {tag}
          </span>
        ) : null}
      </header>
      <div className="flex items-center justify-between">
        <p className="text-2xl font-bold text-ink">{price}</p>
        <Button
          size="md"
          onClick={onAction}
          disabled={actionDisabled}
          type="button"
        >
          {actionLabel}
        </Button>
      </div>
    </article>
  );
}

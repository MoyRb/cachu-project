import type { HTMLAttributes } from "react";

import Image from "next/image";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

type ProductCardProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  description: string;
  price: string;
  tag?: string;
  imageUrl?: string | null;
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
  imageUrl,
  actionLabel = "Agregar",
  onAction,
  actionDisabled = false,
  ...props
}: ProductCardProps) {
  const imageContent = imageUrl ? (
    <Image
      src={imageUrl}
      alt={title}
      fill
      sizes="(min-width: 1280px) 320px, (min-width: 1024px) 280px, 100vw"
      className="object-cover"
    />
  ) : (
    <div
      className="absolute inset-0 bg-gradient-to-br from-surface-2 via-surface-1 to-surface-2"
      aria-hidden="true"
    />
  );

  const imageWrapper = (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-surface-2">
      {imageContent}
    </div>
  );

  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-3xl border border-border bg-surface p-6 shadow-sm",
        className,
      )}
      {...props}
    >
      {onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={`Agregar ${title}`}
        >
          {imageWrapper}
        </button>
      ) : (
        imageWrapper
      )}
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xl font-semibold text-ink">{title}</p>
          <p className="text-sm text-muted">{description}</p>
        </div>
        {tag ? (
          <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-on-accent">
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

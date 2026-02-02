import type { ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  subtitle?: string;
  hint?: string;
  lastUpdated?: ReactNode;
  onRefresh?: () => void;
  icon?: ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  subtitle,
  hint,
  lastUpdated,
  onRefresh,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <Card
      className={cn(
        "flex w-full max-w-xl flex-col items-center gap-4 px-8 py-10 text-center",
        className,
      )}
    >
      <div className="text-5xl" aria-hidden>
        {icon ?? "📭"}
      </div>
      <div className="space-y-2">
        <CardTitle className="text-2xl">{title}</CardTitle>
        {subtitle ? (
          <CardDescription className="text-base">{subtitle}</CardDescription>
        ) : null}
      </div>
      <Button size="lg" onClick={onRefresh}>
        Refrescar ahora
      </Button>
      <div className="space-y-1 text-sm text-muted">
        {hint ? <p>{hint}</p> : null}
        {lastUpdated ? <p className="tabular-nums">{lastUpdated}</p> : null}
      </div>
    </Card>
  );
}

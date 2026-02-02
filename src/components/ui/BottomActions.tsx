import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function BottomActions({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
      {...props}
    />
  );
}

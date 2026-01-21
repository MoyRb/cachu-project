import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function TopBar({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border bg-card/90 px-6 py-4 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

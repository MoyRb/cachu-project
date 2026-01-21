import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Modal({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-6",
        className,
      )}
      {...props}
    />
  );
}

export function ModalPanel({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-lg",
        className,
      )}
      {...props}
    />
  );
}

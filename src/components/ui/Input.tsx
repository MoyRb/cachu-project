import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-2xl border border-border bg-cream px-4 text-base text-ink placeholder:text-ink/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wood/60 focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
        className,
      )}
      {...props}
    />
  );
}

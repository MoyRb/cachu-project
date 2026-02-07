"use client";

import { useEffect } from "react";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ModalProps = HTMLAttributes<HTMLDivElement> & {
  onClose?: () => void;
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
};

export function Modal({
  className,
  onClose,
  closeOnBackdrop = true,
  closeOnEsc = true,
  onMouseDown,
  ...props
}: ModalProps) {
  useEffect(() => {
    if (!onClose || !closeOnEsc) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeOnEsc, onClose]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6",
        className,
      )}
      onMouseDown={(event) => {
        onMouseDown?.(event);
        if (!onClose || !closeOnBackdrop) {
          return;
        }
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
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
        "w-full max-w-lg rounded-3xl border border-border bg-surface p-6 shadow-lg",
        className,
      )}
      {...props}
    />
  );
}

"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";

type AwaitingPaymentBannerProps = {
  count: number;
};

export function AwaitingPaymentBanner({ count }: AwaitingPaymentBannerProps) {
  const router = useRouter();
  const suffix = count === 1 ? "" : "s";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cta/50 bg-cta/10 px-5 py-3">
      <p className="text-base font-semibold text-ink">
        Hay {count} pedido{suffix} esperando ser cobrado{suffix}
      </p>
      <Button size="lg" onClick={() => router.push("/caja")}>
        Ir a Caja
      </Button>
    </div>
  );
}

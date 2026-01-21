import Link from "next/link";

import { Card, CardDescription, CardTitle } from "@/components/ui/Card";

export default function Home() {
  return (
    <div className="min-h-screen bg-cream px-6 py-12 text-ink">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-10">
        <section className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-ink/60">
            Cachu PWA
          </p>
          <h1 className="text-4xl font-bold">Base visual y tokens</h1>
          <p className="text-lg text-ink/80">
            Configuración inicial del sistema visual para kiosco, cocina y
            clientes móviles.
          </p>
        </section>

        <Card className="space-y-6">
          <div className="space-y-2">
            <CardTitle>Revisar UI Kit</CardTitle>
            <CardDescription>
              Todos los componentes base, variantes y estados de badge reunidos
              en una sola vista.
            </CardDescription>
          </div>
          <Link
            href="/ui-kit"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-cta px-6 text-lg font-semibold text-ink transition-colors hover:bg-[#d88b46]"
          >
            Abrir /ui-kit
          </Link>
        </Card>
      </main>
    </div>
  );
}

import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { BottomActions } from "@/components/ui/BottomActions";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal, ModalPanel } from "@/components/ui/Modal";
import { OrderCard } from "@/components/ui/OrderCard";
import { ProductCard } from "@/components/ui/ProductCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TopBar } from "@/components/ui/TopBar";

export default function UIKitPage() {
  return (
    <div className="min-h-screen bg-cream px-6 py-10 text-ink sm:px-10">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <TopBar>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-ink/60">
              Cachu PWA
            </p>
            <h1 className="text-3xl font-bold text-ink">UI Kit & Tokens</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button size="lg">Nuevo pedido</Button>
            <Button variant="secondary" size="lg">
              Ver pedidos
            </Button>
            <Button variant="ghost" size="lg">
              Ayuda
            </Button>
            <Link
              href="/kiosco"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-cta px-6 text-lg font-semibold text-ink shadow-sm transition-colors hover:bg-[#d88b46] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wood/60 focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
            >
              Ir a Kiosco
            </Link>
          </div>
        </TopBar>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="space-y-6">
            <div>
              <CardTitle>Checklist visual</CardTitle>
              <CardDescription>
                Validar contraste, tamaños kiosk/cocina y consistencia de
                paleta.
              </CardDescription>
            </div>
            <ul className="space-y-3 text-base font-semibold text-ink">
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-cta" />
                Botones principales en #E89D58 con texto oscuro.
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-wood" />
                Secundarios con borde madera y fondo crema.
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-accent" />
                Badges y estados consistentes para cocina.
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-success" />
                Cards con sombras ligeras y esquinas grandes.
              </li>
            </ul>
          </Card>

          <Card className="space-y-5">
            <CardTitle>Tokens de color</CardTitle>
            <div className="grid grid-cols-2 gap-3 text-sm font-semibold">
              {[
                { label: "Crema", className: "bg-cream" },
                { label: "Ink", className: "bg-ink text-cream" },
                { label: "CTA", className: "bg-cta" },
                { label: "Acento", className: "bg-accent" },
                { label: "Madera", className: "bg-wood text-cream" },
                { label: "Success", className: "bg-success" },
                { label: "Info", className: "bg-info" },
                { label: "Card", className: "bg-card" },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`flex h-16 items-center justify-center rounded-2xl border border-border ${item.className}`}
                >
                  {item.label}
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="space-y-4">
            <CardTitle>Botones & Inputs</CardTitle>
            <div className="flex flex-wrap gap-3">
              <Button size="md">Primary</Button>
              <Button variant="secondary" size="md">
                Secondary
              </Button>
              <Button variant="ghost" size="md">
                Ghost
              </Button>
              <Button size="xl">Kiosk XL</Button>
            </div>
            <div className="space-y-3">
              <Input placeholder="Número de pedido" />
              <Input placeholder="Buscar producto" />
            </div>
          </Card>

          <Card className="space-y-4">
            <CardTitle>Badges de estado</CardTitle>
            <div className="flex flex-wrap gap-3">
              <Badge variant="new">Nuevo / En cola</Badge>
              <Badge variant="prep">En preparación</Badge>
              <Badge variant="ready">Listo</Badge>
              <Badge variant="delivery">En reparto</Badge>
              <Badge variant="urgent">Urgente</Badge>
            </div>
            <div className="flex flex-wrap gap-3">
              <StatusBadge status="nuevo" />
              <StatusBadge status="en-preparacion" />
              <StatusBadge status="listo" />
              <StatusBadge status="en-reparto" />
              <StatusBadge status="urgente" />
            </div>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <ProductCard
            title="Combo Clásico"
            description="Hamburguesa + papas + bebida"
            price="$149"
            tag="Plancha"
          />
          <ProductCard
            title="Alitas BBQ"
            description="8 piezas con salsa"
            price="$129"
            tag="Freidora"
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <OrderCard
            orderNumber="042"
            status="en-preparacion"
            station="Plancha"
            items={["Burger doble", "Torta ahogada"]}
          />
          <OrderCard
            orderNumber="043"
            status="listo"
            station="Freidora"
            items={["Papas gajo", "Aros de cebolla"]}
          />
        </section>

        <BottomActions>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-ink/60">
              Modo kiosk
            </p>
            <p className="text-lg font-semibold">Listo para tomar pedidos</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button size="lg">Comer aquí</Button>
            <Button variant="secondary" size="lg">
              Para llevar
            </Button>
          </div>
        </BottomActions>

        <div className="relative min-h-[240px]">
          <Modal className="absolute inset-0">
            <ModalPanel>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-ink/60">
                    Modal ejemplo
                  </p>
                  <h2 className="text-2xl font-bold text-ink">
                    Confirmar pedido #045
                  </h2>
                </div>
                <p className="text-base text-ink/80">
                  El pedido está listo para empaquetar. ¿Deseas moverlo a la
                  estación final?
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button size="md">Confirmar</Button>
                  <Button variant="secondary" size="md">
                    Revisar
                  </Button>
                </div>
              </div>
            </ModalPanel>
          </Modal>
        </div>
      </section>
    </div>
  );
}

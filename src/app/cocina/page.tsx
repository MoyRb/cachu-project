"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal, ModalPanel } from "@/components/ui/Modal";
import { TopBar } from "@/components/ui/TopBar";
import {
  KitchenRole,
  persistKitchenRole,
  persistKitchenUserId,
} from "@/lib/kitchen/auth";

type RoleOption = {
  role: KitchenRole;
  label: string;
  userId: number;
  pin: string;
  href: string;
  description: string;
};

const resolvePin = (envValue: string | undefined, fallback: string) => {
  if (!envValue) {
    return fallback;
  }
  const trimmed = envValue.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

const PLANCHA_PIN = resolvePin(
  process.env.NEXT_PUBLIC_KITCHEN_PIN_PLANCHA,
  "1111",
);
const FREIDORA_PIN = resolvePin(
  process.env.NEXT_PUBLIC_KITCHEN_PIN_FREIDORA,
  "2222",
);
const EMPAQUETADO_PIN = resolvePin(
  process.env.NEXT_PUBLIC_KITCHEN_PIN_EMPAQUETADO,
  "3333",
);

const ROLE_OPTIONS: RoleOption[] = [
  {
    role: "PLANCHA",
    label: "Plancha",
    userId: 2,
    pin: PLANCHA_PIN,
    href: "/cocina/plancha",
    description: "Hamburguesas y plancha caliente.",
  },
  {
    role: "FREIDORA",
    label: "Freidora",
    userId: 3,
    pin: FREIDORA_PIN,
    href: "/cocina/freidora",
    description: "Papas, croquetas y frituras.",
  },
  {
    role: "EMPAQUETADO",
    label: "Empaquetado",
    userId: 4,
    pin: EMPAQUETADO_PIN,
    href: "/cocina/empaquetado",
    description: "Armar pedidos y entregar.",
  },
];

export default function CocinaLandingPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<RoleOption | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const openRole = (option: RoleOption) => {
    setSelectedRole(option);
    setPin("");
    setError(null);
  };

  const handleConfirm = () => {
    if (!selectedRole) {
      return;
    }

    if (pin !== selectedRole.pin) {
      setError("PIN incorrecto. Intenta nuevamente.");
      return;
    }

    persistKitchenRole(selectedRole.role);
    persistKitchenUserId(selectedRole.userId);
    router.push(selectedRole.href);
  };

  const handleClose = () => {
    setSelectedRole(null);
    setPin("");
    setError(null);
  };

  return (
    <main className="min-h-screen bg-transparent px-6 py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <TopBar>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">
              Cocina
            </p>
            <h1 className="text-3xl font-bold text-ink">
              Selecciona tu estación
            </h1>
          </div>
        </TopBar>

        <section className="grid gap-6 md:grid-cols-4">
          {ROLE_OPTIONS.map((option) => (
            <Card key={option.role} className="flex h-full flex-col">
              <CardTitle className="text-2xl">{option.label}</CardTitle>
              <CardDescription className="mt-2 text-base">
                {option.description}
              </CardDescription>
              <div className="mt-6 flex flex-1 items-end">
                <Button size="xl" className="w-full" onClick={() => openRole(option)}>
                  Entrar a {option.label}
                </Button>
              </div>
            </Card>
          ))}

          <Card className="flex h-full flex-col">
            <CardTitle className="text-2xl">Caja</CardTitle>
            <CardDescription className="mt-2 text-base">
              Cobrar pedidos y liberar a cocina
            </CardDescription>
            <div className="mt-6 flex flex-1 items-end">
              <Button size="xl" className="w-full" onClick={() => router.push("/caja")}>
                Entrar a Caja
              </Button>
            </div>
          </Card>
        </section>
      </div>

      {selectedRole ? (
        <Modal>
          <ModalPanel className="space-y-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-muted">
                {selectedRole.label}
              </p>
              <h2 className="text-2xl font-bold text-ink">
                Ingresa el PIN de la estación
              </h2>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-muted">
                PIN
              </label>
              <Input
                type="password"
                inputMode="numeric"
                placeholder="••••"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
              />
              {error ? (
                <p className="text-sm font-semibold text-danger">{error}</p>
              ) : null}
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="secondary" onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={handleConfirm}>Confirmar</Button>
            </div>
          </ModalPanel>
        </Modal>
      ) : null}
    </main>
  );
}

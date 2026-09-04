"use client";

import { useSyncExternalStore } from "react";

import { getStoredKitchenUserId } from "@/lib/kitchen/auth";
import type { KitchenRole } from "@/lib/kitchen/types";

// Caja siempre opera como ADMIN, independientemente del rol almacenado en
// localStorage por las estaciones de cocina (PLANCHA, FREIDORA, EMPAQUETADO).
// Este hook NO lee ni escribe cachu_role, por lo que no afecta las sesiones
// de cocina existentes.
const CAJA_ROLE: KitchenRole = "ADMIN";

// useSyncExternalStore es el patrón recomendado por React para leer de
// almacenamiento del navegador: evita llamar setState dentro de un efecto
// y maneja correctamente la diferencia SSR vs cliente.
const subscribe = () => () => {
  /* localStorage no emite eventos para lectura inicial */
};
const getUserIdSnapshot = () => getStoredKitchenUserId() ?? 1;
const getUserIdServerSnapshot = () => 1;

export function useCajaSession() {
  const userId = useSyncExternalStore(
    subscribe,
    getUserIdSnapshot,
    getUserIdServerSnapshot,
  );

  return { role: CAJA_ROLE, userId };
}

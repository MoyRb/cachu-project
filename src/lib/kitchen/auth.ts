export type KitchenRole = "PLANCHA" | "FREIDORA" | "EMPAQUETADO" | "ADMIN";

export const kitchenRoles: KitchenRole[] = [
  "PLANCHA",
  "FREIDORA",
  "EMPAQUETADO",
  "ADMIN",
];

const ROLE_STORAGE_KEY = "cachu-kitchen-role";
const USER_ID_STORAGE_KEY = "cachu-kitchen-user-id";

export function isKitchenDev() {
  return process.env.NODE_ENV !== "production";
}

export function getStoredKitchenRole(defaultRole: KitchenRole) {
  if (typeof window === "undefined") {
    return defaultRole;
  }

  const stored = window.localStorage.getItem(ROLE_STORAGE_KEY);
  if (stored && kitchenRoles.includes(stored as KitchenRole)) {
    return stored as KitchenRole;
  }

  return defaultRole;
}

export function getStoredKitchenUserId(defaultUserId = 1) {
  if (typeof window === "undefined") {
    return defaultUserId;
  }

  const stored = window.localStorage.getItem(USER_ID_STORAGE_KEY);
  const parsed = Number(stored);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return defaultUserId;
}

export function persistKitchenRole(role: KitchenRole) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ROLE_STORAGE_KEY, role);
}

export function persistKitchenUserId(userId: number) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(USER_ID_STORAGE_KEY, String(userId));
}

export function buildKitchenHeaders(role: KitchenRole, userId: number) {
  return {
    "X-ROLE": role,
    "X-USER-ID": String(userId),
  };
}

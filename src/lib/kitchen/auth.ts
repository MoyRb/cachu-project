import { isKitchenRole, kitchenRoles } from "@/lib/kitchen/types";
import type { KitchenRole } from "@/lib/kitchen/types";

export { kitchenRoles };
export type { KitchenRole };

const ROLE_STORAGE_KEY = "cachu_role";
const USER_ID_STORAGE_KEY = "cachu_user_id";

export function isKitchenDev() {
  return process.env.NODE_ENV !== "production";
}

export function getStoredKitchenRole() {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(ROLE_STORAGE_KEY);
  if (stored && isKitchenRole(stored)) {
    return stored;
  }

  return null;
}

export function getStoredKitchenUserId() {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(USER_ID_STORAGE_KEY);
  const parsed = Number(stored);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return null;
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

export function clearKitchenSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ROLE_STORAGE_KEY);
  window.localStorage.removeItem(USER_ID_STORAGE_KEY);
}

export function getStoredKitchenSession() {
  const role = getStoredKitchenRole();
  const userId = getStoredKitchenUserId();

  if (role && userId) {
    return { role, userId };
  }

  return null;
}

export function buildKitchenHeaders(role: KitchenRole, userId: number) {
  return {
    "X-ROLE": role,
    "X-USER-ID": String(userId),
  };
}

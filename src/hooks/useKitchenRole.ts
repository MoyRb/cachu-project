"use client";

import { useEffect, useState } from "react";

import {
  clearKitchenSession,
  getStoredKitchenSession,
  isKitchenDev,
  persistKitchenRole,
  persistKitchenUserId,
} from "@/lib/kitchen/auth";
import type { KitchenRole } from "@/lib/kitchen/auth";

export function useKitchenRole(defaultRole: KitchenRole) {
  const [role, setRole] = useState<KitchenRole>(defaultRole);
  const [userId, setUserId] = useState(1);
  const [hasSession, setHasSession] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const session = getStoredKitchenSession();
    if (session) {
      setRole(session.role);
      setUserId(session.userId);
      setHasSession(true);
    } else {
      setHasSession(false);
    }
    setIsReady(true);
  }, [defaultRole]);

  useEffect(() => {
    if (!hasSession) {
      return;
    }

    persistKitchenRole(role);
  }, [hasSession, role]);

  useEffect(() => {
    if (!hasSession) {
      return;
    }

    persistKitchenUserId(userId);
  }, [hasSession, userId]);

  const clearSession = () => {
    clearKitchenSession();
    setRole(defaultRole);
    setUserId(1);
    setHasSession(false);
  };

  return {
    role,
    setRole,
    userId,
    setUserId,
    hasSession,
    isReady,
    clearSession,
    isDev: isKitchenDev(),
  };
}

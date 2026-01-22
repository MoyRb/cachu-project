"use client";

import { useEffect, useState } from "react";

import {
  getStoredKitchenRole,
  getStoredKitchenUserId,
  isKitchenDev,
  KitchenRole,
  persistKitchenRole,
  persistKitchenUserId,
} from "@/lib/kitchen/auth";

export function useKitchenRole(defaultRole: KitchenRole) {
  const [role, setRole] = useState<KitchenRole>(defaultRole);
  const [userId, setUserId] = useState(1);

  useEffect(() => {
    setRole(getStoredKitchenRole(defaultRole));
    setUserId(getStoredKitchenUserId(1));
  }, [defaultRole]);

  useEffect(() => {
    persistKitchenRole(role);
  }, [role]);

  useEffect(() => {
    persistKitchenUserId(userId);
  }, [userId]);

  return {
    role,
    setRole,
    userId,
    setUserId,
    isDev: isKitchenDev(),
  };
}

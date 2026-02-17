"use client";

import { kitchenRoles } from "@/lib/kitchen/auth";
import type { KitchenRole } from "@/lib/kitchen/auth";
import { cn } from "@/lib/utils";

type RoleSelectorProps = {
  role: KitchenRole;
  onChange: (role: KitchenRole) => void;
  isVisible?: boolean;
};

export function RoleSelector({ role, onChange, isVisible = true }: RoleSelectorProps) {
  if (!isVisible) {
    return null;
  }

  return (
    <label className="flex items-center gap-3 text-base font-semibold text-ink">
      <span className="uppercase tracking-wide text-muted">Rol</span>
      <select
        className={cn(
          "rounded-2xl border border-border bg-surface-2 px-4 py-2 text-base font-semibold text-ink shadow-sm",
        )}
        value={role}
        onChange={(event) => onChange(event.target.value as KitchenRole)}
      >
        {kitchenRoles.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

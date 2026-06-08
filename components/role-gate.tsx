"use client";

import { useRole } from "./role-provider";
import { canAccess, type ViewKey, type RoleKey } from "@/lib/roles";
import { AccessDenied } from "./ui/access";
import type { ReactNode } from "react";

/** Klientstyrd behörighetskontroll för en vy (§7). Statisk sajt: gating sker i webbläsaren. */
export function RoleGate({ view, children }: { view: ViewKey; children: ReactNode }) {
  const { role } = useRole();
  if (!canAccess(role, view)) return <AccessDenied role={role} />;
  return <>{children}</>;
}

/** Visar innehåll endast för vissa roller (utan "behörighet saknas"-vy). */
export function RoleOnly({ roles, children }: { roles: RoleKey[]; children: ReactNode }) {
  const { role } = useRole();
  if (!roles.includes(role)) return null;
  return <>{children}</>;
}

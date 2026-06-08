import { Card } from "./primitives";
import { roleLabel, type RoleKey } from "@/lib/roles";

/** Visas när aktuell roll saknar behörighet till en vy (§7). */
export function AccessDenied({ role }: { role: RoleKey }) {
  return (
    <Card className="mx-auto mt-10 max-w-lg p-8 text-center">
      <p className="font-display text-2xl">Behörighet saknas</p>
      <p className="mt-2 text-[var(--text-muted)]">
        Rollen <strong>{roleLabel(role)}</strong> har inte åtkomst till den här vyn i demon. Byt roll i
        rollväljaren uppe till höger för att se mer.
      </p>
      <p className="mt-4 text-sm text-[var(--text-muted)]">
        I en skarp lösning skulle åtkomsten styras av behörighetsregler i databasen.
      </p>
    </Card>
  );
}

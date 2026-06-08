"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "./ui/primitives";
import type { StudentRow } from "@/lib/db/queries";

export function StudentSearch({ students }: { students: StudentRow[] }) {
  const [q, setQ] = useState("");
  const norm = q.trim().toLowerCase();
  const filtered = norm
    ? students.filter(
        (s) =>
          `${s.first_name} ${s.last_name}`.toLowerCase().includes(norm) ||
          s.class_id.toLowerCase().includes(norm),
      )
    : students;

  return (
    <div>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Sök på namn eller klass, t.ex. 8A…"
        aria-label="Sök elev"
        className="mb-4 w-full max-w-md rounded-lg border border-[var(--border-strong)] bg-white px-4 py-2.5 text-[15px] focus:border-[var(--gbg-blue)] focus:outline-none"
      />
      <p className="mb-3 text-sm text-[var(--text-muted)]">{filtered.length} elever</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.slice(0, 120).map((s) => (
          <Link key={s.student_id} href={`/elev/${s.student_id}`}>
            <Card className="flex items-center justify-between p-3 transition-shadow hover:shadow-md">
              <span className="font-medium">{s.first_name} {s.last_name}</span>
              <span className="text-sm text-[var(--text-muted)]">{s.class_id}</span>
            </Card>
          </Link>
        ))}
      </div>
      {filtered.length > 120 && (
        <p className="mt-3 text-sm text-[var(--text-muted)]">Visar de första 120 träffarna. Förfina sökningen för att se fler.</p>
      )}
    </div>
  );
}

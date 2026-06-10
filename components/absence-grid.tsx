"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "./ui/primitives";
import { pct } from "@/lib/format";
import type { AbsenceCell, StudentAbsenceRow } from "@/lib/db/queries-history";

// Frånvarorutnät per elev – växlar mellan "per månad (innevarande läsår)" och
// "per termin (fyra läsår)", som skolans egen frånvarorapport.

const BUCKETS = [
  { min: 0.25, label: "≥ 25 %", cls: "bg-[var(--gbg-red-light)] text-[var(--gbg-red-dark)]" },
  { min: 0.15, label: "15–25 %", cls: "bg-[var(--gbg-orange-light)] text-[var(--gbg-orange-dark)]" },
  { min: 0.10, label: "10–15 %", cls: "bg-[var(--gbg-yellow-light)] text-[var(--text-strong)]" },
  { min: 0, label: "< 10 %", cls: "bg-[var(--gbg-green-light)] text-[var(--gbg-green-dark)]" },
] as const;

function cellClass(rate: number): string {
  return BUCKETS.find((b) => rate >= b.min)!.cls;
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-[var(--gbg-blue)] text-white" : "bg-[var(--surface-muted)] text-[var(--text-default)] hover:bg-[var(--border-subtle)]"
      }`}
    >
      {children}
    </button>
  );
}

export function AbsenceGrid({
  monthly,
  byTerm,
}: {
  monthly: { columns: AbsenceCell[]; rows: StudentAbsenceRow[] };
  byTerm: { columns: AbsenceCell[]; rows: StudentAbsenceRow[] };
}) {
  const [mode, setMode] = useState<"manad" | "termin">("manad");
  const data = mode === "manad" ? monthly : byTerm;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <ModeButton active={mode === "manad"} onClick={() => setMode("manad")}>
          Per månad · innevarande läsår
        </ModeButton>
        <ModeButton active={mode === "termin"} onClick={() => setMode("termin")}>
          Per termin · fyra läsår
        </ModeButton>
      </div>

      <Card className="table-card table-card--scroll">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-left text-[var(--text-muted)]">
              <th className="px-4 py-2 font-medium">Elev</th>
              {data.columns.map((c) => (
                <th key={c.key} className="px-1.5 py-2 text-center font-medium">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.student_id} className="border-b border-[var(--border-subtle)] last:border-0">
                <td className="px-4 py-1.5">
                  <Link href={`/elev/${r.student_id}`} className="font-medium hover:text-[var(--gbg-blue)] hover:underline">
                    {r.name}
                  </Link>
                </td>
                {r.cells.map((c) => (
                  <td key={c.key} className="px-1.5 py-1.5 text-center">
                    {c.rate == null ? (
                      <span className="text-[var(--text-muted)]">·</span>
                    ) : (
                      <span className={`inline-block min-w-12 rounded-[4px] px-1 py-0.5 font-semibold tabular ${cellClass(c.rate)}`}>
                        {pct(c.rate, 1)}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--text-muted)]">
        <span>Frånvaroandel:</span>
        {[...BUCKETS].reverse().map((b) => (
          <span key={b.label} className="flex items-center gap-1.5">
            <span aria-hidden className={`inline-block size-3 rounded-[3px] ${b.cls.split(" ")[0]}`} />
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

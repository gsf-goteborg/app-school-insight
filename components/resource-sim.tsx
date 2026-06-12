"use client";

import { useState } from "react";
import { Card, Pill } from "./ui/primitives";
import { num, tkr } from "@/lib/format";

// Resurssimulering "vad händer om": dra i speciallärar-FTE per stadium och se
// belastningen (flaggade elever per tjänst) och kostnadskonsekvensen räknas om
// direkt. Helt klientstyrd – ändrar ingenting, sparar ingenting. Underlag för
// samtalet om omfördelning, inte ett beslut.

/** Antagen helårskostnad per speciallärartjänst (lön + omkostnader), kr. */
export const SPECIAL_FTE_COST = 760_000;

export interface SimRow {
  arbetslag: string;
  grades: string;
  flagged: number;
  hog: number;
  specialFte: number;
}

function loadOf(flagged: number, fte: number): number | null {
  return fte > 0 ? flagged / fte : null;
}

export function ResourceSim({ rows }: { rows: SimRow[] }) {
  const [fte, setFte] = useState<Record<string, number>>(
    Object.fromEntries(rows.map((r) => [r.arbetslag, r.specialFte])),
  );

  const totalNow = rows.reduce((s, r) => s + r.specialFte, 0);
  const totalSim = rows.reduce((s, r) => s + (fte[r.arbetslag] ?? 0), 0);
  const deltaFte = totalSim - totalNow;
  const deltaCost = deltaFte * SPECIAL_FTE_COST;

  const loadsNow = rows.map((r) => loadOf(r.flagged, r.specialFte)).filter((x): x is number => x != null);
  const loadsSim = rows.map((r) => loadOf(r.flagged, fte[r.arbetslag] ?? 0)).filter((x): x is number => x != null);
  const spread = (xs: number[]) => (xs.length > 1 ? Math.max(...xs) - Math.min(...xs) : 0);

  const totalFlagged = rows.reduce((s, r) => s + r.flagged, 0);
  const balance = () => {
    // Fördela dagens totala FTE proportionellt mot antalet flaggade elever.
    const next: Record<string, number> = {};
    for (const r of rows) {
      next[r.arbetslag] = Math.round(((r.flagged / totalFlagged) * totalNow) * 4) / 4;
    }
    setFte(next);
  };
  const resetSim = () => setFte(Object.fromEntries(rows.map((r) => [r.arbetslag, r.specialFte])));

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--text-muted)]">
          Dra i tjänsterna och se belastningen räknas om
        </p>
        <span className="flex gap-2">
          <button
            type="button"
            onClick={balance}
            className="rounded-lg bg-[var(--surface-muted)] px-3 py-1.5 text-sm font-semibold text-[var(--gbg-blue)] hover:bg-[var(--border-subtle)]"
          >
            Fördela efter behov
          </button>
          <button
            type="button"
            onClick={resetSim}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-[var(--text-muted)] hover:underline"
          >
            Återställ
          </button>
        </span>
      </div>

      <div className="space-y-4">
        {rows.map((r) => {
          const v = fte[r.arbetslag] ?? 0;
          const now = loadOf(r.flagged, r.specialFte);
          const sim = loadOf(r.flagged, v);
          const better = now != null && sim != null ? sim < now - 0.5 : sim != null && now == null;
          const worse = now != null && (sim == null || sim > now + 0.5);
          return (
            <div key={r.arbetslag} className="grid grid-cols-1 items-center gap-2 lg:grid-cols-[12rem_minmax(10rem,1fr)_minmax(14rem,auto)]">
              <span className="text-sm">
                <span className="font-medium">{r.arbetslag}</span>{" "}
                <span className="text-[var(--text-muted)]">{r.grades} · {num(r.flagged)} flaggade</span>
              </span>
              <span className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={4}
                  step={0.25}
                  value={v}
                  onChange={(e) => setFte({ ...fte, [r.arbetslag]: Number(e.target.value) })}
                  aria-label={`Speciallärartjänster i ${r.arbetslag}`}
                  className="w-full accent-[var(--gbg-blue)]"
                />
                <span className="w-14 shrink-0 text-sm tabular">
                  {num(v, 2)} <span className="text-[var(--text-muted)]">tj.</span>
                </span>
              </span>
              <span className="text-sm tabular">
                {sim == null ? (
                  <span className="font-medium text-[var(--gbg-red-dark)]">ingen resurs</span>
                ) : (
                  <span className={better ? "font-medium text-[var(--gbg-green-dark)]" : worse ? "font-medium text-[var(--gbg-orange-dark)]" : ""}>
                    {num(sim, 0)} flaggade/tjänst
                  </span>
                )}
                <span className="text-[var(--text-muted)]">
                  {" "}(idag {now == null ? "ingen resurs" : num(now, 0)}
                  {v !== r.specialFte ? `, ${v > r.specialFte ? "+" : "−"}${num(Math.abs(v - r.specialFte), 2)} tj.` : ""})
                </span>
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-4">
        <Pill tone={Math.abs(deltaFte) < 0.01 ? "neutral" : deltaFte > 0 ? "uppmarksam" : "positiv"}>
          {Math.abs(deltaFte) < 0.01
            ? "Samma totala bemanning som idag"
            : `${deltaFte > 0 ? "+" : "−"}${num(Math.abs(deltaFte), 2)} tjänster ≈ ${deltaCost > 0 ? "+" : "−"}${tkr(Math.abs(deltaCost))}/år`}
        </Pill>
        <Pill tone={spread(loadsSim) < spread(loadsNow) - 1 ? "positiv" : "neutral"}>
          Spridning i belastning: {num(spread(loadsSim), 0)} (idag {num(spread(loadsNow), 0)})
        </Pill>
      </div>

      <p className="mt-3 text-sm text-[var(--text-muted)]">
        Antagen kostnad {tkr(SPECIAL_FTE_COST)}/år per speciallärartjänst. Statisk modell: visar hur
        belastningen per tjänst fördelas – inte elevutfall. Simuleringen ändrar ingenting och sparas inte.
      </p>
    </Card>
  );
}

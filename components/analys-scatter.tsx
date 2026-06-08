"use client";

import { useState } from "react";
import { Card } from "./ui/primitives";
import { ScatterChart } from "./charts";
import { num } from "@/lib/format";

export interface ScatterPoint { x: number; y: number; label: string; grade: number }

export function AnalysScatter({ points }: { points: ScatterPoint[] }) {
  const [grade, setGrade] = useState<number | null>(null);
  const shown = grade ? points.filter((p) => p.grade === grade) : points;

  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap gap-1 text-sm">
        {[null, 7, 8, 9, 10].map((g) => {
          const active = g === grade;
          return (
            <button
              key={String(g)}
              onClick={() => setGrade(g)}
              className={`rounded-lg px-3 py-1.5 font-medium ${active ? "bg-[var(--gbg-blue)] text-white" : "bg-[var(--surface-muted)] text-[var(--text-default)] hover:bg-[var(--border-subtle)]"}`}
            >
              {g === null ? "Alla åk 7–10" : `Åk ${g}`}
            </button>
          );
        })}
      </div>
      <ScatterChart
        ariaLabel="Punktdiagram över frånvaro mot meritvärde"
        points={shown}
        xName="Frånvaro (%)"
        yName="Meritvärde"
        yMax={340}
        height={380}
      />
      <p className="mt-2 text-sm text-[var(--text-muted)]">{num(shown.length)} elever i urvalet.</p>
    </Card>
  );
}

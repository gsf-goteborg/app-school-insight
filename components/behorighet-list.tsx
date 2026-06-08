"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, Pill } from "./ui/primitives";
import { num, pct } from "@/lib/format";
import type { BehorighetForecast, RiskBucket } from "@/lib/db/queries-behorighet";

// Lokala (runtime-fria) display-metadata så att inget dras in från server-only-modulen.
const BUCKET_META: Record<RiskBucket, { label: string; tone: "kritisk" | "uppmarksam" | "info" | "positiv" }> = {
  3: { label: "Risk 3", tone: "kritisk" },
  2: { label: "Risk 2", tone: "uppmarksam" },
  1: { label: "Risk 1", tone: "info" },
  0: { label: "Risk 0", tone: "positiv" },
};

const BUCKETS: RiskBucket[] = [3, 2, 1, 0];
const BANDS: { key: string; label: string; test: (g: number) => boolean }[] = [
  { key: "4-6", label: "Åk 4–6", test: (g) => g >= 4 && g <= 6 },
  { key: "7-10", label: "Åk 7–10", test: (g) => g >= 7 },
];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

export function BehorighetList({ rows }: { rows: BehorighetForecast[] }) {
  const [bucket, setBucket] = useState<RiskBucket | null>(null);
  const [band, setBand] = useState<string | null>(null);

  const bandTest = BANDS.find((b) => b.key === band)?.test;
  const shown = rows.filter(
    (r) => (bucket == null || r.bucket === bucket) && (!bandTest || bandTest(r.grade_level)),
  );

  return (
    <div>
      <div className="mb-3 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-sm text-[var(--text-muted)]">Riskgrupp:</span>
          <Chip active={bucket === null} onClick={() => setBucket(null)}>Alla</Chip>
          {BUCKETS.map((b) => (
            <Chip key={b} active={bucket === b} onClick={() => setBucket(b)}>
              {BUCKET_META[b].label} ({num(rows.filter((r) => r.bucket === b).length)})
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-sm text-[var(--text-muted)]">Årskurs:</span>
          <Chip active={band === null} onClick={() => setBand(null)}>Alla</Chip>
          {BANDS.map((b) => (
            <Chip key={b.key} active={band === b.key} onClick={() => setBand(b.key)}>{b.label}</Chip>
          ))}
        </div>
      </div>

      <p className="mb-3 text-sm text-[var(--text-muted)]">
        Visar {num(shown.length)} av {num(rows.length)} elever (åk 4–10){bucket != null || band ? " i urvalet" : ""}.
        Sorterade efter lägst sannolikhet (högst risk) först.
      </p>

      {shown.length === 0 ? (
        <Card className="p-5 text-[var(--text-muted)]">Inga elever matchar filtret.</Card>
      ) : (
        <div className="space-y-3">
          {shown.map((r) => (
            <Card key={r.student_id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/elev/${r.student_id}`} className="font-semibold hover:text-[var(--gbg-blue)] hover:underline">
                      {r.name}
                    </Link>
                    <Pill tone={BUCKET_META[r.bucket].tone}>{BUCKET_META[r.bucket].label}</Pill>
                  </div>
                  <p className="mt-0.5 text-sm text-[var(--text-muted)]">Klass {r.class_id} · åk {r.grade_level}</p>
                </div>
                <span className="shrink-0 text-right text-sm text-[var(--text-muted)]">
                  Sannolikhet behörighet
                  <span className="ml-2 tabular text-base font-semibold text-[var(--text-strong)]">{pct(r.probability)}</span>
                </span>
              </div>

              {r.factors.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.factors.map((f, i) => (
                    <Pill key={i} tone="neutral">{f}</Pill>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

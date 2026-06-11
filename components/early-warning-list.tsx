"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, Pill } from "./ui/primitives";
import { num } from "@/lib/format";
import type { RiskStudent, RiskLevel, RiskCategory } from "@/lib/db/queries-risk";

const LEVEL_TONE: Record<RiskLevel, "kritisk" | "uppmarksam" | "info"> = {
  Hög: "kritisk",
  Förhöjd: "uppmarksam",
  Bevaka: "info",
};

// Lokala (runtime-fria) listor så att inget dras in från server-only-modulen.
const CATEGORIES: RiskCategory[] = ["Frånvaro", "Kunskap", "Trivsel", "Stöd"];
const BANDS: { key: string; label: string; test: (g: number) => boolean }[] = [
  { key: "1-3", label: "Åk 1–3", test: (g) => g <= 3 },
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

export function EarlyWarningList({ rows, bevaka }: { rows: RiskStudent[]; bevaka: number }) {
  const [cat, setCat] = useState<RiskCategory | null>(null);
  const [band, setBand] = useState<string | null>(null);
  // Rangordnad lista → topp 25 som standard, resten bakom "visa alla".
  const [showAll, setShowAll] = useState(false);
  const CAP = 25;

  const bandTest = BANDS.find((b) => b.key === band)?.test;
  const shown = rows.filter(
    (r) => (!cat || r.categories.includes(cat)) && (!bandTest || bandTest(r.grade_level)),
  );

  return (
    <div>
      <div className="mb-3 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-sm text-[var(--text-muted)]">Typ av oro:</span>
          <Chip active={cat === null} onClick={() => setCat(null)}>Alla</Chip>
          {CATEGORIES.map((c) => (
            <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
              {c} ({num(rows.filter((r) => r.categories.includes(c)).length)})
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
        {shown.length > CAP && !showAll
          ? `Visar de ${num(CAP)} starkaste signalerna av ${num(shown.length)} elever med hög eller förhöjd risk.`
          : `Visar ${num(shown.length)} av ${num(rows.length)} elever med hög eller förhöjd risk${cat || band ? " i urvalet" : ""}.`}{" "}
        Ytterligare {num(bevaka)} elever har en svagare signal att bevaka.
      </p>

      {shown.length === 0 ? (
        <Card className="p-5 text-[var(--text-muted)]">Inga elever matchar filtret.</Card>
      ) : (
        <div className="space-y-3">
          {(showAll ? shown : shown.slice(0, CAP)).map((r) => (
            <Card key={r.student_id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/elev/${r.student_id}`} className="font-semibold hover:text-[var(--gbg-blue)] hover:underline">
                      {r.name}
                    </Link>
                    <Pill tone={LEVEL_TONE[r.level]}>{r.level} risk</Pill>
                  </div>
                  <p className="mt-0.5 text-sm text-[var(--text-muted)]">Klass {r.class_id} · åk {r.grade_level}</p>
                </div>
                <span className="shrink-0 text-sm text-[var(--text-muted)]">
                  Signalstyrka <span className="tabular font-semibold text-[var(--text-strong)]">{r.score}</span>
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {r.signals.map((s, i) => (
                  <Pill key={i} tone="neutral">{s.label}</Pill>
                ))}
              </div>

              <p className="mt-3 text-sm">
                <span className="font-medium text-[var(--text-muted)]">Förslag på nästa steg: </span>
                {r.action}
              </p>
            </Card>
          ))}
          {shown.length > CAP && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm font-semibold text-[var(--gbg-blue)] hover:bg-[var(--border-subtle)]"
            >
              {showAll ? `Visa endast topp ${num(CAP)}` : `Visa alla ${num(shown.length)} elever i urvalet`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

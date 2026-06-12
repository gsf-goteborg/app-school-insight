"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, Pill } from "./ui/primitives";
import { num } from "@/lib/format";
import { useDemoStore } from "./demo-store";
import { ActionStatusPill, ActionEditor } from "./student-action";
import type { PriorityStudent, LensKey, LensTone } from "@/lib/db/queries-priority";

// Lokala (runtime-fria) listor så att inget dras in från server-only-modulen.
const LENS_FILTERS: { key: LensKey; label: string }[] = [
  { key: "tidig", label: "Tidig signal" },
  { key: "behorighet", label: "Behörighetsrisk" },
  { key: "skuld", label: "Ihållande svårigheter" },
  { key: "tappar", label: "Tappar mark" },
  { key: "trend", label: "Fallande trend" },
  { key: "franvaro", label: "Växande frånvaro" },
];

const SUPPORT_SHORT: Record<PriorityStudent["support"], string> = {
  atgardsprogram: "Åtgärdsprogram",
  utredning: "Utredning pågår",
  anpassning: "Extra anpassning",
  ingen: "Ingen formell process",
};

const LENS_TONE_CLASS: Record<LensTone, string> = {
  kritisk: "bg-[var(--gbg-red-light)] text-[var(--gbg-red-dark)]",
  uppmarksam: "bg-[var(--gbg-orange-light)] text-[var(--gbg-orange-dark)]",
  info: "bg-[var(--gbg-purple-light)] text-[var(--gbg-purple-dark)]",
};

const BANDS: { key: string; label: string; test: (g: number) => boolean }[] = [
  { key: "1-4", label: "Åk 1–4", test: (g) => g <= 4 },
  { key: "5-7", label: "Åk 5–7", test: (g) => g >= 5 && g <= 7 },
  { key: "8-10", label: "Åk 8–10", test: (g) => g >= 8 },
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

export function PriorityList({ rows }: { rows: PriorityStudent[] }) {
  // Standardläget visar elever som fångas av minst två linser – det är de som
  // sannolikt behöver mest. "Alla" visar även en-lins-eleverna.
  const { actions } = useDemoStore();
  const [multiOnly, setMultiOnly] = useState(true);
  const [gapOnly, setGapOnly] = useState(false);
  const [noActionOnly, setNoActionOnly] = useState(false);
  const [lens, setLens] = useState<LensKey | null>(null);
  const [band, setBand] = useState<string | null>(null);
  // Visa topp 25 som standard – listan är rangordnad, så de viktigaste syns
  // alltid. Skalar till stora skolor utan att bli oöverskådlig.
  const [showAll, setShowAll] = useState(false);
  const CAP = 25;

  const bandTest = BANDS.find((b) => b.key === band)?.test;
  const hasAction = (id: string) => actions.some((a) => a.student_id === id);
  const shown = rows.filter(
    (r) =>
      (!multiOnly || r.lenses.length >= 2) &&
      (!gapOnly || r.formalGap) &&
      (!noActionOnly || !hasAction(r.student_id)) &&
      (!lens || r.lenses.some((l) => l.key === lens)) &&
      (!bandTest || bandTest(r.grade_level)),
  );

  const multiCount = rows.filter((r) => r.lenses.length >= 2).length;

  return (
    <div>
      <div className="mb-3 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-sm text-[var(--text-muted)]">Urval:</span>
          <Chip active={multiOnly} onClick={() => setMultiOnly(true)}>
            Flera linser ({num(multiCount)})
          </Chip>
          <Chip active={!multiOnly} onClick={() => setMultiOnly(false)}>
            Alla ({num(rows.length)})
          </Chip>
          <span className="mx-1 hidden h-4 w-px bg-[var(--border-subtle)] sm:inline-block" aria-hidden />
          <Chip active={gapOnly} onClick={() => setGapOnly((v) => !v)}>
            Utan formell stödprocess
          </Chip>
          <Chip active={noActionOnly} onClick={() => setNoActionOnly((v) => !v)}>
            Utan påbörjad åtgärd
          </Chip>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-sm text-[var(--text-muted)]">Lins:</span>
          <Chip active={lens === null} onClick={() => setLens(null)}>Alla</Chip>
          {LENS_FILTERS.map((l) => (
            <Chip key={l.key} active={lens === l.key} onClick={() => setLens(l.key)}>
              {l.label} ({num(rows.filter((r) => r.lenses.some((x) => x.key === l.key)).length)})
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
          ? `Visar de ${num(CAP)} högst prioriterade av ${num(shown.length)} elever i urvalet.`
          : `Visar ${num(shown.length)} elever, sorterade på antal linser och samlad prioritet.`}
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
                    <Pill tone={r.lenses.length >= 3 ? "kritisk" : r.lenses.length === 2 ? "uppmarksam" : "neutral"}>
                      {r.lenses.length} {r.lenses.length === 1 ? "lins" : "linser"}
                    </Pill>
                    {r.formalGap && <Pill tone="kritisk">Saknar formell stödprocess</Pill>}
                  </div>
                  <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                    Klass {r.class_id} · åk {r.grade_level} · stöd: {SUPPORT_SHORT[r.support]}
                  </p>
                </div>
                <Link href={`/elev/${r.student_id}`} className="shrink-0 text-sm font-semibold text-[var(--gbg-blue)] hover:underline">
                  Öppna elev →
                </Link>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {r.lenses.map((l) => (
                  <span
                    key={l.key}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-semibold ${LENS_TONE_CLASS[l.tone]}`}
                  >
                    {l.label}
                    <span className="font-normal opacity-80">· {l.detail}</span>
                  </span>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3">
                <ActionStatusPill studentId={r.student_id} />
                <ActionEditor studentId={r.student_id} />
              </div>
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

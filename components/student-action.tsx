"use client";

import { useState } from "react";
import { useDemoStore, type StudentAction } from "./demo-store";
import { Pill, Card } from "./ui/primitives";
import { ATGARD_STEPS, ATGARD_STEP_LABEL, type AtgardStep } from "@/lib/constants";
import { num, pct } from "@/lib/format";

// Åtgärdsloopen per elev: var i processen är vi och vem äger nästa steg.
// Klientlagrad i demo-store (localStorage) – i en skarp lösning motsvaras detta
// av elevhälsans ärendehantering. Processtegen är ett ARBETSFLÖDE, inte nivåer.

export function useStudentAction(studentId: string): StudentAction | null {
  const { actions } = useDemoStore();
  return actions.find((a) => a.student_id === studentId) ?? null;
}

/** Statuspill: "Ej påbörjad" (grå) eller aktuellt processteg (tonad). */
export function ActionStatusPill({ studentId }: { studentId: string }) {
  const action = useStudentAction(studentId);
  if (!action) return <Pill tone="neutral">Åtgärd ej påbörjad</Pill>;
  const done = action.step === "avslutad";
  return (
    <span title={action.ansvarig ? `Ansvarig: ${action.ansvarig}` : undefined}>
      <Pill tone={done ? "positiv" : "info"}>
        {ATGARD_STEP_LABEL[action.step as AtgardStep] ?? action.step}
      </Pill>
    </span>
  );
}

/** Kompakt redigerare: välj processteg + ansvarig. Visas bakom en knapp. */
export function ActionEditor({ studentId }: { studentId: string }) {
  const { setAction, removeAction } = useDemoStore();
  const current = useStudentAction(studentId);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<string>(current?.step ?? "kontakt");
  const [ansvarig, setAnsvarig] = useState(current?.ansvarig ?? "");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setStep(current?.step ?? "kontakt");
          setAnsvarig(current?.ansvarig ?? "");
          setOpen(true);
        }}
        className="text-sm font-semibold text-[var(--gbg-blue)] hover:underline"
      >
        {current ? "Uppdatera åtgärd" : "Starta åtgärd"}
      </button>
    );
  }

  return (
    <div className="mt-2 flex w-full flex-wrap items-end gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-[var(--text-muted)]">Processteg</span>
        <select
          value={step}
          onChange={(e) => setStep(e.target.value)}
          className="rounded-md border border-[var(--border-strong)] bg-[var(--surface-card)] px-2 py-1.5"
        >
          {ATGARD_STEPS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </label>
      <label className="flex min-w-44 flex-1 flex-col gap-1 text-sm">
        <span className="font-medium text-[var(--text-muted)]">Ansvarig</span>
        <input
          value={ansvarig}
          onChange={(e) => setAnsvarig(e.target.value)}
          placeholder="t.ex. mentor, kurator"
          className="rounded-md border border-[var(--border-strong)] bg-[var(--surface-card)] px-2 py-1.5"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setAction({ student_id: studentId, step, ansvarig: ansvarig.trim(), note: "" });
            setOpen(false);
          }}
          className="rounded-lg bg-[var(--gbg-blue)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[var(--gbg-blue-dark)]"
        >
          Spara
        </button>
        {current && (
          <button
            type="button"
            onClick={() => {
              removeAction(studentId);
              setOpen(false);
            }}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-[var(--gbg-red-dark)] hover:underline"
          >
            Ta bort
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-3 py-1.5 text-sm font-semibold text-[var(--text-muted)] hover:underline"
        >
          Avbryt
        </button>
      </div>
    </div>
  );
}

/** Elevsidans åtgärdspanel: status + redigerare + demonot. */
export function StudentActionPanel({ studentId }: { studentId: string }) {
  const action = useStudentAction(studentId);
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ActionStatusPill studentId={studentId} />
          {action?.ansvarig && (
            <span className="text-sm text-[var(--text-muted)]">Ansvarig: {action.ansvarig}</span>
          )}
          {action && <span className="text-sm text-[var(--text-muted)]">Uppdaterad {action.updated}</span>}
        </div>
        <ActionEditor studentId={studentId} />
      </div>
      <p className="mt-3 border-t border-[var(--border-subtle)] pt-3 text-sm text-[var(--text-muted)]">
        Åtgärdsloopen följer skolans eskaleringsprocess (kontakt → kartläggning → elevhälsa →
        fördjupad utredning) – ett arbetsflöde med tydlig ägare, inte en bedömning av eleven.
        Sparas i din webbläsare (demo); nollställs med Återställ demodata.
      </p>
    </Card>
  );
}

/** Lednings-/översiktskort: hur många av de prioriterade eleverna har en påbörjad åtgärd. */
export function ActionCoverage({ studentIds }: { studentIds: string[] }) {
  const { actions, ready } = useDemoStore();
  const started = studentIds.filter((id) => actions.some((a) => a.student_id === id)).length;
  const total = studentIds.length;
  const share = total ? started / total : 0;
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--text-muted)]">
          Har varje prioriterad elev en påbörjad åtgärd?
        </p>
        <span className="font-display text-2xl tabular">
          {ready ? `${num(started)} av ${num(total)}` : `– av ${num(total)}`}
        </span>
      </div>
      <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]" role="img"
        aria-label={`${num(started)} av ${num(total)} prioriterade elever har en påbörjad åtgärd`}>
        <div className="h-full bg-[var(--gbg-green)]" style={{ width: `${share * 100}%` }} />
      </div>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        {ready && total > 0 ? `${pct(share, 0)} av eleverna som flaggas i flera underlag har en åtgärd igång. ` : ""}
        Åtgärder startas från Prioriterade elever eller elevens sida och sparas i din webbläsare (demo).
      </p>
    </Card>
  );
}

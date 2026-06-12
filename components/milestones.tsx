import Link from "next/link";
import { Card, Pill, Note, Disclosure } from "@/components/ui/primitives";
import {
  GATES,
  getMilestoneStudents,
  getGateSummaries,
  getMissedGateStudents,
  type GateKey,
} from "@/lib/db/queries-milestones";
import { num, pct } from "@/lib/format";

// Milstolpar i basfärdigheter: per-grind-läget + arbetslista över elever med
// missade grindar. Renderas på Analys. Server-komponent (läser repository-lagret).

const GATE_SHORT: Record<GateKey, string> = {
  avkodning: "Avkodning",
  taluppfattning: "Taluppfattning",
  tabeller: "Räknefärdighet",
  brak: "Bråk",
  prealgebra: "Pre-algebra",
};

const WORKLIST_CAP = 12;

export function Milestones() {
  const students = getMilestoneStudents();
  const summaries = getGateSummaries(students);
  const worklist = getMissedGateStudents(students);
  const noSupport = worklist.filter((s) => !s.hasFormalSupport && s.missed > 0).length;

  return (
    <div>
      <Card className="mb-4 p-5">
        <p className="mb-3 text-sm font-semibold text-[var(--text-muted)]">
          Andel som klarat respektive grind (elever som passerat grindens årskurs, fyra läsårs underlag)
        </p>
        <div className="space-y-3">
          {summaries.map((g) => {
            const share = g.judged ? g.klarad / g.judged : 0;
            return (
              <div key={g.key} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[11rem_1fr_auto]">
                <span className="text-sm font-medium">
                  {g.label} <span className="text-[var(--text-muted)]">åk {g.gradeDue}</span>
                </span>
                <div
                  className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]"
                  role="img"
                  aria-label={`${g.label}: ${num(g.klarad)} av ${num(g.judged)} klarade, ${num(g.missad)} missade${g.riskzon ? `, ${num(g.riskzon)} i riskzon nu` : ""}`}
                >
                  <div className="h-full bg-[var(--gbg-green)]" style={{ width: `${share * 100}%` }} />
                  <div className="h-full bg-[var(--gbg-red)]" style={{ width: `${(g.judged ? g.missad / g.judged : 0) * 100}%` }} />
                </div>
                <span className="text-sm tabular text-[var(--text-muted)]">
                  {pct(share, 0)} klarade · {num(g.missad)} missade
                  {g.riskzon > 0 ? ` · ${num(g.riskzon)} i riskzon nu` : ""}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="mb-4 p-5">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[var(--text-muted)]">
            Elever med missad grind eller i riskzon (åk 1–8, värst och utan stödprocess först)
          </p>
          <Pill tone={noSupport > 0 ? "kritisk" : "positiv"}>
            {num(noSupport)} med missad grind utan formell stödprocess
          </Pill>
        </div>
        <p className="mb-3 text-sm text-[var(--text-muted)]">
          En missad grind är en skuld som växer med kursplanen – insatsen är billigast nu.
        </p>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {worklist.slice(0, WORKLIST_CAP).map((s) => (
            <li key={s.student_id}>
              <Link
                href={`/elev/${s.student_id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2 hover:bg-[var(--surface-muted)]"
              >
                <span className="min-w-0">
                  <span className="font-medium hover:text-[var(--gbg-blue)] hover:underline">{s.name}</span>
                  <span className="ml-2 text-sm text-[var(--text-muted)]">åk {s.grade_level} · {s.class_id}</span>
                </span>
                <span className="flex shrink-0 flex-wrap justify-end gap-1">
                  {s.gates
                    .filter((x) => x.status === "missad" || x.status === "riskzon")
                    .map((x) => (
                      <Pill key={x.gate} tone={x.status === "missad" ? "kritisk" : "uppmarksam"}>
                        {GATE_SHORT[x.gate]}{x.status === "riskzon" ? " (riskzon)" : ""}
                      </Pill>
                    ))}
                  {!s.hasFormalSupport && s.missed > 0 && <Pill tone="neutral">Ingen stödprocess</Pill>}
                </span>
              </Link>
            </li>
          ))}
          {worklist.length > WORKLIST_CAP && (
            <li className="flex items-center rounded-lg border border-dashed border-[var(--border-strong)] px-3 py-2 text-sm text-[var(--text-muted)]">
              + {num(worklist.length - WORKLIST_CAP)} elever till – korsas med linserna i{" "}
              <Link href="/prioritera" className="ml-1 font-semibold text-[var(--gbg-blue)] underline">Prioriterade elever</Link>.
            </li>
          )}
        </ul>
      </Card>

      <Disclosure
        title="Så avläses grindarna"
        description="Inga nya bedömningar – varje grind läses ur en befintlig obligatorisk mätpunkt, vårterminen det läsår eleven gick i grindens årskurs (fyra läsårs historik)."
      >
        <ul className="space-y-2.5 text-[15px]">
          {GATES.map((g) => (
            <li key={g.key} className="grid grid-cols-1 gap-1 sm:grid-cols-[13rem_1fr] sm:gap-3">
              <span className="font-medium">{g.label} (åk {g.gradeDue})</span>
              <span className="text-[var(--text-muted)]">
                {g.source}. {g.why}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 border-t border-[var(--border-subtle)] pt-3 text-sm text-[var(--text-muted)]">
          Klarad = godtagbar nivå (i linje/över) respektive godkänt betyg vid grindens mätpunkt. Riskzon = går i
          grindens årskurs nu med stort stödbehov. Grindar äldre än historikfönstret redovisas som okända. Grind-
          status är ett underlag för läsa-skriva-räkna-garantins arbetsgång – inte ett omdöme om eleven.
        </p>
      </Disclosure>

      <Note tone="info">
        Stöd för <strong>läsa-skriva-räkna-garantin</strong> (skollagen 3 kap): garantin kräver tidig upptäckt,
        insats direkt, uppföljning och överlämning mellan stadier – grindarna gör det synligt när ett kritiskt
        delmoment inte följt med, medan det fortfarande är billigt att åtgärda. Demodata.
      </Note>
    </div>
  );
}

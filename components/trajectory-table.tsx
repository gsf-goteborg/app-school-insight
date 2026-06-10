import { Card, Pill } from "./ui/primitives";
import type { StudentTrajectory, TrajectoryRow, LongTrend } from "@/lib/db/queries-history";
import { LONG_TREND_LABEL } from "@/lib/db/queries-history";
import type { GradeMark, Level } from "@/lib/constants";

// Ämne × termin-rutnät över upp till fyra läsår, med trend per ämne beräknad
// över hela serien. Speglar skolans egen progressionsrapport men med trenden
// förklarad och elevens årskurs per termin i rubriken.

// Cellfärger följer Pill-tonerna (positiv/info/uppmärksam/kritisk) så att
// rutnätet läses likadant som resten av appen.
const MARK_CELL: Record<GradeMark, string> = {
  A: "bg-[var(--gbg-green-light)] text-[var(--gbg-green-dark)]",
  B: "bg-[var(--gbg-green-light)] text-[var(--gbg-green-dark)]",
  C: "bg-[var(--gbg-blue-light)] text-[var(--gbg-blue-dark)]",
  D: "bg-[var(--gbg-yellow-light)] text-[var(--text-strong)]",
  E: "bg-[var(--gbg-orange-light)] text-[var(--gbg-orange-dark)]",
  F: "bg-[var(--gbg-red-light)] text-[var(--gbg-red-dark)]",
  "-": "bg-[var(--gbg-red-light)] text-[var(--gbg-red-dark)]",
};

const LEVEL_CELL: Record<Level, string> = {
  over: "bg-[var(--gbg-green-light)] text-[var(--gbg-green-dark)]",
  i_linje: "bg-[var(--gbg-purple-light)] text-[var(--gbg-purple-dark)]",
  uppmarksam: "bg-[var(--gbg-orange-light)] text-[var(--gbg-orange-dark)]",
  stort_behov: "bg-[var(--gbg-red-light)] text-[var(--gbg-red-dark)]",
};

const TREND_TONE: Record<LongTrend, "positiv" | "kritisk" | "neutral"> = {
  positiv: "positiv",
  negativ: "kritisk",
  neutral: "neutral",
  saknas: "neutral",
};
const TREND_ARROW: Record<LongTrend, string> = {
  positiv: "↗ ",
  negativ: "↘ ",
  neutral: "→ ",
  saknas: "",
};

function TrendPill({ trend }: { trend: LongTrend }) {
  return (
    <Pill tone={TREND_TONE[trend]}>
      {TREND_ARROW[trend]}
      {LONG_TREND_LABEL[trend]}
    </Pill>
  );
}

export function TrajectoryTable({
  trajectory,
  rows,
  caption,
  natBySubject,
}: {
  trajectory: StudentTrajectory;
  rows: TrajectoryRow[];
  caption: string;
  /** Nationellt prov per ämne (endast betygstabellen). */
  natBySubject?: Map<string, GradeMark>;
}) {
  // Visa bara terminer där minst en av raderna har data (betygs- och
  // nivåtabellerna kan täcka olika delar av elevens historik).
  const colHasData = trajectory.terms.map((_, i) => rows.some((r) => r.cells[i] != null));
  const cols = trajectory.terms
    .map((t, i) => ({ ...t, i }))
    .filter((t) => colHasData[t.i]);
  if (rows.length === 0 || cols.length === 0) return null;

  return (
    <Card className="table-card table-card--scroll mb-4">
      <table className="w-full text-[15px]">
        <caption className="px-4 pb-1 pt-3 text-left text-sm font-semibold text-[var(--text-muted)]">
          {caption}
        </caption>
        <thead>
          <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-left text-sm text-[var(--text-muted)]">
            <th className="px-4 py-2 font-medium">Ämne / område</th>
            {cols.map((t) => (
              <th key={t.key} className="px-2 py-2 text-center font-medium">
                <span className="block">{t.grade != null ? `Åk ${t.grade}` : ""}</span>
                <span className="block font-normal">{t.label}</span>
              </th>
            ))}
            <th className="px-4 py-2 font-medium">Trend</th>
            {natBySubject && <th className="px-4 py-2 font-medium">Nat. prov</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.subject} className="border-b border-[var(--border-subtle)] last:border-0">
              <td className="px-4 py-1.5 font-medium">{r.subject}</td>
              {cols.map((t) => {
                const c = r.cells[t.i];
                if (!c) return <td key={t.key} className="px-2 py-1.5 text-center text-[var(--text-muted)]">·</td>;
                const cls = c.mark != null ? MARK_CELL[c.mark] : LEVEL_CELL[c.level!];
                return (
                  <td key={t.key} className="px-2 py-1.5 text-center">
                    <span className={`inline-block min-w-9 rounded-[4px] px-1.5 py-0.5 text-sm font-semibold tabular ${cls}`}>
                      {c.text}
                    </span>
                  </td>
                );
              })}
              <td className="px-4 py-1.5"><TrendPill trend={r.trend} /></td>
              {natBySubject && (
                <td className="px-4 py-1.5 tabular">{natBySubject.get(r.subject) ?? "–"}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

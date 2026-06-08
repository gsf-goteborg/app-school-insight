import { Card, Pill } from "./primitives";
import type { GradeInsights, InsightTone } from "@/lib/db/queries-insights";

const INSIGHT_LABEL: Record<InsightTone, string> = {
  kritisk: "Prioritera",
  uppmarksam: "Uppmärksamma",
  info: "Notera",
};

/**
 * Renderar förklarbara insikter (Vad / Möjlig förklaring / Nästa steg) plus en
 * kort lista över styrkor. Delas av årskurs- och klassvyn.
 */
export function InsightCards({
  data,
  emptyText = "Inga särskilda riskområden sticker ut just nu.",
}: {
  data: GradeInsights;
  emptyText?: string;
}) {
  const { strengths, insights } = data;
  return (
    <>
      {strengths.length > 0 && (
        <Card className="mb-4 p-5">
          <Pill tone="positiv">Styrkor</Pill>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[15px]">
            {strengths.map((s, i) => (
              <li key={i}>• {s}</li>
            ))}
          </ul>
        </Card>
      )}

      {insights.length === 0 ? (
        <Card className="p-5 text-[var(--text-muted)]">{emptyText}</Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {insights.map((ins, i) => (
            <Card key={i} className="p-5">
              <Pill tone={ins.tone}>{INSIGHT_LABEL[ins.tone]}</Pill>
              <p className="mt-3 font-medium">{ins.what}</p>
              <p className="mt-2 text-sm">
                <span className="font-semibold text-[var(--text-muted)]">Möjlig förklaring: </span>
                {ins.why}
              </p>
              <p className="mt-1.5 text-sm">
                <span className="font-semibold text-[var(--text-muted)]">Nästa steg: </span>
                {ins.action}
              </p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

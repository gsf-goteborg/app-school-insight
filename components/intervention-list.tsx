import Link from "next/link";
import { Card, Pill, Empty } from "./ui/primitives";
import { INTERVENTION_STATUS_LABEL, INTERVENTION_LEVEL_LABEL, type InterventionStatus, type InterventionLevel } from "@/lib/constants";
import { dateShort } from "@/lib/format";
import type { Intervention } from "@/lib/db/queries-resources";

const STATUS_TONE: Record<InterventionStatus, "info" | "neutral" | "positiv"> = {
  pagaende: "info",
  planerad: "neutral",
  avslutad: "positiv",
};

function targetLabel(i: Intervention): string {
  if (i.target_student_id) return `Elev ${i.target_student_id}`;
  if (i.target_class_id) return `Klass ${i.target_class_id}`;
  if (i.target_grade) return `Årskurs ${i.target_grade}`;
  return INTERVENTION_LEVEL_LABEL[i.level as InterventionLevel] ?? "Skola";
}

export function InterventionList({ interventions }: { interventions: Intervention[] }) {
  if (interventions.length === 0) {
    return <Empty>Inga registrerade insatser här ännu.</Empty>;
  }
  return (
    <div className="space-y-3">
      {interventions.map((i) => (
        <Link key={i.intervention_id} href={`/insatser/${i.intervention_id}`} className="block">
          <Card className="p-4 transition-shadow hover:shadow-md">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={STATUS_TONE[i.status as InterventionStatus] ?? "neutral"}>
                {INTERVENTION_STATUS_LABEL[i.status as InterventionStatus] ?? i.status}
              </Pill>
              <span className="font-semibold">{i.title}</span>
              {i.is_demo === 0 && <Pill tone="neutral">Egen</Pill>}
            </div>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {targetLabel(i)}
              {i.subject ? ` · ${i.subject}` : ""}
              {i.follow_up_date ? ` · uppföljning ${dateShort(i.follow_up_date)}` : ""}
            </p>
          </Card>
        </Link>
      ))}
    </div>
  );
}

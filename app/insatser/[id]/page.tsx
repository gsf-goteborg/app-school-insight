import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Card, Section, Pill, Empty } from "@/components/ui/primitives";
import { BarChart } from "@/components/charts";
import { getIntervention, getFollowups, listInterventions } from "@/lib/db/queries-resources";
import { getInterventionEffect } from "@/lib/db/queries-effect";
import {
  INTERVENTION_STATUS_LABEL, INTERVENTION_LEVEL_LABEL, type InterventionStatus, type InterventionLevel,
} from "@/lib/constants";
import { dateLong, pct, num } from "@/lib/format";

export function generateStaticParams() {
  return listInterventions().map((i) => ({ id: String(i.intervention_id) }));
}

const STATUS_TONE: Record<InterventionStatus, "info" | "neutral" | "positiv"> = {
  pagaende: "info", planerad: "neutral", avslutad: "positiv",
};

function targetHref(i: ReturnType<typeof getIntervention>): { href: string; label: string } | null {
  if (!i) return null;
  if (i.target_student_id) return { href: `/elev/${i.target_student_id}`, label: `Elev ${i.target_student_id}` };
  if (i.target_class_id) return { href: `/klass/${i.target_class_id}`, label: `Klass ${i.target_class_id}` };
  if (i.target_grade) return { href: `/arskurs/${i.target_grade}`, label: `Årskurs ${i.target_grade}` };
  return null;
}

export default async function InsatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const intervention = getIntervention(id);
  if (!intervention) notFound();
  const followups = getFollowups(id);
  const target = targetHref(intervention);
  const effect = getInterventionEffect(intervention);
  const deltaPP = effect
    ? `${effect.delta > 0 ? "+" : effect.delta < 0 ? "−" : ""}${num(Math.abs(effect.delta) * 100, 0)} p.e.`
    : "";

  const facts: { label: string; value: string }[] = [
    { label: "Nivå", value: INTERVENTION_LEVEL_LABEL[intervention.level as InterventionLevel] ?? intervention.level },
    { label: "Ämne", value: intervention.subject ?? "–" },
    { label: "Ansvarig roll", value: intervention.owner_role ?? "–" },
    { label: "Startdatum", value: intervention.start_date ? dateLong(intervention.start_date) : "–" },
    { label: "Uppföljningsdatum", value: intervention.follow_up_date ? dateLong(intervention.follow_up_date) : "–" },
  ];

  return (
    <div>
      <PageHeader
        kicker="Insats"
        title={intervention.title}
        breadcrumb={[{ label: "Insatser", href: "/insatser" }, { label: intervention.title }]}
        right={
          <div className="flex items-center gap-2">
            <Pill tone={STATUS_TONE[intervention.status as InterventionStatus] ?? "neutral"}>
              {INTERVENTION_STATUS_LABEL[intervention.status as InterventionStatus] ?? intervention.status}
            </Pill>
            {intervention.is_demo === 0 && <Pill tone="neutral">Egen insats</Pill>}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {effect && (
            <Section
              title="Uppmätt effekt"
              description={`${effect.metric} · ${effect.populationLabel}. Måttet är valt så att högre är bättre.`}
            >
              <Card className="p-5">
                <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                  <div>
                    <p className="text-sm text-[var(--text-muted)]">{effect.beforeLabel}</p>
                    <p className="font-display text-3xl tabular">{pct(effect.before, 0)}</p>
                  </div>
                  <span aria-hidden className="pb-2 text-2xl text-[var(--text-muted)]">→</span>
                  <div>
                    <p className="text-sm text-[var(--text-muted)]">{effect.afterLabel}</p>
                    <p className="font-display text-3xl tabular text-[var(--text-strong)]">{pct(effect.after, 0)}</p>
                  </div>
                  <div className="pb-1.5">
                    <Pill tone={effect.delta > 0 ? "positiv" : effect.delta < 0 ? "kritisk" : "neutral"}>
                      {deltaPP}
                    </Pill>
                  </div>
                </div>

                <div className="mt-4">
                  <BarChart
                    ariaLabel={`${effect.metric} före och efter insatsen`}
                    categories={[effect.beforeLabel, effect.afterLabel]}
                    series={[{ name: effect.metric, data: [Math.round(effect.before * 100), Math.round(effect.after * 100)] }]}
                    colors={["#82bbdb", "#005293"]}
                    valueFormat="pct0"
                    height={200}
                  />
                </div>

                <p className="mt-3 text-sm text-[var(--text-muted)]">
                  {effect.note} Baserat på {num(effect.n)} mätpunkter. Visar sambandet mellan insats och utfall –
                  inte ett bevisat orsakssamband.
                </p>
              </Card>
            </Section>
          )}

          <Section title="Om insatsen">
            <Card className="space-y-4 p-5">
              {[
                ["Hypotes", intervention.hypothesis],
                ["Planerad åtgärd", intervention.planned_action],
                ["Förväntad effekt", intervention.expected_effect],
                ["Uppföljd effekt", intervention.outcome],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-sm font-semibold text-[var(--text-muted)]">{k}</p>
                  <p className="mt-0.5 whitespace-pre-wrap">{v || "–"}</p>
                </div>
              ))}
            </Card>
          </Section>

          <Section title="Uppföljningar">
            {followups.length === 0 ? (
              <Empty>Inga uppföljningar registrerade ännu.</Empty>
            ) : (
              <Card className="p-5">
                <ol className="relative space-y-4 border-l-2 border-[var(--border-subtle)] pl-5">
                  {followups.map((f) => (
                    <li key={f.followup_id}>
                      <span className="absolute -left-[7px] mt-1.5 size-3 rounded-full bg-[var(--gbg-green)]" aria-hidden />
                      <p className="text-sm text-[var(--text-muted)]">{dateLong(f.date)}</p>
                      <p className="mt-0.5">{f.note}</p>
                      {f.effect_observed && <p className="mt-0.5 text-sm text-[var(--gbg-green-dark)]">Effekt: {f.effect_observed}</p>}
                    </li>
                  ))}
                </ol>
              </Card>
            )}
          </Section>
        </div>

        <div>
          <Section title="Fakta">
            <Card className="space-y-3 p-5">
              {facts.map((f) => (
                <div key={f.label} className="flex justify-between gap-3 text-[15px]">
                  <span className="text-[var(--text-muted)]">{f.label}</span>
                  <span className="text-right font-medium">{f.value}</span>
                </div>
              ))}
            </Card>
          </Section>

          <Section title="Underlag bakom insatsen">
            {target ? (
              <Link href={target.href}>
                <Card className="p-5 transition-shadow hover:shadow-md">
                  <p className="text-sm text-[var(--text-muted)]">Kopplad till</p>
                  <p className="font-semibold text-[var(--gbg-blue)]">{target.label} →</p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    Öppna vyn för att se den data som motiverade insatsen.
                  </p>
                </Card>
              </Link>
            ) : (
              <Empty>Insatsen gäller hela skolan.</Empty>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

import { notFound } from "next/navigation";
import { RoleGate } from "@/components/role-gate";
import { PageHeader, Card, Section, Stat, Pill, Note } from "@/components/ui/primitives";
import { LineChart } from "@/components/charts";
import { getSchoolKpisFor, getSchoolTermSeriesAll, getSchoolGradeRows } from "@/lib/db/queries-huvudman";
import { SCHOOLS, HOME_SCHOOL } from "@/lib/constants";
import { pct, num, deltaPct } from "@/lib/format";

export function generateStaticParams() {
  return SCHOOLS.map((s) => ({ schoolId: s.id }));
}

const ATTENTION_TONE = { Prioritera: "kritisk", Bevaka: "uppmarksam", Stabilt: "positiv" } as const;

export default async function SkolkortPage({ params }: { params: Promise<{ schoolId: string }> }) {
  const { schoolId } = await params;
  const kpis = getSchoolKpisFor(schoolId);
  if (!kpis) notFound();
  const trends = getSchoolTermSeriesAll();
  const own = trends.series.find((s) => s.school_id === schoolId)!;
  const grades = getSchoolGradeRows(schoolId);

  return (
    <RoleGate view="huvudman">
      <PageHeader
        kicker="Skolkort"
        title={kpis.name}
        breadcrumb={[{ label: "Mina skolor", href: "/huvudman" }, { label: kpis.name }]}
        description={`${num(kpis.students)} elever · ${kpis.blurb}`}
        right={<Pill tone={ATTENTION_TONE[kpis.attention]}>{kpis.attention}</Pill>}
      />

      <Section title="Att agera på" description="Det viktigaste i dialogen med skolans rektor just nu.">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {kpis.focus.map((f, i) => (
            <Card key={i} className="p-4">
              <p className="leading-relaxed">{f}</p>
            </Card>
          ))}
        </div>
      </Section>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Frånvaro" value={pct(kpis.absenceRate, 1)} tone={kpis.absenceRate >= 0.055 ? "kritisk" : kpis.absenceRate >= 0.05 ? "uppmarksam" : "positiv"} hint="VT 2026" />
        <Stat label="Trygghet" value={`${num(kpis.avgTrygghet, 1)}/4`} tone={kpis.avgTrygghet < 3.0 ? "kritisk" : kpis.avgTrygghet < 3.2 ? "uppmarksam" : "positiv"} />
        <Stat label="Underkänt kärnämne" value={pct(kpis.coreFailShare, 0)} hint="av åk 7–10" tone={kpis.coreFailShare >= 0.25 ? "uppmarksam" : "neutral"} />
        <Stat label="Merit åk 10" value={kpis.meritLeaving > 0 ? num(kpis.meritLeaving, 0) : "–"} />
        <Stat label="Ekonomi" value={deltaPct(kpis.economyDeviationShare)} hint="prognos mot budget" tone={kpis.economyDeviationShare >= 0.03 ? "kritisk" : kpis.economyDeviationShare >= 0.015 ? "uppmarksam" : "positiv"} />
        <Stat label="Sjukfrånvaro" value={pct(kpis.sickShare, 1)} hint="personal, tjänstevägd" tone={kpis.sickShare >= 0.06 ? "uppmarksam" : "neutral"} />
      </div>

      <Section title="Utveckling över tid" description="Fyra läsår – riktningen är viktigare än enskilda terminer.">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <p className="mb-2 text-sm font-semibold text-[var(--text-muted)]">Frånvaro per termin – lägre är bättre</p>
            <LineChart
              ariaLabel={`Frånvaro per termin för ${kpis.name}`}
              categories={trends.labels}
              series={[{ name: "Frånvaro", data: own.absence.map((v) => (v != null ? Math.round(v * 1000) / 10 : null)) }]}
              valueFormat="pct1"
              height={240}
            />
          </Card>
          <Card className="p-5">
            <p className="mb-2 text-sm font-semibold text-[var(--text-muted)]">Snittmeritvärde (åk 7–10) per termin</p>
            <LineChart
              ariaLabel={`Snittmeritvärde per termin för ${kpis.name}`}
              categories={trends.labels}
              series={[{ name: "Meritvärde", data: own.merit.map((v) => (v != null ? Math.round(v * 10) / 10 : null)) }]}
              valueFormat="dec1"
              height={240}
            />
          </Card>
        </div>
      </Section>

      <Section
        title="Läget per årskurs"
        description="Aggregat per årskurs vårterminen 2026 – underlag för dialogen, inte för beslut om enskilda elever."
      >
        <Card className="table-card">
          <table className="w-full text-[15px]">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-left text-sm text-[var(--text-muted)]">
                <th className="px-4 py-2.5 font-medium">Årskurs</th>
                <th className="px-4 py-2.5 font-medium">Elever</th>
                <th className="px-4 py-2.5 font-medium">Frånvaro</th>
                <th className="px-4 py-2.5 font-medium">Andel med svag kunskapssignal</th>
                <th className="px-4 py-2.5 font-medium">Trygghet</th>
              </tr>
            </thead>
            <tbody>
              {grades.map((g) => (
                <tr key={g.grade} className="border-b border-[var(--border-subtle)] last:border-0">
                  <td className="px-4 py-2.5 font-medium">Åk {g.grade}</td>
                  <td className="px-4 py-2.5 tabular">{num(g.students)}</td>
                  <td className={`px-4 py-2.5 tabular ${g.absenceRate >= 0.07 ? "font-medium text-[var(--gbg-red-dark)]" : ""}`}>{pct(g.absenceRate, 1)}</td>
                  <td className="px-4 py-2.5 tabular">{pct(g.knowledgeAttentionShare, 0)}</td>
                  <td className={`px-4 py-2.5 tabular ${g.avgTrygghet > 0 && g.avgTrygghet < 3.0 ? "font-medium text-[var(--gbg-orange-dark)]" : ""}`}>
                    {g.avgTrygghet > 0 ? `${num(g.avgTrygghet, 1)}/4` : "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Section>

      <Note tone="info">
        Demodata. Skolkortet visar endast aggregat (dataminimering på huvudmannanivå).
        {schoolId === HOME_SCHOOL
          ? " Framtidsskolan mellan är demons fullt utbyggda skola – byt roll till Skolledare för att utforska skolans egna vyer ned till elevnivå."
          : " Skolans rektor och elevhälsa arbetar med elevnivån i skolans eget Skolinsikt."}
      </Note>
    </RoleGate>
  );
}

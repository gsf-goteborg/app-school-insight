import Link from "next/link";
import { RoleGate } from "@/components/role-gate";
import { PageHeader, Card, Section, Pill, Note } from "@/components/ui/primitives";
import { LineChart } from "@/components/charts";
import { getSchoolKpis, getSchoolTermSeriesAll, getTotalStudents } from "@/lib/db/queries-huvudman";
import { pct, num, deltaPct } from "@/lib/format";

const ATTENTION_TONE = { Prioritera: "kritisk", Bevaka: "uppmarksam", Stabilt: "positiv" } as const;

export default function HuvudmanPage() {
  const kpis = getSchoolKpis();
  const trends = getSchoolTermSeriesAll();
  const total = getTotalStudents();

  return (
    <RoleGate view="huvudman">
      <PageHeader
        kicker="Huvudmannanivå"
        title="Mina skolor"
        description={`Läget per skola inom området – ${num(total)} elever på ${kpis.length} skolor. Varje rad visar vad som kräver din uppmärksamhet och varför; klicka för skolans fullständiga bild.`}
      />

      <Section
        title="Att agera på per skola"
        description="Det viktigaste per skola just nu, härlett ur skolans indikatorer – med förslag på nästa steg i dialogen med rektor."
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {kpis.map((k) => (
            <Card key={k.school_id} className="flex flex-col p-5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <Link href={`/huvudman/${k.school_id}`} className="font-display text-xl hover:text-[var(--gbg-blue)] hover:underline">
                  {k.name}
                </Link>
                <Pill tone={ATTENTION_TONE[k.attention]}>{k.attention}</Pill>
              </div>
              <p className="mb-3 text-sm text-[var(--text-muted)]">{num(k.students)} elever · {k.blurb}</p>
              <ul className="mb-3 flex-1 space-y-2">
                {k.focus.map((f, i) => (
                  <li key={i} className="rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-sm leading-relaxed">{f}</li>
                ))}
              </ul>
              <Link href={`/huvudman/${k.school_id}`} className="text-sm font-semibold text-[var(--gbg-blue)] hover:underline">
                Skolans bild →
              </Link>
            </Card>
          ))}
        </div>
      </Section>

      <Section
        title="Skolorna i siffror"
        description="Vårterminen 2026. Indikatorerna är direkta mått ur skolornas data – respektive skolas risk- och prognosmodeller är skolans egna verktyg."
      >
        <Card className="table-card table-card--scroll">
          <table className="w-full text-[15px]">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-left text-sm text-[var(--text-muted)]">
                <th className="px-4 py-2.5 font-medium">Skola</th>
                <th className="px-4 py-2.5 font-medium">Elever</th>
                <th className="px-4 py-2.5 font-medium">Frånvaro</th>
                <th className="px-4 py-2.5 font-medium">Trygghet</th>
                <th className="px-4 py-2.5 font-medium">Underkänt kärnämne</th>
                <th className="px-4 py-2.5 font-medium">Merit åk 10</th>
                <th className="px-4 py-2.5 font-medium">Stödandel</th>
                <th className="px-4 py-2.5 font-medium">Ekonomi</th>
                <th className="px-4 py-2.5 font-medium">Sjukfrånvaro</th>
              </tr>
            </thead>
            <tbody>
              {kpis.map((k) => (
                <tr key={k.school_id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--surface-muted)]">
                  <td className="px-4 py-2.5">
                    <Link href={`/huvudman/${k.school_id}`} className="font-medium hover:text-[var(--gbg-blue)] hover:underline">
                      {k.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 tabular">{num(k.students)}</td>
                  <td className={`px-4 py-2.5 tabular ${k.absenceRate >= 0.055 ? "font-medium text-[var(--gbg-red-dark)]" : ""}`}>{pct(k.absenceRate, 1)}</td>
                  <td className={`px-4 py-2.5 tabular ${k.avgTrygghet < 3.1 ? "font-medium text-[var(--gbg-orange-dark)]" : ""}`}>{num(k.avgTrygghet, 1)}/4</td>
                  <td className="px-4 py-2.5 tabular">{pct(k.coreFailShare, 0)} av åk 7–10</td>
                  <td className="px-4 py-2.5 tabular">{k.meritLeaving > 0 ? num(k.meritLeaving, 0) : "–"}</td>
                  <td className="px-4 py-2.5 tabular">{pct(k.supportShare, 0)}</td>
                  <td className={`px-4 py-2.5 tabular ${k.economyDeviationShare >= 0.02 ? "font-medium text-[var(--gbg-red-dark)]" : ""}`}>
                    {deltaPct(k.economyDeviationShare)}
                  </td>
                  <td className="px-4 py-2.5 tabular">{pct(k.sickShare, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Section>

      <Section
        title="Utveckling över tid"
        description="Frånvaro och snittmeritvärde per skola över fyra läsår – jämför riktning mellan skolorna, inte exakta nivåer."
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <p className="mb-2 text-sm font-semibold text-[var(--text-muted)]">Frånvaro per termin – lägre är bättre</p>
            <LineChart
              ariaLabel="Frånvaroandel per termin och skola, fyra läsår"
              categories={trends.labels}
              series={trends.series.map((s) => ({
                name: s.name,
                data: s.absence.map((v) => (v != null ? Math.round(v * 1000) / 10 : null)),
              }))}
              valueFormat="pct1"
              height={260}
            />
          </Card>
          <Card className="p-5">
            <p className="mb-2 text-sm font-semibold text-[var(--text-muted)]">Snittmeritvärde (åk 7–10) per termin</p>
            <LineChart
              ariaLabel="Snittmeritvärde per termin och skola, fyra läsår"
              categories={trends.labels}
              series={trends.series.map((s) => ({
                name: s.name,
                data: s.merit.map((v) => (v != null ? Math.round(v * 10) / 10 : null)),
              }))}
              valueFormat="dec1"
              height={260}
            />
          </Card>
        </div>
      </Section>

      <Note tone="info">
        Demodata. Huvudmannanivån visar endast skol- och årskursaggregat – aldrig uppgifter om enskilda
        elever (dataminimering). Elevnivån hanteras av respektive skolas rektor och elevhälsa i skolans
        egna vyer.
      </Note>
    </RoleGate>
  );
}

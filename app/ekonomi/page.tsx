import { RoleGate } from "@/components/role-gate";
import { PageHeader, Card, Section, Stat, Pill, Note } from "@/components/ui/primitives";
import { LineChart, BarChart } from "@/components/charts";
import { getEconomyTotals, getForecasts, getBudgetMonthly, getCostPerStudent } from "@/lib/db/queries-resources";
import { getElevpengBreakdown } from "@/lib/db/queries-economy";
import { tkr, num, pct, deltaPct } from "@/lib/format";

const MONTH_LABEL = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", { month: "short" }).format(new Date(iso));

export default function EkonomiPage() {
  const totals = getEconomyTotals();
  const forecasts = getForecasts();
  const monthly = getBudgetMonthly();
  const costPerStudent = getCostPerStudent();
  const elevpeng = getElevpengBreakdown();
  const deviation = totals.full_year_forecast - totals.full_year_budget;
  const tackning = elevpeng.total / totals.full_year_forecast;

  // Aggregera per månad
  const months = [...new Set(monthly.map((m) => m.month))].sort();
  const budgetSeries = months.map((mo) =>
    Math.round(monthly.filter((m) => m.month === mo).reduce((s, m) => s + m.budget, 0)),
  );
  const actualSeries = months.map((mo) => {
    const rows = monthly.filter((m) => m.month === mo);
    if (rows.some((r) => r.actual === null)) return null;
    return Math.round(rows.reduce((s, m) => s + (m.actual ?? 0), 0));
  });

  return (
    <RoleGate view="ekonomi">
      <PageHeader
        kicker="Ekonomi & resurser"
        title="Ekonomiskt nuläge"
        description="Budget, utfall och prognos. Ett enkelt beslutsstöd kopplat till verksamhetens behov."
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Budget helår" value={tkr(totals.full_year_budget)} />
        <Stat
          label="Prognos helår"
          value={tkr(totals.full_year_forecast)}
          tone={deviation > 0 ? "uppmarksam" : "positiv"}
          delta={{ text: deltaPct(deviation / totals.full_year_budget), tone: deviation > 0 ? "uppmarksam" : "positiv" }}
        />
        <Stat label="Utfall hittills" value={tkr(totals.actual_ytd)} hint={`av ${tkr(totals.budget_ytd)} budgeterat`} />
        <Stat label="Kostnad per elev" value={tkr(costPerStudent, 1)} hint="helårsprognos" />
      </div>

      <Section title="Budget mot utfall" description="Total kostnad per månad, läsåret. Utfall saknas för kommande månader.">
        <Card className="p-5">
          <LineChart
            ariaLabel="Budget mot utfall per månad"
            categories={months.map(MONTH_LABEL)}
            series={[
              { name: "Budget", data: budgetSeries },
              { name: "Utfall", data: actualSeries },
            ]}
            valueFormat="tkr"
            height={320}
          />
        </Card>
      </Section>

      <Section title="Kostnadsavvikelser per kategori" description="Prognos jämfört med budget för helåret. Belopp i tkr.">
        <Card className="table-card">
          <table className="w-full text-[15px]">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-left text-sm text-[var(--text-muted)]">
                <th className="px-4 py-2.5 font-medium">Kategori</th>
                <th className="px-4 py-2.5 text-right font-medium">Budget</th>
                <th className="px-4 py-2.5 text-right font-medium">Prognos</th>
                <th className="px-4 py-2.5 text-right font-medium">Avvikelse</th>
              </tr>
            </thead>
            <tbody>
              {forecasts.map((f) => {
                const tone = f.deviation > f.full_year_budget * 0.1 ? "kritisk" : f.deviation > 0 ? "uppmarksam" : "positiv";
                return (
                  <tr key={f.category} className="border-b border-[var(--border-subtle)] last:border-0">
                    <td className="px-4 py-2.5 font-medium">{f.category}</td>
                    <td className="px-4 py-2.5 text-right tabular">{tkr(f.full_year_budget)}</td>
                    <td className="px-4 py-2.5 text-right tabular">{tkr(f.full_year_forecast)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Pill tone={tone}>{deltaPct(f.deviation / f.full_year_budget)}</Pill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </Section>

      <Section
        title="Elevpeng och resurstilldelning"
        description="Kommunens resurstilldelning till skolan. Elevpengen per elev är ett grundbelopp per stadium plus ett socioekonomiskt strukturtillägg som ökar med klassens socioekonomiska index."
      >
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Stat label="Total elevpeng helår" value={tkr(elevpeng.total)} hint={`${num(elevpeng.students)} elever`} />
          <Stat label="Varav grundbelopp" value={tkr(elevpeng.grundbelopp)} hint={pct(1 - elevpeng.strukturandel)} />
          <Stat
            label="Varav socioekonomiskt tillägg"
            value={tkr(elevpeng.strukturtillagg)}
            tone="info"
            hint={`${pct(elevpeng.strukturandel)} av elevpengen`}
          />
          <Stat label="Snitt elevpeng per elev" value={tkr(elevpeng.avg_per_student, 1)} hint="helår" />
          <Stat
            label="Skolans socioekonomiska index"
            value={num(elevpeng.avg_index, 1)}
            hint="riksgenomsnitt = 100"
          />
        </div>

        <Card className="mb-4 table-card">
          <table className="w-full text-[15px]">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-left text-sm text-[var(--text-muted)]">
                <th className="px-4 py-2.5 font-medium">Stadium</th>
                <th className="px-4 py-2.5 text-right font-medium">Antal elever</th>
                <th className="px-4 py-2.5 text-right font-medium">Snittindex</th>
                <th className="px-4 py-2.5 text-right font-medium">Grundbelopp</th>
                <th className="px-4 py-2.5 text-right font-medium">Strukturtillägg</th>
                <th className="px-4 py-2.5 text-right font-medium">Summa</th>
              </tr>
            </thead>
            <tbody>
              {elevpeng.by_stadium.map((s) => (
                <tr key={s.stadium} className="border-b border-[var(--border-subtle)] last:border-0">
                  <td className="px-4 py-2.5 font-medium">{s.stadium}<span className="block text-xs text-[var(--text-muted)]">{s.range}</span></td>
                  <td className="px-4 py-2.5 text-right tabular">{num(s.students)}</td>
                  <td className="px-4 py-2.5 text-right tabular">{num(s.avg_index, 1)}</td>
                  <td className="px-4 py-2.5 text-right tabular">{tkr(s.grundbelopp)}</td>
                  <td className="px-4 py-2.5 text-right tabular">{tkr(s.strukturtillagg)}</td>
                  <td className="px-4 py-2.5 text-right tabular font-medium">{tkr(s.summa)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-[var(--border-subtle)] bg-[var(--surface-muted)] font-medium">
                <td className="px-4 py-2.5">Totalt</td>
                <td className="px-4 py-2.5 text-right tabular">{num(elevpeng.students)}</td>
                <td className="px-4 py-2.5 text-right tabular">{num(elevpeng.avg_index, 1)}</td>
                <td className="px-4 py-2.5 text-right tabular">{tkr(elevpeng.grundbelopp)}</td>
                <td className="px-4 py-2.5 text-right tabular">{tkr(elevpeng.strukturtillagg)}</td>
                <td className="px-4 py-2.5 text-right tabular">{tkr(elevpeng.total)}</td>
              </tr>
            </tfoot>
          </table>
        </Card>

        <Card className="mb-4 p-5">
          <BarChart
            ariaLabel="Elevpeng per stadium uppdelad på grundbelopp och socioekonomiskt strukturtillägg"
            categories={elevpeng.by_stadium.map((s) => s.stadium)}
            series={[
              { name: "Grundbelopp", data: elevpeng.by_stadium.map((s) => Math.round(s.grundbelopp)) },
              { name: "Socioekonomiskt tillägg", data: elevpeng.by_stadium.map((s) => Math.round(s.strukturtillagg)) },
            ]}
            stacked
            valueFormat="tkr"
            height={320}
          />
        </Card>

        <Note tone="neutral">
          Elevpengen ger en samlad intäkt på {tkr(elevpeng.total)} för helåret, vilket motsvarar {pct(tackning)} av
          prognostiserade kostnader ({tkr(totals.full_year_forecast)}).
        </Note>
      </Section>

      <Note tone="info">
        Demodata. Simuleringsläge (“vad händer om vi omfördelar resurser?”) planeras i kommande version.
      </Note>
    </RoleGate>
  );
}

import { RoleGate } from "@/components/role-gate";
import { PageHeader, Card, Section, Stat, Pill, Note } from "@/components/ui/primitives";
import { BarChart } from "@/components/charts";
import { BehorighetList } from "@/components/behorighet-list";
import {
  getBehorighetForecasts,
  getBehorighetSummary,
  BEHORIGHET_BUCKETS,
  BEHORIGHET_DISCOUNT,
} from "@/lib/db/queries-behorighet";
import { num } from "@/lib/format";

export default function BehorighetPage() {
  const all = getBehorighetForecasts();
  const summary = getBehorighetSummary(all);

  // Risk 2 + 3 (under 80 % sannolikhet) per årskurs 4–10
  const grades = [4, 5, 6, 7, 8, 9, 10];
  const perGradeRisk = grades.map(
    (g) => all.filter((r) => r.grade_level === g && r.bucket >= 2).length,
  );

  const seg = (n: number) => (summary.total > 0 ? (n / summary.total) * 100 : 0);

  return (
    <RoleGate view="behorighet">
      <PageHeader
        kicker="Behörighetsprognos"
        title="Sannolikhet för behörighet till yrkesprogram"
        description="En utfallsnära lins som kompletterar Tidig upptäckt: en skattad sannolikhet att varje elev (åk 4–10) når behörighet till gymnasiets yrkesprogram, indelad i Risk 0–3."
      />

      <Card className="mb-8 p-5">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
          <span aria-hidden className="inline-block h-px w-6 bg-[var(--gbg-orange)]" />
          Analysstöd
        </p>
        <p className="mt-2 max-w-3xl text-[var(--text-default)]">
          Sannolikheten skattas med en <strong>logistisk modell</strong> där betyg och omdömen i{" "}
          <strong>svenska, engelska och matematik</strong> samt <strong>närvaron</strong> väger tyngst. Svaga resultat i
          lägre årskurser väger lättare än nära slutåret – eleverna har mer tid att förbättra sina resultat
          (tidsdiskontering per årskurs). I <strong>åk 10</strong> (slutåret) styr den faktiska behörigheten: godkänt i
          svenska, engelska och matematik samt minst åtta ämnen totalt. Modellen kompletterar – ersätter inte – den
          bredare signalbilden i Tidig upptäckt.
        </p>
      </Card>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Risk 3 – högst risk" value={num(summary.risk3)} tone="kritisk" hint="under 40 % sannolikhet" />
        <Stat label="Risk 2" value={num(summary.risk2)} tone="uppmarksam" hint="40–80 %" />
        <Stat label="Risk 1" value={num(summary.risk1)} tone="info" hint="80–90 %" />
        <Stat label="Risk 0 – trygg prognos" value={num(summary.risk0)} tone="positiv" hint="över 90 %" />
      </div>

      <Section
        title="Fördelning över riskgrupper"
        description={`${num(summary.at_risk)} av ${num(summary.total)} elever (åk 4–10) ligger under 80 % sannolikhet (Risk 2–3).`}
      >
        <Card className="p-5">
          <div
            className="flex h-3 w-full overflow-hidden rounded-full"
            role="img"
            aria-label={`Risk 3: ${summary.risk3}, Risk 2: ${summary.risk2}, Risk 1: ${summary.risk1}, Risk 0: ${summary.risk0}`}
          >
            <div className="bg-[var(--gbg-red)]" style={{ width: `${seg(summary.risk3)}%` }} />
            <div className="bg-[var(--gbg-orange)]" style={{ width: `${seg(summary.risk2)}%` }} />
            <div className="bg-[var(--gbg-blue)]" style={{ width: `${seg(summary.risk1)}%` }} />
            <div className="bg-[var(--gbg-green)]" style={{ width: `${seg(summary.risk0)}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--text-muted)]">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block size-2.5 rounded-full bg-[var(--gbg-red)]" /> Risk 3 ({num(summary.risk3)})
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block size-2.5 rounded-full bg-[var(--gbg-orange)]" /> Risk 2 ({num(summary.risk2)})
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block size-2.5 rounded-full bg-[var(--gbg-blue)]" /> Risk 1 ({num(summary.risk1)})
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block size-2.5 rounded-full bg-[var(--gbg-green)]" /> Risk 0 ({num(summary.risk0)})
            </span>
          </div>
        </Card>
      </Section>

      <Section
        title="Elever i riskzon per årskurs"
        description="Antal elever i Risk 2–3 (under 80 % sannolikhet) per årskurs. Tidsdiskonteringen gör att de högsta riskerna koncentreras nära slutåret."
      >
        <Card className="p-5">
          <BarChart
            ariaLabel="Antal elever i riskzon per årskurs"
            categories={grades.map((g) => `åk ${g}`)}
            series={[{ name: "Risk 2–3", data: perGradeRisk }]}
            valueFormat="raw"
            colors={["#f47815"]}
            height={280}
          />
        </Card>
      </Section>

      <Section
        title="Elever sorterade efter risk"
        description="Lägst sannolikhet (högst risk) först. Varje rad visar de faktorer som drar ned sannolikheten och länkar till elevens fullständiga underlag."
      >
        <BehorighetList rows={all} />
      </Section>

      <Section
        title="Så beräknas sannolikheten"
        description="Modellen är illustrativ på demodata (ingen historik att träna på), men efterliknar metoden i en skarp lösning och visar varje elevs underliggande faktorer."
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="p-5">
            <p className="mb-3 text-sm font-semibold text-[var(--text-muted)]">Riskgrupper</p>
            <ul className="space-y-2 text-[15px]">
              {[...BEHORIGHET_BUCKETS].sort((a, b) => b.bucket - a.bucket).map((b) => (
                <li key={b.bucket} className="flex items-center justify-between gap-3">
                  <Pill tone={b.tone}>{b.label}</Pill>
                  <span className="tabular text-[var(--text-muted)]">{b.desc}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5 lg:col-span-2">
            <p className="mb-3 text-sm font-semibold text-[var(--text-muted)]">Vad modellen väger in</p>
            <ul className="space-y-2 text-[15px] text-[var(--text-default)]">
              <li>• Betyg/omdömen i <strong>svenska, engelska och matematik</strong> (väger tyngst).</li>
              <li>• <strong>Bredd</strong>: antal ämnen med godkänt mot kravet på minst åtta totalt.</li>
              <li>• <strong>Närvaro</strong> – låg närvaro sänker sannolikheten.</li>
              <li>• <strong>Tidsdiskontering</strong> per årskurs (åk 10 = full vikt, lägre årskurser väger lättare):</li>
            </ul>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[4, 5, 6, 7, 8, 9, 10].map((g) => (
                <span key={g} className="rounded-md bg-[var(--surface-muted)] px-2 py-1 text-sm tabular text-[var(--text-muted)]">
                  åk {g}: {Math.round((BEHORIGHET_DISCOUNT[g] ?? 0) * 100)} %
                </span>
              ))}
            </div>
          </Card>
        </div>
      </Section>

      <Note tone="info">
        Demodata. Sannolikheten är en illustrativ skattning – inte en garanti eller ett omdöme om eleven – och ska tolkas
        med professionell bedömning tillsammans med den bredare bilden i Tidig upptäckt och elevhälsans kännedom.
      </Note>
    </RoleGate>
  );
}

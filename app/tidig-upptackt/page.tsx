import { RoleGate } from "@/components/role-gate";
import { PageHeader, Card, Section, Stat, Pill, Note } from "@/components/ui/primitives";
import { BarChart } from "@/components/charts";
import { EarlyWarningList } from "@/components/early-warning-list";
import {
  getEarlyWarnings, getEarlyWarningSummary,
  RISK_LEVELS, RISK_SIGNALS, RISK_MIN_FLAG,
} from "@/lib/db/queries-risk";
import { num } from "@/lib/format";

export default function TidigUpptacktPage() {
  const all = getEarlyWarnings();
  const summary = getEarlyWarningSummary(all);
  // Detaljlistan fokuserar på de actionable nivåerna (Hög + Förhöjd). De svagare
  // "Bevaka"-signalerna räknas i nyckeltalen men tynger inte listan.
  const rows = all.filter((r) => r.level !== "Bevaka");

  // Flaggade elever per årskurs (1–10)
  const grades = Array.from({ length: 10 }, (_, i) => i + 1);
  const perGrade = grades.map((g) => all.filter((r) => r.grade_level === g).length);

  return (
    <RoleGate view="tidig">
      <PageHeader
        kicker="Tidig upptäckt"
        title="Tidiga signaler"
        description="Lyfter proaktivt elever med tidiga tecken över närvaro, kunskapsresultat och stöd, så att stöd kan sättas in tidigt och samordnat."
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Elever med signal" value={num(summary.flagged)} hint="av 400 aktiva elever" />
        <Stat label="Hög risk" value={num(summary.hog)} tone="kritisk" />
        <Stat label="Förhöjd risk" value={num(summary.forhojd)} tone="uppmarksam" />
        <Stat label="Saknar åtgärdsprogram" value={num(summary.support_gap)} tone="info" hint="trots tecken på stödbehov" />
      </div>

      <Section
        title="Flaggade elever per årskurs"
        description="Var i skolan tecknen koncentreras – underlag för var stöd kan behöva riktas."
      >
        <Card className="p-5">
          <BarChart
            ariaLabel="Antal flaggade elever per årskurs"
            categories={grades.map((g) => `åk ${g}`)}
            series={[{ name: "Flaggade elever", data: perGrade }]}
            valueFormat="raw"
            height={280}
          />
        </Card>
      </Section>

      <Section
        title="Rangordnade signaler"
        description="Elever sorterade efter samlad signalstyrka. Varje rad visar de underliggande skälen och ett förslag på nästa steg."
      >
        <EarlyWarningList rows={rows} bevaka={summary.bevaka} />
      </Section>

      <Section
        title="Så beräknas signalerna"
        description="Modellen är medvetet enkel och granskningsbar. Varje elevs underliggande siffror visas som etiketter på raden, och namnet länkar till elevens fullständiga underlag."
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2">
            <p className="mb-3 text-sm font-semibold text-[var(--text-muted)]">Signaler och poäng</p>
            <ul className="space-y-2.5 text-[15px]">
              {RISK_SIGNALS.map((s) => (
                <li key={s.name} className="grid grid-cols-[10rem_1fr] gap-3">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-[var(--text-muted)]">{s.rule}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <p className="mb-3 text-sm font-semibold text-[var(--text-muted)]">Signalstyrka → nivå</p>
            <ul className="space-y-2 text-[15px]">
              {RISK_LEVELS.map((l) => (
                <li key={l.level} className="flex items-center justify-between gap-3">
                  <Pill tone={l.tone}>{l.level} risk</Pill>
                  <span className="tabular text-[var(--text-muted)]">
                    {l.max == null ? `${l.min}+ p` : l.min === l.max ? `${l.min} p` : `${l.min}–${l.max} p`}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-[var(--border-subtle)] pt-3 text-sm text-[var(--text-muted)]">
              En enstaka svag signal (under {RISK_MIN_FLAG} p) flaggas inte, för att hålla listan fokuserad.
              Poängen summeras och vägs aldrig samman till ett enskilt omdöme om eleven.
            </p>
          </Card>
        </div>
      </Section>

      <Note tone="info">
        Demodata. Signalerna är indikatorer som ska tolkas med professionell bedömning och tillsammans med annan
        kännedom om eleven – de är inte automatiska slutsatser. Listan ersätter inte elevhälsans och lärarnas samlade
        bild, utan är ett stöd för att tidigt uppmärksamma elever som kan behöva extra uppmärksamhet.
      </Note>
    </RoleGate>
  );
}

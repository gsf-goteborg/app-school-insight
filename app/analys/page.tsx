import { RoleGate } from "@/components/role-gate";
import { PageHeader, Card, Section, Note, Pill, Stat } from "@/components/ui/primitives";
import { Fragebank } from "@/components/ui/questions";
import { Heatmap, SankeyChart, BarChart } from "@/components/charts";
import { AnalysScatter } from "@/components/analys-scatter";
import { ResultMatrix } from "@/components/result-matrix";
import {
  getWeekdayAbsence, getAbsenceVsMerit, getReadingLevelFlow, getAverageMerit,
} from "@/lib/db/queries";
import { getUtredningsskuld } from "@/lib/db/queries-summary";
import { getDevelopmentSummary } from "@/lib/db/queries-development";
import { getAbsenceByTrygghet } from "@/lib/db/queries-wellbeing";
import { getSchoolTermTrends, type TermMetric } from "@/lib/db/queries-trend";
import { GRADES, LEVELS, CURRENT_TERM, type Level } from "@/lib/constants";
import { pct, num } from "@/lib/format";

function trendDelta(m: TermMetric): { text: string; tone: "positiv" | "uppmarksam" | "neutral" } {
  const d = m.vt - m.ht;
  const eps = m.format === "pct" ? 0.002 : 0.05;
  const tone = d > eps ? "positiv" : d < -eps ? "uppmarksam" : "neutral";
  const sign = d > eps ? "+" : d < -eps ? "−" : "±";
  const mag = m.format === "pct" ? `${num(Math.abs(d) * 100, 1)} p.e.` : num(Math.abs(d), 1);
  return { text: `${sign}${mag}`, tone };
}
const fmtVal = (m: TermMetric, v: number) => (m.format === "pct" ? pct(v, 1) : num(v, 1));

const WEEKDAYS = ["Mån", "Tis", "Ons", "Tor", "Fre"];
const LEVEL_COLOR: Record<Level, string> = {
  over: "#6a9a1f", i_linje: "#005293", uppmarksam: "#f47815", stort_behov: "#e8364a",
};

export default function AnalysPage() {
  // Heatmap: frånvaro per veckodag och årskurs
  const weekday = getWeekdayAbsence();
  const heatData: [number, number, number][] = [];
  let heatMax = 5;
  for (let gi = 0; gi < GRADES.length; gi++) {
    for (let di = 0; di < 5; di++) {
      const row = weekday.find((w) => w.grade_level === GRADES[gi] && w.iso_dow === di + 1);
      const v = row ? Math.round(row.absence_rate * 1000) / 10 : 0;
      heatData.push([di, gi, v]);
      heatMax = Math.max(heatMax, v);
    }
  }

  // Sambandsanalys: frånvaro vs meritvärde (alla åk 7–10, filtreras i klienten)
  const scatter = getAbsenceVsMerit(7, 10, CURRENT_TERM);
  const scatterPoints = scatter.map((s) => ({
    x: Math.round(s.absence * 1000) / 10,
    y: Math.round(s.merit),
    label: `${s.name} (åk ${s.grade_level})`,
    grade: s.grade_level,
  }));

  // Sankey: lässnivåer HT → VT (åk 1–4)
  const flow = getReadingLevelFlow();
  const nodes = [
    ...LEVELS.map((l) => ({ name: `HT: ${l.short}`, itemStyle: { color: LEVEL_COLOR[l.key] } })),
    ...LEVELS.map((l) => ({ name: `VT: ${l.short}`, itemStyle: { color: LEVEL_COLOR[l.key] } })),
  ];
  const shortOf = (k: Level) => LEVELS.find((l) => l.key === k)!.short;
  const links = flow.map((f) => ({ source: `HT: ${shortOf(f.ht)}`, target: `VT: ${shortOf(f.vt)}`, value: f.n }));

  // Terminsjämförelse: snittmeritvärde per årskurs HT vs VT
  const hogGrades = [7, 8, 9, 10];
  const meritHT = hogGrades.map((gr) => Math.round(getAverageMerit(gr, "HT2025") * 10) / 10);
  const meritVT = hogGrades.map((gr) => Math.round(getAverageMerit(gr, "VT2026") * 10) / 10);

  // Utveckling under läsåret (HT → VT)
  const termTrends = getSchoolTermTrends();

  // Utveckling och potential
  const devSummary = getDevelopmentSummary();

  // Utredningsskuld: ihållande svårigheter utan åtgärdsprogram/utredning
  const us = getUtredningsskuld();
  const usShareNoAction = us.lacking_total > 0 ? us.no_action / us.lacking_total : 0;
  const usSeg = (n: number) => (us.lacking_total > 0 ? (n / us.lacking_total) * 100 : 0);
  const usTone = usShareNoAction >= 0.5 ? "kritisk" : usShareNoAction >= 0.25 ? "uppmarksam" : "positiv";

  // Samband: snittfrånvaro per trygghetsnivå (hela skolan)
  const absByTrygg = getAbsenceByTrygghet();
  const tryggCats = absByTrygg.map((r) => `Trygghet ${r.trygghet}/4`);
  const tryggAbsence = absByTrygg.map((r) => Math.round(r.avg_absence * 1000) / 10);
  const lowT = absByTrygg.find((r) => r.trygghet === 1) ?? absByTrygg[0];
  const highT = absByTrygg.find((r) => r.trygghet === 4) ?? absByTrygg[absByTrygg.length - 1];

  return (
    <RoleGate view="analys">
      <PageHeader
        kicker="Analys"
        title="Analys och samband"
        description="Underlag för förstelärare, skolledare och elevhälsa. Diagrammen visar mönster att undersöka vidare."
      />

      <Section
        title="Utveckling under läsåret (HT → VT)"
        description="Terminsjämförelse av skolans viktigaste mått. Måtten är formulerade så att högre är bättre."
      >
        <Card className="overflow-hidden">
          <table className="w-full text-[15px]">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-left text-sm text-[var(--text-muted)]">
                <th className="px-4 py-2.5 font-medium">Mått</th>
                <th className="px-4 py-2.5 text-right font-medium">Höstterminen</th>
                <th className="px-4 py-2.5 text-right font-medium">Vårterminen</th>
                <th className="px-4 py-2.5 text-right font-medium">Förändring</th>
              </tr>
            </thead>
            <tbody>
              {termTrends.map((m) => {
                const d = trendDelta(m);
                return (
                  <tr key={m.key} className="border-b border-[var(--border-subtle)] last:border-0">
                    <td className="px-4 py-2.5 font-medium">{m.label}</td>
                    <td className="px-4 py-2.5 text-right tabular">{fmtVal(m, m.ht)}{m.hint ? ` ${m.hint}` : ""}</td>
                    <td className="px-4 py-2.5 text-right tabular">{fmtVal(m, m.vt)}{m.hint ? ` ${m.hint}` : ""}</td>
                    <td className="px-4 py-2.5 text-right"><Pill tone={d.tone}>{d.text}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          En blandad bild över läsåret: läsa-skriva-räkna och meritvärde stärks något, medan trygghet och närvaro
          viker nedåt – mönster att följa, inte färdiga slutsatser.
        </p>
      </Section>

      <Section
        title="Utveckling och potential"
        description="Att följa varje elevs utveckling mot sin potential – inte bara dem med svårigheter. Förändring mellan höst- och vårterminen."
      >
        <div className="mb-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label="Utvecklats positivt" value={num(devSummary.positive_movers)} tone="positiv" hint="flyttat fram sina resultat" />
          <Stat label="Tappar mark" value={num(devSummary.losing_ground)} tone="uppmarksam" hint="sjunker från en god nivå" />
          <Stat label="Kan utmanas mer" value={num(devSummary.stretch)} tone="info" hint="ligger högt – stretch" />
        </div>
        <p className="text-sm text-[var(--text-muted)]">
          Vilka elever som rör sig – och åt vilket håll – syns per elev i resultatmatrisen nedan; &quot;kan utmanas
          mer&quot; markeras dessutom i respektive klass elevlista.
        </p>
      </Section>

      <Section
        title="Resultatmatris: nivå × trend"
        description="Varje elev placerad efter nuvarande resultatnivå och flerterminstrend (upp till fyra läsår) – fyra grupper som kräver olika slags uppmärksamhet."
      >
        <ResultMatrix />
      </Section>

      <Section
        title="Utredningsskuld: ihållande svårigheter utan stödprocess"
        description="Elever som under båda terminerna (HT + VT) saknar godtagbart omdöme (åk 2–6) eller godkänt betyg A–E (åk 7–10) i minst ett ämne, fördelade efter om en formell stödprocess finns på plats."
      >
        <Card className="p-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat
              label="Ihållande svårigheter"
              value={num(us.lacking_total)}
              tone="uppmarksam"
              hint="båda terminerna, ≥1 ämne"
            />
            <Stat label="Aktivt åtgärdsprogram" value={num(us.with_atgardsprogram)} tone="positiv" hint="JA" />
            <Stat label="Under utredning" value={num(us.under_utredning)} tone="info" hint="UTREDNING" />
            <Stat label="Varken eller" value={num(us.no_action)} tone="kritisk" hint="NEJ – utredningsskuld" />
          </div>

          {us.lacking_total > 0 && (
            <div className="mt-5">
              <div
                className="flex h-3 w-full overflow-hidden rounded-full"
                role="img"
                aria-label={`Av ${us.lacking_total} elever har ${us.with_atgardsprogram} åtgärdsprogram, ${us.under_utredning} är under utredning och ${us.no_action} har varken eller`}
              >
                <div className="bg-[var(--gbg-green)]" style={{ width: `${usSeg(us.with_atgardsprogram)}%` }} />
                <div className="bg-[var(--gbg-orange)]" style={{ width: `${usSeg(us.under_utredning)}%` }} />
                <div className="bg-[var(--gbg-red)]" style={{ width: `${usSeg(us.no_action)}%` }} />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--text-muted)]">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className="inline-block size-2.5 rounded-full bg-[var(--gbg-green)]" />
                  Åtgärdsprogram ({num(us.with_atgardsprogram)})
                </span>
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className="inline-block size-2.5 rounded-full bg-[var(--gbg-orange)]" />
                  Under utredning ({num(us.under_utredning)})
                </span>
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className="inline-block size-2.5 rounded-full bg-[var(--gbg-red)]" />
                  Varken eller ({num(us.no_action)})
                </span>
              </div>
            </div>
          )}

          <Note tone={usTone}>
            {us.lacking_total > 0 ? (
              <>
                <strong>{pct(usShareNoAction, 0)}</strong> ({num(us.no_action)} av {num(us.lacking_total)} elever) har
                ihållande svårigheter men varken aktivt åtgärdsprogram eller pågående utredning. Det är skolans{" "}
                <strong>utredningsskuld</strong> – elever att prioritera för en första kartläggning. En enskild
                terminssiffra räcker inte som beslut; bekräfta alltid mot elevens hela bild.
              </>
            ) : (
              <>Inga elever har ihållande avsaknad av godtagbara resultat under båda terminerna.</>
            )}
          </Note>
        </Card>
      </Section>

      <Section title="Frånvaro per veckodag och årskurs" description="Andel registrerad frånvaro (%). Mörkare ruta = högre frånvaro.">
        <Card className="p-5">
          <Heatmap
            ariaLabel="Heatmap över frånvaro per veckodag och årskurs"
            xLabels={WEEKDAYS}
            yLabels={GRADES.map((gr) => `Åk ${gr}`)}
            data={heatData}
            max={Math.ceil(heatMax)}
            valueSuffix=" %"
            height={420}
          />
        </Card>
      </Section>

      <Section
        title="Samband: frånvaro och meritvärde"
        description="Varje punkt är en elev i åk 7–10 (vårterminen 2026). Tolka sambandet varsamt – det visar mönster, inte orsak."
      >
        <AnalysScatter points={scatterPoints} />
      </Section>

      <Section
        title="Samband: trygghet och frånvaro"
        description="Snittfrånvaro per trygghetsnivå i trivselenkäten (hela skolan, vårterminen 2026). Visar hur upplevd trygghet och närvaro hänger ihop."
      >
        <Card className="p-5">
          <BarChart
            ariaLabel="Snittfrånvaro per trygghetsnivå"
            categories={tryggCats}
            series={[{ name: "Snittfrånvaro", data: tryggAbsence }]}
            colors={["#7f3f98"]}
            valueFormat="pct1"
            height={300}
          />
          {lowT && highT && lowT.trygghet !== highT.trygghet && (
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              Elever som skattar låg trygghet ({lowT.trygghet}/4) har i snitt {pct(lowT.avg_absence, 1)} frånvaro, mot{" "}
              {pct(highT.avg_absence, 1)} för dem med hög trygghet ({highT.trygghet}/4). Låg trygghet är därför en tidig
              signal värd att fånga innan frånvaron växer. Sambandet visar mönster, inte orsak.
            </p>
          )}
        </Card>
      </Section>

      <Section title="Elevernas lässnivåer över tid (åk 1–4)" description="Flöde mellan nivåer från höstterminen till vårterminen. Rörelse uppåt visar progression.">
        <Card className="p-5">
          <SankeyChart
            ariaLabel="Sankey-diagram över elevernas lässnivåer mellan terminerna"
            nodes={nodes}
            links={links}
            height={360}
          />
        </Card>
      </Section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Terminsjämförelse: meritvärde åk 7–10">
          <Card className="p-5">
            <BarChart
              ariaLabel="Snittmeritvärde per årskurs, höst mot vår"
              categories={hogGrades.map((gr) => `Åk ${gr}`)}
              series={[
                { name: "Höstterminen", data: meritHT },
                { name: "Vårterminen", data: meritVT },
              ]}
              colors={["#82bbdb", "#005293"]}
              valueFormat="dec1"
              height={300}
            />
          </Card>
        </Section>
        <Section title="Frågor för kollegial analys">
          <Fragebank
            questions={[
              "Vilka mönster ser vi mellan frånvaro och resultat?",
              "Var skiljer sig nationella prov från betygen?",
              "Vilka grupper rör sig mellan nivåer – och varför?",
              "Vilka insatser kan prövas och hur följer vi upp dem?",
            ]}
          />
        </Section>
      </div>

      <Note tone="info">Demodata. Export av underlag och fler filter planeras i kommande version.</Note>
    </RoleGate>
  );
}

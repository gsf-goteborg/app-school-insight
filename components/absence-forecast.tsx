import Link from "next/link";
import { Card, Pill, Disclosure } from "@/components/ui/primitives";
import {
  getAbsenceForecasts,
  getAbsenceForecastFor,
  getPrognosSummary,
  KRONISK_BUCKETS,
  KRONISK_WEIGHTS,
  PROGNOS_WEIGHTS,
  type AbsenceForecast,
  type KroniskBucket,
} from "@/lib/db/queries-prognos";
import { num, pct } from "@/lib/format";

// Frånvaroprognosens ytor: topplista på Tidig upptäckt + per-elev-kort.
// Serverkomponenter (läser repository-lagret vid bygget).

const BUCKET_TONE: Record<KroniskBucket, "kritisk" | "uppmarksam" | "positiv"> = {
  Hög: "kritisk",
  Förhöjd: "uppmarksam",
  Låg: "positiv",
};

function fmtDays(d: number): string {
  return num(d, 1).replace(".", ",");
}

/** Topplista på Tidig upptäckt: vem behöver kontakt INNAN veckan börjar. */
export function AbsenceForecastSection() {
  const forecasts = getAbsenceForecasts();
  const summary = getPrognosSummary(forecasts);
  const top = forecasts.slice(0, 10);

  return (
    <div>
      <Card className="mb-4 p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Pill tone="kritisk">{num(summary.hog)} hög kronisk risk</Pill>
          <Pill tone="uppmarksam">{num(summary.forhojd)} förhöjd</Pill>
          <Pill tone="info">{num(summary.heavyWeek)} elever väntas vara borta ≥ 1,5 dagar nästa vecka</Pill>
        </div>
        <ul className="divide-y divide-[var(--border-subtle)]">
          {top.map((f) => (
            <li key={f.student_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
              <span className="flex min-w-0 flex-wrap items-center gap-2">
                <Link href={`/elev/${f.student_id}`} className="font-medium hover:text-[var(--gbg-blue)] hover:underline">
                  {f.name}
                </Link>
                <span className="text-sm text-[var(--text-muted)]">åk {f.grade_level} · {f.class_id}</span>
                <Pill tone={BUCKET_TONE[f.chronicBucket]}>Kronisk: {f.chronicBucket}</Pill>
              </span>
              <span className="text-sm tabular">
                ≈ <strong>{fmtDays(f.expectedDays)} av 5 dagar</strong> nästa vecka
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 border-t border-[var(--border-subtle)] pt-3 text-sm text-[var(--text-muted)]">
          Rangordnat på förväntade frånvarodagar – kontakta hem före måndag morgon där det gör störst skillnad.
          Varje elevs prognos förklaras exakt på elevens sida.
        </p>
      </Card>

      <Disclosure
        title="Så beräknas prognosen"
        description="Illustrativ, helt additiv modell med öppna vikter – varje elevs prognos är exakt summan av sina bidrag, ingen svart låda."
      >
        <ul className="space-y-2.5 text-[15px]">
          <li className="grid grid-cols-1 gap-1 sm:grid-cols-[14rem_1fr] sm:gap-3">
            <span className="font-medium">Bas</span>
            <span className="text-[var(--text-muted)]">Elevens egen frånvaroandel senaste fyra veckorna – prognosens dominerande term, redovisad öppet.</span>
          </li>
          <li className="grid grid-cols-1 gap-1 sm:grid-cols-[14rem_1fr] sm:gap-3">
            <span className="font-medium">Veckodagsmönster</span>
            <span className="text-[var(--text-muted)]">{Math.round(PROGNOS_WEIGHTS.veckodag * 100)} % av elevens avvikelse per veckodag (t.ex. måndagsfrånvaro).</span>
          </li>
          <li className="grid grid-cols-1 gap-1 sm:grid-cols-[14rem_1fr] sm:gap-3">
            <span className="font-medium">Trend + pågående frånvaro</span>
            <span className="text-[var(--text-muted)]">Ökning senaste 4 v mot 12 v (vikt {PROGNOS_WEIGHTS.trend}) samt +{Math.round(PROGNOS_WEIGHTS.pagaende * 100)} p.e. på måndagen om eleven var borta senaste skoldagen.</span>
          </li>
          <li className="grid grid-cols-1 gap-1 sm:grid-cols-[14rem_1fr] sm:gap-3">
            <span className="font-medium">Kronisk risk</span>
            <span className="text-[var(--text-muted)]">Logistisk modell (bas {KRONISK_WEIGHTS.bas}): frånvaronivå ×{KRONISK_WEIGHTS.niva}, trend ×{KRONISK_WEIGHTS.trend}, flerårsdrift ×{KRONISK_WEIGHTS.drift}, andel ogiltig ×{KRONISK_WEIGHTS.ogiltig}, låg trygghet +{KRONISK_WEIGHTS.trygghet}. Hög ≥ {pct(KRONISK_BUCKETS[0].min, 0)}, Förhöjd ≥ {pct(KRONISK_BUCKETS[1].min, 0)}.</span>
          </li>
        </ul>
        <p className="mt-3 border-t border-[var(--border-subtle)] pt-3 text-sm text-[var(--text-muted)]">
          Prognosen uttrycks som förväntade dagar (inte rå procent) för att läsas rätt. Illustrativ på demodata –
          i skarp drift ersätts vikterna av en tränad och kalibrerad modell med samma förklaringsprincip, scoring
          sker i nattlig batch. Förvaltningens ML-prototyp (daglig/kronisk risk + SHAP) är förlagan.
        </p>
      </Disclosure>
    </div>
  );
}

/** Per-elev-kort: förväntade dagar + kronisk risk + exakta bidrag. */
export function AbsenceForecastCard({ studentId }: { studentId: string }) {
  const f: AbsenceForecast | null = getAbsenceForecastFor(studentId);
  if (!f) return null;
  const maxC = Math.max(...f.chronicFactors.map((x) => x.contribution), 0.01);

  return (
    <Card className="p-5">
      <p className="mb-2 text-sm font-semibold text-[var(--text-muted)]">Frånvaroprognos · illustrativ</p>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span>
          <span className="font-display text-2xl tabular">{fmtDays(f.expectedDays)}</span>
          <span className="text-sm text-[var(--text-muted)]"> av 5 dagar väntad frånvaro nästa vecka</span>
        </span>
        <Pill tone={BUCKET_TONE[f.chronicBucket]}>Kronisk risk: {f.chronicBucket} ({pct(f.chronicP, 0)})</Pill>
      </div>

      <p className="mb-1 mt-4 text-sm font-medium text-[var(--text-muted)]">Det här driver den kroniska risken</p>
      <div className="space-y-1.5">
        {f.chronicFactors.map((x) => (
          <div key={x.label} className="grid grid-cols-[1fr_8rem] items-center gap-3 text-sm">
            <span>{x.label}</span>
            <span className="flex h-2.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
              <span
                className="h-full rounded-full bg-[var(--gbg-orange)]"
                style={{ width: `${(x.contribution / maxC) * 100}%` }}
              />
            </span>
          </div>
        ))}
      </div>
      {f.weekFactors.length > 0 && (
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          Veckoprognosen lyfts av: {f.weekFactors.map((x) => x.label.toLowerCase()).join(", ")}.
        </p>
      )}
      <p className="mt-3 border-t border-[var(--border-subtle)] pt-3 text-sm text-[var(--text-muted)]">
        Additiv modell med öppna vikter – bidragen ovan summerar exakt till prognosen (se Tidig upptäckt
        för hela beräkningen). Underlag för kontakt och planering, inte ett omdöme om eleven.
      </p>
    </Card>
  );
}

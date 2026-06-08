import Link from "next/link";
import type { ReactNode } from "react";
import { CURRENT_TERM, DEMO_TODAY, SKILL_AREAS, INTERVENTION_LEVEL_LABEL, type InterventionLevel } from "@/lib/constants";
import { Card, PageHeader, Section, Note, Pill, Stat, Highlight } from "@/components/ui/primitives";
import { LevelDistributionRow, LevelLegend, groupLevels } from "@/components/ui/level-distribution";
import { RoleOnly } from "@/components/role-gate";
import {
  getSchoolAttendance,
  attendanceRate,
  getRisingAbsence,
  getThresholdCounts,
  getAverageMerit,
  getGradeSkillSummary,
  type SkillLevelCount,
} from "@/lib/db/queries";
import {
  getWrittenOmdomeSummary,
  getBehorighetRisk,
  getSupportSummary,
  getUtredningsskuld,
} from "@/lib/db/queries-summary";
import {
  getEconomyTotals,
  getForecasts,
  getStaffingSummary,
  listInterventions,
  type Intervention,
} from "@/lib/db/queries-resources";
import { getHrSummary } from "@/lib/db/queries-hr";
import { getEarlyWarningSummary } from "@/lib/db/queries-risk";
import { getWellbeingSummary } from "@/lib/db/queries-wellbeing";
import { getDevelopmentSummary } from "@/lib/db/queries-development";
import { PrintButton } from "@/components/print-button";
import {
  writtenNarrative,
  betygNarrative,
  stodNarrative,
  utredningsskuldNarrative,
  narvaroNarrative,
} from "@/lib/text/summary-narrative";
import { tkr, pct, num, deltaPct, dateShort, dateLong } from "@/lib/format";

export default function StartPage() {
  // --- Aggregat per område ---
  const written = getWrittenOmdomeSummary(CURRENT_TERM);
  const behorighet = getBehorighetRisk(CURRENT_TERM);
  const meritLeaving = getAverageMerit(10, CURRENT_TERM);
  const support = getSupportSummary();
  const utredningsskuld = getUtredningsskuld();

  const school = getSchoolAttendance();
  const rate = attendanceRate(school);
  const thresholds = getThresholdCounts();
  const rising = getRisingAbsence();
  const earlyWarning = getEarlyWarningSummary();
  const wellbeing = getWellbeingSummary();
  const development = getDevelopmentSummary();

  // Läsa, skriva och räkna – åk 1–4
  const lsr: SkillLevelCount[] = [1, 2, 3, 4].flatMap((g) => getGradeSkillSummary(g, CURRENT_TERM));
  const lsrByArea = groupLevels(lsr, (r) => r.area);
  const lsrAreas = SKILL_AREAS.map((a) => {
    const counts = lsrByArea.get(a.key) ?? {};
    const total = Object.values(counts).reduce((s, n) => s + (n ?? 0), 0);
    const attn = (counts.uppmarksam ?? 0) + (counts.stort_behov ?? 0);
    return { ...a, counts, share: total ? attn / total : 0 };
  });
  const lsrWorst = [...lsrAreas].sort((x, y) => y.share - x.share)[0];
  const lsrTone = lsrWorst.share >= 0.35 ? "kritisk" : lsrWorst.share >= 0.2 ? "uppmarksam" : "positiv";

  // Pågående insatser
  const ongoing = listInterventions().filter((i) => i.status === "pagaende");

  // Ekonomi och bemanning (visas för skolledare)
  const economy = getEconomyTotals();
  const deviation = economy.full_year_forecast - economy.full_year_budget;
  const vikarie = getForecasts().find((f) => f.category === "Vikariekostnader");
  const staffing = getStaffingSummary();
  const hr = getHrSummary();

  // --- Genererad prosa per kort ---
  const omdomenText = writtenNarrative({
    totalStudents: written.total_students,
    withAny: written.with_any,
    allGodtagbara: written.all_godtagbara,
  });
  const betygText = betygNarrative({
    totalStudents: behorighet.total_students,
    atRisk: behorighet.at_risk,
    meritLeaving,
  });
  const stodText = stodNarrative({
    totalStudents: support.total_students,
    extraAnpassning: support.extra_anpassning,
    atgardsprogram: support.atgardsprogram,
    utredning: support.utredning,
  });
  const utredningsskuldText = utredningsskuldNarrative({
    lackingTotal: utredningsskuld.lacking_total,
    withAtgardsprogram: utredningsskuld.with_atgardsprogram,
    underUtredning: utredningsskuld.under_utredning,
    noAction: utredningsskuld.no_action,
  });
  const narvaroText = narvaroNarrative({
    attendanceRate: rate,
    totalStudents: thresholds.total,
    over15: thresholds.t15,
    rising: rising.length,
  });

  return (
    <div>
      <PageHeader
        kicker="Startsida"
        title="Skolans nuläge"
        description="En samlad bild av kunskapsresultat, stöd och närvaro – med fördjupning i läsa-skriva-räkna, pågående insatser och, för skolledare, ekonomi och bemanning."
        right={<PrintButton label="Skriv ut sammanfattning" />}
      />

      <p className="mb-6 hidden text-sm text-[var(--text-muted)] print:block">
        Framtidsskolan · sammanfattning per {dateLong(DEMO_TODAY)} · fiktiv demodata
      </p>

      <Card className="mb-8 p-5">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
          <span aria-hidden className="inline-block h-px w-6 bg-[var(--gbg-orange)]" />
          Analysstöd
        </p>
        <p className="mt-2 max-w-3xl text-[var(--text-default)]">
          Sidan sammanfattar skolnivån: <strong>läsa, skriva och räkna</strong> (åk 1–4),{" "}
          <strong>skriftliga omdömen</strong> (åk 2–6), <strong>betyg</strong> (åk 7–10),{" "}
          <strong>stödinsatser</strong> och <strong>närvaro och frånvaro</strong>, följt av pågående
          insatser samt ekonomi och bemanning. Färgade nyckeltal visar läget i korthet – grönt är
          gott, orange bör uppmärksammas och rött är kritiskt. För djupare analys per årskurs, klass
          och elev – gå vidare till respektive vy.
        </p>
      </Card>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Samlad närvarograd"
          value={pct(rate, 1)}
          tone={rate >= 0.95 ? "positiv" : rate >= 0.9 ? "neutral" : "uppmarksam"}
          hint="läsåret hittills"
        />
        <Link href="/tidig-upptackt" className="block">
          <Stat
            label="Elever med tidig signal"
            value={num(earlyWarning.flagged)}
            tone={earlyWarning.hog > 0 ? "uppmarksam" : "neutral"}
            hint={`varav ${num(earlyWarning.hog)} hög risk →`}
          />
        </Link>
        <Stat
          label="Snitt trygghet"
          value={`${num(wellbeing.trygghet, 1)}/4`}
          tone={wellbeing.trygghet < 2.8 ? "uppmarksam" : "positiv"}
          hint={`${num(wellbeing.low_count)} elever med låg trivsel`}
        />
        <Stat label="Snittmeritvärde åk 10" value={num(meritLeaving, 1)} hint="vårterminen 2026" />
      </div>

      <Card className="mb-8 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            <span aria-hidden className="inline-block h-px w-6 bg-[var(--gbg-green)]" />
            Utveckling och potential
          </p>
          <Link href="/analys" className="text-sm font-semibold text-[var(--gbg-blue)] hover:underline">Till analys →</Link>
        </div>
        <p className="mb-4 max-w-3xl text-[var(--text-default)]">
          Att följa <strong>varje</strong> elevs utveckling – inte bara dem med svårigheter. Mellan höst- och vårterminen
          visar bilden var skolan lyfter elever framåt och var potential riskerar att tappas.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label="Utvecklats positivt" value={num(development.positive_movers)} tone="positiv" hint="flyttat fram sina resultat" />
          <Stat label="Tappar mark" value={num(development.losing_ground)} tone="uppmarksam" hint="sjunker från en god nivå – lätt att missa" />
          <Stat label="Kan utmanas mer" value={num(development.stretch)} tone="info" hint="ligger högt och kan stretchas" />
        </div>
      </Card>

      <div className="mb-6">
        <SummaryCard
          title="Läsa, skriva och räkna"
          subtitle="Årskurs 1–4 · vårterminen 2026"
          color="var(--gbg-green-dark)"
          href="/analys"
          linkLabel="Till analys →"
        >
          <div>
            {lsrAreas.map((a) => (
              <LevelDistributionRow key={a.key} label={a.label} counts={a.counts} />
            ))}
            <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
              <LevelLegend />
            </div>
            <p className="mt-3 text-[var(--text-default)]">
              Störst behov i {lsrWorst.label.toLowerCase()} – <Highlight tone={lsrTone}>{pct(lsrWorst.share, 0)}</Highlight>{" "}
              av eleverna behöver uppmärksammas.
            </p>
          </div>
        </SummaryCard>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SummaryCard
          title="Skriftliga omdömen"
          subtitle="Årskurs 2–6 · vårterminen 2026"
          color="var(--gbg-green)"
          text={omdomenText}
          href="/analys"
          linkLabel="Till analys →"
        />
        <SummaryCard
          title="Betyg"
          subtitle="Årskurs 7–10 · vårterminen 2026"
          color="var(--gbg-blue)"
          text={betygText}
          href="/analys"
          linkLabel="Till analys →"
        />
        <SummaryCard
          title="Stödinsatser"
          subtitle="Hela skolan · innevarande termin"
          color="var(--gbg-red)"
          href="/analys"
          linkLabel="Till analys →"
        >
          <div className="space-y-3">
            <p className="leading-relaxed text-[var(--text-default)]">{stodText}</p>
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Utredningsskuld
              </p>
              <p className="mt-1 leading-relaxed text-[var(--text-default)]">{utredningsskuldText}</p>
            </div>
          </div>
        </SummaryCard>
        <SummaryCard
          title="Närvaro och frånvaro"
          subtitle="Hela skolan · läsåret hittills"
          color="var(--gbg-purple)"
          text={narvaroText}
          href="/analys"
          linkLabel="Till analys →"
        />
      </div>

      <Section
        title="Pågående insatser"
        description="Aktiva insatser på skol-, årskurs- och klassnivå med planerad uppföljning."
        action={
          <Link href="/insatser" className="text-sm font-semibold text-[var(--gbg-blue)] hover:underline">
            Alla insatser →
          </Link>
        }
      >
        <Card className="p-5">
          {ongoing.length === 0 ? (
            <p className="text-[var(--text-muted)]">Inga pågående insatser registrerade.</p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {ongoing.map((i) => (
                <li key={i.intervention_id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <Link href={`/insatser/${i.intervention_id}`} className="font-medium hover:text-[var(--gbg-blue)] hover:underline">
                      {i.title}
                    </Link>
                    <p className="text-sm text-[var(--text-muted)]">
                      {insatsTarget(i)}
                      {i.subject ? ` · ${i.subject}` : ""}
                      {i.follow_up_date ? ` · uppföljning ${dateShort(i.follow_up_date)}` : ""}
                    </p>
                  </div>
                  <Pill tone="info">{INTERVENTION_LEVEL_LABEL[i.level as InterventionLevel] ?? "Insats"}</Pill>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Section>

      <RoleOnly roles={["skolledare"]}>
        <Section title="Ekonomi och bemanning" description="Översikt för skolledning. Fördjupa i ekonomi- respektive personalvyn.">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SummaryCard
              title="Ekonomi & resurser"
              subtitle="Helår · läsåret 2025/2026"
              color="var(--gbg-orange)"
              href="/ekonomi"
              linkLabel="Till ekonomi →"
            >
              <div className="grid grid-cols-2 gap-4">
                <Kpi label="Budget helår" value={tkr(economy.full_year_budget)} />
                <Kpi
                  label="Prognos helår"
                  value={tkr(economy.full_year_forecast)}
                  tone={deviation > 0 ? "uppmarksam" : "positiv"}
                  hint={`${deltaPct(deviation / economy.full_year_budget)} mot budget`}
                />
              </div>
              {vikarie && vikarie.deviation > 0 && (
                <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-[var(--text-muted)]">
                  <Pill tone="uppmarksam">Vikariekostnader</Pill>
                  prognos {tkr(vikarie.deviation)} över budget för helåret.
                </p>
              )}
            </SummaryCard>

            <SummaryCard
              title="Personalplanering"
              subtitle="Bemanning, kompetens och HR"
              color="var(--gbg-blue)"
              href="/personal"
              linkLabel="Till personalplanering →"
            >
              <div className="grid grid-cols-3 gap-4">
                <Kpi
                  label="Behörig undervisning"
                  value={pct(staffing.qualified_share, 0)}
                  tone={staffing.qualified_share >= 0.85 ? "positiv" : "uppmarksam"}
                />
                <Kpi label="Lärartäthet" value={num(staffing.density, 1)} hint="elever/tjänst" />
                <Kpi
                  label="Sjukfrånvaro"
                  value={pct(hr.total_sick_share, 1)}
                  tone={hr.total_sick_share >= 0.06 ? "uppmarksam" : "neutral"}
                  hint="tjänstevägd"
                />
              </div>
            </SummaryCard>
          </div>
        </Section>
      </RoleOnly>

      <Note tone="info">
        Allt innehåll är fiktiv demodata. Siffrorna är avsedda att stödja dialog och analys – inte
        att fatta beslut åt verksamheten.
      </Note>
    </div>
  );
}

function insatsTarget(i: Intervention): string {
  if (i.target_student_id) return `Elev ${i.target_student_id}`;
  if (i.target_class_id) return `Klass ${i.target_class_id}`;
  if (i.target_grade != null) return `Årskurs ${i.target_grade}`;
  return "Hela skolan";
}

type KpiTone = "neutral" | "positiv" | "uppmarksam";

function Kpi({ label, value, hint, tone = "neutral" }: { label: string; value: ReactNode; hint?: string; tone?: KpiTone }) {
  const accent: Record<KpiTone, string> = {
    neutral: "text-[var(--text-strong)]",
    positiv: "text-[var(--gbg-green-dark)]",
    uppmarksam: "text-[var(--gbg-orange-dark)]",
  };
  return (
    <div>
      <p className="text-sm text-[var(--text-muted)]">{label}</p>
      <p className={`mt-0.5 font-display text-2xl tabular ${accent[tone]}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{hint}</p>}
    </div>
  );
}

function SummaryCard({
  title,
  subtitle,
  color,
  text,
  children,
  href,
  linkLabel,
}: {
  title: string;
  subtitle: string;
  color: string;
  text?: ReactNode;
  children?: ReactNode;
  href: string;
  linkLabel: string;
}) {
  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="px-5 py-4 text-white" style={{ background: color }}>
        <h2 className="font-display text-2xl leading-tight">{title}</h2>
        <p className="mt-0.5 text-sm text-white/85">{subtitle}</p>
      </div>
      <div className="flex flex-1 flex-col justify-between gap-4 p-5">
        {children ?? <p className="text-[var(--text-default)] leading-relaxed">{text}</p>}
        <Link
          href={href}
          className="inline-block text-sm font-semibold text-[var(--gbg-blue)] hover:underline"
        >
          {linkLabel}
        </Link>
      </div>
    </Card>
  );
}

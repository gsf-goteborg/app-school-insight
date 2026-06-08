import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Card, Section, Stat, Note } from "@/components/ui/primitives";
import { LevelDistributionRow, LevelLegend, groupLevels } from "@/components/ui/level-distribution";
import { Fragebank } from "@/components/ui/questions";
import { BarChart } from "@/components/charts";
import { InterventionList } from "@/components/intervention-list";
import {
  getGradeAttendanceFor, attendanceRate, getClasses, getClassAttendance,
  getWeekdayAbsence, getGradeSkillSummary, getGradeWrittenSummary,
  getGradeDistribution, getNationalVsGrades, getAverageMerit,
} from "@/lib/db/queries";
import { getInterventionsForGrade } from "@/lib/db/queries-resources";
import { getGradeInsights } from "@/lib/db/queries-insights";
import { getBehorighetForecasts } from "@/lib/db/queries-behorighet";
import { InsightCards } from "@/components/ui/insight-cards";
import { pct, num, deltaPct } from "@/lib/format";
import { CURRENT_TERM, SKILL_AREAS, GRADE_MARKS, GRADES, type GradeMark } from "@/lib/constants";

export function generateStaticParams() {
  return GRADES.map((g) => ({ grade: String(g) }));
}

const WEEKDAYS = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag"];
const MARK_COLOR: Record<GradeMark, string> = {
  A: "#4f6f18", B: "#6a9a1f", C: "#9ec038", D: "#f9b000", E: "#f47815", F: "#e8364a", "-": "#b0bcc6",
};

export default async function ArskursPage({ params }: { params: Promise<{ grade: string }> }) {
  const { grade: gradeStr } = await params;
  const grade = Number(gradeStr);
  if (!Number.isInteger(grade) || grade < 1 || grade > 10) notFound();

  const attn = getGradeAttendanceFor(grade);
  if (!attn) notFound();
  const rate = attendanceRate(attn);
  const rise = (attn.w4_absence_rate ?? 0) - (attn.w12_absence_rate ?? 0);
  const classes = getClasses(grade);
  const classAttn = new Map(getClassAttendance(grade).map((c) => [c.class_id, c]));
  const interventions = getInterventionsForGrade(grade);

  // Frånvaro per veckodag
  const weekday = getWeekdayAbsence(grade);
  const weekdayData = WEEKDAYS.map((_, i) => {
    const row = weekday.find((w) => w.iso_dow === i + 1);
    return row ? row.absence_rate * 100 : 0;
  });

  const showLSR = grade >= 1 && grade <= 4;
  const showWritten = grade >= 2 && grade <= 6;
  const showGrades = grade >= 7 && grade <= 10;

  // Behörighetsprognos för årskursen (åk 4–10)
  const showBehorighet = grade >= 4 && grade <= 10;
  const behForGrade = showBehorighet
    ? getBehorighetForecasts().filter((f) => f.grade_level === grade)
    : [];
  const behRiskzon = behForGrade.filter((f) => f.bucket >= 2).length;
  const behRisk3 = behForGrade.filter((f) => f.bucket === 3).length;

  return (
    <div>
      <PageHeader
        kicker={`Årskurs ${grade}`}
        title={`Årskurs ${grade}`}
        breadcrumb={[{ label: "Årskurser", href: "/arskurs" }, { label: `Åk ${grade}` }]}
        description="Närvaro, kunskapsresultat och insatser för årskursens två klasser."
      />

      {/* KPI */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Närvarograd" value={pct(rate, 1)} tone={rate >= 0.95 ? "positiv" : rate >= 0.9 ? "neutral" : "uppmarksam"} />
        <Stat
          label="Frånvarotrend"
          value={deltaPct(rise)}
          tone={rise > 0.02 ? "uppmarksam" : rise < -0.01 ? "positiv" : "neutral"}
          hint="senaste 4 v mot 12 v"
        />
        <Stat label="Antal elever" value={num(40)} hint="två klasser" />
        {showGrades
          ? <Stat label="Snittmeritvärde" value={num(getAverageMerit(grade, CURRENT_TERM), 1)} hint="vårterminen 2026" />
          : <Stat label="Pågående insatser" value={num(interventions.filter((i) => i.status === "pagaende").length)} />}
      </div>

      {showBehorighet && (
        <Card className="mb-8 flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="text-sm font-semibold">Behörighetsprognos</p>
            <p className="mt-0.5 text-[var(--text-muted)]">
              <span className="font-semibold text-[var(--text-strong)]">{num(behRiskzon)}</span> av {num(behForGrade.length)} elever
              i riskzon (under 80 % sannolikhet){behRisk3 > 0 ? <>, varav <span className="font-semibold text-[var(--gbg-red-dark)]">{num(behRisk3)}</span> i Risk 3</> : null}.
            </p>
          </div>
          <Link href="/behorighet" className="text-sm font-semibold text-[var(--gbg-blue)] hover:underline">
            Till behörighetsprognos →
          </Link>
        </Card>
      )}

      {/* Klasser */}
      <Section title="Klasser">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {classes.map((c) => {
            const ca = classAttn.get(c.class_id);
            const cr = ca ? attendanceRate(ca) : 0;
            return (
              <Link key={c.class_id} href={`/klass/${c.class_id}`}>
                <Card className="flex items-center justify-between p-5 transition-shadow hover:shadow-md">
                  <div>
                    <p className="font-display text-2xl">{c.class_id}</p>
                    <p className="text-sm text-[var(--text-muted)]">Mentor: {c.mentor_name ?? "–"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-[var(--text-muted)]">Närvaro</p>
                    <p className="font-display text-2xl tabular">{pct(cr, 1)}</p>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </Section>

      {/* Närvaro per veckodag */}
      <Section title="Frånvaro per veckodag" description="Andel registrerad frånvaro (giltig + ogiltig) per veckodag, läsåret hittills.">
        <Card className="p-5">
          <BarChart
            ariaLabel={`Frånvaro per veckodag för årskurs ${grade}`}
            categories={WEEKDAYS}
            series={[{ name: "Frånvaro", data: weekdayData }]}
            colors={["#f47815"]}
            valueFormat="pct0"
            height={260}
          />
        </Card>
      </Section>

      {/* Kunskapsresultat */}
      {showLSR && <SkillSection grade={grade} />}
      {showWritten && <WrittenSection grade={grade} />}
      {showGrades && <GradesSection grade={grade} />}

      {/* Analys och nästa steg */}
      <AnalysisNextSteps grade={grade} />

      {/* Insatser + frågebank */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Pågående och planerade insatser">
          <InterventionList interventions={interventions} />
        </Section>
        <Section title="Frågor till arbetslagets analys">
          <Fragebank />
        </Section>
      </div>

      <Note tone="info">Demodata. Resultaten är avsedda att stödja arbetslagets analys – inte att rangordna klasser eller elever.</Note>
    </div>
  );
}

function SkillSection({ grade }: { grade: number }) {
  const rows = getGradeSkillSummary(grade, CURRENT_TERM);
  const byArea = groupLevels(rows, (r) => r.area);
  return (
    <Section title="Läsa, skriva och räkna" description="Andel elever per nivå, vårterminen 2026.">
      <Card className="p-5">
        {SKILL_AREAS.map((a) => (
          <LevelDistributionRow key={a.key} label={a.label} counts={byArea.get(a.key) ?? {}} />
        ))}
        <div className="mt-3 border-t border-[var(--border-subtle)] pt-3"><LevelLegend /></div>
      </Card>
    </Section>
  );
}

function WrittenSection({ grade }: { grade: number }) {
  const rows = getGradeWrittenSummary(grade, CURRENT_TERM);
  const bySubject = groupLevels(rows, (r) => r.subject);
  return (
    <Section title="Skriftliga omdömen" description="Andel elever per nivå och ämne, vårterminen 2026.">
      <Card className="p-5">
        {[...bySubject.entries()].map(([subject, counts]) => (
          <LevelDistributionRow key={subject} label={subject} counts={counts} />
        ))}
        <div className="mt-3 border-t border-[var(--border-subtle)] pt-3"><LevelLegend /></div>
      </Card>
    </Section>
  );
}

function GradesSection({ grade }: { grade: number }) {
  const dist = getGradeDistribution(grade, CURRENT_TERM);
  const subjects = [...new Set(dist.map((d) => d.subject))];
  const series = GRADE_MARKS.map((m) => ({
    name: m === "-" ? "Streck" : m,
    data: subjects.map((s) => dist.find((d) => d.subject === s && d.grade === m)?.antal ?? 0),
  }));
  const natVsGrade = grade === 10 ? getNationalVsGrades(10, CURRENT_TERM) : [];

  return (
    <>
      <Section title="Betygsfördelning per ämne" description="Antal betyg per steg, vårterminen 2026.">
        <Card className="p-5">
          <BarChart
            ariaLabel={`Betygsfördelning per ämne för årskurs ${grade}`}
            categories={subjects}
            series={series}
            stacked
            colors={GRADE_MARKS.map((m) => MARK_COLOR[m])}
            height={360}
          />
        </Card>
      </Section>
      {grade === 10 && natVsGrade.length > 0 && (
        <Section title="Nationella prov jämfört med betyg" description="Medelpoäng (A=20 … F=0). Stor skillnad kan tyda på olika bedömningsgrunder.">
          <Card className="p-5">
            <BarChart
              ariaLabel="Nationella prov jämfört med terminsbetyg per ämne"
              categories={natVsGrade.map((n) => n.subject)}
              series={[
                { name: "Terminsbetyg", data: natVsGrade.map((n) => Math.round(n.avg_grade * 10) / 10) },
                { name: "Provbetyg", data: natVsGrade.map((n) => Math.round(n.avg_nat * 10) / 10) },
              ]}
              colors={["#005293", "#f47815"]}
              height={300}
            />
          </Card>
        </Section>
      )}
    </>
  );
}

function AnalysisNextSteps({ grade }: { grade: number }) {
  return (
    <Section
      title="Analys och nästa steg"
      description="Det viktigaste att uppmärksamma – vad som syns, varför det kan vara så och förslag på nästa steg."
    >
      <InsightCards data={getGradeInsights(grade)} emptyText="Inga särskilda riskområden sticker ut för årskursen just nu." />
    </Section>
  );
}

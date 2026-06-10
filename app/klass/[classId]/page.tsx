import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Card, Section, Stat, Pill, Note } from "@/components/ui/primitives";
import { LevelDistributionRow, LevelLegend, groupLevels } from "@/components/ui/level-distribution";
import { BarChart } from "@/components/charts";
import { InterventionList } from "@/components/intervention-list";
import { CommentThread } from "@/components/comment-thread";
import {
  getClass, getStudentsByClass, getStudentAttendanceByClass, attendanceRate,
  getClassAttendance, getClassSkillSummary, getClassWrittenSummary,
  getClassGradeDistribution, getClassKnowledgeAttention,
} from "@/lib/db/queries";
import { getInterventionsForClass, getComments } from "@/lib/db/queries-resources";
import { getClassWellbeing } from "@/lib/db/queries-wellbeing";
import { getClassInsights } from "@/lib/db/queries-insights";
import { getBehorighetForecasts, bucketMeta } from "@/lib/db/queries-behorighet";
import { getDevelopment, type DevStudent } from "@/lib/db/queries-development";
import { getLongTermTrends, getClassMonthlyAbsence, getClassTermAbsence, type StudentLongTrend } from "@/lib/db/queries-history";
import { AbsenceGrid } from "@/components/absence-grid";
import { InsightCards } from "@/components/ui/insight-cards";
import { pct, num } from "@/lib/format";
import { CURRENT_TERM, SKILL_AREAS, GRADE_MARKS, CLASS_IDS, type GradeMark } from "@/lib/constants";

export function generateStaticParams() {
  return CLASS_IDS.map((classId) => ({ classId }));
}

const MARK_COLOR: Record<GradeMark, string> = {
  A: "#4f6f18", B: "#6a9a1f", C: "#9ec038", D: "#f9b000", E: "#f47815", F: "#e8364a", "-": "#b0bcc6",
};

export default async function KlassPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const klass = getClass(classId);
  if (!klass) notFound();
  const grade = klass.grade_level;

  const students = getStudentsByClass(classId);
  const attnList = getStudentAttendanceByClass(classId);
  const attnMap = new Map(attnList.map((a) => [a.student_id, a]));
  const classAttn = getClassAttendance(grade).find((c) => c.class_id === classId);
  const classRate = classAttn ? attendanceRate(classAttn) : 0;
  const knowledgeAttn = getClassKnowledgeAttention(classId, CURRENT_TERM);
  const wellbeing = getClassWellbeing(classId);
  const interventions = getInterventionsForClass(classId);
  const comments = getComments("class", classId);

  // Behörighetsprognos per elev (endast åk 4–10).
  const showBehorighet = grade >= 4 && grade <= 10;
  const behMap = showBehorighet
    ? new Map(getBehorighetForecasts().filter((f) => f.class_id === classId).map((f) => [f.student_id, f]))
    : null;

  // Utvecklingslins (HT → VT): lyfter både "kan utmanas mer" och "tappar mark".
  const devMap = new Map(
    getDevelopment().filter((d) => d.class_id === classId).map((d) => [d.student_id, d]),
  );
  // Flerterminstrend (upp till fyra läsår) – fångar långsamma nedgångar som
  // HT→VT-linsen missar.
  const longTrendMap = new Map(
    getLongTermTrends().filter((t) => t.class_id === classId).map((t) => [t.student_id, t]),
  );

  // Per elev: närvaro, trend, trygghet, följ upp-flagga
  const rows = students.map((s) => {
    const a = attnMap.get(s.student_id);
    const rate = a ? (a.days_total ? a.days_attended / a.days_total : 0) : 0;
    const absRate = a ? (a.days_total ? a.days_absent / a.days_total : 0) : 0;
    const w4 = a && a.w4_total ? a.w4_absent / a.w4_total : 0;
    const w12 = a && a.w12_total ? a.w12_absent / a.w12_total : 0;
    const rise = w4 - w12;
    const kAttn = knowledgeAttn.get(s.student_id) ?? 0;
    const wb = wellbeing.byStudent.get(s.student_id) ?? null;
    const lowTrygghet = wb ? wb.trygghet <= 2 : false;
    const followUp = absRate >= 0.1 || rise >= 0.05 || kAttn >= 3 || lowTrygghet;
    const dev = devMap.get(s.student_id) ?? null;
    const longTrend = longTrendMap.get(s.student_id) ?? null;
    return { s, rate, absRate, rise, kAttn, wb, lowTrygghet, followUp, dev, longTrend };
  });
  const followUpCount = rows.filter((r) => r.followUp).length;

  const showLSR = grade >= 1 && grade <= 4;
  const showWritten = grade >= 2 && grade <= 6;
  const showGrades = grade >= 7 && grade <= 10;

  return (
    <div>
      <PageHeader
        kicker={`Klass ${classId}`}
        title={`Klass ${classId}`}
        breadcrumb={[
          { label: "Klasser", href: "/klass" },
          { label: `Åk ${grade}`, href: `/arskurs/${grade}` },
          { label: classId },
        ]}
        description={`Mentor: ${klass.mentor_name ?? "–"} · ${klass.arbetslag}`}
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Närvarograd" value={pct(classRate, 1)} tone={classRate >= 0.95 ? "positiv" : classRate >= 0.9 ? "neutral" : "uppmarksam"} />
        <Stat label="Antal elever" value={String(students.length)} />
        <Stat
          label="Snitt trygghet"
          value={`${num(wellbeing.avgTrygghet, 1)}/4`}
          tone={wellbeing.avgTrygghet < 2.4 ? "kritisk" : wellbeing.avgTrygghet < 2.8 ? "uppmarksam" : "positiv"}
          hint={wellbeing.lowCount > 0 ? `${wellbeing.lowCount} elever med låg trivsel` : "trivselenkäten"}
        />
        <Stat label="Att följa upp" value={String(followUpCount)} tone={followUpCount > 5 ? "uppmarksam" : "neutral"} hint="närvaro, resultat eller trygghet" />
      </div>

      {/* Elevlista */}
      <Section title="Elevlista" description="Markerade elever bör följas upp utifrån närvaro eller resultat. Utvecklingskolumnen lyfter även elever som kan utmanas mer eller tappar mark.">
        <Card className="table-card">
          <table className="w-full text-[15px]">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-left text-sm text-[var(--text-muted)]">
                <th className="px-4 py-2.5 font-medium">Elev</th>
                <th className="px-4 py-2.5 font-medium">Närvaro</th>
                <th className="px-4 py-2.5 font-medium">Trygghet</th>
                {showBehorighet && <th className="px-4 py-2.5 font-medium">Behörighet</th>}
                <th className="px-4 py-2.5 font-medium">Utveckling</th>
                <th className="px-4 py-2.5 font-medium">Att uppmärksamma</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ s, rate, kAttn, wb, lowTrygghet, followUp, dev, longTrend }) => (
                <tr key={s.student_id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--surface-muted)]">
                  <td className="px-4 py-2.5">
                    <Link href={`/elev/${s.student_id}`} className="font-medium hover:text-[var(--gbg-blue)] hover:underline">
                      {s.first_name} {s.last_name}
                    </Link>
                    {followUp && <span className="ml-2"><Pill tone="uppmarksam">Följ upp</Pill></span>}
                  </td>
                  <td className="px-4 py-2.5 tabular">{pct(rate, 0)}</td>
                  <td className="px-4 py-2.5 tabular">
                    {wb ? (
                      lowTrygghet
                        ? <span className="font-medium text-[var(--gbg-red-dark)]">{wb.trygghet}/4</span>
                        : <span className="text-[var(--text-muted)]">{wb.trygghet}/4</span>
                    ) : "–"}
                  </td>
                  {showBehorighet && (
                    <td className="px-4 py-2.5">
                      {(() => {
                        const f = behMap?.get(s.student_id);
                        if (!f) return <span className="text-[var(--text-muted)]">–</span>;
                        const m = bucketMeta(f.bucket);
                        return (
                          <span className="flex items-center gap-2">
                            <Pill tone={m.tone}>{m.label}</Pill>
                            <span className="tabular text-[var(--text-muted)]">{pct(f.probability)}</span>
                          </span>
                        );
                      })()}
                    </td>
                  )}
                  <td className="px-4 py-2.5"><DevBadge dev={dev} longTrend={longTrend} /></td>
                  <td className="px-4 py-2.5">{kAttn > 0 ? `${kAttn} ämnen/områden` : "–"}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Link href={`/elev/${s.student_id}`} className="text-sm font-semibold text-[var(--gbg-blue)] hover:underline">Öppna →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Section>

      {/* Frånvaro över tid */}
      <Section
        title="Frånvaro över tid"
        description="Frånvaroandel per elev – per månad för innevarande läsår eller per termin över upp till fyra läsår. Färgerna markerar nivå; klicka på en elev för hela bilden."
      >
        <AbsenceGrid monthly={getClassMonthlyAbsence(classId)} byTerm={getClassTermAbsence(classId)} />
      </Section>

      {/* Resultat på gruppnivå */}
      <Section title="Resultat på gruppnivå" description="Vårterminen 2026.">
        {showLSR && (
          <Card className="mb-4 p-5">
            <h3 className="mb-2 font-semibold">Läsa, skriva och räkna</h3>
            {SKILL_AREAS.map((a) => {
              const byArea = groupLevels(getClassSkillSummary(classId, CURRENT_TERM), (r) => r.area);
              return <LevelDistributionRow key={a.key} label={a.label} counts={byArea.get(a.key) ?? {}} />;
            })}
            <div className="mt-3 border-t border-[var(--border-subtle)] pt-3"><LevelLegend /></div>
          </Card>
        )}
        {showWritten && (
          <Card className="mb-4 p-5">
            <h3 className="mb-2 font-semibold">Skriftliga omdömen</h3>
            {[...groupLevels(getClassWrittenSummary(classId, CURRENT_TERM), (r) => r.subject).entries()].map(([subject, counts]) => (
              <LevelDistributionRow key={subject} label={subject} counts={counts} />
            ))}
            <div className="mt-3 border-t border-[var(--border-subtle)] pt-3"><LevelLegend /></div>
          </Card>
        )}
        {showGrades && <ClassGrades classId={classId} />}
      </Section>

      {/* Analys och nästa steg */}
      <Section
        title="Analys och nästa steg"
        description="Det viktigaste att uppmärksamma för klassen – vad som syns, varför det kan vara så och förslag på nästa steg."
      >
        <InsightCards data={getClassInsights(classId)} emptyText="Inga särskilda riskområden sticker ut för klassen just nu." />
      </Section>

      {/* Insatser + kommentarer */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Insatser för klassen">
          <InterventionList interventions={interventions} />
        </Section>
        <Section title="Kommentarer från arbetslag och elevhälsa">
          <CommentThread scope="class" scopeRef={classId} comments={comments} />
        </Section>
      </div>

      <Note tone="info">Demodata. Undvik att dra slutsatser om enskilda elever utan kompletterande information.</Note>
    </div>
  );
}

/**
 * Utvecklingslinsen per elev: stretch ("kan utmanas mer"), tappar mark eller
 * positiv rörelse inom läsåret – plus en markör när flerterminstrenden över
 * upp till fyra läsår pekar nedåt.
 */
function DevBadge({ dev, longTrend }: { dev: DevStudent | null; longTrend: StudentLongTrend | null }) {
  const fallingLong = longTrend?.trend === "negativ";
  const longMarker = fallingLong ? (
    <span className="text-sm font-medium text-[var(--gbg-red-dark)]" title={longTrend!.detail}>
      ↘ över tid
    </span>
  ) : null;

  let inYear: React.ReactNode = null;
  if (dev && dev.category === "stretch") {
    inYear = <span title={dev.detail}><Pill tone="info">Kan utmanas mer</Pill></span>;
  } else if (dev && dev.category === "tappar") {
    inYear = <span title={dev.detail}><Pill tone="uppmarksam">Tappar mark</Pill></span>;
  } else if (dev && dev.category === "positiv") {
    inYear = (
      <span className="text-sm text-[var(--gbg-green-dark)]" title={dev.detail}>
        ↗ förbättras
      </span>
    );
  }

  if (!inYear && !longMarker) return <span className="text-[var(--text-muted)]">–</span>;
  return (
    <span className="flex flex-wrap items-center gap-2">
      {inYear}
      {longMarker}
    </span>
  );
}

function ClassGrades({ classId }: { classId: string }) {
  const dist = getClassGradeDistribution(classId, CURRENT_TERM);
  const subjects = [...new Set(dist.map((d) => d.subject))];
  const series = GRADE_MARKS.map((m) => ({
    name: m === "-" ? "Streck" : m,
    data: subjects.map((s) => dist.find((d) => d.subject === s && d.grade === m)?.antal ?? 0),
  }));
  return (
    <Card className="p-5">
      <h3 className="mb-2 font-semibold">Betygsfördelning per ämne</h3>
      <BarChart
        ariaLabel={`Betygsfördelning per ämne för klass ${classId}`}
        categories={subjects}
        series={series}
        stacked
        colors={GRADE_MARKS.map((m) => MARK_COLOR[m])}
        height={340}
      />
    </Card>
  );
}

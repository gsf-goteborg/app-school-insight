import { notFound } from "next/navigation";
import { PageHeader, Card, Section, Stat, Pill, Note } from "@/components/ui/primitives";
import { LevelBadge } from "@/components/ui/primitives";
import { LineChart, BarChart } from "@/components/charts";
import { InterventionList } from "@/components/intervention-list";
import { CommentThread } from "@/components/comment-thread";
import {
  getStudent, getStudentAttendance, getStudentAttendanceTimeline,
  getStudentSkills, getStudentWritten, getStudentGrades, getStudentNationalTests,
  getMeritValue, getAllStudents,
} from "@/lib/db/queries";
import { getInterventionsForStudent, getComments } from "@/lib/db/queries-resources";
import { getStudentSupport } from "@/lib/db/queries-progression";
import { getStudentWellbeing } from "@/lib/db/queries-wellbeing";
import { getBehorighetForStudent, bucketMeta } from "@/lib/db/queries-behorighet";
import {
  levelTrend, gradeTrend, TREND_LABEL, type Trend,
  gradeParagraph, knowledgeParagraph, attendanceParagraph, supportParagraph, wellbeingParagraph, buildNarrative,
} from "@/lib/text/student-narrative";
import { pct, num, dateShort, dateLong } from "@/lib/format";
import { CURRENT_TERM, DEMO_TODAY, SKILL_AREAS, TERMS, type Level, type GradeMark } from "@/lib/constants";

export function generateStaticParams() {
  return getAllStudents().map((s) => ({ studentId: s.student_id }));
}

function weekStart(iso: string): string {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7; // måndag = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

const monthFmt = new Intl.DateTimeFormat("sv-SE", { month: "short" });

/** Liten trend-pill för tabeller. */
function TrendCell({ trend }: { trend: Trend }) {
  const tone = trend === "positiv" ? "positiv" : trend === "negativ" ? "kritisk" : trend === "neutral" ? "neutral" : "neutral";
  const arrow = trend === "positiv" ? "↑ " : trend === "negativ" ? "↓ " : trend === "neutral" ? "→ " : "";
  return <Pill tone={tone}>{arrow}{TREND_LABEL[trend]}</Pill>;
}

export default async function ElevPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const student = getStudent(studentId);
  if (!student) notFound();
  const grade = student.grade_level;

  // Behörighetsprognos (åk 4–10) – kompletterande utfallsnära lins.
  const beh = getBehorighetForStudent(studentId);
  const behMeta = beh ? bucketMeta(beh.bucket) : null;

  const attn = getStudentAttendance(studentId);
  const rate = attn && attn.days_total ? attn.days_attended / attn.days_total : 0;
  const absRate = attn && attn.days_total ? attn.days_absent / attn.days_total : 0;
  const w4 = attn && attn.w4_total ? attn.w4_absent / attn.w4_total : 0;
  const w12 = attn && attn.w12_total ? attn.w12_absent / attn.w12_total : 0;
  const rise = w4 - w12;

  // Tidslinje – underlag för både veckovis närvaro och månadsvis frånvaro
  const timeline = getStudentAttendanceTimeline(studentId);

  // Veckovis närvaro
  const weekMap = new Map<string, { present: number; total: number }>();
  for (const d of timeline) {
    const k = weekStart(d.date);
    const cur = weekMap.get(k) ?? { present: 0, total: 0 };
    cur.total += 1;
    if (d.status === "present" || d.status === "late") cur.present += 1;
    weekMap.set(k, cur);
  }
  const weeks = [...weekMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const weekCats = weeks.map(([k]) => dateShort(k));
  const weekRates = weeks.map(([, v]) => (v.total ? Math.round((v.present / v.total) * 100) : 0));

  // Månadsvis frånvaro (frånvaro = valid_absence | invalid_absence)
  const monthMap = new Map<string, { absent: number; total: number }>();
  for (const d of timeline) {
    const k = d.date.slice(0, 7); // YYYY-MM
    const cur = monthMap.get(k) ?? { absent: 0, total: 0 };
    cur.total += 1;
    if (d.status === "valid_absence" || d.status === "invalid_absence") cur.absent += 1;
    monthMap.set(k, cur);
  }
  const months = [...monthMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const monthRows = months.map(([k, v]) => {
    const rate = v.total ? v.absent / v.total : 0;
    const tone: "kritisk" | "uppmarksam" | "neutral" = rate >= 0.2 ? "kritisk" : rate >= 0.1 ? "uppmarksam" : "neutral";
    return {
      key: k,
      label: monthFmt.format(new Date(`${k}-01`)),
      rate,
      tone,
    };
  });
  const monthCats = monthRows.map((m) => m.label);
  const monthAbsRates = monthRows.map((m) => Math.round(m.rate * 1000) / 10);

  const interventions = getInterventionsForStudent(studentId, student.class_id, grade);
  const comments = getComments("student", studentId);
  const support = getStudentSupport(studentId);
  const wellbeing = getStudentWellbeing(studentId);

  // Nästa planerade uppföljning
  const nextFollowUp = interventions
    .map((i) => i.follow_up_date)
    .filter((d): d is string => !!d && d >= DEMO_TODAY)
    .sort()[0];

  // Tidslinje av händelser
  const events = interventions
    .filter((i) => i.start_date)
    .map((i) => ({ date: i.start_date!, label: `Insats startad: ${i.title}` }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const showLSR = grade >= 1 && grade <= 4;
  const showWritten = grade >= 2 && grade <= 6;
  const showGrades = grade >= 7 && grade <= 10;

  // ----- Elevanalys -----
  const currentTermLabel = TERMS.find((t) => t.key === CURRENT_TERM)!.label.toLowerCase();
  const narrativeParas: string[] = [];

  if (showGrades) {
    const g = getStudentGrades(studentId);
    const subjects = [...new Set(g.map((x) => x.subject))];
    const current = subjects
      .map((subj) => ({ subject: subj, grade: g.find((x) => x.subject === subj && x.term === CURRENT_TERM)?.grade }))
      .filter((x): x is { subject: string; grade: GradeMark } => !!x.grade);
    const trends = subjects.map((subj) => ({
      subject: subj,
      trend: gradeTrend(
        g.find((x) => x.subject === subj && x.term === "HT2025")?.grade,
        g.find((x) => x.subject === subj && x.term === "VT2026")?.grade,
      ),
    }));
    narrativeParas.push(
      gradeParagraph({ term: currentTermLabel, current, trends, meritValue: getMeritValue(studentId, CURRENT_TERM) }),
    );
  } else {
    const current: { label: string; level: Level }[] = [];
    const trends: { label: string; trend: Trend }[] = [];
    let kind: "lsr" | "written" | "both" = "lsr";
    if (showLSR) {
      const skills = getStudentSkills(studentId);
      for (const a of SKILL_AREAS) {
        const ht = skills.find((s) => s.area === a.key && s.term === "HT2025")?.level;
        const vt = skills.find((s) => s.area === a.key && s.term === "VT2026")?.level;
        if (vt) current.push({ label: a.label, level: vt });
        trends.push({ label: a.label, trend: levelTrend(ht, vt) });
      }
    }
    if (showWritten) {
      const w = getStudentWritten(studentId);
      const subjects = [...new Set(w.map((x) => x.subject))];
      for (const subj of subjects) {
        const ht = w.find((x) => x.subject === subj && x.term === "HT2025")?.level;
        const vt = w.find((x) => x.subject === subj && x.term === "VT2026")?.level;
        if (vt) current.push({ label: subj, level: vt });
        trends.push({ label: subj, trend: levelTrend(ht, vt) });
      }
    }
    kind = showLSR && showWritten ? "both" : showWritten ? "written" : "lsr";
    narrativeParas.push(knowledgeParagraph({ term: currentTermLabel, current, trends, kind }));
  }

  narrativeParas.push(attendanceParagraph({ absenceRate: absRate, rise }));
  if (wellbeing.current) {
    narrativeParas.push(wellbeingParagraph({ ...wellbeing.current, trend: wellbeing.trend }));
  }
  narrativeParas.push(supportParagraph(support));
  const narrative = buildNarrative(narrativeParas);

  // Trivsel/wellbeing – dimensioner och jämförelse mot föregående termin
  const wbDims = ["Trivsel", "Trygghet", "Arbetsro"] as const;
  const wbCurrent = wellbeing.current ? [wellbeing.current.trivsel, wellbeing.current.trygghet, wellbeing.current.studiero] : [];
  const wbPrevious = wellbeing.previous ? [wellbeing.previous.trivsel, wellbeing.previous.trygghet, wellbeing.previous.studiero] : [];

  return (
    <div>
      <PageHeader
        kicker="Elev"
        title={`${student.first_name} ${student.last_name}`}
        breadcrumb={[
          { label: "Elever", href: "/elev" },
          { label: `Åk ${grade}`, href: `/arskurs/${grade}` },
          { label: student.class_id, href: `/klass/${student.class_id}` },
          { label: `${student.first_name} ${student.last_name}` },
        ]}
        description={`Klass ${student.class_id} · årskurs ${grade}`}
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Närvarograd" value={pct(rate, 1)} tone={rate >= 0.95 ? "positiv" : rate >= 0.9 ? "neutral" : "uppmarksam"} hint="läsåret hittills" />
        <Stat label="Frånvaro" value={pct(absRate, 1)} hint="giltig + ogiltig" />
        <Stat
          label="Frånvarotrend"
          value={rise > 0 ? `↑ ${pct(rise, 1)}` : rise < 0 ? `↓ ${pct(-rise, 1)}` : "stabil"}
          tone={rise > 0.02 ? "uppmarksam" : rise < -0.01 ? "positiv" : "neutral"}
          hint="senaste 4 v mot 12 v"
        />
        {showGrades
          ? <Stat label="Meritvärde" value={num(getMeritValue(studentId, CURRENT_TERM), 0)} hint="vårterminen 2026" />
          : <Stat label="Nästa uppföljning" value={nextFollowUp ? dateShort(nextFollowUp) : "–"} />}
      </div>

      {/* Elevanalys – sammanfattande genererad text */}
      <Section title="Elevanalys" description="Automatiskt genererad sammanfattning utifrån elevens registrerade data.">
        <Card className="p-5">
          <div className="space-y-3 text-[15px] leading-relaxed">
            {narrative.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </Card>
      </Section>

      {/* Behörighetsprognos (åk 4–10) */}
      {beh && behMeta && (
        <Section
          title="Behörighetsprognos"
          description="Skattad sannolikhet för behörighet till yrkesprogram – en kompletterande lins (se Behörighetsprognos)."
        >
          <Card className="p-5">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <p className="text-sm text-[var(--text-muted)]">Sannolikhet behörighet</p>
                <p className="font-display text-3xl tabular text-[var(--text-strong)]">{pct(beh.probability)}</p>
              </div>
              <Pill tone={behMeta.tone}>{behMeta.label} · {behMeta.desc}</Pill>
              {beh.meetsRequirements !== null && (
                <Pill tone={beh.meetsRequirements ? "positiv" : "kritisk"}>
                  {beh.meetsRequirements ? "Uppfyller behörighetskraven" : "Uppfyller inte behörighetskraven"}
                </Pill>
              )}
            </div>
            {beh.factors.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-sm font-medium text-[var(--text-muted)]">Faktorer som påverkar prognosen</p>
                <div className="flex flex-wrap gap-2">
                  {beh.factors.map((f, i) => (
                    <Pill key={i} tone="neutral">{f}</Pill>
                  ))}
                </div>
              </div>
            )}
            <p className="mt-4 text-sm text-[var(--text-muted)]">
              Illustrativ skattning på demodata{grade === 10 ? " – i slutåret styr den faktiska behörigheten" : ", tidsdiskonterad efter årskurs"}.
              Tolkas tillsammans med elevens hela bild.
            </p>
          </Card>
        </Section>
      )}

      {/* Närvaroutveckling */}
      <Section title="Närvaroutveckling" description="Närvaro per vecka, läsåret hittills.">
        <Card className="p-5">
          <LineChart
            ariaLabel={`Veckovis närvaro för ${student.first_name} ${student.last_name}`}
            categories={weekCats}
            series={[{ name: "Närvaro", data: weekRates }]}
            yMax={100}
            valueFormat="pct0"
            height={280}
          />
        </Card>
      </Section>

      {/* Frånvaro per månad */}
      <Section title="Frånvaro per månad" description="Andel frånvaro (giltig + ogiltig) per kalendermånad, läsåret hittills.">
        {monthRows.length === 0 ? (
          <Card className="p-5 text-[var(--text-muted)]">Ingen frånvarodata registrerad.</Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <LineChart
                ariaLabel={`Månadsvis frånvaro för ${student.first_name} ${student.last_name}`}
                categories={monthCats}
                series={[{ name: "Frånvaro", data: monthAbsRates }]}
                valueFormat="pct1"
                height={280}
              />
            </Card>
            <Card className="overflow-hidden">
              <table className="w-full text-[15px]">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-left text-sm text-[var(--text-muted)]">
                    <th className="px-4 py-2.5 font-medium">Månad</th>
                    <th className="px-4 py-2.5 font-medium">Frånvaro</th>
                    <th className="px-4 py-2.5 font-medium">Bedömning</th>
                  </tr>
                </thead>
                <tbody>
                  {monthRows.map((m) => (
                    <tr key={m.key} className="border-b border-[var(--border-subtle)] last:border-0">
                      <td className="px-4 py-2.5 font-medium capitalize">{m.label}</td>
                      <td className="px-4 py-2.5 tabular">{pct(m.rate, 1)}</td>
                      <td className="px-4 py-2.5">
                        <Pill tone={m.tone}>
                          {m.tone === "kritisk" ? "Hög" : m.tone === "uppmarksam" ? "Uppmärksammas" : "Normal"}
                        </Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}
      </Section>

      {/* Trivsel och trygghet (wellbeing) */}
      {wellbeing.current && (
        <Section title="Trivsel och trygghet" description="Elevens egen skattning i trivselenkäten (skala 1–4, högre är bättre).">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <div className="space-y-3">
                {wbDims.map((dim, i) => {
                  const v = wbCurrent[i];
                  const tone: "kritisk" | "uppmarksam" | "positiv" | "neutral" =
                    v <= 2 ? "kritisk" : v === 3 ? "neutral" : "positiv";
                  return (
                    <div key={dim} className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-3">
                      <span className="text-sm font-medium">{dim}</span>
                      <div className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(v / 4) * 100}%`,
                            background:
                              tone === "kritisk" ? "var(--gbg-red)" : tone === "neutral" ? "var(--gbg-orange)" : "var(--gbg-green)",
                          }}
                        />
                      </div>
                      <span className="text-right text-sm tabular text-[var(--text-muted)]">{v}/4</span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 text-sm text-[var(--text-muted)]">
                Snitt {num(wellbeing.current.avg, 1)}/4
                {wellbeing.previous && ` (föregående termin ${num(wellbeing.previous.avg, 1)}/4)`}
                {wellbeing.trend != null && wellbeing.trend <= -0.5 && " – sjunkande, värt att uppmärksamma."}
                {wellbeing.trend != null && wellbeing.trend >= 0.5 && " – stigande."}
              </p>
            </Card>
            {wbPrevious.length > 0 && (
              <Card className="p-5">
                <BarChart
                  ariaLabel={`Trivsel per dimension, HT 2025 mot VT 2026 för ${student.first_name} ${student.last_name}`}
                  categories={[...wbDims]}
                  series={[
                    { name: "HT 2025", data: wbPrevious },
                    { name: "VT 2026", data: wbCurrent },
                  ]}
                  valueFormat="dec1"
                  height={240}
                />
              </Card>
            )}
          </div>
        </Section>
      )}

      {/* Kunskapsutveckling */}
      <Section title="Kunskapsutveckling" description="Utveckling mellan terminerna med trend HT → VT.">
        {showLSR && <SkillTable studentId={studentId} />}
        {showWritten && <WrittenTable studentId={studentId} />}
        {showGrades && <GradeTable studentId={studentId} />}
      </Section>

      {/* Insatser, tidslinje, kommentarer */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Stödinsatser">
          <InterventionList interventions={interventions} />
          {nextFollowUp && (
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              Nästa planerade uppföljning: <strong>{dateLong(nextFollowUp)}</strong>
            </p>
          )}
        </Section>
        <Section title="Viktiga händelser">
          {events.length === 0 ? (
            <Card className="p-5 text-[var(--text-muted)]">Inga registrerade händelser.</Card>
          ) : (
            <Card className="p-5">
              <ol className="relative space-y-4 border-l-2 border-[var(--border-subtle)] pl-5">
                {events.map((e, i) => (
                  <li key={i}>
                    <span className="absolute -left-[7px] mt-1.5 size-3 rounded-full bg-[var(--gbg-blue)]" aria-hidden />
                    <p className="text-sm text-[var(--text-muted)]">{dateLong(e.date)}</p>
                    <p className="font-medium">{e.label}</p>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </Section>
      </div>

      <Section title="Kommentarer">
        <CommentThread scope="student" scopeRef={studentId} comments={comments} />
      </Section>

      <Note tone="info">
        Demodata. Elevbilden ska tolkas varsamt och tillsammans med annan kännedom om eleven – den ersätter
        inte professionell bedömning. Elevanalysen är automatiskt genererad utifrån registrerade siffror.
      </Note>
    </div>
  );
}

function TwoTermTable({ rows }: { rows: { label: string; ht?: Level; vt?: Level }[] }) {
  return (
    <Card className="overflow-hidden">
      <table className="w-full text-[15px]">
        <thead>
          <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-left text-sm text-[var(--text-muted)]">
            <th className="px-4 py-2.5 font-medium">Område / ämne</th>
            <th className="px-4 py-2.5 font-medium">{TERMS[0].label}</th>
            <th className="px-4 py-2.5 font-medium">{TERMS[1].label}</th>
            <th className="px-4 py-2.5 font-medium">Trend</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-[var(--border-subtle)] last:border-0">
              <td className="px-4 py-2.5 font-medium">{r.label}</td>
              <td className="px-4 py-2.5">{r.ht ? <LevelBadge level={r.ht} /> : "–"}</td>
              <td className="px-4 py-2.5">{r.vt ? <LevelBadge level={r.vt} /> : "–"}</td>
              <td className="px-4 py-2.5"><TrendCell trend={levelTrend(r.ht, r.vt)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function SkillTable({ studentId }: { studentId: string }) {
  const skills = getStudentSkills(studentId);
  const rows = SKILL_AREAS.map((a) => ({
    label: a.label,
    ht: skills.find((s) => s.area === a.key && s.term === "HT2025")?.level,
    vt: skills.find((s) => s.area === a.key && s.term === "VT2026")?.level,
  }));
  return <TwoTermTable rows={rows} />;
}

function WrittenTable({ studentId }: { studentId: string }) {
  const w = getStudentWritten(studentId);
  const subjects = [...new Set(w.map((x) => x.subject))];
  const rows = subjects.map((subj) => ({
    label: subj,
    ht: w.find((x) => x.subject === subj && x.term === "HT2025")?.level,
    vt: w.find((x) => x.subject === subj && x.term === "VT2026")?.level,
  }));
  return <TwoTermTable rows={rows} />;
}

function GradeTable({ studentId }: { studentId: string }) {
  const g = getStudentGrades(studentId);
  const nat = getStudentNationalTests(studentId);
  const subjects = [...new Set(g.map((x) => x.subject))];
  return (
    <Card className="overflow-hidden">
      <table className="w-full text-[15px]">
        <thead>
          <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-left text-sm text-[var(--text-muted)]">
            <th className="px-4 py-2.5 font-medium">Ämne</th>
            <th className="px-4 py-2.5 font-medium">{TERMS[0].label}</th>
            <th className="px-4 py-2.5 font-medium">{TERMS[1].label}</th>
            <th className="px-4 py-2.5 font-medium">Trend</th>
            <th className="px-4 py-2.5 font-medium">Nationellt prov</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((subj) => {
            const ht = g.find((x) => x.subject === subj && x.term === "HT2025")?.grade;
            const vt = g.find((x) => x.subject === subj && x.term === "VT2026")?.grade;
            return (
              <tr key={subj} className="border-b border-[var(--border-subtle)] last:border-0">
                <td className="px-4 py-2.5 font-medium">{subj}</td>
                <td className="px-4 py-2.5 tabular">{ht ?? "–"}</td>
                <td className="px-4 py-2.5 tabular">{vt ?? "–"}</td>
                <td className="px-4 py-2.5"><TrendCell trend={gradeTrend(ht, vt)} /></td>
                <td className="px-4 py-2.5 tabular">{nat.find((x) => x.subject === subj)?.grade ?? "–"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

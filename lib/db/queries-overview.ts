import "server-only";
import { all } from "./index";
import { CURRENT_TERM } from "@/lib/constants";
import { getEarlyWarnings } from "./queries-risk";

// ---------------------------------------------------------------------------
// Jämförelseunderlag för översiktsvyerna (Årskurser / Klasser): samma nyckeltal
// per årskurs och per klass så att man snabbt kan jämföra och se var behovet av
// uppmärksamhet är störst. Demodata.
// ---------------------------------------------------------------------------

export type AttentionLevel = "Prioritera" | "Bevaka" | "Stabilt";

export interface OverviewMetrics {
  students: number;
  attendanceRate: number;
  absenceRise: number;       // w4 − w12 (positivt = ökande frånvaro)
  over15Share: number;       // andel elever med ≥15 % frånvaro
  flagged: number;
  flaggedShare: number;
  hog: number;               // antal hög risk i Tidig upptäckt
  avgTrygghet: number;       // 1–4
  supportShare: number;      // andel med extra anpassning/åtgärdsprogram
  attention: AttentionLevel;
}

export interface GradeOverview extends OverviewMetrics {
  grade: number;
}
export interface ClassOverview extends OverviewMetrics {
  class_id: string;
  grade: number;
  mentor: string | null;
}

interface BaseRow {
  key: string;
  grade: number;
  students: number;
  att: number; tot: number; absent: number;
  w4a: number; w4t: number; w12a: number; w12t: number;
  over15: number; support: number;
}

function attentionOf(m: Omit<OverviewMetrics, "attention">): AttentionLevel {
  let score = 0;
  if (m.avgTrygghet > 0 && m.avgTrygghet < 2.4) score += 3;
  else if (m.avgTrygghet > 0 && m.avgTrygghet < 2.8) score += 1;
  if (m.hog >= 6 || (m.students > 0 && m.hog / m.students >= 0.1)) score += 2;
  if (m.attendanceRate > 0 && m.attendanceRate < 0.92) score += 1;
  if (m.absenceRise >= 0.03) score += 1;
  if (m.over15Share >= 0.1) score += 1;
  if (m.flaggedShare >= 0.55) score += 1;
  return score >= 3 ? "Prioritera" : score >= 1 ? "Bevaka" : "Stabilt";
}

function baseQuery(groupBy: "s.grade_level" | "s.class_id, s.grade_level"): BaseRow[] {
  const keyExpr = groupBy.startsWith("s.class_id") ? "s.class_id" : "cast(s.grade_level as text)";
  return all<BaseRow>(
    `select ${keyExpr} key, s.grade_level grade,
       count(*) students,
       coalesce(sum(va.days_attended),0) att,
       coalesce(sum(va.days_total),0) tot,
       coalesce(sum(va.days_absent),0) absent,
       coalesce(sum(va.w4_absent),0) w4a, coalesce(sum(va.w4_total),0) w4t,
       coalesce(sum(va.w12_absent),0) w12a, coalesce(sum(va.w12_total),0) w12t,
       sum(case when va.days_total>0 and cast(va.days_absent as real)/va.days_total >= 0.15 then 1 else 0 end) over15,
       sum(case when s.extra_anpassning=1 or s.atgardsprogram=1 then 1 else 0 end) support
     from students s
     join v_student_attendance va on va.student_id = s.student_id
     where s.active = 1
     group by ${groupBy}`,
  );
}

function tryggMap(byClass: boolean): Map<string, number> {
  const col = byClass ? "s.class_id" : "cast(s.grade_level as text)";
  const rows = all<{ key: string; trygghet: number }>(
    `select ${col} key, avg(w.trygghet) trygghet
     from wellbeing_surveys w join students s on s.student_id = w.student_id
     where w.term = ? group by ${col}`,
    CURRENT_TERM,
  );
  return new Map(rows.map((r) => [r.key, r.trygghet]));
}

function metricsFrom(b: BaseRow, trygghet: number, flagged: number, hog: number): OverviewMetrics {
  const attendanceRate = b.tot ? b.att / b.tot : 0;
  const absenceRise = (b.w4t ? b.w4a / b.w4t : 0) - (b.w12t ? b.w12a / b.w12t : 0);
  const m = {
    students: b.students,
    attendanceRate,
    absenceRise,
    over15Share: b.students ? b.over15 / b.students : 0,
    flagged,
    flaggedShare: b.students ? flagged / b.students : 0,
    hog,
    avgTrygghet: trygghet,
    supportShare: b.students ? b.support / b.students : 0,
  };
  return { ...m, attention: attentionOf(m) };
}

export function getGradeOverview(): GradeOverview[] {
  const base = baseQuery("s.grade_level");
  const trygg = tryggMap(false);
  const warnings = getEarlyWarnings();
  const flaggedByGrade = new Map<number, number>();
  const hogByGrade = new Map<number, number>();
  for (const w of warnings) {
    flaggedByGrade.set(w.grade_level, (flaggedByGrade.get(w.grade_level) ?? 0) + 1);
    if (w.level === "Hög") hogByGrade.set(w.grade_level, (hogByGrade.get(w.grade_level) ?? 0) + 1);
  }
  return base
    .map((b) => ({
      grade: b.grade,
      ...metricsFrom(b, trygg.get(String(b.grade)) ?? 0, flaggedByGrade.get(b.grade) ?? 0, hogByGrade.get(b.grade) ?? 0),
    }))
    .sort((a, b) => a.grade - b.grade);
}

export function getClassOverview(): ClassOverview[] {
  const base = baseQuery("s.class_id, s.grade_level");
  const trygg = tryggMap(true);
  const mentors = new Map(
    all<{ class_id: string; mentor: string | null }>(
      `select c.class_id, (m.first_name || ' ' || m.last_name) mentor
       from classes c left join staff m on m.staff_id = c.mentor_staff_id`,
    ).map((r) => [r.class_id, r.mentor]),
  );
  const warnings = getEarlyWarnings();
  const flaggedByClass = new Map<string, number>();
  const hogByClass = new Map<string, number>();
  for (const w of warnings) {
    flaggedByClass.set(w.class_id, (flaggedByClass.get(w.class_id) ?? 0) + 1);
    if (w.level === "Hög") hogByClass.set(w.class_id, (hogByClass.get(w.class_id) ?? 0) + 1);
  }
  return base
    .map((b) => ({
      class_id: b.key,
      grade: b.grade,
      mentor: mentors.get(b.key) ?? null,
      ...metricsFrom(b, trygg.get(b.key) ?? 0, flaggedByClass.get(b.key) ?? 0, hogByClass.get(b.key) ?? 0),
    }))
    .sort((a, b) => a.class_id.localeCompare(b.class_id, "sv", { numeric: true }));
}

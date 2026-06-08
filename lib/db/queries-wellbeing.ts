import "server-only";
import { all, one } from "./index";
import { CURRENT_TERM } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Trivsel / wellbeing (§ vision: wellbeing-data som tidig indikator).
// Skala 1–4 där 4 = bäst. Tre dimensioner: trivsel, trygghet, arbetsro (studiero).
// Låg trivsel/trygghet är en tidig signal som vägs in i Tidig upptäckt.
// ---------------------------------------------------------------------------

/** En dimension räknas som låg (signal) vid värde ≤ 2. */
export const LOW_WELLBEING = 2;

export interface WellbeingTerm {
  term: string;
  trivsel: number;
  trygghet: number;
  studiero: number;
  avg: number;
}

export interface StudentWellbeing {
  current: WellbeingTerm | null;
  previous: WellbeingTerm | null;
  trend: number | null; // current.avg - previous.avg
}

const withAvg = (r: { term: string; trivsel: number; trygghet: number; studiero: number }): WellbeingTerm => ({
  ...r,
  avg: (r.trivsel + r.trygghet + r.studiero) / 3,
});

export function getStudentWellbeing(studentId: string): StudentWellbeing {
  const rows = all<{ term: string; trivsel: number; trygghet: number; studiero: number }>(
    `select term, trivsel, trygghet, studiero from wellbeing_surveys where student_id = ? order by term`,
    studentId,
  ).map(withAvg);
  const current = rows.find((r) => r.term === CURRENT_TERM) ?? null;
  const previous = rows.find((r) => r.term !== CURRENT_TERM) ?? null;
  const trend = current && previous ? current.avg - previous.avg : null;
  return { current, previous, trend };
}

export interface WellbeingSummary {
  trivsel: number;
  trygghet: number;
  studiero: number;
  low_count: number; // antal elever med minst en låg dimension (≤2) innevarande termin
  total: number;
}

export function getWellbeingSummary(): WellbeingSummary {
  const avg = one<{ trivsel: number; trygghet: number; studiero: number; total: number }>(
    `select coalesce(avg(trivsel),0) trivsel, coalesce(avg(trygghet),0) trygghet,
            coalesce(avg(studiero),0) studiero, count(*) total
     from wellbeing_surveys where term = ?`,
    CURRENT_TERM,
  )!;
  const low = one<{ c: number }>(
    `select count(distinct student_id) c from wellbeing_surveys
     where term = ? and (trivsel <= ? or trygghet <= ? or studiero <= ?)`,
    CURRENT_TERM, LOW_WELLBEING, LOW_WELLBEING, LOW_WELLBEING,
  )!;
  return { trivsel: avg.trivsel, trygghet: avg.trygghet, studiero: avg.studiero, low_count: low.c, total: avg.total };
}

export interface ClassWellbeing {
  avgTrivsel: number;
  avgTrygghet: number;
  avgStudiero: number;
  lowCount: number; // elever med minst en låg dimension (≤2)
  byStudent: Map<string, { trivsel: number; trygghet: number; studiero: number }>;
}

export function getClassWellbeing(classId: string): ClassWellbeing {
  const rows = all<{ student_id: string; trivsel: number; trygghet: number; studiero: number }>(
    `select w.student_id, w.trivsel, w.trygghet, w.studiero
     from wellbeing_surveys w join students s on s.student_id = w.student_id
     where w.term = ? and s.class_id = ? and s.active = 1`,
    CURRENT_TERM, classId,
  );
  const n = rows.length || 1;
  const sum = rows.reduce(
    (a, r) => ({ t: a.t + r.trivsel, g: a.g + r.trygghet, s: a.s + r.studiero }),
    { t: 0, g: 0, s: 0 },
  );
  return {
    avgTrivsel: sum.t / n,
    avgTrygghet: sum.g / n,
    avgStudiero: sum.s / n,
    lowCount: rows.filter((r) => r.trivsel <= LOW_WELLBEING || r.trygghet <= LOW_WELLBEING || r.studiero <= LOW_WELLBEING).length,
    byStudent: new Map(rows.map((r) => [r.student_id, { trivsel: r.trivsel, trygghet: r.trygghet, studiero: r.studiero }])),
  };
}

/**
 * Sambandsunderlag: snittfrånvaro per trygghetsnivå (1–4) innevarande termin.
 * Visar hur trygghet och närvaro hänger ihop (underlag för Analys-vyn).
 */
export interface AbsenceByTrygghet { trygghet: number; avg_absence: number; n: number }
export function getAbsenceByTrygghet(): AbsenceByTrygghet[] {
  return all<AbsenceByTrygghet>(
    `select w.trygghet,
       avg(cast(va.days_absent as real) / nullif(va.days_total, 0)) avg_absence,
       count(*) n
     from wellbeing_surveys w
     join v_student_attendance va on va.student_id = w.student_id
     where w.term = ?
     group by w.trygghet
     order by w.trygghet`,
    CURRENT_TERM,
  );
}

/** Genomsnittlig trivsel/trygghet per årskurs innevarande termin (för aggregat). */
export interface GradeWellbeing { grade_level: number; trivsel: number; trygghet: number; studiero: number }
export function getGradeWellbeing(): GradeWellbeing[] {
  return all<GradeWellbeing>(
    `select s.grade_level,
       avg(w.trivsel) trivsel, avg(w.trygghet) trygghet, avg(w.studiero) studiero
     from wellbeing_surveys w join students s on s.student_id = w.student_id
     where w.term = ?
     group by s.grade_level order by s.grade_level`,
    CURRENT_TERM,
  );
}

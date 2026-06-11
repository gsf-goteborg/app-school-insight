import "server-only";
import { all, one } from "./index";
import { TERM_SEQUENCE, termShort, SCHOOLS } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Huvudmannanivå (utbildningschef): aggregat per skola.
//
// Läser *_all-tabellerna (alla skolor) – till skillnad från resten av fråge-
// lagret som läser de Framtidsskolan-scopade vyerna. DATAMINIMERING: modulen
// exponerar ALDRIG elevnivå – utbildningschefen ser skol- och årskursaggregat.
// Indikatorerna är direkta mått (frånvaro, underkänt i kärnämne, trygghet …),
// inte skolornas interna modeller – riskmodellerna är respektive skolas verktyg.
// ---------------------------------------------------------------------------

/** Frånvaro per elev och termin för ALLA skolor: terminsaggregat + Framtids-
 *  skolans innevarande läsår beräknat från de dagliga raderna. */
const TERM_ABSENCE_ALL_SQL = `
  select school_id, student_id, term, days_total, days_absent from attendance_term_history_all
  union all
  select school_id, student_id,
    case when date < '2026-01-07' then 'HT2025' else 'VT2026' end term,
    count(*) days_total,
    sum(case when status in ('valid_absence','invalid_absence') then 1 else 0 end) days_absent
  from attendance_records_all
  group by school_id, student_id, case when date < '2026-01-07' then 'HT2025' else 'VT2026' end`;

export type SchoolAttention = "Prioritera" | "Bevaka" | "Stabilt";

export interface SchoolKpis {
  school_id: string;
  name: string;
  blurb: string;
  students: number;
  /** Frånvaroandel VT 2026. */
  absenceRate: number;
  /** Andel elever med ≥ 15 % frånvaro VT 2026. */
  highAbsenceShare: number;
  /** Andel elever åk 7–10 med F/streck i kärnämne VT 2026. */
  coreFailShare: number;
  /** Andel godtagbara omdömen (åk 2–6) VT 2026. */
  writtenOkShare: number;
  /** Snitt trygghet (1–4) VT 2026. */
  avgTrygghet: number;
  /** Andel elever med extra anpassning eller åtgärdsprogram. */
  supportShare: number;
  /** Snittmeritvärde åk 10 VT 2026. */
  meritLeaving: number;
  /** Ekonomisk avvikelse helår (prognos − budget) som andel av budget. */
  economyDeviationShare: number;
  /** Tjänstevägd sjukfrånvaro personal. */
  sickShare: number;
  attention: SchoolAttention;
  /** Det viktigaste att agera på för skolan, 1–2 korta punkter. */
  focus: string[];
}

function attentionOf(k: Omit<SchoolKpis, "attention" | "focus" | "name" | "blurb">): SchoolAttention {
  let score = 0;
  if (k.absenceRate >= 0.055) score += 2;
  else if (k.absenceRate >= 0.05) score += 1;
  if (k.avgTrygghet > 0 && k.avgTrygghet < 3.0) score += 2;
  else if (k.avgTrygghet > 0 && k.avgTrygghet < 3.2) score += 1;
  if (k.coreFailShare >= 0.25) score += 1;
  if (k.economyDeviationShare >= 0.03) score += 2;
  else if (k.economyDeviationShare >= 0.015) score += 1;
  if (k.sickShare >= 0.06) score += 1;
  return score >= 3 ? "Prioritera" : score >= 1 ? "Bevaka" : "Stabilt";
}

function focusOf(k: Omit<SchoolKpis, "attention" | "focus" | "name" | "blurb">): string[] {
  const pctTxt = (v: number, d = 1) => `${(v * 100).toFixed(d).replace(".", ",")} %`;
  const candidates: { score: number; text: string }[] = [
    { score: k.economyDeviationShare * 30, text: `Ekonomisk avvikelse ${pctTxt(k.economyDeviationShare)} mot budget – följ upp prognosen med rektor.` },
    { score: (0.05 - Math.min(k.absenceRate, 0.1)) * -40, text: `Frånvaro ${pctTxt(k.absenceRate)} (${pctTxt(k.highAbsenceShare, 0)} av eleverna ≥ 15 %) – efterfråga skolans närvaroarbete.` },
    { score: (3.3 - k.avgTrygghet) * 1.5, text: `Snitt trygghet ${k.avgTrygghet.toFixed(1).replace(".", ",")}/4 – be om elevhälsans bild av läget.` },
    { score: k.coreFailShare * 4, text: `${pctTxt(k.coreFailShare, 0)} av åk 7–10 har underkänt i kärnämne – diskutera stödorganisationen.` },
    { score: (k.sickShare - 0.045) * 30, text: `Sjukfrånvaro personal ${pctTxt(k.sickShare)} – följ upp arbetsmiljön.` },
  ];
  const top = candidates.filter((c) => c.score > 0.3).sort((a, b) => b.score - a.score).slice(0, 2);
  return top.length > 0 ? top.map((c) => c.text) : ["Inget kräver huvudmannens agerande just nu – följ ordinarie uppföljning."];
}

export function getSchoolKpis(): SchoolKpis[] {
  const students = new Map(
    all<{ school_id: string; n: number; support: number }>(
      `select school_id, count(*) n,
         sum(case when extra_anpassning = 1 or atgardsprogram = 1 then 1 else 0 end) support
       from students_all where active = 1 group by school_id`,
    ).map((r) => [r.school_id, r]),
  );
  const absence = new Map(
    all<{ school_id: string; rate: number; high_share: number }>(
      `select school_id,
         cast(sum(days_absent) as real) / nullif(sum(days_total), 0) rate,
         avg(case when cast(days_absent as real) / nullif(days_total, 0) >= 0.15 then 1.0 else 0 end) high_share
       from (${TERM_ABSENCE_ALL_SQL}) where term = 'VT2026' group by school_id`,
    ).map((r) => [r.school_id, r]),
  );
  const coreFail = new Map(
    all<{ school_id: string; share: number }>(
      `select s.school_id,
         cast(count(distinct case when sg.grade in ('F','-') and sg.subject in ('Svenska','Engelska','Matematik') then sg.student_id end) as real)
           / nullif(count(distinct sg.student_id), 0) share
       from subject_grades_all sg join students_all s on s.student_id = sg.student_id
       where sg.term = 'VT2026' and s.grade_level between 7 and 10
       group by s.school_id`,
    ).map((r) => [r.school_id, r.share]),
  );
  const writtenOk = new Map(
    all<{ school_id: string; share: number }>(
      `select school_id, avg(case when level in ('over','i_linje') then 1.0 else 0 end) share
       from written_assessments_all where term = 'VT2026' group by school_id`,
    ).map((r) => [r.school_id, r.share]),
  );
  const trygghet = new Map(
    all<{ school_id: string; v: number }>(
      `select school_id, avg(trygghet) v from wellbeing_surveys_all where term = 'VT2026' group by school_id`,
    ).map((r) => [r.school_id, r.v]),
  );
  const merit = new Map(
    all<{ school_id: string; v: number }>(
      `with mp(g,p) as (values ('A',20.0),('B',17.5),('C',15.0),('D',12.5),('E',10.0),('F',0.0),('-',0.0))
       select school_id, avg(m) v from (
         select sg.school_id, sg.student_id, sum(mp.p) m
         from subject_grades_all sg
         join students_all s on s.student_id = sg.student_id
         join mp on mp.g = sg.grade
         where sg.term = 'VT2026' and s.grade_level = 10
         group by sg.school_id, sg.student_id
       ) group by school_id`,
    ).map((r) => [r.school_id, r.v]),
  );
  const economy = new Map(
    all<{ school_id: string; budget: number; forecast: number }>(
      `select school_id, sum(full_year_budget) budget, sum(full_year_forecast) forecast
       from financial_forecasts_all group by school_id`,
    ).map((r) => [r.school_id, r]),
  );
  const sick = new Map(
    all<{ school_id: string; v: number }>(
      `select school_id, sum(sick_share * fte) / nullif(sum(fte), 0) v from staff_all group by school_id`,
    ).map((r) => [r.school_id, r.v]),
  );

  return SCHOOLS.map((school) => {
    const eco = economy.get(school.id);
    const base = {
      school_id: school.id,
      students: students.get(school.id)?.n ?? 0,
      absenceRate: absence.get(school.id)?.rate ?? 0,
      highAbsenceShare: absence.get(school.id)?.high_share ?? 0,
      coreFailShare: coreFail.get(school.id) ?? 0,
      writtenOkShare: writtenOk.get(school.id) ?? 0,
      avgTrygghet: trygghet.get(school.id) ?? 0,
      supportShare: students.get(school.id) ? students.get(school.id)!.support / students.get(school.id)!.n : 0,
      meritLeaving: merit.get(school.id) ?? 0,
      economyDeviationShare: eco && eco.budget ? (eco.forecast - eco.budget) / eco.budget : 0,
      sickShare: sick.get(school.id) ?? 0,
    };
    return {
      ...base,
      name: school.name,
      blurb: school.blurb,
      attention: attentionOf(base),
      focus: focusOf(base),
    };
  });
}

export function getSchoolKpisFor(schoolId: string): SchoolKpis | null {
  return getSchoolKpis().find((k) => k.school_id === schoolId) ?? null;
}

// --- Tidsserier per skola och termin (fyra läsår) ---

export interface SchoolTermSeries {
  school_id: string;
  name: string;
  /** En punkt per termin i TERM_SEQUENCE-ordning, null där data saknas. */
  absence: (number | null)[];
  merit: (number | null)[];
}

export function getSchoolTermSeriesAll(): { labels: string[]; series: SchoolTermSeries[] } {
  const absenceRows = all<{ school_id: string; term: string; v: number }>(
    `select school_id, term, cast(sum(days_absent) as real) / nullif(sum(days_total), 0) v
     from (${TERM_ABSENCE_ALL_SQL}) group by school_id, term`,
  );
  const meritRows = all<{ school_id: string; term: string; v: number }>(
    `with mp(g,p) as (values ('A',20.0),('B',17.5),('C',15.0),('D',12.5),('E',10.0),('F',0.0),('-',0.0))
     select school_id, term, avg(m) v from (
       select sg.school_id, sg.term, sg.student_id, sum(mp.p) m
       from subject_grades_all sg join mp on mp.g = sg.grade
       group by sg.school_id, sg.term, sg.student_id
     ) group by school_id, term`,
  );
  const key = (sid: string, term: string) => `${sid}|${term}`;
  const absMap = new Map(absenceRows.map((r) => [key(r.school_id, r.term), r.v]));
  const meritMap = new Map(meritRows.map((r) => [key(r.school_id, r.term), r.v]));

  return {
    labels: TERM_SEQUENCE.map(termShort),
    series: SCHOOLS.map((s) => ({
      school_id: s.id,
      name: s.name,
      absence: TERM_SEQUENCE.map((t) => absMap.get(key(s.id, t)) ?? null),
      merit: TERM_SEQUENCE.map((t) => meritMap.get(key(s.id, t)) ?? null),
    })),
  };
}

// --- Årskursnivå per skola (skolkortet) ---

export interface SchoolGradeRow {
  grade: number;
  students: number;
  absenceRate: number;       // VT 2026
  knowledgeAttentionShare: number; // andel elever med ≥1 svag signal (F/streck eller uppmärksammas/stort behov) VT 2026
  avgTrygghet: number;       // VT 2026
}

export function getSchoolGradeRows(schoolId: string): SchoolGradeRow[] {
  const rows = all<SchoolGradeRow>(
    `with elever as (
       select student_id, grade_level from students_all where school_id = ? and active = 1
     ),
     franvaro as (
       select student_id, cast(days_absent as real) / nullif(days_total, 0) rate
       from (${TERM_ABSENCE_ALL_SQL}) where term = 'VT2026' and school_id = ?
     ),
     svag as (
       select student_id from subject_grades_all where school_id = ? and term = 'VT2026' and grade in ('F','-')
       union
       select student_id from written_assessments_all where school_id = ? and term = 'VT2026' and level in ('uppmarksam','stort_behov')
       union
       select student_id from literacy_numeracy_assessments_all where school_id = ? and term = 'VT2026' and level in ('uppmarksam','stort_behov')
     ),
     trygg as (
       select student_id, trygghet from wellbeing_surveys_all where school_id = ? and term = 'VT2026'
     )
     select e.grade_level grade,
       count(*) students,
       coalesce(avg(f.rate), 0) absenceRate,
       avg(case when sv.student_id is not null then 1.0 else 0 end) knowledgeAttentionShare,
       coalesce(avg(t.trygghet), 0) avgTrygghet
     from elever e
     left join franvaro f on f.student_id = e.student_id
     left join svag sv on sv.student_id = e.student_id
     left join trygg t on t.student_id = e.student_id
     group by e.grade_level
     order by e.grade_level`,
    schoolId, schoolId, schoolId, schoolId, schoolId, schoolId,
  );
  return rows;
}

/** Antal elever totalt inom huvudmannens område. */
export function getTotalStudents(): number {
  return one<{ n: number }>(`select count(*) n from students_all where active = 1`)?.n ?? 0;
}

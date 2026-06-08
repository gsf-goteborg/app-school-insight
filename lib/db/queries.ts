import "server-only";
import { all, one } from "./index";
import { DEMO_TODAY, MERIT_POINTS, type GradeMark, type Level } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Närvaro
// ---------------------------------------------------------------------------
export interface AttnAgg {
  days_total: number;
  days_attended: number;
  days_absent: number;
  days_valid: number;
  days_invalid: number;
}
export const attendanceRate = (a: AttnAgg) => (a.days_total ? a.days_attended / a.days_total : 0);
export const absenceRate = (a: AttnAgg) => (a.days_total ? a.days_absent / a.days_total : 0);

export function getSchoolAttendance(): AttnAgg {
  return (
    one<AttnAgg>(`select days_total, days_attended, days_absent, days_valid, days_invalid from v_school_attendance`) ?? {
      days_total: 0, days_attended: 0, days_absent: 0, days_valid: 0, days_invalid: 0,
    }
  );
}

export interface GradeAttn extends AttnAgg {
  grade_level: number;
  w4_absence_rate: number | null;
  w8_absence_rate: number | null;
  w12_absence_rate: number | null;
}
export function getGradeAttendance(): GradeAttn[] {
  return all<GradeAttn>(`select * from v_grade_attendance order by grade_level`);
}
export function getGradeAttendanceFor(grade: number): GradeAttn | undefined {
  return one<GradeAttn>(`select * from v_grade_attendance where grade_level = ?`, grade);
}

export interface ClassAttn extends AttnAgg {
  class_id: string;
  grade_level: number;
  w4_absence_rate: number | null;
  w8_absence_rate: number | null;
  w12_absence_rate: number | null;
}
export function getClassAttendance(grade?: number): ClassAttn[] {
  return grade
    ? all<ClassAttn>(`select * from v_class_attendance where grade_level = ? order by class_id`, grade)
    : all<ClassAttn>(`select * from v_class_attendance order by grade_level, class_id`);
}

export interface StudentAttn {
  student_id: string;
  class_id: string;
  grade_level: number;
  days_total: number;
  days_attended: number;
  days_absent: number;
  days_valid: number;
  days_invalid: number;
  days_late: number;
  w4_total: number; w4_absent: number;
  w8_total: number; w8_absent: number;
  w12_total: number; w12_absent: number;
}
export function getStudentAttendance(studentId: string): StudentAttn | undefined {
  return one<StudentAttn>(`select * from v_student_attendance where student_id = ?`, studentId);
}
export function getStudentAttendanceByClass(classId: string): StudentAttn[] {
  return all<StudentAttn>(`select * from v_student_attendance where class_id = ? order by student_id`, classId);
}

/** Frånvaro per veckodag (1=mån..7=sön) för en årskurs – underlag till heatmap. */
export interface WeekdayAbsence { grade_level: number; iso_dow: number; absence_rate: number; days_total: number }
export function getWeekdayAbsence(grade?: number): WeekdayAbsence[] {
  return grade
    ? all<WeekdayAbsence>(`select grade_level, iso_dow, absence_rate, days_total from v_grade_weekday_absence where grade_level = ? and iso_dow <= 5 order by iso_dow`, grade)
    : all<WeekdayAbsence>(`select grade_level, iso_dow, absence_rate, days_total from v_grade_weekday_absence where iso_dow <= 5 order by grade_level, iso_dow`);
}

/** Daglig närvaro för en elev (tidslinje). */
export interface AttnDay { date: string; status: string; minutes_absent: number }
export function getStudentAttendanceTimeline(studentId: string): AttnDay[] {
  return all<AttnDay>(
    `select date, status, minutes_absent from attendance_records where student_id = ? and date <= '${DEMO_TODAY}' order by date`,
    studentId,
  );
}

/** Elever med ökande frånvaro: 4-veckorsfrånvaro tydligt högre än 12-veckors. */
export interface RisingAbsence {
  student_id: string; first_name: string; last_name: string; class_id: string; grade_level: number;
  w4_rate: number; w12_rate: number; rise: number;
}
export function getRisingAbsence(minRise = 0.04, minW4 = 0.08): RisingAbsence[] {
  return all<RisingAbsence>(
    `select s.student_id, s.first_name, s.last_name, s.class_id, s.grade_level,
       cast(va.w4_absent as real)/nullif(va.w4_total,0)  as w4_rate,
       cast(va.w12_absent as real)/nullif(va.w12_total,0) as w12_rate,
       cast(va.w4_absent as real)/nullif(va.w4_total,0) - cast(va.w12_absent as real)/nullif(va.w12_total,0) as rise
     from v_student_attendance va
     join students s on s.student_id = va.student_id
     where va.w4_total > 0
       and cast(va.w4_absent as real)/nullif(va.w4_total,0) >= ?
       and (cast(va.w4_absent as real)/nullif(va.w4_total,0) - cast(va.w12_absent as real)/nullif(va.w12_total,0)) >= ?
     order by rise desc`,
    minW4, minRise,
  );
}

/** Antal elever över frånvarotrösklarna 10/15/20 % (livstid). */
export function getThresholdCounts(): { t10: number; t15: number; t20: number; total: number } {
  const r = one<{ t10: number; t15: number; t20: number; total: number }>(
    `select
       sum(case when days_total>0 and cast(days_absent as real)/days_total >= 0.10 then 1 else 0 end) t10,
       sum(case when days_total>0 and cast(days_absent as real)/days_total >= 0.15 then 1 else 0 end) t15,
       sum(case when days_total>0 and cast(days_absent as real)/days_total >= 0.20 then 1 else 0 end) t20,
       count(*) total
     from v_student_attendance`,
  );
  return r ?? { t10: 0, t15: 0, t20: 0, total: 0 };
}

// ---------------------------------------------------------------------------
// Klasser, elever, personal
// ---------------------------------------------------------------------------
export interface ClassRow {
  class_id: string; grade_level: number; suffix: string; arbetslag: string;
  mentor_staff_id: string | null; mentor_name: string | null;
}
export function getClasses(grade?: number): ClassRow[] {
  const sql = `select c.class_id, c.grade_level, c.suffix, c.arbetslag, c.mentor_staff_id,
      (m.first_name || ' ' || m.last_name) as mentor_name
    from classes c left join staff m on m.staff_id = c.mentor_staff_id`;
  return grade
    ? all<ClassRow>(`${sql} where c.grade_level = ? order by c.class_id`, grade)
    : all<ClassRow>(`${sql} order by c.grade_level, c.class_id`);
}
export function getClass(classId: string): ClassRow | undefined {
  return getClasses().find((c) => c.class_id === classId);
}

export interface StudentRow {
  student_id: string; first_name: string; last_name: string;
  grade_level: number; class_id: string; gender: string;
}
export function getStudent(studentId: string): StudentRow | undefined {
  return one<StudentRow>(`select student_id, first_name, last_name, grade_level, class_id, gender from students where student_id = ?`, studentId);
}
export function getAllStudents(): StudentRow[] {
  return all<StudentRow>(`select student_id, first_name, last_name, grade_level, class_id, gender from students order by grade_level, class_id, first_name`);
}
export function getStudentsByClass(classId: string): StudentRow[] {
  return all<StudentRow>(`select student_id, first_name, last_name, grade_level, class_id, gender from students where class_id = ? order by first_name`, classId);
}

// ---------------------------------------------------------------------------
// Läsa/skriva/räkna åk 1–4
// ---------------------------------------------------------------------------
export interface SkillLevelCount { area: string; level: Level; n: number }
export function getGradeSkillSummary(grade: number, term: string): SkillLevelCount[] {
  return all<SkillLevelCount>(
    `select area, level, count(*) n
     from literacy_numeracy_assessments la join students s on s.student_id = la.student_id
     where s.grade_level = ? and la.term = ?
     group by area, level`,
    grade, term,
  );
}
export function getClassSkillSummary(classId: string, term: string): SkillLevelCount[] {
  return all<SkillLevelCount>(
    `select area, level, count(*) n
     from literacy_numeracy_assessments la join students s on s.student_id = la.student_id
     where s.class_id = ? and la.term = ?
     group by area, level`,
    classId, term,
  );
}
export interface StudentSkill { term: string; area: string; level: Level; progression_score: number | null; comment: string | null }
export function getStudentSkills(studentId: string): StudentSkill[] {
  return all<StudentSkill>(
    `select term, area, level, progression_score, comment from literacy_numeracy_assessments where student_id = ? order by term, area`,
    studentId,
  );
}

// ---------------------------------------------------------------------------
// Skriftliga omdömen åk 2–6
// ---------------------------------------------------------------------------
export interface WrittenLevelCount { subject: string; level: Level; n: number }
export function getGradeWrittenSummary(grade: number, term: string): WrittenLevelCount[] {
  return all<WrittenLevelCount>(
    `select subject, level, count(*) n
     from written_assessments wa join students s on s.student_id = wa.student_id
     where s.grade_level = ? and wa.term = ?
     group by subject, level`,
    grade, term,
  );
}
export function getClassWrittenSummary(classId: string, term: string): WrittenLevelCount[] {
  return all<WrittenLevelCount>(
    `select subject, level, count(*) n
     from written_assessments wa join students s on s.student_id = wa.student_id
     where s.class_id = ? and wa.term = ?
     group by subject, level`,
    classId, term,
  );
}
export interface StudentWritten { term: string; subject: string; level: Level; comment: string | null }
export function getStudentWritten(studentId: string): StudentWritten[] {
  return all<StudentWritten>(
    `select term, subject, level, comment from written_assessments where student_id = ? order by term, subject`,
    studentId,
  );
}

// ---------------------------------------------------------------------------
// Betyg åk 7–10 + nationella prov
// ---------------------------------------------------------------------------
export interface GradeDistRow { subject: string; grade: GradeMark; antal: number }
export function getGradeDistribution(grade: number, term: string, subject?: string): GradeDistRow[] {
  const base = `select subject, grade, count(*) antal
     from subject_grades sg join students s on s.student_id = sg.student_id
     where s.grade_level = ? and sg.term = ?`;
  return subject
    ? all<GradeDistRow>(`${base} and sg.subject = ? group by subject, grade order by subject, grade`, grade, term, subject)
    : all<GradeDistRow>(`${base} group by subject, grade order by subject, grade`, grade, term);
}

export function getClassGradeDistribution(classId: string, term: string): GradeDistRow[] {
  return all<GradeDistRow>(
    `select subject, grade, count(*) antal
     from subject_grades sg join students s on s.student_id = sg.student_id
     where s.class_id = ? and sg.term = ?
     group by subject, grade order by subject, grade`,
    classId, term,
  );
}

export interface StudentGrade { term: string; subject: string; grade: GradeMark; is_final: number }
export function getStudentGrades(studentId: string): StudentGrade[] {
  return all<StudentGrade>(`select term, subject, grade, is_final from subject_grades where student_id = ? order by term, subject`, studentId);
}

/** Meritvärde (summa av betygspoäng för terminens betyg). */
export function getMeritValue(studentId: string, term: string): number {
  const rows = all<{ grade: GradeMark }>(`select grade from subject_grades where student_id = ? and term = ?`, studentId, term);
  return rows.reduce((sum, r) => sum + (MERIT_POINTS[r.grade] ?? 0), 0);
}

/** Genomsnittligt meritvärde per årskurs (terminens betyg). */
export function getAverageMerit(grade: number, term: string): number {
  const rows = all<{ student_id: string; grade: GradeMark }>(
    `select sg.student_id, sg.grade from subject_grades sg join students s on s.student_id = sg.student_id
     where s.grade_level = ? and sg.term = ?`, grade, term,
  );
  const byStudent = new Map<string, number>();
  for (const r of rows) byStudent.set(r.student_id, (byStudent.get(r.student_id) ?? 0) + (MERIT_POINTS[r.grade] ?? 0));
  if (byStudent.size === 0) return 0;
  return [...byStudent.values()].reduce((a, b) => a + b, 0) / byStudent.size;
}

/** Andel F eller streck per ämne i en årskurs. */
export interface FailShare { subject: string; fail: number; total: number }
export function getFailShareBySubject(grade: number, term: string): FailShare[] {
  return all<FailShare>(
    `select subject,
       sum(case when grade in ('F','-') then 1 else 0 end) fail,
       count(*) total
     from subject_grades sg join students s on s.student_id = sg.student_id
     where s.grade_level = ? and sg.term = ?
     group by subject order by cast(sum(case when grade in ('F','-') then 1 else 0 end) as real)/count(*) desc`,
    grade, term,
  );
}

/** Per-elev antal "att uppmärksamma" i kunskapsresultat (LSR/omdömen/betyg) en termin. */
export function getClassKnowledgeAttention(classId: string, term: string): Map<string, number> {
  const rows = all<{ student_id: string; attn: number }>(
    `select u.student_id, sum(u.attn) attn from (
       select la.student_id, sum(case when la.level in ('uppmarksam','stort_behov') then 1 else 0 end) attn
         from literacy_numeracy_assessments la where la.term = ? group by la.student_id
       union all
       select wa.student_id, sum(case when wa.level in ('uppmarksam','stort_behov') then 1 else 0 end)
         from written_assessments wa where wa.term = ? group by wa.student_id
       union all
       select sg.student_id, sum(case when sg.grade in ('F','-') then 1 else 0 end)
         from subject_grades sg where sg.term = ? group by sg.student_id
     ) u
     join students s on s.student_id = u.student_id
     where s.class_id = ?
     group by u.student_id`,
    term, term, term, classId,
  );
  return new Map(rows.map((r) => [r.student_id, r.attn]));
}

export interface StudentNat { subject: string; grade: GradeMark }
export function getStudentNationalTests(studentId: string): StudentNat[] {
  return all<StudentNat>(`select subject, grade from national_tests where student_id = ? order by subject`, studentId);
}

/** Sambandsanalys: frånvaro vs meritvärde per elev (åk 7–10). */
export interface AbsenceVsMerit { student_id: string; name: string; grade_level: number; absence: number; merit: number }
export function getAbsenceVsMerit(gradeMin = 7, gradeMax = 10, term = "VT2026"): AbsenceVsMerit[] {
  return all<AbsenceVsMerit>(
    `with mp(g,p) as (values ('A',20.0),('B',17.5),('C',15.0),('D',12.5),('E',10.0),('F',0.0),('-',0.0))
     select s.student_id, s.first_name || ' ' || s.last_name name, s.grade_level,
       cast(va.days_absent as real)/nullif(va.days_total,0) absence,
       sum(mp.p) merit
     from students s
     join v_student_attendance va on va.student_id = s.student_id
     join subject_grades sg on sg.student_id = s.student_id and sg.term = ?
     join mp on mp.g = sg.grade
     where s.grade_level between ? and ?
     group by s.student_id`,
    term, gradeMin, gradeMax,
  );
}

/** Flöde av elever mellan lässnivåer HT → VT (åk 1–4) – underlag till sankey. */
export interface LevelFlow { ht: Level; vt: Level; n: number }
export function getReadingLevelFlow(): LevelFlow[] {
  return all<LevelFlow>(
    `select ht.level ht, vt.level vt, count(*) n
     from literacy_numeracy_assessments ht
     join literacy_numeracy_assessments vt
       on vt.student_id = ht.student_id and vt.area = ht.area and vt.term = 'VT2026'
     where ht.area = 'reading' and ht.term = 'HT2025'
     group by ht.level, vt.level`,
  );
}

/** Jämförelse provbetyg vs terminsbetyg per ämne i en årskurs (medelpoäng). */
export interface NatVsGrade { subject: string; avg_grade: number; avg_nat: number; n: number }
export function getNationalVsGrades(grade: number, term = "VT2026"): NatVsGrade[] {
  return all<NatVsGrade>(
    `with mp(g,p) as (values ('A',20.0),('B',17.5),('C',15.0),('D',12.5),('E',10.0),('F',0.0),('-',0.0))
     select sg.subject,
       avg(g.p) avg_grade,
       avg(n.p) avg_nat,
       count(*) n
     from subject_grades sg
     join students s on s.student_id = sg.student_id
     join national_tests nt on nt.student_id = sg.student_id and nt.subject = sg.subject
     join mp g on g.g = sg.grade
     join mp n on n.g = nt.grade
     where s.grade_level = ? and sg.term = ?
     group by sg.subject order by (avg(g.p) - avg(n.p)) desc`,
    grade, term,
  );
}

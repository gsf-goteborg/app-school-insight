import "server-only";
import { one } from "./index";
import { DEMO_TODAY } from "@/lib/constants";
import type { Intervention } from "./queries-resources";

// ---------------------------------------------------------------------------
// Insatsuppföljning: uppmätt effekt (before → after) per insats.
//
// Varje insats kopplas till det nyckeltal den faktiskt syftar till att påverka,
// och vi mäter värdet före och efter. Måtten är formulerade så att HÖGRE alltid
// är bättre (närvarograd, andel i linje/godkänt), så att en positiv delta entydigt
// betyder förbättring. Detta gör det möjligt att se *om insatsen ger mätbar effekt*
// (vision: skolledare). Allt är demodata och ska tolkas tillsammans med insatsens
// uppföljningsanteckningar – inte som ett bevis på orsakssamband.
// ---------------------------------------------------------------------------

const HT = "HT2025";
const VT = "VT2026";
const VT_START = "2026-01-07";

const AREA_FROM_SUBJECT: Record<string, string> = {
  "Läsning": "reading",
  "Skrivning": "writing",
  "Räkning": "numeracy",
};
const AREA_LABEL: Record<string, string> = {
  reading: "Läsning",
  writing: "Skrivning",
  numeracy: "Räkning",
};

export interface InterventionEffect {
  metric: string;        // vad som mäts, t.ex. "Andel godtagbara omdömen i Matematik"
  populationLabel: string; // vilka elever, t.ex. "klass 2A"
  beforeLabel: string;
  afterLabel: string;
  before: number;        // 0..1
  after: number;         // 0..1
  delta: number;         // after - before
  n: number;             // antal datapunkter/elever i mätningen
  note: string;          // kort tolkning
}

interface Pop { sql: string; params: unknown[]; label: string; grade: number | null }

function population(i: Intervention): Pop {
  if (i.target_student_id) {
    return { sql: "s.student_id = ?", params: [i.target_student_id], label: `elev ${i.target_student_id}`, grade: gradeOf(i) };
  }
  if (i.target_class_id) {
    return { sql: "s.class_id = ?", params: [i.target_class_id], label: `klass ${i.target_class_id}`, grade: gradeOf(i) };
  }
  if (i.target_grade != null) {
    return { sql: "s.grade_level = ?", params: [i.target_grade], label: `åk ${i.target_grade}`, grade: i.target_grade };
  }
  return { sql: "1 = 1", params: [], label: "hela skolan", grade: null };
}

function gradeOf(i: Intervention): number | null {
  if (i.target_grade != null) return i.target_grade;
  if (i.target_class_id) {
    const m = i.target_class_id.match(/^(\d+)/);
    if (m) return Number(m[1]);
  }
  return null;
}

function shareRow(sql: string, params: unknown[]): { share: number; n: number } {
  const r = one<{ share: number | null; n: number }>(sql, ...params);
  return { share: r?.share ?? 0, n: r?.n ?? 0 };
}

/** Beräknar uppmätt effekt för en insats, eller null om inget lämpligt mått finns. */
export function getInterventionEffect(i: Intervention): InterventionEffect | null {
  const pop = population(i);
  const subject = i.subject ?? null;
  const area = subject ? AREA_FROM_SUBJECT[subject] : undefined;
  const grade = pop.grade;

  // 1) Läsa/skriva/räkna (åk 1–4): andel i linje eller över i området.
  if (area && (grade == null || grade <= 4)) {
    const q = (term: string) => shareRow(
      `select avg(case when la.level in ('i_linje','over') then 1.0 else 0 end) share, count(*) n
       from literacy_numeracy_assessments la join students s on s.student_id = la.student_id
       where la.area = ? and la.term = ? and ${pop.sql}`,
      [area, term, ...pop.params],
    );
    const b = q(HT), a = q(VT);
    return effect(`Andel i linje eller över i ${AREA_LABEL[area]}`, pop.label, "HT 2025", "VT 2026", b, a);
  }

  // 2) Skriftliga omdömen (åk 2–6): andel godtagbara omdömen i ämnet.
  if (subject && grade != null && grade >= 2 && grade <= 6) {
    const q = (term: string) => shareRow(
      `select avg(case when wa.level in ('i_linje','over') then 1.0 else 0 end) share, count(*) n
       from written_assessments wa join students s on s.student_id = wa.student_id
       where wa.subject = ? and wa.term = ? and ${pop.sql}`,
      [subject, term, ...pop.params],
    );
    const b = q(HT), a = q(VT);
    if (a.n > 0) return effect(`Andel godtagbara omdömen i ${subject}`, pop.label, "HT 2025", "VT 2026", b, a);
  }

  // 3) Betyg (åk 7–10): andel godkända betyg (≥ E) i ämnet.
  if (subject && grade != null && grade >= 7 && grade <= 10) {
    const q = (term: string) => shareRow(
      `select avg(case when sg.grade not in ('F','-') then 1.0 else 0 end) share, count(*) n
       from subject_grades sg join students s on s.student_id = sg.student_id
       where sg.subject = ? and sg.term = ? and ${pop.sql}`,
      [subject, term, ...pop.params],
    );
    const b = q(HT), a = q(VT);
    if (a.n > 0) return effect(`Andel godkända betyg i ${subject}`, pop.label, "HT 2025", "VT 2026", b, a);
  }

  // 4) Närvaroinsats (inget ämne): närvarograd före vs efter insatsstart.
  const start = i.start_date && i.start_date > VT_START ? i.start_date : null;
  const attn = (cmp: "<" | ">=", date: string) => shareRow(
    `select avg(case when a.status in ('present','late') then 1.0 else 0 end) share, count(*) n
     from attendance_records a join students s on s.student_id = a.student_id
     where a.date ${cmp} ? and a.date <= '${DEMO_TODAY}' and ${pop.sql}`,
    [date, ...pop.params],
  );
  if (start) {
    const b = attn("<", start), a = attn(">=", start);
    if (b.n > 0 && a.n > 0) return effect("Närvarograd", pop.label, "Före insatsstart", "Efter insatsstart", b, a);
  }
  // Fallback utan startdatum: HT vs VT-period.
  const b = attn("<", VT_START), a = attn(">=", VT_START);
  if (b.n > 0 && a.n > 0) return effect("Närvarograd", pop.label, "HT-period", "VT-period", b, a);

  return null;
}

function effect(
  metric: string, populationLabel: string, beforeLabel: string, afterLabel: string,
  before: { share: number; n: number }, after: { share: number; n: number },
): InterventionEffect {
  const delta = after.share - before.share;
  const note =
    delta >= 0.05 ? "Tydlig förbättring sedan mätningen före insatsen."
    : delta > 0.0 ? "Svag positiv utveckling – följ vidare."
    : delta === 0 ? "Oförändrat läge sedan föregående mätning."
    : "Ingen förbättring ännu – ompröva eller intensifiera insatsen.";
  return { metric, populationLabel, beforeLabel, afterLabel, before: before.share, after: after.share, delta, n: after.n, note };
}

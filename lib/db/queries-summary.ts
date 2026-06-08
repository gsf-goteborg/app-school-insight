import "server-only";
import { one } from "./index";

/**
 * Aggregat för startsidans "Skolans nuläge" – en sammanställning över fyra
 * områden (skriftliga omdömen, betyg, stöd och närvaro). All demodata är fiktiv.
 */

// ---------------------------------------------------------------------------
// Skriftliga omdömen (åk 2–6)
// ---------------------------------------------------------------------------
export interface WrittenSummary {
  /** Elever i åk 2–6. */
  total_students: number;
  /** Elever med minst ett skriftligt omdöme innevarande termin. */
  with_any: number;
  /** Elever med godtagbara omdömen (i_linje eller over) i samtliga sina ämnen. */
  all_godtagbara: number;
}
export function getWrittenOmdomeSummary(term: string): WrittenSummary {
  const total =
    one<{ n: number }>(`select count(*) n from students where grade_level between 2 and 6`)?.n ?? 0;
  const withAny =
    one<{ n: number }>(
      `select count(distinct wa.student_id) n
       from written_assessments wa join students s on s.student_id = wa.student_id
       where s.grade_level between 2 and 6 and wa.term = ?`,
      term,
    )?.n ?? 0;
  const allGodtagbara =
    one<{ n: number }>(
      `select count(*) n from (
         select wa.student_id
         from written_assessments wa join students s on s.student_id = wa.student_id
         where s.grade_level between 2 and 6 and wa.term = ?
         group by wa.student_id
         having sum(case when wa.level in ('uppmarksam','stort_behov') then 1 else 0 end) = 0
       )`,
      term,
    )?.n ?? 0;
  return { total_students: total, with_any: withAny, all_godtagbara: allGodtagbara };
}

// ---------------------------------------------------------------------------
// Betyg / behörighetsrisk (åk 7–10)
// ---------------------------------------------------------------------------
export interface BehorighetSummary {
  /** Elever i åk 7–10. */
  total_students: number;
  /** Elever med F eller streck i något kärnämne (Sv/En/Ma) innevarande termin. */
  at_risk: number;
}
export function getBehorighetRisk(term: string): BehorighetSummary {
  const total =
    one<{ n: number }>(`select count(*) n from students where grade_level between 7 and 10`)?.n ?? 0;
  const atRisk =
    one<{ n: number }>(
      `select count(distinct sg.student_id) n
       from subject_grades sg join students s on s.student_id = sg.student_id
       where s.grade_level between 7 and 10 and sg.term = ?
         and sg.subject in ('Svenska','Engelska','Matematik')
         and sg.grade in ('F','-')`,
      term,
    )?.n ?? 0;
  return { total_students: total, at_risk: atRisk };
}

// ---------------------------------------------------------------------------
// Stödinsatser (hela skolan)
// ---------------------------------------------------------------------------
export interface SupportSummary {
  total_students: number;
  extra_anpassning: number;
  atgardsprogram: number;
  utredning: number;
}
export function getSupportSummary(): SupportSummary {
  return (
    one<SupportSummary>(
      `select count(*) total_students,
         sum(extra_anpassning) extra_anpassning,
         sum(atgardsprogram) atgardsprogram,
         sum(utredning_pagaende) utredning
       from students`,
    ) ?? { total_students: 0, extra_anpassning: 0, atgardsprogram: 0, utredning: 0 }
  );
}

// ---------------------------------------------------------------------------
// Utredningsskuld (hela skolan)
// Elever som UNDER BÅDA TERMINERNA (HT + VT) saknar godtagbart omdöme (åk 2–6)
// eller godkänt betyg A–E (åk 7–10) i minst ett ämne – dvs. en ihållande svårighet,
// inte en enstaka termins dipp. Dessa korsas mot stödprocessen:
//   JA        = aktivt åtgärdsprogram (atgardsprogram = 1)
//   UTREDNING = pågående utredning men inget åtgärdsprogram
//   NEJ       = varken åtgärdsprogram eller utredning  → utredningsskulden
// "Skulden" är NEJ-gruppen: elever med ihållande svårigheter som ännu inte fångats
// av en formell stödprocess. Speglar skolans rapport "Utredning". Demodata.
// ---------------------------------------------------------------------------
export interface UtredningsskuldSummary {
  /** Elever som saknar godtagbart omdöme/godkänt betyg i ≥1 ämne under båda terminerna. */
  lacking_total: number;
  /** ...varav med aktivt åtgärdsprogram (JA). */
  with_atgardsprogram: number;
  /** ...varav under utredning men utan åtgärdsprogram (UTREDNING). */
  under_utredning: number;
  /** ...varav varken åtgärdsprogram eller utredning (NEJ) – utredningsskulden. */
  no_action: number;
}
export function getUtredningsskuld(): UtredningsskuldSummary {
  return (
    one<UtredningsskuldSummary>(
      `with failing_omdome as (
         select wa.student_id
         from written_assessments wa join students s on s.student_id = wa.student_id
         where s.grade_level between 2 and 6 and wa.level in ('uppmarksam','stort_behov')
         group by wa.student_id, wa.subject having count(distinct wa.term) = 2
       ),
       failing_betyg as (
         select sg.student_id
         from subject_grades sg join students s on s.student_id = sg.student_id
         where s.grade_level between 7 and 10 and sg.grade in ('F','-')
         group by sg.student_id, sg.subject having count(distinct sg.term) = 2
       ),
       lacking as (
         select student_id from failing_omdome
         union
         select student_id from failing_betyg
       )
       select
         count(*) lacking_total,
         coalesce(sum(s.atgardsprogram), 0) with_atgardsprogram,
         coalesce(sum(case when s.atgardsprogram = 0 and s.utredning_pagaende = 1 then 1 else 0 end), 0) under_utredning,
         coalesce(sum(case when s.atgardsprogram = 0 and s.utredning_pagaende = 0 then 1 else 0 end), 0) no_action
       from lacking l join students s on s.student_id = l.student_id`,
    ) ?? { lacking_total: 0, with_atgardsprogram: 0, under_utredning: 0, no_action: 0 }
  );
}

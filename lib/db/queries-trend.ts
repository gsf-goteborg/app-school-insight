import "server-only";
import { one } from "./index";
import { DEMO_TODAY } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Utveckling under läsåret (HT2025 → VT2026). Skolan i demon har två terminer,
// så detta är en samlad terminsjämförelse av de viktigaste måtten. Alla mått är
// formulerade så att högre = bättre, så att en positiv förändring entydigt är
// en förbättring. Demodata.
// ---------------------------------------------------------------------------

const HT = "HT2025";
const VT = "VT2026";
const VT_START = "2026-01-07";

export interface TermMetric {
  key: string;
  label: string;
  ht: number;
  vt: number;
  format: "pct" | "num"; // pct: 0..1 andel; num: värde (t.ex. meritvärde, 1–4)
  hint?: string;
}

const val = (sql: string, ...p: unknown[]): number =>
  one<{ v: number | null }>(sql, ...p)?.v ?? 0;

function shareGodtagbart(table: "literacy_numeracy_assessments" | "written_assessments", term: string, gMin: number, gMax: number): number {
  return val(
    `select avg(case when x.level in ('over','i_linje') then 1.0 else 0 end) v
     from ${table} x join students s on s.student_id = x.student_id
     where x.term = ? and s.grade_level between ? and ?`,
    term, gMin, gMax,
  );
}

function avgMerit(term: string): number {
  return val(
    `with mp(g,p) as (values ('A',20.0),('B',17.5),('C',15.0),('D',12.5),('E',10.0),('F',0.0),('-',0.0))
     select avg(m) v from (
       select sg.student_id, sum(mp.p) m
       from subject_grades sg
       join students s on s.student_id = sg.student_id
       join mp on mp.g = sg.grade
       where sg.term = ? and s.grade_level between 7 and 10
       group by sg.student_id
     )`,
    term,
  );
}

function avgTrygghet(term: string): number {
  return val(`select avg(trygghet) v from wellbeing_surveys where term = ?`, term);
}

function attendanceRate(cmp: "<" | ">=", date: string): number {
  return val(
    `select avg(case when status in ('present','late') then 1.0 else 0 end) v
     from attendance_records where date ${cmp} ? and date <= '${DEMO_TODAY}'`,
    date,
  );
}

export function getSchoolTermTrends(): TermMetric[] {
  return [
    {
      key: "lsr",
      label: "I linje eller över – läsa, skriva, räkna (åk 1–4)",
      ht: shareGodtagbart("literacy_numeracy_assessments", HT, 1, 4),
      vt: shareGodtagbart("literacy_numeracy_assessments", VT, 1, 4),
      format: "pct",
    },
    {
      key: "written",
      label: "Godtagbara omdömen (åk 2–6)",
      ht: shareGodtagbart("written_assessments", HT, 2, 6),
      vt: shareGodtagbart("written_assessments", VT, 2, 6),
      format: "pct",
    },
    {
      key: "merit",
      label: "Snittmeritvärde (åk 7–10)",
      ht: avgMerit(HT),
      vt: avgMerit(VT),
      format: "num",
    },
    {
      key: "trygghet",
      label: "Snitt trygghet (hela skolan)",
      ht: avgTrygghet(HT),
      vt: avgTrygghet(VT),
      format: "num",
      hint: "av 4",
    },
    {
      key: "attendance",
      label: "Närvarograd (hela skolan)",
      ht: attendanceRate("<", VT_START),
      vt: attendanceRate(">=", VT_START),
      format: "pct",
    },
  ];
}

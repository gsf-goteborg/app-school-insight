import "server-only";
import { all } from "./index";
import {
  TERM_SEQUENCE,
  termShort,
  gradeAtTerm,
  MERIT_POINTS,
  LEVELS,
  type GradeMark,
  type Level,
} from "@/lib/constants";

// ---------------------------------------------------------------------------
// Utveckling över tid (longitudinell historik, upp till fyra läsår)
//
// Bedömningshistoriken (betyg åk 7–10, omdömen åk 2–6, LSR åk 1–4) följer varje
// elev över terminerna – som i skolans egen progressionsrapport. Trenden per
// ämne beräknas över HELA serien (inte bara HT→VT): snittet av de två första
// tillgängliga terminerna jämförs med snittet av de två senaste. Minst tre
// terminer krävs, annars "data saknas". Demodata.
// ---------------------------------------------------------------------------

export type LongTrend = "positiv" | "negativ" | "neutral" | "saknas";

export const LONG_TREND_LABEL: Record<LongTrend, string> = {
  positiv: "Positiv",
  negativ: "Negativ",
  neutral: "Stabil",
  saknas: "Data saknas",
};

/** Minsta antal terminer med data för att en trend ska beräknas. */
export const TREND_MIN_TERMS = 3;
/** Tröskel i betygspoäng (1 steg = 2,5 p) för positiv/negativ betygstrend. */
export const TREND_GRADE_THRESHOLD = 2.5;
/** Tröskel i nivåsteg (skala 0–3) för positiv/negativ nivåtrend. */
export const TREND_LEVEL_THRESHOLD = 0.75;

const LEVEL_ORDER: Record<Level, number> = { over: 3, i_linje: 2, uppmarksam: 1, stort_behov: 0 };
const LEVEL_SHORT: Record<Level, string> = Object.fromEntries(
  LEVELS.map((l) => [l.key, l.short]),
) as Record<Level, string>;

/** Trend över en numerisk serie: snitt av första två vs sista två värdena. */
function seriesTrend(values: (number | null)[], threshold: number): { trend: LongTrend; diff: number } {
  const present = values.filter((v): v is number => v != null);
  if (present.length < TREND_MIN_TERMS) return { trend: "saknas", diff: 0 };
  const head = present.slice(0, 2);
  const tail = present.slice(-2);
  const avg = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
  const diff = avg(tail) - avg(head);
  if (diff >= threshold) return { trend: "positiv", diff };
  if (diff <= -threshold) return { trend: "negativ", diff };
  return { trend: "neutral", diff };
}

// ---------------------------------------------------------------------------
// Per elev: ämne × termin-rutnät med trend (elevvyn)
// ---------------------------------------------------------------------------

export interface TrajectoryCell {
  term: string;
  /** Betyg (A–F/-) eller null. */
  mark: GradeMark | null;
  /** Nivå (LSR/omdöme) eller null. */
  level: Level | null;
  /** Visningstext, t.ex. "B" eller "I linje". */
  text: string;
}

export interface TrajectoryRow {
  subject: string;
  cells: (TrajectoryCell | null)[]; // en per termin i `terms`, null = ingen data
  trend: LongTrend;
}

export interface StudentTrajectory {
  /** Terminer (kronologiskt) där eleven har någon bedömning. */
  terms: { key: string; label: string; grade: number | null }[];
  /** Betygsrader (åk 7–10). */
  gradeRows: TrajectoryRow[];
  /** Nivårader (LSR-områden + omdömesämnen, åk 1–6). */
  levelRows: TrajectoryRow[];
  /** Meritvärde per termin (endast terminer med betyg). */
  meritByTerm: (number | null)[];
}

const AREA_LABEL: Record<string, string> = {
  reading: "Läsning",
  writing: "Skrivning",
  numeracy: "Räkning",
};

export function getStudentTrajectory(studentId: string, currentGrade: number): StudentTrajectory {
  const gradeRows = all<{ term: string; subject: string; grade: GradeMark }>(
    `select term, subject, grade from subject_grades where student_id = ?`,
    studentId,
  );
  const levelRows = all<{ term: string; label: string; level: Level }>(
    `select term, area as label, level from literacy_numeracy_assessments where student_id = ?
     union all
     select term, subject as label, level from written_assessments where student_id = ?`,
    studentId, studentId,
  );

  const termsWithData = new Set<string>([...gradeRows, ...levelRows].map((r) => r.term));
  const terms = TERM_SEQUENCE.filter((t) => termsWithData.has(t)).map((key) => ({
    key,
    label: termShort(key),
    grade: gradeAtTerm(currentGrade, key),
  }));
  // Betygsrader
  const bySubject = new Map<string, Map<string, GradeMark>>();
  for (const r of gradeRows) {
    const m = bySubject.get(r.subject) ?? new Map();
    m.set(r.term, r.grade);
    bySubject.set(r.subject, m);
  }
  const gRows: TrajectoryRow[] = [...bySubject.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "sv-SE"))
    .map(([subject, byTerm]) => {
      const cells = terms.map((t) => {
        const mark = byTerm.get(t.key) ?? null;
        return mark ? { term: t.key, mark, level: null, text: mark === "-" ? "–" : mark } : null;
      });
      const values = cells.map((c) => (c?.mark != null ? (MERIT_POINTS[c.mark] ?? 0) : null));
      return { subject, cells, trend: seriesTrend(values, TREND_GRADE_THRESHOLD).trend };
    });

  // Nivårader (LSR-områden får svenska etiketter; omdömesämnen heter redan rätt)
  const byLabel = new Map<string, Map<string, Level>>();
  for (const r of levelRows) {
    const label = AREA_LABEL[r.label] ?? r.label;
    const m = byLabel.get(label) ?? new Map();
    m.set(r.term, r.level);
    byLabel.set(label, m);
  }
  const lRows: TrajectoryRow[] = [...byLabel.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "sv-SE"))
    .map(([subject, byTerm]) => {
      const cells = terms.map((t) => {
        const level = byTerm.get(t.key) ?? null;
        return level ? { term: t.key, mark: null, level, text: LEVEL_SHORT[level] } : null;
      });
      const values = cells.map((c) => (c?.level != null ? LEVEL_ORDER[c.level] : null));
      return { subject, cells, trend: seriesTrend(values, TREND_LEVEL_THRESHOLD).trend };
    });

  // Meritvärde per termin
  const meritByTerm = terms.map((t) => {
    const marks = gradeRows.filter((r) => r.term === t.key);
    if (marks.length === 0) return null;
    return marks.reduce((s, r) => s + (MERIT_POINTS[r.grade] ?? 0), 0);
  });

  return { terms, gradeRows: gRows, levelRows: lRows, meritByTerm };
}

// ---------------------------------------------------------------------------
// Per elev: samlad flerterminstrend (för klasslista, ledning och prioritering)
// ---------------------------------------------------------------------------

export interface StudentLongTrend {
  student_id: string;
  name: string;
  class_id: string;
  grade_level: number;
  trend: LongTrend;
  /** T.ex. "Snittresultatet faller ≈ 0,4 steg per läsår över 6 terminer". */
  detail: string;
  /** Regressionslutning per termin (normaliserad skala 0–1), null om för kort historik. */
  slope: number | null;
}

/** Minsta antal terminer för en flerterminstrend på elevnivå. */
export const LONG_TREND_MIN_TERMS = 4;
/**
 * Lutningströskel per termin i normaliserade enheter (1 betygssteg = 0,125):
 * ±0,012 ≈ ±0,2 betygssteg per läsår, uthålligt över hela serien.
 */
export const LONG_TREND_SLOPE = 0.012;

/** Minsta-kvadrat-lutning per termin för en serie (index = terminsposition). */
function regressionSlope(points: { x: number; y: number }[]): number {
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let num = 0, den = 0;
  for (const p of points) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) * (p.x - mx);
  }
  return den ? num / den : 0;
}

/**
 * Klassificerar varje aktiv elevs utveckling över alla terminer med data.
 * Elevens snittresultat per termin (alla ämnen, normaliserat) följs med en
 * minsta-kvadrat-lutning – betyg och nivåskalor hålls åtskilda så att bytet av
 * skala vid åk 7 inte skapar falska trender. Negativ/positiv kräver en uthållig
 * lutning över minst fyra terminer; "saknas" om historiken är för kort.
 */
export function getLongTermTrends(): StudentLongTrend[] {
  const students = all<{ student_id: string; name: string; class_id: string; grade_level: number }>(
    `select student_id, (first_name || ' ' || last_name) name, class_id, grade_level
     from students where active = 1`,
  );

  const gradeRows = all<{ student_id: string; term: string; subject: string; grade: GradeMark }>(
    `select sg.student_id, sg.term, sg.subject, sg.grade
     from subject_grades sg join students s on s.student_id = sg.student_id where s.active = 1`,
  );
  const levelRows = all<{ student_id: string; term: string; label: string; level: Level }>(
    `select la.student_id, la.term, la.area as label, la.level
       from literacy_numeracy_assessments la join students s on s.student_id = la.student_id where s.active = 1
     union all
     select wa.student_id, wa.term, wa.subject as label, wa.level
       from written_assessments wa join students s on s.student_id = wa.student_id where s.active = 1`,
  );

  // student -> skala -> term -> { sum, n } (snitt per termin inom samma skala)
  type TermAgg = Map<string, { sum: number; n: number }>;
  const byStudent = new Map<string, { grades: TermAgg; levels: TermAgg }>();
  const put = (agg: TermAgg, term: string, value: number) => {
    const cur = agg.get(term) ?? { sum: 0, n: 0 };
    cur.sum += value;
    cur.n += 1;
    agg.set(term, cur);
  };
  const entry = (sid: string) => {
    let e = byStudent.get(sid);
    if (!e) {
      e = { grades: new Map(), levels: new Map() };
      byStudent.set(sid, e);
    }
    return e;
  };
  for (const r of gradeRows) put(entry(r.student_id).grades, r.term, (MERIT_POINTS[r.grade] ?? 0) / 20);
  for (const r of levelRows) put(entry(r.student_id).levels, r.term, LEVEL_ORDER[r.level] / 3);

  const seriesFor = (agg: TermAgg) =>
    TERM_SEQUENCE
      .map((t, x) => ({ x, agg: agg.get(t) }))
      .filter((p) => p.agg != null)
      .map((p) => ({ x: p.x, y: p.agg!.sum / p.agg!.n }));

  const out: StudentLongTrend[] = [];
  for (const s of students) {
    const e = byStudent.get(s.student_id);
    // Föredra betygsserien (mest aktuell); annars nivåserien. Skalorna blandas
    // aldrig – skalbytet vid åk 7 skulle annars se ut som en trend.
    const gradeSeries = e ? seriesFor(e.grades) : [];
    const levelSeries = e ? seriesFor(e.levels) : [];
    const series =
      gradeSeries.length >= LONG_TREND_MIN_TERMS ? gradeSeries :
      levelSeries.length >= LONG_TREND_MIN_TERMS ? levelSeries : null;
    if (!series) {
      out.push({ ...s, trend: "saknas", detail: "", slope: null });
      continue;
    }
    const slope = regressionSlope(series);
    // Dubbelt kriterium mot brus: lutningen ska vara uthållig OCH start- och
    // slutläget skilja sig tydligt (≈ ett halvt betygssteg, 0,0625 normaliserat).
    const avg = (a: { y: number }[]) => a.reduce((s, p) => s + p.y, 0) / a.length;
    const endDiff = avg(series.slice(-2)) - avg(series.slice(0, 2));
    const CONFIRM = 0.0625;
    const trend: LongTrend =
      slope <= -LONG_TREND_SLOPE && endDiff <= -CONFIRM ? "negativ"
      : slope >= LONG_TREND_SLOPE && endDiff >= CONFIRM ? "positiv"
      : "neutral";
    // Lutning uttryckt i betygssteg per läsår (1 steg = 0,125 normaliserat, 2 terminer/läsår).
    const stepsPerYear = (slope * 2) / 0.125;
    const detail =
      trend === "neutral"
        ? `Stabilt snittresultat över ${series.length} terminer`
        : `Snittresultatet ${trend === "negativ" ? "faller" : "stiger"} ≈ ${Math.abs(stepsPerYear).toFixed(1).replace(".", ",")} steg per läsår över ${series.length} terminer`;
    out.push({ ...s, trend, detail, slope });
  }
  return out;
}

export interface LongTrendSummary {
  judged: number;
  positiv: number;
  negativ: number;
  neutral: number;
}

export function getLongTrendSummary(list?: StudentLongTrend[]): LongTrendSummary {
  const rows = list ?? getLongTermTrends();
  const judged = rows.filter((r) => r.trend !== "saknas");
  return {
    judged: judged.length,
    positiv: judged.filter((r) => r.trend === "positiv").length,
    negativ: judged.filter((r) => r.trend === "negativ").length,
    neutral: judged.filter((r) => r.trend === "neutral").length,
  };
}

// ---------------------------------------------------------------------------
// Skolnivå: tidsserier per termin (ledningsvyn)
// ---------------------------------------------------------------------------

export interface SchoolTermPoint {
  term: string;
  label: string;
  avgMerit: number | null;        // åk 7–10 (elever med betyg den terminen)
  shareWrittenOk: number | null;  // andel godtagbara omdömen (åk 2–6 då)
  shareLsrOk: number | null;      // andel i linje/över i LSR (åk 1–4 då)
  absenceRate: number | null;     // frånvaroandel (hela skolan)
}

export function getSchoolTermSeries(): SchoolTermPoint[] {
  const merit = new Map(
    all<{ term: string; v: number }>(
      `with mp(g,p) as (values ('A',20.0),('B',17.5),('C',15.0),('D',12.5),('E',10.0),('F',0.0),('-',0.0))
       select term, avg(m) v from (
         select sg.term term, sg.student_id, sum(mp.p) m
         from subject_grades sg join mp on mp.g = sg.grade
         group by sg.term, sg.student_id
       ) group by term`,
    ).map((r) => [r.term, r.v]),
  );
  const written = new Map(
    all<{ term: string; v: number }>(
      `select term, avg(case when level in ('over','i_linje') then 1.0 else 0 end) v
       from written_assessments group by term`,
    ).map((r) => [r.term, r.v]),
  );
  const lsr = new Map(
    all<{ term: string; v: number }>(
      `select term, avg(case when level in ('over','i_linje') then 1.0 else 0 end) v
       from literacy_numeracy_assessments group by term`,
    ).map((r) => [r.term, r.v]),
  );

  const absence = new Map(
    all<{ term: string; v: number }>(
      `select term, cast(sum(days_absent) as real) / nullif(sum(days_total), 0) v
       from (${TERM_ABSENCE_SQL}) group by term`,
    ).map((r) => [r.term, r.v]),
  );

  return TERM_SEQUENCE.map((term) => ({
    term,
    label: termShort(term),
    avgMerit: merit.get(term) ?? null,
    shareWrittenOk: written.get(term) ?? null,
    shareLsrOk: lsr.get(term) ?? null,
    absenceRate: absence.get(term) ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Resultatmatris: nivå × trend
//
// Kategoriserar varje elev längs två axlar – NUVARANDE NIVÅ (snittresultat
// vårterminen 2026) och FLERTERMINSTREND (regressionslutningen ovan). Idén är
// inspirerad av en PCA på den här typen av mått: första komponenten laddar på
// nivå och andra på trend/stabilitet. Här används de två axlarna direkt i
// stället för komponenterna, så att varje elevs placering är förklarbar
// (Trust-principen) – samma kvadranter, inga dolda vikter. Demodata.
// ---------------------------------------------------------------------------

export type MatrixCategory = "lag_upp" | "lag_still" | "hog_haller" | "hog_tappar" | "mitten" | "okand";

export const MATRIX_CATEGORIES: {
  key: MatrixCategory;
  label: string;
  tone: "positiv" | "kritisk" | "uppmarksam" | "info" | "neutral";
  desc: string;
}[] = [
  { key: "lag_upp", label: "Låga resultat – på väg uppåt", tone: "info",
    desc: "Under godtagbar nivå men med stigande flerterminstrend. Pågående stöd kan vara på väg att verka – håll i." },
  { key: "lag_still", label: "Låga resultat – står stilla eller faller", tone: "kritisk",
    desc: "Under godtagbar nivå utan förbättring över tid. Skolans tydligaste prioriteringsgrupp." },
  { key: "hog_tappar", label: "Höga resultat – börjar tappa", tone: "uppmarksam",
    desc: "Hög nivå men fallande flerterminstrend. Lätt att missa eftersom resultaten ännu ser goda ut." },
  { key: "hog_haller", label: "Höga resultat – håller i", tone: "positiv",
    desc: "Hög nivå som står sig eller stiger. Kandidater för mer utmaning." },
  { key: "mitten", label: "Mittenfältet", tone: "neutral",
    desc: "Varken tydligt hög eller låg nivå. Följs via ordinarie uppföljning." },
  { key: "okand", label: "För kort historik", tone: "neutral",
    desc: "Färre än fyra terminer med data (främst åk 1) – ingen trend kan beräknas." },
];

// Nivågränser per skala (normaliserat 0–1). Betyg: hög = snitt C eller bättre,
// låg = under snitt D. Nivåer: hög = tydligt inslag av "över förväntan",
// låg = klart under "i linje".
export const NIVA_BOUNDS = {
  betyg: { hog: 0.75, lag: 0.625 },
  niva: { hog: 0.78, lag: 0.6 },
} as const;

export interface MatrixStudent {
  student_id: string;
  name: string;
  class_id: string;
  grade_level: number;
  /** Vilken skala nivån bygger på. */
  scale: "betyg" | "niva";
  /** Snittresultat VT 2026, normaliserat 0–1. */
  niva: number;
  /** Trendlutning i betygssteg per läsår (null om för kort historik). */
  stepsPerYear: number | null;
  category: MatrixCategory;
}

export function getResultMatrix(): MatrixStudent[] {
  const trends = new Map(getLongTermTrends().map((t) => [t.student_id, t]));

  // Nuvarande nivå (VT 2026): betyg åk 7–10, annars nivåer (LSR + omdömen) åk 1–6.
  const betyg = all<{ student_id: string; v: number }>(
    `with mp(g,p) as (values ('A',20.0),('B',17.5),('C',15.0),('D',12.5),('E',10.0),('F',0.0),('-',0.0))
     select sg.student_id, avg(mp.p) / 20.0 v
     from subject_grades sg join mp on mp.g = sg.grade
     where sg.term = 'VT2026'
     group by sg.student_id`,
  );
  const niva = all<{ student_id: string; v: number }>(
    `select student_id, avg(v) / 3.0 v from (
       select student_id,
         case level when 'over' then 3.0 when 'i_linje' then 2.0 when 'uppmarksam' then 1.0 else 0.0 end v
       from literacy_numeracy_assessments where term = 'VT2026'
       union all
       select student_id,
         case level when 'over' then 3.0 when 'i_linje' then 2.0 when 'uppmarksam' then 1.0 else 0.0 end v
       from written_assessments where term = 'VT2026'
     ) group by student_id`,
  );
  const betygMap = new Map(betyg.map((r) => [r.student_id, r.v]));
  const nivaMap = new Map(niva.map((r) => [r.student_id, r.v]));

  const students = all<{ student_id: string; name: string; class_id: string; grade_level: number }>(
    `select student_id, (first_name || ' ' || last_name) name, class_id, grade_level
     from students where active = 1`,
  );

  const out: MatrixStudent[] = [];
  for (const s of students) {
    const scale: "betyg" | "niva" = betygMap.has(s.student_id) ? "betyg" : "niva";
    const value = scale === "betyg" ? betygMap.get(s.student_id) : nivaMap.get(s.student_id);
    if (value == null) continue;
    const t = trends.get(s.student_id);
    const slope = t?.slope ?? null;
    const stepsPerYear = slope != null ? (slope * 2) / 0.125 : null;

    const b = NIVA_BOUNDS[scale];
    const band: "hog" | "lag" | "mitten" = value >= b.hog ? "hog" : value < b.lag ? "lag" : "mitten";
    // Trendriktningen återanvänder flerterminsklassningen ovan (lutning +
    // bekräftande start/slut-skillnad) så att matrisen och trendlinsen aldrig
    // säger emot varandra.
    const dir = t?.trend ?? "saknas";

    let category: MatrixCategory;
    if (dir === "saknas") category = "okand";
    else if (band === "lag") category = dir === "positiv" ? "lag_upp" : "lag_still";
    else if (band === "hog") category = dir === "negativ" ? "hog_tappar" : "hog_haller";
    else category = "mitten";

    out.push({ ...s, scale, niva: value, stepsPerYear, category });
  }
  return out;
}
// beräknat från de dagliga närvaroraderna). Speglar skolans Qlik-rapporter
// "Frånvaro – Progression – Månad/Termin".
// ---------------------------------------------------------------------------

/** Frånvaro per elev och termin: historiktabellen + innevarande läsår per termin. */
const TERM_ABSENCE_SQL = `
  select student_id, term, days_total, days_absent from attendance_term_history
  union all
  select student_id,
    case when date < '2026-01-07' then 'HT2025' else 'VT2026' end term,
    count(*) days_total,
    sum(case when status in ('valid_absence','invalid_absence') then 1 else 0 end) days_absent
  from attendance_records
  group by student_id, case when date < '2026-01-07' then 'HT2025' else 'VT2026' end`;

export interface AbsenceCell {
  key: string;
  label: string;
  rate: number | null;
}

export interface StudentAbsenceRow {
  student_id: string;
  name: string;
  cells: AbsenceCell[];
}

/** Frånvaro per elev och termin (fyra läsår) för en klass. */
export function getClassTermAbsence(classId: string): { columns: AbsenceCell[]; rows: StudentAbsenceRow[] } {
  const raw = all<{ student_id: string; name: string; term: string; rate: number }>(
    `select t.student_id, (s.first_name || ' ' || s.last_name) name, t.term,
       cast(t.days_absent as real) / nullif(t.days_total, 0) rate
     from (${TERM_ABSENCE_SQL}) t
     join students s on s.student_id = t.student_id
     where s.class_id = ? and s.active = 1`,
    classId,
  );
  const byStudent = new Map<string, { name: string; byTerm: Map<string, number> }>();
  for (const r of raw) {
    const e = byStudent.get(r.student_id) ?? { name: r.name, byTerm: new Map() };
    e.byTerm.set(r.term, r.rate);
    byStudent.set(r.student_id, e);
  }
  const usedTerms = new Set(raw.map((r) => r.term));
  const columns: AbsenceCell[] = TERM_SEQUENCE.filter((t) => usedTerms.has(t)).map((t) => ({
    key: t,
    label: termShort(t),
    rate: null,
  }));
  const rows = [...byStudent.entries()]
    .map(([student_id, e]) => ({
      student_id,
      name: e.name,
      cells: columns.map((c) => ({ key: c.key, label: c.label, rate: e.byTerm.get(c.key) ?? null })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "sv-SE"));
  return { columns, rows };
}

const MONTH_LABEL = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

/** Frånvaro per elev och kalendermånad, innevarande läsår, för en klass. */
export function getClassMonthlyAbsence(classId: string): { columns: AbsenceCell[]; rows: StudentAbsenceRow[] } {
  const raw = all<{ student_id: string; name: string; month: string; rate: number }>(
    `select a.student_id, (s.first_name || ' ' || s.last_name) name,
       substr(a.date, 1, 7) month,
       cast(sum(case when a.status in ('valid_absence','invalid_absence') then 1 else 0 end) as real)
         / nullif(count(*), 0) rate
     from attendance_records a
     join students s on s.student_id = a.student_id
     where s.class_id = ? and s.active = 1
     group by a.student_id, substr(a.date, 1, 7)`,
    classId,
  );
  const months = [...new Set(raw.map((r) => r.month))].sort();
  const columns: AbsenceCell[] = months.map((m) => ({
    key: m,
    label: MONTH_LABEL[Number(m.slice(5, 7)) - 1],
    rate: null,
  }));
  const byStudent = new Map<string, { name: string; byMonth: Map<string, number> }>();
  for (const r of raw) {
    const e = byStudent.get(r.student_id) ?? { name: r.name, byMonth: new Map() };
    e.byMonth.set(r.month, r.rate);
    byStudent.set(r.student_id, e);
  }
  const rows = [...byStudent.entries()]
    .map(([student_id, e]) => ({
      student_id,
      name: e.name,
      cells: columns.map((c) => ({ key: c.key, label: c.label, rate: e.byMonth.get(c.key) ?? null })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "sv-SE"));
  return { columns, rows };
}

/** Frånvaro per termin (fyra läsår) för en enskild elev. */
export function getStudentTermAbsence(studentId: string): AbsenceCell[] {
  const raw = all<{ term: string; rate: number }>(
    `select term, cast(days_absent as real) / nullif(days_total, 0) rate
     from (${TERM_ABSENCE_SQL}) where student_id = ?`,
    studentId,
  );
  const byTerm = new Map(raw.map((r) => [r.term, r.rate]));
  return TERM_SEQUENCE.filter((t) => byTerm.has(t)).map((t) => ({
    key: t,
    label: termShort(t),
    rate: byTerm.get(t) ?? null,
  }));
}

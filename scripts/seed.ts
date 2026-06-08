/*
 * Deterministisk seed-generator för Skolinsikt.
 * Skapar en fiktiv grundskola (åk 1–10, 20 klasser, 400 elever) och skriver
 * supabase/seed.sql. Fast RNG-frö ger identisk data varje körning, så de fem
 * demoscenarierna (§16) alltid syns. Kör: npm run seed
 */
import { writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import {
  GRADES,
  CLASS_SUFFIXES,
  STUDENTS_PER_CLASS,
  TERMS,
  GRADED_SUBJECTS,
  WRITTEN_SUBJECTS,
  NATIONAL_TEST_SUBJECTS,
  stadiumForGrade,
  type Level,
  type GradeMark,
} from "../lib/constants";

// ----------------------------- RNG (mulberry32) -----------------------------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260515);
const rnd = () => rng();
const ri = (a: number, b: number) => Math.floor(rnd() * (b - a + 1)) + a;
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
function gauss(mean: number, sd: number) {
  // Box–Muller
  const u = 1 - rnd();
  const v = rnd();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Separat RNG-ström för demografiska fält (stödinsatser, socioekonomiskt index,
// HR). Hålls åtskild så att de kurerade resultatscenariona ovan ligger kvar
// oförändrade när dessa fält läggs till eller justeras.
const rng2 = mulberry32(76543210);
const rnd2 = () => rng2();
function gauss2(mean: number, sd: number) {
  const u = 1 - rnd2();
  const v = rnd2();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

// ----------------------------- Namn -----------------------------
// Anonymiserade namn: varje person får ett unikt löpnummer (name1, name2, …).
let nameSeq = 0;
const nextName = () => `name${++nameSeq}`;

// ----------------------------- SQL-hjälp -----------------------------
type Val = string | number | boolean | null;
const q = (v: Val): string => {
  if (v === null) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "true" : "false";
  return `'${v.replace(/'/g, "''")}'`;
};
function insertBatch(table: string, cols: string[], rows: Val[][]): string {
  if (rows.length === 0) return "";
  const out: string[] = [];
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const values = chunk.map((r) => `(${r.map(q).join(",")})`).join(",\n");
    out.push(`insert into ${table} (${cols.join(",")}) values\n${values};`);
  }
  return out.join("\n");
}

// ----------------------------- Datum/skoldagar -----------------------------
const DEMO_TODAY = new Date("2026-05-15");
const LOV: [string, string][] = [
  ["2025-10-27", "2025-10-31"], // höstlov
  ["2025-12-20", "2026-01-06"], // jullov
  ["2026-02-09", "2026-02-13"], // sportlov
  ["2026-03-30", "2026-04-06"], // påsklov
  ["2026-05-01", "2026-05-01"], // första maj
];
function isLov(d: Date): boolean {
  const iso = d.toISOString().slice(0, 10);
  return LOV.some(([a, b]) => iso >= a && iso <= b);
}
function schoolDays(from: string, to: Date): Date[] {
  const days: Date[] = [];
  const d = new Date(from);
  while (d <= to) {
    const dow = d.getUTCDay(); // 0 sön … 6 lör
    if (dow >= 1 && dow <= 5 && !isLov(d)) days.push(new Date(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}
const iso = (d: Date) => d.toISOString().slice(0, 10);
const HT_DAYS = schoolDays("2025-08-18", new Date("2025-12-19"));
const VT_DAYS = schoolDays("2026-01-07", DEMO_TODAY);
const ALL_DAYS = [...HT_DAYS, ...VT_DAYS];

// ----------------------------- Nivå- och betygshjälp -----------------------------
function levelFromScore(score: number): Level {
  if (score >= 80) return "over";
  if (score >= 60) return "i_linje";
  if (score >= 42) return "uppmarksam";
  return "stort_behov";
}
function markFromScore(s: number): GradeMark {
  if (s >= 0.88) return "A";
  if (s >= 0.75) return "B";
  if (s >= 0.6) return "C";
  if (s >= 0.45) return "D";
  if (s >= 0.3) return "E";
  if (s >= 0.14) return "F";
  return "-";
}

// ----------------------------- Datamodeller -----------------------------
interface Student {
  id: string; first: string; last: string; grade: number; classId: string;
  gender: "flicka" | "pojke"; ability: number; absenceBase: number;
}

const classRows: Val[][] = [];
const staffRows: Val[][] = [];
const assignRows: Val[][] = [];
const studentRows: Val[][] = [];
const attendanceRows: Val[][] = [];
const lnaRows: Val[][] = [];
const writtenRows: Val[][] = [];
const gradeRows: Val[][] = [];
const natRows: Val[][] = [];
const wellbeingRows: Val[][] = [];
const students: Student[] = [];

// Stadieindelning (Lågstadium 1–4, Mellanstadium 5–7, Högstadium 8–10).
const stadiumFor = stadiumForGrade;

// ----------------------------- Personal -----------------------------
let staffSeq = 0;
function newStaff(role: string, arbetslag: string | null, fte = 1.0): string {
  staffSeq++;
  const id = `T${String(staffSeq).padStart(3, "0")}`;
  // HR-nyckeltal (demodata): sjukfrånvaro, anställningsform och anställningstid.
  // ~15 % visstid; visstidsanställda har kortare anställningstid.
  const visstid = rnd2() < 0.15;
  const employment = visstid ? "visstid" : "tillsvidare";
  const years = visstid
    ? clamp(gauss2(1.5, 1.0), 0.2, 4)
    : clamp(gauss2(9, 6), 0.5, 35);
  // Sjukfrånvaro: de flesta lågt, men en svans med långtidssjukfrånvaro.
  let sick = clamp(gauss2(0.045, 0.025), 0.005, 0.5);
  if (rnd2() < 0.06) sick = clamp(gauss2(0.22, 0.07), 0.12, 0.6); // långtidssjukskriven
  staffRows.push([id, nextName(), "", role, arbetslag, fte, +sick.toFixed(4), employment, +years.toFixed(1)]);
  return id;
}
// Skolledning
newStaff("skolledare", null, 1.0);
newStaff("skolledare", null, 1.0);
// Speciallärare/specialpedagog per stadium
const specialIds: string[] = [];
for (const al of ["Lågstadium", "Mellanstadium", "Högstadium"]) {
  specialIds.push(newStaff("speciallarare", al, rnd() < 0.5 ? 1.0 : 0.75));
  specialIds.push(newStaff("specialpedagog", al, 0.5));
}

// ----------------------------- Klasser, mentorer, elever -----------------------------
for (const g of GRADES) {
  for (const suf of CLASS_SUFFIXES) {
    const classId = `${g}${suf}`;
    const al = stadiumFor(g);
    const mentor = newStaff("larare", al, 1.0);
    // Socioekonomiskt strukturindex per klass (riksgenomsnitt = 100).
    const socioIndex = +clamp(gauss2(102, 11), 78, 134).toFixed(1);
    classRows.push([classId, g, suf, al, mentor, socioIndex]);

    for (let i = 0; i < STUDENTS_PER_CLASS; i++) {
      const gender: "flicka" | "pojke" = rnd() < 0.5 ? "flicka" : "pojke";
      const first = nextName();
      const ability = clamp(gauss(0.6, 0.17), 0.05, 0.98);
      // Frånvaro korrelerar svagt negativt med förmåga (§5.5 samband).
      const absenceBase = clamp(0.045 + (0.6 - ability) * 0.06 + gauss(0, 0.02), 0.01, 0.22);
      const id = `S${g}${suf}${String(i + 1).padStart(2, "0")}`;
      // Stödinsatser (separat RNG): lägre förmåga → större sannolikhet för stöd.
      // åtgärdsprogram ⊂ extra anpassning; utredning främst för dem utan program än.
      const anp = rnd2() < clamp(0.55 - ability * 0.55, 0.03, 0.5);
      const prog = anp && rnd2() < clamp(0.6 - ability * 0.45, 0.05, 0.6);
      const utr = !prog && rnd2() < clamp(0.10 - ability * 0.09, 0.01, 0.12);
      students.push({ id, first, last: "", grade: g, classId, gender, ability, absenceBase });
      studentRows.push([id, first, "", g, classId, gender, true, anp, prog, utr]);
    }
  }
}

// ----------------------------- Tjänstefördelning (ämneslärare) -----------------------------
// Ämneslärare för åk 7–10 per ämne; behörighet mestadels hög men lägre i
// Moderna språk och Teknik (scenario 6: bemanningsutmaning).
let assignSeq = 0;
function addAssignment(staffId: string, classId: string | null, subject: string | null, grade: number | null, hours: number, qualified: boolean) {
  assignSeq++;
  assignRows.push([`A${String(assignSeq).padStart(4, "0")}`, staffId, classId, subject, grade, hours, qualified]);
}
const subjectTeachers: Record<string, string[]> = {};
for (const subj of GRADED_SUBJECTS) {
  const lowSupply = subj === "Moderna språk" || subj === "Teknik";
  const n = lowSupply ? 1 : 2;
  subjectTeachers[subj] = [];
  for (let k = 0; k < n; k++) {
    subjectTeachers[subj].push(newStaff("larare", "Högstadium", lowSupply ? 0.8 : 1.0));
  }
}
for (const g of [7, 8, 9, 10]) {
  for (const suf of CLASS_SUFFIXES) {
    const classId = `${g}${suf}`;
    for (const subj of GRADED_SUBJECTS) {
      const lowSupply = subj === "Moderna språk" || subj === "Teknik";
      const teacher = pick(subjectTeachers[subj]);
      const qualified = lowSupply ? rnd() < 0.55 : rnd() < 0.92;
      const hours = subj === "Svenska" || subj === "Matematik" ? 3.5 : subj === "Engelska" ? 2.5 : 1.5;
      addAssignment(teacher, classId, subj, g, hours, qualified);
    }
  }
}
// Klasslärare åk 1–6 undervisar i basämnen (förenklat: mentor som lärare).
for (const g of [1, 2, 3, 4, 5, 6]) {
  for (const suf of CLASS_SUFFIXES) {
    const classId = `${g}${suf}`;
    const mentor = classRows.find((c) => c[0] === classId)![4] as string;
    addAssignment(mentor, classId, "Basundervisning", g, 18, rnd() < 0.9);
  }
}

// ----------------------------- Närvaro -----------------------------
function statusFor(absProb: number, invalidShare: number, lateProb: number): string {
  if (rnd() < lateProb) return "late";
  if (rnd() < absProb) return rnd() < invalidShare ? "invalid_absence" : "valid_absence";
  return "present";
}
for (const s of students) {
  // Scenario 2: åk 8 ökande frånvaro under VT, tydligast måndag/fredag.
  const isAk8 = s.grade === 8;
  for (const day of ALL_DAYS) {
    const isVT = day >= new Date("2026-01-07");
    const dow = day.getUTCDay(); // 1 mån … 5 fre
    let absProb = s.absenceBase;
    let invalidShare = 0.25;
    if (isAk8 && isVT) {
      // ramp 0→1 över VT fram till idag
      const ramp = clamp((day.getTime() - new Date("2026-01-07").getTime()) /
        (DEMO_TODAY.getTime() - new Date("2026-01-07").getTime()), 0, 1);
      absProb += 0.10 * ramp;
      if (dow === 1 || dow === 5) absProb += 0.10 * ramp; // mån/fre
      invalidShare = 0.55;
    }
    const status = statusFor(absProb, invalidShare, 0.02);
    const minutes = status === "late" ? ri(5, 25) : status === "valid_absence" || status === "invalid_absence" ? 0 : 0;
    attendanceRows.push([s.id, iso(day), status, minutes]);
  }
}

// ----------------------------- Läsa/skriva/räkna åk 1–4 -----------------------------
const LNA_COMMENTS: Record<Level, string[]> = {
  over: ["Läser med mycket god flyt.", "Visar säker taluppfattning.", "Skriver sammanhängande texter."],
  i_linje: ["Utvecklas enligt förväntan.", "God progression sedan förra mätningen.", "Stabil utveckling."],
  uppmarksam: ["Behöver mer lästräning.", "Osäker på vissa moment, följs upp.", "Gynnas av extra stöd i mindre grupp."],
  stort_behov: ["Stort behov av riktat stöd.", "Bör utredas vidare av speciallärare.", "Intensiv träning rekommenderas."],
};
for (const s of students) {
  if (s.grade > 4) continue;
  for (const area of ["reading", "writing", "numeracy"] as const) {
    let prevScore = clamp(gauss(s.ability * 100, 8), 5, 99);
    for (const t of TERMS) {
      let score = clamp(prevScore + gauss(4, 6), 5, 99);
      // Scenario 1: åk 2 klass 2A svag läsning HT → tydlig förbättring VT.
      if (s.grade === 2 && s.classId === "2A" && area === "reading") {
        if (t.key === "HT2025") score = clamp(gauss(38, 7), 10, 60);
        else score = clamp(prevScore + gauss(22, 7), 20, 99); // insatsens effekt
      }
      const level = levelFromScore(score);
      lnaRows.push([s.id, t.key, area, level, Math.round(score), pick(LNA_COMMENTS[level])]);
      prevScore = score;
    }
  }
}

// ----------------------------- Skriftliga omdömen åk 2–6 -----------------------------
const WRITTEN_COMMENTS: Record<Level, string[]> = {
  over: ["Når långt i ämnet.", "Visar fördjupad förståelse.", "Bidrar aktivt på lektionerna."],
  i_linje: ["Utvecklas väl.", "Goda kunskaper för årskursen.", "Stabil kunskapsutveckling."],
  uppmarksam: ["Behöver stärka grunderna.", "Följs upp kommande termin.", "Gynnas av tydligare struktur."],
  stort_behov: ["Risk att inte nå kommande kunskapskrav.", "Behöver riktat stöd.", "Planera anpassningar."],
};
const MATH_PROBLEM_COMMENT = "Återkommande utmaning i problemlösning.";
for (const s of students) {
  if (s.grade < 2 || s.grade > 6) continue;
  for (const subj of WRITTEN_SUBJECTS) {
    if (subj === "Engelska" && s.grade < 3) continue; // engelska från åk 3
    const subjBias = subj === "Matematik" ? -0.05 : 0;
    for (const t of TERMS) {
      const base = clamp(s.ability + subjBias + gauss(0, 0.08), 0.02, 0.99);
      let level = levelFromScore(base * 100);
      let comment = pick(WRITTEN_COMMENTS[level]);
      // Scenario 5: åk 5 matematik – återkommande problemlösning.
      if (s.grade === 5 && subj === "Matematik" && rnd() < 0.55) {
        if (level === "over") level = "i_linje";
        else if (level === "i_linje") level = "uppmarksam";
        comment = MATH_PROBLEM_COMMENT;
      }
      writtenRows.push([s.id, t.key, subj, level, comment]);
    }
  }
}

// ----------------------------- Betyg åk 7–10 -----------------------------
for (const s of students) {
  if (s.grade < 7) continue;
  for (const subj of GRADED_SUBJECTS) {
    const subjBias =
      subj === "Matematik" ? -0.06 :
      subj === "Moderna språk" ? -0.04 :
      subj === "Fysik" || subj === "Kemi" ? -0.03 : 0;
    for (const t of TERMS) {
      const score = clamp(s.ability + subjBias + gauss(0, 0.07), 0.0, 1.0);
      const mark = markFromScore(score);
      const isFinal = s.grade === 10 && t.key === "VT2026"; // slutbetyg åk 10 (sista året)
      gradeRows.push([s.id, t.key, subj, mark, isFinal]);
    }
  }
}

// ----------------------------- Nationella prov åk 7–10 (fokus åk 10) -----------------------------
for (const s of students) {
  if (s.grade < 7) continue;
  for (const subj of NATIONAL_TEST_SUBJECTS) {
    let score = clamp(s.ability + gauss(0, 0.08), 0, 1);
    // Scenario 3: åk 10 matematik – provbetyg tydligt lägre än terminsbetyg.
    if (s.grade === 10 && subj === "Matematik") score = clamp(score - 0.22, 0, 1);
    natRows.push([s.id, "VT2026", subj, markFromScore(score)]);
  }
}

// ----------------------------- Trivsel / wellbeing (separat RNG) -----------------------------
// Skala 1–4 (4 = bäst). Lägre trivsel hänger svagt samman med högre frånvaro och
// lägre förmåga. Scenario 2: åk 8 visar sjunkande trivsel och trygghet under VT,
// vilket samspelar med den ökande frånvaron – en tidig signal.
for (const s of students) {
  const latent = 3.35 - s.absenceBase * 4 + (s.ability - 0.6) * 0.5;
  for (const t of TERMS) {
    const ak8vt = s.grade === 8 && t.key === "VT2026";
    const dip = ak8vt ? 0.8 : 0;
    const dim = (bias: number) => clamp(Math.round(latent - dip + bias + gauss2(0, 0.5)), 1, 4);
    const trivsel = dim(0.1);
    const trygghet = dim(ak8vt ? -0.2 : 0.2);
    const studiero = dim((s.ability - 0.6) * 0.4);
    wellbeingRows.push([s.id, t.key, trivsel, trygghet, studiero]);
  }
}

// ----------------------------- Insatser (kurerade, is_demo=true) -----------------------------
const interventions: Val[][] = [];
const followups: Val[][] = [];
// kolumner: title, level, target_grade, target_class_id, target_student_id, subject,
// start_date, follow_up_date, owner_role, hypothesis, planned_action, expected_effect, outcome, status, is_demo
function addIntervention(r: {
  title: string; level: string; grade?: number | null; classId?: string | null; studentId?: string | null;
  subject?: string | null; start?: string | null; followUp?: string | null; owner: string;
  hypothesis: string; action: string; expected: string; outcome?: string | null; status: string;
}): number {
  interventions.push([
    r.title, r.level, r.grade ?? null, r.classId ?? null, r.studentId ?? null, r.subject ?? null,
    r.start ?? null, r.followUp ?? null, r.owner, r.hypothesis, r.action, r.expected, r.outcome ?? null, r.status, true,
  ]);
  return interventions.length; // 1-baserat intervention_id (identity startar på 1)
}

const i1 = addIntervention({
  title: "Läsintervention åk 2", level: "class", grade: 2, classId: "2A", subject: "Läsning",
  start: "2025-09-15", followUp: "2025-11-10", owner: "forstelarare",
  hypothesis: "Svag läsprogression i 2A beror på begränsad mängd strukturerad lästräning.",
  action: "Daglig intensiv lästräning i mindre grupp, 20 min, med speciallärare.",
  expected: "Majoriteten av eleverna höjer sin lässnivå inom åtta veckor.",
  outcome: "Tydlig förbättring för de flesta eleverna vid uppföljning.", status: "avslutad",
});
followups.push([i1, "2025-11-10", "Av 20 elever har 15 höjt sin nivå i läsning sedan höstens mätning.", "Positiv effekt – fortsätter med underhåll.", true]);

addIntervention({
  title: "Närvaroteam åk 8", level: "grade", grade: 8, subject: null,
  start: "2026-03-02", followUp: "2026-05-25", owner: "elevhalsa",
  hypothesis: "Ökande frånvaro i åk 8, särskilt måndagar och fredagar, hänger ihop med svag tillhörighet.",
  action: "Mentorer och elevhälsa kontaktar familjer och följer närvaro veckovis.",
  expected: "Frånvaron planar ut och minskar på sikt.", status: "pagaende",
});

addIntervention({
  title: "Kollegialt ämnesarbete i matematik åk 10", level: "grade", grade: 10, subject: "Matematik",
  start: "2026-04-07", followUp: "2026-06-05", owner: "forstelarare",
  hypothesis: "Skillnaden mellan nationella prov och betyg i matematik tyder på olika bedömningsgrunder.",
  action: "Förstelärare leder sambedömning och analys av provresultat kontra betyg.",
  expected: "Mer likvärdig bedömning och tydligare undervisningsfokus.", status: "pagaende",
});

addIntervention({
  title: "Intensivträning i matematik åk 4", level: "grade", grade: 4, subject: "Matematik",
  start: "2026-02-17", followUp: "2026-05-12", owner: "forstelarare",
  hypothesis: "Flera elever i åk 4 saknar automatiserade grundfärdigheter i taluppfattning.",
  action: "Tre pass per vecka med riktad färdighetsträning.",
  expected: "Förbättrad taluppfattning inför åk 5.", status: "pagaende",
});

addIntervention({
  title: "Stärkt mentorskap åk 7", level: "grade", grade: 7, subject: null,
  start: "2026-01-20", followUp: "2026-05-20", owner: "skolledare",
  hypothesis: "Övergången till högstadiet kräver tätare mentorskontakt.",
  action: "Schemalagd mentorstid varje vecka och tidiga avstämningar.",
  expected: "Tryggare elever och tidigare upptäckt av behov.", status: "pagaende",
});

addIntervention({
  title: "Problemlösning i fokus åk 5", level: "grade", grade: 5, subject: "Matematik",
  start: "2026-03-09", followUp: "2026-06-01", owner: "forstelarare",
  hypothesis: "Omdömena visar återkommande svårigheter med problemlösning i matematik.",
  action: "Gemensam undervisningsmodell för problemlösning, kollegial uppföljning.",
  expected: "Fler elever når godtagbara kunskaper i problemlösning nästa termin.", status: "pagaende",
});

// ----------------------------- Ekonomi -----------------------------
const budgetRows: Val[][] = [];
const forecastRows: Val[][] = [];
const MONTHS = ["2025-08-01","2025-09-01","2025-10-01","2025-11-01","2025-12-01","2026-01-01","2026-02-01","2026-03-01","2026-04-01","2026-05-01","2026-06-01"];
const TODAY_MONTH_IDX = 9; // maj 2026 = utfall t.o.m. denna månad
interface Cat { name: string; monthly: number; drift: number; vikarie?: boolean }
const CATS: Cat[] = [
  { name: "Personalkostnader", monthly: 2_350_000, drift: 0.01 },
  { name: "Läromedel", monthly: 145_000, drift: 0.0 },
  { name: "Elevstöd och särskilda insatser", monthly: 220_000, drift: 0.02 },
  { name: "Vikariekostnader", monthly: 95_000, drift: 0.0, vikarie: true }, // scenario 4
  { name: "Lokaler och övrigt", monthly: 410_000, drift: 0.0 },
];
for (const c of CATS) {
  for (let m = 0; m < MONTHS.length; m++) {
    const budget = Math.round(c.monthly * (1 + c.drift * m));
    let actual: number | null = null;
    if (m <= TODAY_MONTH_IDX) {
      if (c.vikarie) {
        // Scenario 4: vikariekostnader ökar kraftigt över året och spränger budget.
        actual = Math.round(c.monthly * (1 + 0.14 * m) * (1 + gauss(0, 0.05)));
      } else {
        actual = Math.round(budget * (1 + gauss(0.0, 0.03)));
      }
    }
    budgetRows.push([c.name, MONTHS[m], budget, actual]);
  }
  const fullBudget = budgetRows.filter((r) => r[0] === c.name).reduce((a, r) => a + (r[2] as number), 0);
  let forecast = fullBudget;
  if (c.vikarie) forecast = Math.round(fullBudget * 1.42);
  else if (c.name === "Elevstöd och särskilda insatser") forecast = Math.round(fullBudget * 1.06);
  else forecast = Math.round(fullBudget * (1 + gauss(0, 0.01)));
  forecastRows.push([c.name, fullBudget, forecast]);
}

// ----------------------------- Elevpeng / resurstilldelning -----------------------------
// Kommunens resurstilldelning: grundbelopp per elev (varierar per stadium) plus
// ett socioekonomiskt strukturtillägg som ökar med klassens strukturindex.
const fundingRows: Val[][] = [
  ["grundbelopp_lag", 68000, "Grundbelopp per elev Lågstadium åk 1–4 (kr/år)"],
  ["grundbelopp_mellan", 75000, "Grundbelopp per elev Mellanstadium åk 5–7 (kr/år)"],
  ["grundbelopp_hog", 86000, "Grundbelopp per elev Högstadium åk 8–10 (kr/år)"],
  ["baseline_index", 100, "Socioekonomiskt index vid noll strukturtillägg"],
  ["strukturbelopp_per_index", 1150, "Strukturtillägg per indexpoäng över baslinjen (kr/elev/år)"],
];

// ----------------------------- HR-nyckeltal per månad -----------------------------
const hrRows: Val[][] = [];
for (let m = 0; m < MONTHS.length; m++) {
  const winter = m >= 4 && m <= 6; // dec, jan, feb
  const shortRate = clamp(0.022 + (winter ? 0.013 : 0) + gauss2(0, 0.004), 0.01, 0.06);
  const longRate = clamp(0.018 + gauss2(0, 0.003), 0.008, 0.04);
  hrRows.push([MONTHS[m], +shortRate.toFixed(4), +longRate.toFixed(4)]);
}

// ----------------------------- Datamängder -----------------------------
// En källa, två mål: SQLite-databasen (primär) och supabase/seed.sql (framtida).
interface Dataset { table: string; cols: string[]; rows: Val[][] }
const datasets: Dataset[] = [
  { table: "user_roles", cols: ["key", "label"], rows: [
    ["skolledare", "Skolledare"], ["elevhalsa", "Elevhälsa"],
    ["forstelarare", "Förstelärare"], ["larare", "Lärare"],
  ] },
  { table: "school_terms", cols: ["key", "label", "start_date", "end_date"],
    rows: TERMS.map((t) => [t.key, t.label, t.start, t.end]) },
  { table: "staff", cols: ["staff_id", "first_name", "last_name", "role", "arbetslag", "fte", "sick_share", "employment_type", "years_employed"], rows: staffRows },
  { table: "classes", cols: ["class_id", "grade_level", "suffix", "arbetslag", "mentor_staff_id", "socioeconomic_index"], rows: classRows },
  { table: "students", cols: ["student_id", "first_name", "last_name", "grade_level", "class_id", "gender", "active", "extra_anpassning", "atgardsprogram", "utredning_pagaende"], rows: studentRows },
  { table: "staff_assignments", cols: ["assignment_id", "staff_id", "class_id", "subject", "grade_level", "hours_per_week", "is_qualified"], rows: assignRows },
  { table: "attendance_records", cols: ["student_id", "date", "status", "minutes_absent"], rows: attendanceRows },
  { table: "literacy_numeracy_assessments", cols: ["student_id", "term", "area", "level", "progression_score", "comment"], rows: lnaRows },
  { table: "written_assessments", cols: ["student_id", "term", "subject", "level", "comment"], rows: writtenRows },
  { table: "subject_grades", cols: ["student_id", "term", "subject", "grade", "is_final"], rows: gradeRows },
  { table: "national_tests", cols: ["student_id", "term", "subject", "grade"], rows: natRows },
  { table: "wellbeing_surveys", cols: ["student_id", "term", "trivsel", "trygghet", "studiero"], rows: wellbeingRows },
  { table: "interventions",
    cols: ["title","level","target_grade","target_class_id","target_student_id","subject","start_date","follow_up_date","owner_role","hypothesis","planned_action","expected_effect","outcome","status","is_demo"],
    rows: interventions },
  { table: "intervention_followups", cols: ["intervention_id", "date", "note", "effect_observed", "is_demo"], rows: followups },
  { table: "budget_items", cols: ["category", "month", "budget", "actual"], rows: budgetRows },
  { table: "financial_forecasts", cols: ["category", "full_year_budget", "full_year_forecast"], rows: forecastRows },
  { table: "funding_parameters", cols: ["key", "value", "label"], rows: fundingRows },
  { table: "hr_monthly", cols: ["month", "sick_short_rate", "sick_long_rate"], rows: hrRows },
];

// ----------------------------- Bygg SQLite-databasen -----------------------------
const dataDir = join(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true });
const dbFile = join(dataDir, "skolinsikt.db");
for (const f of [dbFile, `${dbFile}-wal`, `${dbFile}-shm`]) if (existsSync(f)) rmSync(f);

const schema = readFileSync(join(process.cwd(), "lib", "db", "schema.sql"), "utf8");
const db = new Database(dbFile);
db.pragma("foreign_keys = OFF"); // tillåt godtycklig insättningsordning under seed
db.exec(schema);

const toSqlite = (v: Val) => (typeof v === "boolean" ? (v ? 1 : 0) : v);
const insertAll = db.transaction(() => {
  for (const ds of datasets) {
    if (ds.rows.length === 0) continue;
    const stmt = db.prepare(
      `insert into ${ds.table} (${ds.cols.join(",")}) values (${ds.cols.map(() => "?").join(",")})`,
    );
    for (const r of ds.rows) stmt.run(r.map(toSqlite));
  }
});
insertAll();
db.pragma("foreign_key_check");
db.exec("vacuum");
db.close();

// ----------------------------- Skriv supabase/seed.sql (framtida Supabase) -----------------------------
const parts: string[] = [];
parts.push("-- GENERERAD AV scripts/seed.ts – ändra inte för hand. All data är fiktiv.");
parts.push("begin;");
parts.push("-- Rensa befintlig demodata (idempotent omseedning).");
parts.push(`truncate table
  intervention_followups, interventions, comments,
  attendance_records, literacy_numeracy_assessments, written_assessments,
  subject_grades, national_tests, wellbeing_surveys, staff_assignments, students, classes, staff,
  budget_items, financial_forecasts, funding_parameters, hr_monthly, school_terms, user_roles
  restart identity cascade;`);
for (const ds of datasets) parts.push(insertBatch(ds.table, ds.cols, ds.rows));
parts.push("commit;");

const outDir = join(process.cwd(), "supabase");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, "seed.sql");
writeFileSync(outFile, parts.filter(Boolean).join("\n\n") + "\n", "utf8");

console.log(`SQLite-databas byggd: ${dbFile}`);
console.log(`Supabase-seed skriven: ${outFile}`);
console.log(`  elever: ${studentRows.length}`);
console.log(`  personal: ${staffRows.length}`);
console.log(`  närvarorader: ${attendanceRows.length}`);
console.log(`  LSR-bedömningar: ${lnaRows.length}`);
console.log(`  omdömen: ${writtenRows.length}`);
console.log(`  betyg: ${gradeRows.length}, nationella prov: ${natRows.length}`);
console.log(`  insatser: ${interventions.length}, budgetrader: ${budgetRows.length}`);

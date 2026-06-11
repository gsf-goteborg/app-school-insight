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
  ALL_TERMS,
  SCHOOLS,
  HOME_SCHOOL,
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

// Tredje RNG-ström för HISTORISKA bedömningar (tre tidigare läsår). Egen ström
// så att varken de kurerade scenariona (rng) eller demografin (rng2) rubbas.
const rng3 = mulberry32(13572468);
const rnd3 = () => rng3();
function gauss3(mean: number, sd: number) {
  const u = 1 - rnd3();
  const v = rnd3();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const pick3 = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd3() * arr.length)];

// Fjärde RNG-ström för historisk NÄRVARO (terminsaggregat, tre tidigare läsår).
const rng4 = mulberry32(98761234);
const rnd4 = () => rng4();
function gauss4(mean: number, sd: number) {
  const u = 1 - rnd4();
  const v = rnd4();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

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

// ----------------------------- Historiska bedömningar (tre tidigare läsår) -----------------------------
// Longitudinell historik så att utveckling kan följas över tid (som i skolans
// progressionsrapport). Genereras BAKLÄNGES från elevens nuvarande nivå med en
// per-elev-trend: ca 16 % har förbättrats över åren, ca 16 % har försämrats,
// resten ligger stabilt. Endast bedömningsdata (betyg/omdömen/LSR) – närvaro
// och trivselenkät finns bara för innevarande läsår. Egen RNG-ström (rng3).
const HIST_YEARS: { ht: string; vt: string; back: number }[] = [
  { ht: "HT2024", vt: "VT2025", back: 1 },
  { ht: "HT2023", vt: "VT2024", back: 2 },
  { ht: "HT2022", vt: "VT2023", back: 3 },
];
let histGradeRows = 0, histWrittenRows = 0, histLnaRows = 0;

for (const s of students) {
  // Trend per elev: positiv lutning = eleven har förbättrats fram till idag
  // (historiska värden lägre), negativ = eleven låg högre förr.
  const r = rnd3();
  const slope = r < 0.16 ? 0.022 : r < 0.32 ? -0.022 : gauss3(0, 0.006);

  for (const y of HIST_YEARS) {
    const gradeThen = s.grade - y.back;
    if (gradeThen < 1) continue;

    for (const [termKey, termsBack] of [[y.ht, y.back * 2], [y.vt, y.back * 2 - 1]] as const) {
      // Betyg (åk 7–9 historiskt – ingen nuvarande elev har redan gått åk 10)
      if (gradeThen >= 7) {
        for (const subj of GRADED_SUBJECTS) {
          const subjBias =
            subj === "Matematik" ? -0.06 :
            subj === "Moderna språk" ? -0.04 :
            subj === "Fysik" || subj === "Kemi" ? -0.03 : 0;
          const slopeS = slope + gauss3(0, 0.006);
          const score = clamp(s.ability + subjBias - slopeS * termsBack + gauss3(0, 0.06), 0, 1);
          gradeRows.push([s.id, termKey, subj, markFromScore(score), false]);
          histGradeRows++;
        }
      } else if (gradeThen >= 2) {
        // Skriftliga omdömen (åk 2–6 historiskt; engelska från åk 3)
        for (const subj of WRITTEN_SUBJECTS) {
          if (subj === "Engelska" && gradeThen < 3) continue;
          const subjBias = subj === "Matematik" ? -0.05 : 0;
          const slopeS = slope + gauss3(0, 0.006);
          const base = clamp(s.ability + subjBias - slopeS * termsBack + gauss3(0, 0.08), 0.02, 0.99);
          const level = levelFromScore(base * 100);
          writtenRows.push([s.id, termKey, subj, level, pick3(WRITTEN_COMMENTS[level])]);
          histWrittenRows++;
        }
      }
      // Läsa/skriva/räkna (åk 1–4 historiskt; kan överlappa omdömen åk 2–4)
      if (gradeThen <= 4) {
        for (const area of ["reading", "writing", "numeracy"] as const) {
          const slopeS = slope + gauss3(0, 0.006);
          const score = clamp(s.ability * 100 - slopeS * 100 * termsBack + gauss3(0, 8), 5, 99);
          const level = levelFromScore(score);
          lnaRows.push([s.id, termKey, area, level, Math.round(score), pick3(LNA_COMMENTS[level])]);
          histLnaRows++;
        }
      }
    }
  }
}

// ----------------------------- Historisk närvaro (terminsaggregat) -----------------------------
// Frånvaro per termin för tre tidigare läsår, så att frånvaro kan följas över
// tid (som skolans Qlik-rapport "Frånvaro – Progression – Termin"). Frånvaro
// är trögrörlig: elevens nuvarande frånvaronivå skrivs bakåt med en per-elev-
// drift – ca 15 % av eleverna har en frånvaro som vuxit fram över åren, ca
// 10 % har förbättrats, resten ligger stabilt kring sin bas. Egen ström (rng4).
const attendanceHistoryRows: Val[][] = [];
for (const s of students) {
  const r = rnd4();
  // Positiv drift = frånvaron har ÖKAT fram till idag (lägre förr).
  const drift = r < 0.15 ? 0.012 : r < 0.25 ? -0.008 : gauss4(0, 0.002);
  for (const y of HIST_YEARS) {
    const gradeThen = s.grade - y.back;
    if (gradeThen < 1) continue;
    for (const [termKey, termsBack] of [[y.ht, y.back * 2], [y.vt, y.back * 2 - 1]] as const) {
      const isHt = termKey.startsWith("HT");
      const daysTotal = Math.round(clamp(gauss4(isHt ? 88 : 98, 2), 80, 104));
      const rate = clamp(s.absenceBase - drift * termsBack + gauss4(0, 0.012), 0.0, 0.6);
      attendanceHistoryRows.push([s.id, termKey, daysTotal, Math.round(rate * daysTotal)]);
    }
  }
}

// ----------------------------- Övriga skolor (huvudmannens område) -----------------------------
// Framtidsskolan (ovan) är demons fullt utbyggda skola och dess data får ALDRIG
// rubbas (testgruppen känner siffrorna). Här genereras två ytterligare skolor
// för huvudmannavyn – fullt seedade i *_all-tabellerna men endast synliga på
// skolnivå i appen. Egen RNG-ström per skola; blocket ligger sist så att
// Framtidsskolans strömmar (rng–rng4) konsumeras exakt som tidigare.
//
// Skolprofiler (ger utbildningschefen något att agera på):
//   ALV (liten): starka resultat, god trygghet – men liten-skola-ekonomi i obalans.
//   BJO (stor):  pressad – högre frånvaro, lägre trygghet, vikariekostnader skenar.
const SCHOOL_PROFILES: Record<string, {
  ability: number; absence: number; trygg: number;
  vikarieFactor: number; persFactor: number; sick: number; rngSeed: number;
}> = {
  ALV: { ability: 0.04, absence: -0.005, trygg: 0.15, vikarieFactor: 1.0, persFactor: 1.045, sick: -0.005, rngSeed: 11111111 },
  BJO: { ability: -0.03, absence: 0.015, trygg: -0.25, vikarieFactor: 1.34, persFactor: 1.015, sick: 0.012, rngSeed: 22222222 },
};

// Radmängder med explicit school_id-kolumn (Framtidsskolans rader använder
// kolumndefaulten 'FRA' och behöver inte ändras).
const xStaffRows: Val[][] = [];
const xClassRows: Val[][] = [];
const xStudentRows: Val[][] = [];
const xAttnTermRows: Val[][] = [];
const xLnaRows: Val[][] = [];
const xWrittenRows: Val[][] = [];
const xGradeRows: Val[][] = [];
const xWellbeingRows: Val[][] = [];
const xBudgetRows: Val[][] = [];
const xForecastRows: Val[][] = [];
const xHrRows: Val[][] = [];

for (const school of SCHOOLS.filter((s) => s.id !== HOME_SCHOOL)) {
  const sid = school.id;
  const prof = SCHOOL_PROFILES[sid];
  const rngS = mulberry32(prof.rngSeed);
  const rndS = () => rngS();
  const gaussS = (mean: number, sd: number) => {
    const u = 1 - rndS();
    const v = rndS();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const suffixes = ["A", "B", "C", "D"].slice(0, school.classesPerGrade);

  // Personal: skolledare + special per stadium + mentorer. (Ämneslärar-
  // tjänstefördelning seedas endast för Framtidsskolan.)
  let staffSeqS = 0;
  const newStaffS = (role: string, arbetslag: string | null, fte: number): string => {
    const id = `${sid}-T${String(++staffSeqS).padStart(3, "0")}`;
    const visstid = rndS() < 0.15;
    let sick = clamp(gaussS(0.045 + prof.sick, 0.025), 0.005, 0.5);
    if (rndS() < 0.06 + prof.sick) sick = clamp(gaussS(0.22, 0.07), 0.12, 0.6);
    xStaffRows.push([
      id, sid, nextName(), "", role, arbetslag, fte, +sick.toFixed(4),
      visstid ? "visstid" : "tillsvidare",
      +clamp(gaussS(visstid ? 1.5 : 9, visstid ? 1 : 6), 0.2, 35).toFixed(1),
    ]);
    return id;
  };
  newStaffS("skolledare", null, 1.0);
  for (const al of ["Lågstadium", "Mellanstadium", "Högstadium"]) {
    newStaffS("speciallarare", al, school.classesPerGrade >= 4 ? 1.5 : 0.75);
    newStaffS("specialpedagog", al, 0.5);
  }

  interface XStudent { id: string; grade: number; ability: number; absenceBase: number }
  const xStudents: XStudent[] = [];

  for (const g of GRADES) {
    for (const suf of suffixes) {
      const classId = `${sid}-${g}${suf}`;
      const al = stadiumFor(g);
      const mentor = newStaffS("larare", al, 1.0);
      const socio = +clamp(gaussS(sid === "BJO" ? 108 : 98, 11), 78, 134).toFixed(1);
      xClassRows.push([classId, sid, g, suf, al, mentor, socio]);

      for (let i = 0; i < STUDENTS_PER_CLASS; i++) {
        const id = `${sid}-S${g}${suf}${String(i + 1).padStart(2, "0")}`;
        const ability = clamp(gaussS(0.6 + prof.ability, 0.17), 0.05, 0.98);
        const absenceBase = clamp(0.045 + prof.absence + (0.6 - ability) * 0.06 + gaussS(0, 0.02), 0.01, 0.25);
        const anp = rndS() < clamp(0.55 - ability * 0.55, 0.03, 0.5);
        const prog = anp && rndS() < clamp(0.6 - ability * 0.45, 0.05, 0.6);
        const utr = !prog && rndS() < clamp(0.10 - ability * 0.09, 0.01, 0.12);
        xStudents.push({ id, grade: g, ability, absenceBase });
        xStudentRows.push([id, sid, nextName(), "", g, classId, rndS() < 0.5 ? "flicka" : "pojke", true, anp, prog, utr]);
      }
    }
  }

  // Bedömningar (innevarande läsår + tre läsårs historik) och närvaro per
  // termin (alla åtta terminer – inga dagliga rader för övriga skolor).
  for (const s of xStudents) {
    const r = rndS();
    const slope = r < 0.16 ? 0.022 : r < 0.32 ? -0.022 : gaussS(0, 0.006);
    const rAbs = rndS();
    const absDrift = rAbs < 0.15 ? 0.012 : rAbs < 0.25 ? -0.008 : gaussS(0, 0.002);

    // back = terminer bakåt från innevarande läsår (0 = HT2025/VT2026), samma
    // skala som Framtidsskolans historikblock. days = skoldagar per termin
    // (VT2026 t.o.m. demo-idag 15 maj).
    const allTerms: { key: string; back: number; days: number }[] = [
      { key: "HT2022", back: 6, days: 88 }, { key: "VT2023", back: 5, days: 98 },
      { key: "HT2023", back: 4, days: 88 }, { key: "VT2024", back: 3, days: 98 },
      { key: "HT2024", back: 2, days: 88 }, { key: "VT2025", back: 1, days: 98 },
      { key: "HT2025", back: 0, days: 88 }, { key: "VT2026", back: 0, days: 83 },
    ];

    for (const t of allTerms) {
      const yearsBack = Math.ceil(t.back / 2);
      const gradeThen = s.grade - yearsBack;
      if (gradeThen < 1) continue;

      // Närvaro (terminsaggregat)
      const rate = clamp(s.absenceBase - absDrift * t.back + gaussS(0, 0.012), 0, 0.6);
      xAttnTermRows.push([s.id, sid, t.key, t.days, Math.round(rate * t.days)]);

      // Kunskapsresultat
      if (gradeThen >= 7) {
        for (const subj of GRADED_SUBJECTS) {
          const subjBias =
            subj === "Matematik" ? -0.06 :
            subj === "Moderna språk" ? -0.04 :
            subj === "Fysik" || subj === "Kemi" ? -0.03 : 0;
          const score = clamp(s.ability + subjBias - (slope + gaussS(0, 0.006)) * t.back + gaussS(0, 0.06), 0, 1);
          xGradeRows.push([s.id, sid, t.key, subj, markFromScore(score), gradeThen === 10 && t.key === "VT2026"]);
        }
      } else if (gradeThen >= 2) {
        for (const subj of WRITTEN_SUBJECTS) {
          if (subj === "Engelska" && gradeThen < 3) continue;
          const subjBias = subj === "Matematik" ? -0.05 : 0;
          const base = clamp(s.ability + subjBias - (slope + gaussS(0, 0.006)) * t.back + gaussS(0, 0.08), 0.02, 0.99);
          const level = levelFromScore(base * 100);
          xWrittenRows.push([s.id, sid, t.key, subj, level, WRITTEN_COMMENTS[level][Math.floor(rndS() * WRITTEN_COMMENTS[level].length)]]);
        }
      }
      if (gradeThen <= 4) {
        for (const area of ["reading", "writing", "numeracy"] as const) {
          const score = clamp(s.ability * 100 - (slope + gaussS(0, 0.006)) * 100 * t.back + gaussS(0, 8), 5, 99);
          const level = levelFromScore(score);
          xLnaRows.push([s.id, sid, t.key, area, level, Math.round(score), LNA_COMMENTS[level][Math.floor(rndS() * LNA_COMMENTS[level].length)]]);
        }
      }
    }

    // Trivselenkät (innevarande läsår)
    const latent = 3.35 + prof.trygg - s.absenceBase * 4 + (s.ability - 0.6) * 0.5;
    for (const t of TERMS) {
      const dim = (bias: number) => clamp(Math.round(latent + bias + gaussS(0, 0.5)), 1, 4);
      xWellbeingRows.push([s.id, sid, t.key, dim(0.1), dim(0.2), dim((s.ability - 0.6) * 0.4)]);
    }
  }

  // Ekonomi (skalad efter elevantal) och HR per månad
  const sizeFactor = xStudents.length / 400;
  for (const c of CATS) {
    let fullBudget = 0;
    for (let m = 0; m < MONTHS.length; m++) {
      const budget = Math.round(c.monthly * sizeFactor * (1 + c.drift * m));
      fullBudget += budget;
      let actual: number | null = null;
      if (m <= TODAY_MONTH_IDX) {
        const factor = c.vikarie ? prof.vikarieFactor : c.name === "Personalkostnader" ? prof.persFactor : 1.0;
        actual = Math.round(budget * factor * (1 + gaussS(0, 0.03)));
      }
      xBudgetRows.push([sid, c.name, MONTHS[m], budget, actual]);
    }
    const forecastFactor = c.vikarie ? prof.vikarieFactor : c.name === "Personalkostnader" ? prof.persFactor : 1 + gaussS(0, 0.01);
    xForecastRows.push([sid, c.name, fullBudget, Math.round(fullBudget * forecastFactor)]);
  }
  for (let m = 0; m < MONTHS.length; m++) {
    const winter = m >= 4 && m <= 6;
    xHrRows.push([
      sid, MONTHS[m],
      +clamp(0.022 + prof.sick / 2 + (winter ? 0.013 : 0) + gaussS(0, 0.004), 0.01, 0.07).toFixed(4),
      +clamp(0.018 + prof.sick / 2 + gaussS(0, 0.003), 0.008, 0.05).toFixed(4),
    ]);
  }
}

// ----------------------------- Datamängder -----------------------------
// En källa, två mål: SQLite-databasen (primär) och supabase/seed.sql (framtida).
interface Dataset { table: string; cols: string[]; rows: Val[][] }
// Fysiska tabeller har _all-suffix och en school_id-kolumn med default 'FRA' –
// Framtidsskolans rader skrivs därför utan school_id (kolumndefaulten gäller),
// medan övriga skolors rader (x*-mängderna) anger school_id explicit.
const datasets: Dataset[] = [
  { table: "user_roles", cols: ["key", "label"], rows: [
    ["skolledare", "Skolledare"], ["elevhalsa", "Elevhälsa"],
    ["forstelarare", "Förstelärare"], ["larare", "Lärare"],
    ["utbildningschef", "Utbildningschef"],
  ] },
  { table: "school_terms", cols: ["key", "label", "start_date", "end_date"],
    rows: ALL_TERMS.map((t) => [t.key, t.label, t.start, t.end]) },
  { table: "schools", cols: ["school_id", "name", "blurb"],
    rows: SCHOOLS.map((s) => [s.id, s.name, s.blurb]) },
  { table: "staff_all", cols: ["staff_id", "first_name", "last_name", "role", "arbetslag", "fte", "sick_share", "employment_type", "years_employed"], rows: staffRows },
  { table: "classes_all", cols: ["class_id", "grade_level", "suffix", "arbetslag", "mentor_staff_id", "socioeconomic_index"], rows: classRows },
  { table: "students_all", cols: ["student_id", "first_name", "last_name", "grade_level", "class_id", "gender", "active", "extra_anpassning", "atgardsprogram", "utredning_pagaende"], rows: studentRows },
  { table: "staff_assignments_all", cols: ["assignment_id", "staff_id", "class_id", "subject", "grade_level", "hours_per_week", "is_qualified"], rows: assignRows },
  { table: "attendance_records_all", cols: ["student_id", "date", "status", "minutes_absent"], rows: attendanceRows },
  { table: "attendance_term_history_all", cols: ["student_id", "term", "days_total", "days_absent"], rows: attendanceHistoryRows },
  { table: "literacy_numeracy_assessments_all", cols: ["student_id", "term", "area", "level", "progression_score", "comment"], rows: lnaRows },
  { table: "written_assessments_all", cols: ["student_id", "term", "subject", "level", "comment"], rows: writtenRows },
  { table: "subject_grades_all", cols: ["student_id", "term", "subject", "grade", "is_final"], rows: gradeRows },
  { table: "national_tests_all", cols: ["student_id", "term", "subject", "grade"], rows: natRows },
  { table: "wellbeing_surveys_all", cols: ["student_id", "term", "trivsel", "trygghet", "studiero"], rows: wellbeingRows },
  { table: "interventions_all",
    cols: ["title","level","target_grade","target_class_id","target_student_id","subject","start_date","follow_up_date","owner_role","hypothesis","planned_action","expected_effect","outcome","status","is_demo"],
    rows: interventions },
  { table: "intervention_followups", cols: ["intervention_id", "date", "note", "effect_observed", "is_demo"], rows: followups },
  { table: "budget_items_all", cols: ["category", "month", "budget", "actual"], rows: budgetRows },
  { table: "financial_forecasts_all", cols: ["category", "full_year_budget", "full_year_forecast"], rows: forecastRows },
  { table: "funding_parameters", cols: ["key", "value", "label"], rows: fundingRows },
  { table: "hr_monthly_all", cols: ["month", "sick_short_rate", "sick_long_rate"], rows: hrRows },
  // Övriga skolor (explicit school_id)
  { table: "staff_all", cols: ["staff_id", "school_id", "first_name", "last_name", "role", "arbetslag", "fte", "sick_share", "employment_type", "years_employed"], rows: xStaffRows },
  { table: "classes_all", cols: ["class_id", "school_id", "grade_level", "suffix", "arbetslag", "mentor_staff_id", "socioeconomic_index"], rows: xClassRows },
  { table: "students_all", cols: ["student_id", "school_id", "first_name", "last_name", "grade_level", "class_id", "gender", "active", "extra_anpassning", "atgardsprogram", "utredning_pagaende"], rows: xStudentRows },
  { table: "attendance_term_history_all", cols: ["student_id", "school_id", "term", "days_total", "days_absent"], rows: xAttnTermRows },
  { table: "literacy_numeracy_assessments_all", cols: ["student_id", "school_id", "term", "area", "level", "progression_score", "comment"], rows: xLnaRows },
  { table: "written_assessments_all", cols: ["student_id", "school_id", "term", "subject", "level", "comment"], rows: xWrittenRows },
  { table: "subject_grades_all", cols: ["student_id", "school_id", "term", "subject", "grade", "is_final"], rows: xGradeRows },
  { table: "wellbeing_surveys_all", cols: ["student_id", "school_id", "term", "trivsel", "trygghet", "studiero"], rows: xWellbeingRows },
  { table: "budget_items_all", cols: ["school_id", "category", "month", "budget", "actual"], rows: xBudgetRows },
  { table: "financial_forecasts_all", cols: ["school_id", "category", "full_year_budget", "full_year_forecast"], rows: xForecastRows },
  { table: "hr_monthly_all", cols: ["school_id", "month", "sick_short_rate", "sick_long_rate"], rows: xHrRows },
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
  intervention_followups, interventions_all, comments,
  attendance_records_all, attendance_term_history_all, literacy_numeracy_assessments_all, written_assessments_all,
  subject_grades_all, national_tests_all, wellbeing_surveys_all, staff_assignments_all, students_all, classes_all, staff_all,
  budget_items_all, financial_forecasts_all, funding_parameters, hr_monthly_all, schools, school_terms, user_roles
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
console.log(`  historik (3 läsår): betyg ${histGradeRows}, omdömen ${histWrittenRows}, LSR ${histLnaRows}, närvaroterminer ${attendanceHistoryRows.length}`);
console.log(`  insatser: ${interventions.length}, budgetrader: ${budgetRows.length}`);
console.log(`  övriga skolor: ${xStudentRows.length} elever, ${xClassRows.length} klasser, ${xGradeRows.length} betyg, ${xAttnTermRows.length} närvaroterminer`);

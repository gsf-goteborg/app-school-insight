// Domänkonstanter delade av seed, frågelager och vyer.
// All demodata är fiktiv.

/** Fast "idag" för demon: mitt i vårterminen 2026. Trender beräknas mot detta datum. */
export const DEMO_TODAY = "2026-05-15";

export type TermKey = "HT2025" | "VT2026";

export interface Term {
  key: TermKey;
  label: string;
  start: string; // ISO
  end: string; // ISO (terminens slut – kan ligga efter DEMO_TODAY)
}

export const TERMS: Term[] = [
  { key: "HT2025", label: "Höstterminen 2025", start: "2025-08-18", end: "2025-12-19" },
  { key: "VT2026", label: "Vårterminen 2026", start: "2026-01-07", end: "2026-06-12" },
];

export const CURRENT_TERM: TermKey = "VT2026";

export const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export type Grade = (typeof GRADES)[number];

export const CLASS_SUFFIXES = ["A", "B"] as const;

/** Alla 20 klass-id: "1A", "1B", ... "10B". */
export const CLASS_IDS: string[] = GRADES.flatMap((g) =>
  CLASS_SUFFIXES.map((s) => `${g}${s}`),
);

export const STUDENTS_PER_CLASS = 20;

// --- Stadieindelning (gemensam källa för alla vyer) ---
// Lågstadium åk 1–4, Mellanstadium åk 5–7, Högstadium åk 8–10.
export type Stadium = "Lågstadium" | "Mellanstadium" | "Högstadium";

export const STADIA: { key: Stadium; min: number; max: number; range: string }[] = [
  { key: "Lågstadium", min: 1, max: 4, range: "åk 1–4" },
  { key: "Mellanstadium", min: 5, max: 7, range: "åk 5–7" },
  { key: "Högstadium", min: 8, max: 10, range: "åk 8–10" },
];

export function stadiumForGrade(grade: number): Stadium {
  if (grade <= 4) return "Lågstadium";
  if (grade <= 7) return "Mellanstadium";
  return "Högstadium";
}

export const STADIUM_RANGE: Record<Stadium, string> = {
  "Lågstadium": "åk 1–4",
  "Mellanstadium": "åk 5–7",
  "Högstadium": "åk 8–10",
};

// --- Bedömningsnivåer (gemensam 4-gradig skala, §5.1/§5.2) ---
export type Level = "over" | "i_linje" | "uppmarksam" | "stort_behov";

export const LEVELS: { key: Level; label: string; short: string; color: string }[] = [
  { key: "over", label: "Över förväntad progression", short: "Över", color: "var(--gbg-green)" },
  { key: "i_linje", label: "I linje med förväntad progression", short: "I linje", color: "var(--gbg-blue)" },
  { key: "uppmarksam", label: "Behöver uppmärksammas", short: "Uppmärksammas", color: "var(--gbg-orange)" },
  { key: "stort_behov", label: "Stort behov av stöd", short: "Stort behov", color: "var(--gbg-red)" },
];

export const LEVEL_LABEL: Record<Level, string> = Object.fromEntries(
  LEVELS.map((l) => [l.key, l.label]),
) as Record<Level, string>;

// --- Färdighetsområden åk 1–4 (§5.1) ---
export type SkillArea = "reading" | "writing" | "numeracy";
export const SKILL_AREAS: { key: SkillArea; label: string }[] = [
  { key: "reading", label: "Läsning" },
  { key: "writing", label: "Skrivning" },
  { key: "numeracy", label: "Räkning" },
];

// --- Ämnen ---
/** Omdömesämnen åk 2–6 (§5.2). Engelska från åk 3. */
export const WRITTEN_SUBJECTS = [
  "Svenska",
  "Matematik",
  "Engelska",
  "SO",
  "NO",
  "Praktisk-estetiska ämnen",
] as const;

/** Betygsämnen åk 7–10 (§5.3). 16 ämnen + moderna språk för meritvärde. */
export const GRADED_SUBJECTS = [
  "Svenska",
  "Engelska",
  "Matematik",
  "Biologi",
  "Fysik",
  "Kemi",
  "Geografi",
  "Historia",
  "Religionskunskap",
  "Samhällskunskap",
  "Idrott och hälsa",
  "Slöjd",
  "Musik",
  "Bild",
  "Teknik",
  "Hem- och konsumentkunskap",
  "Moderna språk",
] as const;

/** Nationella prov-ämnen åk 7–10 i demon (§5.4). */
export const NATIONAL_TEST_SUBJECTS = ["Svenska", "Engelska", "Matematik"] as const;

// --- Betygsskala (§5.3) ---
export type GradeMark = "A" | "B" | "C" | "D" | "E" | "F" | "-";
export const GRADE_MARKS: GradeMark[] = ["A", "B", "C", "D", "E", "F", "-"];

/** Meritvärdespoäng per betyg. "-" (streck) = 0. */
export const MERIT_POINTS: Record<GradeMark, number> = {
  A: 20,
  B: 17.5,
  C: 15,
  D: 12.5,
  E: 10,
  F: 0,
  "-": 0,
};

// --- Närvaro (§5.5) ---
export type AttendanceStatus = "present" | "valid_absence" | "invalid_absence" | "late";
export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: "Närvarande",
  valid_absence: "Giltig frånvaro",
  invalid_absence: "Ogiltig frånvaro",
  late: "Sen ankomst",
};

/** Frånvarotrösklar (§5.5). */
export const ABSENCE_THRESHOLDS = [0.1, 0.15, 0.2] as const;

export type Gender = "flicka" | "pojke";

// --- Insatser (§5.7 / §6.6) ---
export type InterventionLevel = "school" | "grade" | "class" | "group" | "student";
export const INTERVENTION_LEVEL_LABEL: Record<InterventionLevel, string> = {
  school: "Skola",
  grade: "Årskurs",
  class: "Klass",
  group: "Grupp",
  student: "Elev",
};

export type InterventionStatus = "planerad" | "pagaende" | "avslutad";
export const INTERVENTION_STATUS_LABEL: Record<InterventionStatus, string> = {
  planerad: "Planerad",
  pagaende: "Pågående",
  avslutad: "Avslutad",
};

// --- Kommentarsnivå (§6.3) ---
export type CommentScope = "student" | "class" | "grade";

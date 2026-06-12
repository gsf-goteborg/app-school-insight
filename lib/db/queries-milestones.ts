import "server-only";
import { all } from "./index";
import { type GradeMark, type Level } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Milstolpar i basfärdigheter (kumulativa grindar)
//
// Matematik är kumulativt och läsningen har sitt avkodningsfönster: en elev kan
// se "i linje" ut i genomsnitt och ändå ha missat ett kritiskt delmoment som
// knäcker hen flera år senare. Modellen flaggar MISSADE GRINDAR i stället för
// snittnivå – samma obligatoriska mätpunkter lästa smartare, noll nya
// bedömningar (vision: No New Reporting Burden). Grindstatus avläses ur
// fyralärårshistoriken: vad gällde vårterminen det år eleven gick i grindens
// årskurs. Stöd för läsa-skriva-räkna-garantin (skollagen 3 kap). Demodata.
// ---------------------------------------------------------------------------

export type GateKey = "avkodning" | "taluppfattning" | "tabeller" | "brak" | "prealgebra";

export interface GateMeta {
  key: GateKey;
  label: string;
  /** Årskursen då grinden ska vara passerad (avläses VT det läsåret). */
  gradeDue: number;
  /** Vilken befintlig mätpunkt grinden avläses ur. */
  source: string;
  /** Varför grinden är kritisk (forskningsgrund, kort). */
  why: string;
}

export const GATES: GateMeta[] = [
  {
    key: "avkodning",
    label: "Avkodning/läsning",
    gradeDue: 2,
    source: "Läsa-skriva-räkna: läsning (åk 2 VT)",
    why: "Avkodningsfönstret: gap som kvarstår efter åk 2 växer av sig självt (Matteus-effekten) och drar med sig alla textbärande ämnen.",
  },
  {
    key: "taluppfattning",
    label: "Taluppfattning",
    gradeDue: 3,
    source: "Läsa-skriva-räkna: räkning (åk 3 VT)",
    why: "Grunden för all senare matematik – utan säker taluppfattning byggs resten på sand.",
  },
  {
    key: "tabeller",
    label: "Automatiserad räknefärdighet",
    gradeDue: 4,
    source: "Läsa-skriva-räkna: räkning (åk 4 VT)",
    why: "Utan automatisering äts arbetsminnet upp av delsteg när problemlösningen ska ta vid.",
  },
  {
    key: "brak",
    label: "Bråk/rationella tal",
    gradeDue: 6,
    source: "Skriftligt omdöme i matematik (åk 6 VT)",
    why: "Forskningens starkaste enskilda prediktor för om algebran går hem.",
  },
  {
    key: "prealgebra",
    label: "Pre-algebra",
    gradeDue: 7,
    source: "Terminsbetyg i matematik (åk 7 VT)",
    why: "Övergången till det abstrakta – sista grinden före betygens slutspurt.",
  },
];

export type GateStatus = "klarad" | "missad" | "riskzon" | "okand" | "ej_aktuell";

export interface StudentGate {
  gate: GateKey;
  status: GateStatus;
  /** Underlaget, t.ex. "Stort behov av stöd (åk 3 VT, lästes VT 2023)". */
  detail: string;
}

export interface MilestoneStudent {
  student_id: string;
  name: string;
  class_id: string;
  grade_level: number;
  gates: StudentGate[];
  missed: number;
  /** Har formell stödprocess (åtgärdsprogram eller pågående utredning). */
  hasFormalSupport: boolean;
}

export interface GateSummary extends GateMeta {
  /** Elever som passerat grindens årskurs och har avläsbar data. */
  judged: number;
  klarad: number;
  missad: number;
  /** Elever i grindens årskurs just nu med stort behov – på väg att missa. */
  riskzon: number;
  /** Passerat grinden men data äldre än historikfönstret. */
  okand: number;
}

/** VT-terminen X läsår bakåt (0 = innevarande). null utanför historikfönstret. */
const VT_TERMS = ["VT2026", "VT2025", "VT2024", "VT2023"];

const goodLevel = (l: Level) => l === "over" || l === "i_linje";
const goodGrade = (g: GradeMark) => g !== "F" && g !== "-";

const LEVEL_TEXT: Record<Level, string> = {
  over: "Över förväntan",
  i_linje: "I linje",
  uppmarksam: "Behöver uppmärksammas",
  stort_behov: "Stort behov av stöd",
};

export function getMilestoneStudents(): MilestoneStudent[] {
  const students = all<{
    student_id: string; name: string; class_id: string; grade_level: number;
    atgardsprogram: number; utredning_pagaende: number;
  }>(
    `select student_id, (first_name || ' ' || last_name) name, class_id, grade_level,
       atgardsprogram, utredning_pagaende
     from students where active = 1`,
  );

  // Mätpunkter per källa: student -> term -> värde
  const lsr = (area: string) => {
    const rows = all<{ student_id: string; term: string; level: Level }>(
      `select student_id, term, level from literacy_numeracy_assessments where area = ?`, area,
    );
    const m = new Map<string, Map<string, Level>>();
    for (const r of rows) {
      const t = m.get(r.student_id) ?? new Map();
      t.set(r.term, r.level);
      m.set(r.student_id, t);
    }
    return m;
  };
  const reading = lsr("reading");
  const numeracy = lsr("numeracy");

  const writtenMa = new Map<string, Map<string, Level>>();
  for (const r of all<{ student_id: string; term: string; level: Level }>(
    `select student_id, term, level from written_assessments where subject = 'Matematik'`,
  )) {
    const t = writtenMa.get(r.student_id) ?? new Map();
    t.set(r.term, r.level);
    writtenMa.set(r.student_id, t);
  }
  const betygMa = new Map<string, Map<string, GradeMark>>();
  for (const r of all<{ student_id: string; term: string; grade: GradeMark }>(
    `select student_id, term, grade from subject_grades where subject = 'Matematik'`,
  )) {
    const t = betygMa.get(r.student_id) ?? new Map();
    t.set(r.term, r.grade);
    betygMa.set(r.student_id, t);
  }

  const sourceFor = (gate: GateKey) =>
    gate === "avkodning" ? reading :
    gate === "taluppfattning" || gate === "tabeller" ? numeracy :
    gate === "brak" ? writtenMa : null; // prealgebra läser betyg

  return students.map((s) => {
    const gates: StudentGate[] = GATES.map((g) => {
      const yearsBack = s.grade_level - g.gradeDue;
      if (yearsBack < 0) return { gate: g.key, status: "ej_aktuell" as const, detail: "" };

      // Riskzon: eleven går i grindens årskurs NU och ligger i stort behov.
      if (yearsBack === 0) {
        const src = sourceFor(g.key);
        const current = src?.get(s.student_id)?.get("VT2026");
        if (g.key !== "prealgebra" && current === "stort_behov") {
          return { gate: g.key, status: "riskzon", detail: `${LEVEL_TEXT.stort_behov} nu, grindens årskurs` };
        }
        if (g.key === "prealgebra") {
          const mark = betygMa.get(s.student_id)?.get("VT2026");
          if (mark != null && !goodGrade(mark)) {
            return { gate: g.key, status: "riskzon", detail: `Betyg ${mark === "-" ? "streck" : mark} nu, grindens årskurs` };
          }
        }
      }

      const term = VT_TERMS[yearsBack];
      if (!term) return { gate: g.key, status: "okand" as const, detail: "Äldre än historikfönstret" };

      if (g.key === "prealgebra") {
        const mark = betygMa.get(s.student_id)?.get(term);
        if (mark == null) return { gate: g.key, status: "okand", detail: "Mätpunkt saknas" };
        return goodGrade(mark)
          ? { gate: g.key, status: "klarad", detail: `Betyg ${mark} (åk ${g.gradeDue} VT)` }
          : { gate: g.key, status: "missad", detail: `Betyg ${mark === "-" ? "streck" : mark} (åk ${g.gradeDue} VT)` };
      }
      const level = sourceFor(g.key)?.get(s.student_id)?.get(term);
      if (level == null) return { gate: g.key, status: "okand", detail: "Mätpunkt saknas" };
      return goodLevel(level)
        ? { gate: g.key, status: "klarad", detail: `${LEVEL_TEXT[level]} (åk ${g.gradeDue} VT)` }
        : { gate: g.key, status: "missad", detail: `${LEVEL_TEXT[level]} (åk ${g.gradeDue} VT)` };
    });

    return {
      student_id: s.student_id,
      name: s.name,
      class_id: s.class_id,
      grade_level: s.grade_level,
      gates,
      missed: gates.filter((x) => x.status === "missad").length,
      hasFormalSupport: s.atgardsprogram === 1 || s.utredning_pagaende === 1,
    };
  });
}

export function getGateSummaries(list?: MilestoneStudent[]): GateSummary[] {
  const students = list ?? getMilestoneStudents();
  return GATES.map((g) => {
    const statuses = students.map((s) => s.gates.find((x) => x.gate === g.key)!.status);
    const klarad = statuses.filter((x) => x === "klarad").length;
    const missad = statuses.filter((x) => x === "missad").length;
    return {
      ...g,
      judged: klarad + missad,
      klarad,
      missad,
      riskzon: statuses.filter((x) => x === "riskzon").length,
      okand: statuses.filter((x) => x === "okand").length,
    };
  });
}

/**
 * Arbetslista: elever med minst en missad grind (eller i riskzon), i det
 * åtgärdbara fönstret åk 1–8, värst först. Missad grind + ingen formell
 * stödprocess är den viktigaste kombinationen.
 */
export function getMissedGateStudents(list?: MilestoneStudent[]): MilestoneStudent[] {
  const students = list ?? getMilestoneStudents();
  return students
    .filter((s) => s.grade_level <= 8 && (s.missed > 0 || s.gates.some((g) => g.status === "riskzon")))
    .sort(
      (a, b) =>
        Number(a.hasFormalSupport) - Number(b.hasFormalSupport) ||
        b.missed - a.missed ||
        a.grade_level - b.grade_level ||
        a.name.localeCompare(b.name, "sv-SE"),
    );
}

import "server-only";
import { all } from "./index";
import { CURRENT_TERM, GRADE_MARKS, type GradeMark } from "@/lib/constants";
import { pct } from "@/lib/format";

// ---------------------------------------------------------------------------
// Tidig upptäckt / "Early warning" (förklarbar riskmodell, §4)
//
// Modellen bygger en lista med tydliga signaler per aktiv elev. Varje signal
// har en svensk etikett (med den underliggande siffran) och en poäng. Summan
// av poängen ger en risknivå. Modellen är medvetet enkel och förklarbar – den
// är ett underlag för professionell bedömning, inte en automatisk slutsats.
// ---------------------------------------------------------------------------

const CORE_SUBJECTS = ["Svenska", "Engelska", "Matematik"] as const;

/** Index i betygsskalan A..F,- (lägre = bättre). */
const gradeIndex = (g: string): number => {
  const i = GRADE_MARKS.indexOf(g as GradeMark);
  return i === -1 ? GRADE_MARKS.length - 1 : i;
};

export interface RiskSignal {
  label: string;
  points: number;
}

export type RiskLevel = "Hög" | "Förhöjd" | "Bevaka";

// --- Transparens: modellens regler (samma som logiken nedan). Renderas i vyn
//     så att signalerna är förklarbara och granskningsbara (§ vision: Trust). ---
export const RISK_LEVELS: { level: RiskLevel; min: number; max: number | null; tone: "kritisk" | "uppmarksam" | "info" }[] = [
  { level: "Hög", min: 5, max: null, tone: "kritisk" },
  { level: "Förhöjd", min: 3, max: 4, tone: "uppmarksam" },
  { level: "Bevaka", min: 2, max: 2, tone: "info" },
];

export const RISK_SIGNALS: { name: string; rule: string }[] = [
  { name: "Hög frånvaro", rule: "Total frånvaro ≥ 20 % (3 p) eller ≥ 15 % (2 p)." },
  { name: "Ökande frånvaro", rule: "Senaste 4 veckorna ≥ 8 procentenheter högre än tolvveckorssnittet (2 p)." },
  { name: "Underkänt i kärnämne", rule: "F eller streck i svenska, engelska eller matematik – minst två ämnen (3 p), ett ämne (2 p)." },
  { name: "Underkänt i flera ämnen", rule: "F eller streck i minst tre ämnen totalt (1 p)." },
  { name: "Under förväntad nivå (åk 1–6)", rule: "Stort stödbehov (3 p), minst två områden under nivå (2 p) eller ett område (1 p)." },
  { name: "Provavvikelse", rule: "Nationellt prov minst två betygssteg lägre än terminsbetyget (1 p)." },
  { name: "Låg trivsel/trygghet", rule: "Trygghet ≤ 2 av 4, eller snitt ≤ 2,0 av 4 i trivselenkäten (2 p)." },
  { name: "Saknar åtgärdsprogram", rule: "Tydligt stödbehov men varken åtgärdsprogram eller pågående utredning (1 p)." },
];

/** En enstaka svag signal (1 p) flaggas inte – tröskel för att hamna på listan. */
export const RISK_MIN_FLAG = 2;

export type RiskCategory = "Frånvaro" | "Kunskap" | "Trivsel" | "Stöd";
export const RISK_CATEGORIES: RiskCategory[] = ["Frånvaro", "Kunskap", "Trivsel", "Stöd"];

export interface RiskStudent {
  student_id: string;
  name: string;
  class_id: string;
  grade_level: number;
  score: number;
  level: RiskLevel;
  signals: RiskSignal[];
  action: string;
  categories: RiskCategory[]; // typ av oro – för filtrering/triage
}

export interface EarlyWarningSummary {
  flagged: number;
  hog: number;
  forhojd: number;
  bevaka: number;
  support_gap: number;
}

// --- Rårader från ett fåtal set-baserade frågor (joinas i TS) ---

interface BaseRow {
  student_id: string;
  first_name: string;
  last_name: string;
  class_id: string;
  grade_level: number;
  atgardsprogram: number;
  utredning_pagaende: number;
  days_total: number;
  days_absent: number;
  w4_total: number;
  w4_absent: number;
  w12_total: number;
  w12_absent: number;
}

interface GradeRow { student_id: string; subject: string; grade: GradeMark }
interface NatRow { student_id: string; subject: string; grade: GradeMark }
interface LevelRow { student_id: string; label: string; level: string }

function getBaseRows(): BaseRow[] {
  return all<BaseRow>(
    `select s.student_id, s.first_name, s.last_name, s.class_id, s.grade_level,
       s.atgardsprogram, s.utredning_pagaende,
       va.days_total, va.days_absent,
       va.w4_total, va.w4_absent, va.w12_total, va.w12_absent
     from students s
     join v_student_attendance va on va.student_id = s.student_id
     where s.active = 1`,
  );
}

/**
 * Bygger en lista med flaggade elever sorterad på score (fallande).
 * Endast elever med minst en signal (score > 0) ingår.
 */
export function getEarlyWarnings(): RiskStudent[] {
  const base = getBaseRows();

  // Terminsbetyg åk 7–10
  const grades = all<GradeRow>(
    `select sg.student_id, sg.subject, sg.grade
     from subject_grades sg join students s on s.student_id = sg.student_id
     where sg.term = ? and s.active = 1`,
    CURRENT_TERM,
  );
  const gradesByStudent = new Map<string, GradeRow[]>();
  for (const g of grades) {
    const arr = gradesByStudent.get(g.student_id) ?? [];
    arr.push(g);
    gradesByStudent.set(g.student_id, arr);
  }

  // Nationella prov (terminens)
  const nat = all<NatRow>(
    `select nt.student_id, nt.subject, nt.grade
     from national_tests nt join students s on s.student_id = nt.student_id
     where nt.term = ? and s.active = 1`,
    CURRENT_TERM,
  );
  const natByStudent = new Map<string, NatRow[]>();
  for (const n of nat) {
    const arr = natByStudent.get(n.student_id) ?? [];
    arr.push(n);
    natByStudent.set(n.student_id, arr);
  }

  // LSR (åk 1–4) + skriftliga omdömen (åk 2–6): nivåer i fokus
  const levels = all<LevelRow>(
    `select la.student_id, la.area as label, la.level
       from literacy_numeracy_assessments la join students s on s.student_id = la.student_id
       where la.term = ? and s.active = 1
     union all
     select wa.student_id, wa.subject as label, wa.level
       from written_assessments wa join students s on s.student_id = wa.student_id
       where wa.term = ? and s.active = 1`,
    CURRENT_TERM, CURRENT_TERM,
  );
  const levelsByStudent = new Map<string, LevelRow[]>();
  for (const l of levels) {
    const arr = levelsByStudent.get(l.student_id) ?? [];
    arr.push(l);
    levelsByStudent.set(l.student_id, arr);
  }

  // Trivsel/wellbeing (innevarande termin) – låg trygghet/trivsel är en tidig signal.
  const wb = all<{ student_id: string; trivsel: number; trygghet: number; studiero: number }>(
    `select w.student_id, w.trivsel, w.trygghet, w.studiero
       from wellbeing_surveys w join students s on s.student_id = w.student_id
      where w.term = ? and s.active = 1`,
    CURRENT_TERM,
  );
  const wbByStudent = new Map(wb.map((r) => [r.student_id, r]));

  const result: RiskStudent[] = [];

  for (const b of base) {
    const signals: RiskSignal[] = [];
    const grade = b.grade_level;
    let coreFail = false;
    let rising = false;
    let highAbsence = false;
    let levelAttention = false;
    let strongConcern = false;      // tydlig kunskapsoro (kärnämne F / stort behov) – styr stödgap
    let lowWellbeing = false;

    // --- Frånvaro ---
    const absRate = b.days_total ? b.days_absent / b.days_total : 0;
    if (absRate >= 0.2) {
      signals.push({ label: `Hög frånvaro (${pct(absRate)})`, points: 3 });
      highAbsence = true;
    } else if (absRate >= 0.15) {
      signals.push({ label: `Förhöjd frånvaro (${pct(absRate)})`, points: 2 });
      highAbsence = true;
    }

    // --- Ökande frånvaro ---
    const w4 = b.w4_total ? b.w4_absent / b.w4_total : 0;
    const w12 = b.w12_total ? b.w12_absent / b.w12_total : 0;
    const rise = w4 - w12;
    if (rise >= 0.08) {
      signals.push({
        label: `Frånvaron ökar (+${pct(rise)} senaste 4 v mot 12 v)`,
        points: 2,
      });
      rising = true;
    }

    // --- Kunskapsresultat åk 7–10: underkänt ---
    if (grade >= 7 && grade <= 10) {
      const g = gradesByStudent.get(b.student_id) ?? [];
      const isFail = (m: string) => m === "F" || m === "-";
      const coreFailSubjects = g
        .filter((x) => (CORE_SUBJECTS as readonly string[]).includes(x.subject) && isFail(x.grade))
        .map((x) => x.subject);
      const totalFail = g.filter((x) => isFail(x.grade)).length;

      if (coreFailSubjects.length >= 2) {
        signals.push({ label: `Underkänt (F/streck) i ${coreFailSubjects.join(", ")}`, points: 3 });
        coreFail = true;        strongConcern = true;
      } else if (coreFailSubjects.length === 1) {
        signals.push({ label: `Underkänt (F/streck) i ${coreFailSubjects.join(", ")}`, points: 2 });
        coreFail = true;        strongConcern = true;
      }

      if (totalFail >= 3) {
        signals.push({ label: `Underkänt i ${totalFail} ämnen totalt`, points: 1 });      }

      // --- Provavvikelse: nationellt prov ≥2 steg lägre än betyg i samma ämne ---
      const nats = natByStudent.get(b.student_id) ?? [];
      const devSubjects: string[] = [];
      for (const n of nats) {
        const termGrade = g.find((x) => x.subject === n.subject)?.grade;
        if (!termGrade) continue;
        if (gradeIndex(n.grade) - gradeIndex(termGrade) >= 2) devSubjects.push(n.subject);
      }
      if (devSubjects.length > 0) {
        signals.push({
          label: `Nationellt prov klart lägre än betyg i ${devSubjects.join(", ")}`,
          points: 1,
        });
      }
    }

    // --- Kunskapsresultat åk 1–6: under förväntad nivå ---
    if (grade >= 1 && grade <= 6) {
      const ls = levelsByStudent.get(b.student_id) ?? [];
      const stortBehov = [...new Set(ls.filter((x) => x.level === "stort_behov").map((x) => x.label))];
      const uppmarksam = [...new Set(ls.filter((x) => x.level === "uppmarksam").map((x) => x.label))];
      if (stortBehov.length > 0) {
        signals.push({ label: `Stort stödbehov i ${stortBehov.join(", ")}`, points: 3 });
        levelAttention = true;        strongConcern = true;
      } else if (uppmarksam.length >= 2) {
        signals.push({ label: `Under förväntad nivå i ${uppmarksam.join(", ")}`, points: 2 });
        levelAttention = true;      } else if (uppmarksam.length === 1) {
        signals.push({ label: `Under förväntad nivå i ${uppmarksam[0]}`, points: 1 });
        levelAttention = true;      }
    }

    // --- Trivsel/trygghet (wellbeing) ---
    const w = wbByStudent.get(b.student_id);
    if (w) {
      const avg = (w.trivsel + w.trygghet + w.studiero) / 3;
      if (w.trygghet <= 2) {
        signals.push({ label: `Låg trygghet i trivselenkät (${w.trygghet}/4)`, points: 2 });
        lowWellbeing = true;
      } else if (avg <= 2.0) {
        signals.push({ label: `Låg trivsel i trivselenkät (${avg.toFixed(1)}/4)`, points: 2 });
        lowWellbeing = true;
      }
    }

    // --- Stödgap: tydligt stödbehov men saknar åtgärdsprogram/utredning ---
    const supportGap = strongConcern && b.atgardsprogram === 0 && b.utredning_pagaende === 0;
    if (supportGap) {
      signals.push({ label: "Tecken på stödbehov men saknar åtgärdsprogram", points: 1 });
    }

    // En enstaka svag signal (1 p) flaggas inte – håll listan fokuserad och actionable.
    const score = signals.reduce((s, sig) => s + sig.points, 0);
    if (score <= 1) continue;

    const level: RiskLevel = score >= 5 ? "Hög" : score >= 3 ? "Förhöjd" : "Bevaka";

    // --- Föreslagen nästa åtgärd (efter dominerande signal) ---
    let action: string;
    if (coreFail) {
      action = "Följ upp kunskapsläget och överväg riktat stöd/åtgärdsprogram.";
    } else if (rising || highAbsence) {
      action = "Kontakta vårdnadshavare och kartlägg frånvaroorsaker tillsammans med elevhälsan.";
    } else if (lowWellbeing) {
      action = "Följ upp elevens trygghet och trivsel med mentor och elevhälsa.";
    } else if (supportGap) {
      action = "Utred behov av åtgärdsprogram.";
    } else if (levelAttention) {
      action = "Stäm av med speciallärare om intensifierat stöd.";
    } else {
      action = "Bevaka utvecklingen.";
    }

    const categories: RiskCategory[] = [];
    if (rising || highAbsence) categories.push("Frånvaro");
    if (coreFail || levelAttention) categories.push("Kunskap");
    if (lowWellbeing) categories.push("Trivsel");
    if (supportGap) categories.push("Stöd");

    result.push({
      student_id: b.student_id,
      name: `${b.first_name} ${b.last_name}`,
      class_id: b.class_id,
      grade_level: grade,
      score,
      level,
      signals,
      action,
      categories,
    });
  }

  result.sort((a, b) => b.score - a.score || a.grade_level - b.grade_level || a.name.localeCompare(b.name, "sv-SE"));
  return result;
}

/** Sammanfattande nyckeltal för flaggade elever. */
export function getEarlyWarningSummary(list?: RiskStudent[]): EarlyWarningSummary {
  const flaggade = list ?? getEarlyWarnings();
  return {
    flagged: flaggade.length,
    hog: flaggade.filter((r) => r.level === "Hög").length,
    forhojd: flaggade.filter((r) => r.level === "Förhöjd").length,
    bevaka: flaggade.filter((r) => r.level === "Bevaka").length,
    support_gap: flaggade.filter((r) =>
      r.signals.some((s) => s.label === "Tecken på stödbehov men saknar åtgärdsprogram"),
    ).length,
  };
}

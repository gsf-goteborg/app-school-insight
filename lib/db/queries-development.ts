import "server-only";
import { all } from "./index";
import { LEVELS, MERIT_POINTS, type GradeMark, type Level } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Utveckling och potential (HT2025 → VT2026)
//
// Riskvyerna (Tidig upptäckt, Behörighetsprognos) fångar elever med problem.
// Den här modellen balanserar bilden mot uppdraget "alla ska nå sin fulla
// potential" och lyfter två lätt missade grupper:
//   • Tappar mark – elever som presterar godtagbart men vars resultat sjunker
//     från en god nivå (inte flaggade som risk, men på väg åt fel håll).
//   • Hög nivå (stretch) – elever som ligger högt och kan utmanas mer.
// Samt det positiva: elever som flyttat fram sina positioner. Demodata.
// ---------------------------------------------------------------------------

const LEVEL_ORDER: Record<Level, number> = { over: 0, i_linje: 1, uppmarksam: 2, stort_behov: 3 };
const LEVEL_SHORT: Record<Level, string> = Object.fromEntries(
  LEVELS.map((l) => [l.key, l.short]),
) as Record<Level, string>;
const goodLevel = (l: Level) => l === "over" || l === "i_linje";
const isFailGrade = (g: string) => g === "F" || g === "-";
const goodGrade = (g: string) => g === "A" || g === "B" || g === "C" || g === "D";

export type DevCategory = "positiv" | "tappar" | "stretch" | "stabil";

export interface DevStudent {
  student_id: string;
  name: string;
  class_id: string;
  grade_level: number;
  category: DevCategory;
  /** Mest talande förändring, t.ex. "Matematik: B → D" eller "Läsning: Över → I linje". */
  detail: string;
}

export interface DevelopmentSummary {
  total: number;
  positive_movers: number;
  losing_ground: number;
  stretch: number;
}

interface StudentRow {
  student_id: string;
  first_name: string;
  last_name: string;
  class_id: string;
  grade_level: number;
}
interface LevelPair { sid: string; label: string; term: string; level: Level }
interface GradePair { sid: string; label: string; term: string; grade: GradeMark }

const HT = "HT2025";
const VT = "VT2026";

function classifyAll(): DevStudent[] {
  const students = all<StudentRow>(
    `select student_id, first_name, last_name, class_id, grade_level from students where active = 1`,
  );

  // Nivåer (LSR åk 1–4 + skriftliga omdömen åk 2–6)
  const levelRows = all<LevelPair>(
    `select la.student_id sid, la.area label, la.term, la.level
       from literacy_numeracy_assessments la join students s on s.student_id = la.student_id
      where s.active = 1
     union all
     select wa.student_id sid, wa.subject label, wa.term, wa.level
       from written_assessments wa join students s on s.student_id = wa.student_id
      where s.active = 1`,
  );
  // Betyg (åk 7–10)
  const gradeRows = all<GradePair>(
    `select sg.student_id sid, sg.subject label, sg.term, sg.grade
       from subject_grades sg join students s on s.student_id = sg.student_id
      where s.active = 1`,
  );

  // student -> label -> { ht, vt }
  type Pair<T> = { ht?: T; vt?: T };
  const levelByStudent = new Map<string, Map<string, Pair<Level>>>();
  for (const r of levelRows) {
    const m = levelByStudent.get(r.sid) ?? new Map();
    const p = m.get(r.label) ?? {};
    if (r.term === HT) p.ht = r.level;
    else if (r.term === VT) p.vt = r.level;
    m.set(r.label, p);
    levelByStudent.set(r.sid, m);
  }
  const gradeByStudent = new Map<string, Map<string, Pair<GradeMark>>>();
  for (const r of gradeRows) {
    const m = gradeByStudent.get(r.sid) ?? new Map();
    const p = m.get(r.label) ?? {};
    if (r.term === HT) p.ht = r.grade;
    else if (r.term === VT) p.vt = r.grade;
    m.set(r.label, p);
    gradeByStudent.set(r.sid, m);
  }

  const out: DevStudent[] = [];

  for (const s of students) {
    let improved = 0;
    let declined = 0;
    let currentlyOk = true;
    // "Tappar mark" kräver en TYDLIG nedgång från en god nivå (inte en enstaka brusig
    // poäng), annars fångar slumpmässig terminsvariation en tredjedel av eleverna.
    let sharpDecline: { label: string; from: string; to: string } | null = null;
    let bestImproved: { label: string; from: string; to: string } | null = null;
    let meaningfulUp = false;
    let topMetric = false;

    const levels = levelByStudent.get(s.student_id);
    const grades = gradeByStudent.get(s.student_id);

    if (grades && grades.size > 0) {
      // Betygsbaserat (åk 7–10). Ett betygssteg = 2,5 meritpoäng.
      let meritSum = 0, meritN = 0, lowGrade = false;
      for (const [label, p] of grades) {
        if (p.vt) { meritSum += MERIT_POINTS[p.vt] ?? 0; meritN++; if (isFailGrade(p.vt)) currentlyOk = false; if (!goodGrade(p.vt)) lowGrade = true; }
        if (p.ht && p.vt) {
          const d = (MERIT_POINTS[p.vt] ?? 0) - (MERIT_POINTS[p.ht] ?? 0);
          if (d > 0) { improved++; if (d >= 2.5) meaningfulUp = true; if (!bestImproved && d >= 2.5) bestImproved = { label, from: p.ht, to: p.vt }; }
          else if (d < 0) {
            declined++;
            // tydlig nedgång från god bas: minst två betygssteg ned (≥5 p) från A–C.
            if (!sharpDecline && (p.ht === "A" || p.ht === "B" || p.ht === "C") && d <= -5) {
              sharpDecline = { label, from: p.ht, to: p.vt };
            }
          }
        }
      }
      const avgMerit = meritN ? meritSum / meritN : 0;
      topMetric = currentlyOk && !lowGrade && avgMerit >= 17; // mestadels A/B
    } else if (levels && levels.size > 0) {
      // Nivåbaserat (åk 1–6)
      let overCount = 0, n = 0, belowILinje = false;
      for (const [label, p] of levels) {
        if (p.vt) { n++; if (p.vt === "over") overCount++; if (p.vt === "stort_behov") currentlyOk = false; if (LEVEL_ORDER[p.vt] > LEVEL_ORDER.i_linje) belowILinje = true; }
        if (p.ht && p.vt) {
          const d = LEVEL_ORDER[p.ht] - LEVEL_ORDER[p.vt]; // >0 = förbättring
          if (d > 0) { improved++; meaningfulUp = true; if (!bestImproved) bestImproved = { label, from: LEVEL_SHORT[p.ht], to: LEVEL_SHORT[p.vt] }; }
          else if (d < 0) {
            declined++;
            // tydlig nedgång: minst två nivåer ned från en god nivå (t.ex. Över → Uppmärksammas).
            if (!sharpDecline && goodLevel(p.ht) && LEVEL_ORDER[p.vt] - LEVEL_ORDER[p.ht] >= 2) {
              sharpDecline = { label, from: LEVEL_SHORT[p.ht], to: LEVEL_SHORT[p.vt] };
            }
          }
        }
      }
      topMetric = currentlyOk && !belowILinje && n > 0 && overCount >= Math.ceil(n / 2); // ligger högt
    } else {
      out.push({ student_id: s.student_id, name: `${s.first_name} ${s.last_name}`, class_id: s.class_id, grade_level: s.grade_level, category: "stabil", detail: "" });
      continue;
    }

    let category: DevCategory;
    let detail = "";
    // Tappar mark = tydlig nedgång från god bas OCH en nedåtgående bana totalt
    // (inte en enstaka brusig dipp bland annars stabila/stigande resultat).
    if (currentlyOk && sharpDecline && declined > improved) {
      category = "tappar";
      detail = `${sharpDecline.label}: ${sharpDecline.from} → ${sharpDecline.to}`;
    } else if (topMetric) {
      category = "stretch";
      detail = grades && grades.size > 0 ? "Höga betyg – kan utmanas mer" : "Hög nivå – kan utmanas mer";
    } else if (meaningfulUp && improved > declined && bestImproved) {
      category = "positiv";
      detail = `${bestImproved.label}: ${bestImproved.from} → ${bestImproved.to}`;
    } else {
      category = "stabil";
    }

    out.push({ student_id: s.student_id, name: `${s.first_name} ${s.last_name}`, class_id: s.class_id, grade_level: s.grade_level, category, detail });
  }

  return out;
}

export function getDevelopmentSummary(list?: DevStudent[]): DevelopmentSummary {
  const all = list ?? classifyAll();
  return {
    total: all.length,
    positive_movers: all.filter((d) => d.category === "positiv").length,
    losing_ground: all.filter((d) => d.category === "tappar").length,
    stretch: all.filter((d) => d.category === "stretch").length,
  };
}

/** Elever som tappar mark från en god nivå (lätta att missa – inte flaggade som risk). */
export function getLosingGround(): DevStudent[] {
  return classifyAll()
    .filter((d) => d.category === "tappar")
    .sort((a, b) => b.grade_level - a.grade_level || a.name.localeCompare(b.name, "sv-SE"));
}

/** Elever som ligger högt och kan utmanas mer. */
export function getStretchCandidates(): DevStudent[] {
  return classifyAll()
    .filter((d) => d.category === "stretch")
    .sort((a, b) => a.grade_level - b.grade_level || a.name.localeCompare(b.name, "sv-SE"));
}

export function getDevelopment(): DevStudent[] {
  return classifyAll();
}

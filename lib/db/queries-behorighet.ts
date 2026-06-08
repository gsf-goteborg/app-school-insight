import "server-only";
import { all } from "./index";
import { CURRENT_TERM, type GradeMark } from "@/lib/constants";
import { pct } from "@/lib/format";

// ---------------------------------------------------------------------------
// Behörighetsprognos – sannolikhet för behörighet till yrkesprogram
//
// Kompletterar den regelbaserade "Tidig upptäckt"-modellen med en utfallsnära
// lins: en skattad sannolikhet att eleven når behörighet till gymnasiets
// yrkesprogram, bucketad i Risk 0–3. Modellen är en LOGISTISK modell med
// HANDSATTA koefficienter (illustrativ på demodata – det finns ingen historik
// att träna på i demon). Den efterliknar skolans egna riskrapport.
//
// Starkaste faktorerna (enligt skolans modell): betyg/omdömen i svenska,
// engelska och matematik, samt närvaro. Svaga resultat i lägre årskurser väger
// lättare än nära slutåret – eleverna har mer tid att förbättra sig
// (tidsdiskontering per årskurs). I slutåret (åk 10) används den FAKTISKA
// behörigheten (godkänt i sv/en/ma + minst 8 ämnen totalt).
// ---------------------------------------------------------------------------

const CORE_SUBJECTS = ["Svenska", "Engelska", "Matematik"] as const;
/** Behörighet yrkesprogram: godkänt i sv/en/ma + minst 8 ämnen totalt. */
const REQUIRED_TOTAL_GODKANT = 8;
const REQUIRED_EXTRA_GODKANT = REQUIRED_TOTAL_GODKANT - CORE_SUBJECTS.length; // 5

const isGodkant = (g: string) => g !== "F" && g !== "-" && g !== "";

// --- Modellparametrar (exponerade för granskning i vyn – Trust) ---
export const BEHORIGHET_BASE_LOGIT = 2.2; // ~90 % utgångssannolikhet utan svaga signaler

/** Tidsdiskontering: hur tungt svaga signaler väger, per årskurs (10 = slutåret). */
export const BEHORIGHET_DISCOUNT: Record<number, number> = {
  10: 1.0, 9: 0.85, 8: 0.68, 7: 0.52, 6: 0.35, 5: 0.25, 4: 0.18,
};

/** Vikter (logodds-avdrag) per signal innan tidsdiskontering. */
export const BEHORIGHET_WEIGHTS = {
  coreFail: 3.0,        // F/streck i ett kärnämne (åk 7–10) – starkast, nära slutbetyg
  coreBorderline: 0.6,  // E i ett kärnämne (åk 7–10)
  breadthMissing: 1.1,  // per ämne som saknas för att nå 8 godkända (åk 7–10)
  coreWeakLevel: 1.8,   // stort stödbehov i ett kärnämne (åk 4–6) – mildare än ett betygs-F
  coreWeakBorderline: 0.4, // "uppmärksammas" i ett kärnämne (åk 4–6)
  weakOther: 0.4,       // per icke-kärnämne under godtagbar nivå (åk 4–6)
  attnPerPoint: 12,     // multiplikator på (0,90 − närvarograd) när närvaron är låg
  attnCap: 2.0,         // tak för närvaroavdraget
} as const;

export type RiskBucket = 0 | 1 | 2 | 3;
export const BEHORIGHET_BUCKETS: {
  bucket: RiskBucket;
  label: string;
  min: number; // sannolikhet ≥ min
  max: number; // och < max
  tone: "positiv" | "info" | "uppmarksam" | "kritisk";
  desc: string;
}[] = [
  { bucket: 3, label: "Risk 3", min: 0.0, max: 0.4, tone: "kritisk", desc: "0–40 % sannolikhet" },
  { bucket: 2, label: "Risk 2", min: 0.4, max: 0.8, tone: "uppmarksam", desc: "40–80 %" },
  { bucket: 1, label: "Risk 1", min: 0.8, max: 0.9, tone: "info", desc: "80–90 %" },
  { bucket: 0, label: "Risk 0", min: 0.9, max: 1.01, tone: "positiv", desc: "över 90 %" },
];

export function bucketFor(p: number): RiskBucket {
  return (BEHORIGHET_BUCKETS.find((b) => p >= b.min && p < b.max)?.bucket ?? 0) as RiskBucket;
}
export function bucketMeta(bucket: RiskBucket) {
  return BEHORIGHET_BUCKETS.find((b) => b.bucket === bucket)!;
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export interface BehorighetForecast {
  student_id: string;
  name: string;
  class_id: string;
  grade_level: number;
  probability: number;
  bucket: RiskBucket;
  /** Faktorer som drar ned sannolikheten (förklarbarhet). */
  factors: string[];
  /** Endast slutåret (åk 10): uppfyller de faktiska behörighetskraven nu. */
  meetsRequirements: boolean | null;
}

interface BaseRow {
  student_id: string;
  first_name: string;
  last_name: string;
  class_id: string;
  grade_level: number;
  days_total: number;
  days_absent: number;
}
interface GradeRow { student_id: string; subject: string; grade: GradeMark }
interface LevelRow { student_id: string; subject: string; level: string }

/**
 * Behörighetsprognos per elev (åk 4–10), sorterad på högst risk (lägst sannolikhet) först.
 */
export function getBehorighetForecasts(): BehorighetForecast[] {
  const base = all<BaseRow>(
    `select s.student_id, s.first_name, s.last_name, s.class_id, s.grade_level,
       va.days_total, va.days_absent
     from students s
     join v_student_attendance va on va.student_id = s.student_id
     where s.active = 1 and s.grade_level between 4 and 10`,
  );

  const grades = all<GradeRow>(
    `select sg.student_id, sg.subject, sg.grade
     from subject_grades sg join students s on s.student_id = sg.student_id
     where sg.term = ? and s.active = 1 and s.grade_level between 7 and 10`,
    CURRENT_TERM,
  );
  const gradesByStudent = new Map<string, GradeRow[]>();
  for (const g of grades) {
    const arr = gradesByStudent.get(g.student_id) ?? [];
    arr.push(g);
    gradesByStudent.set(g.student_id, arr);
  }

  const levels = all<LevelRow>(
    `select wa.student_id, wa.subject, wa.level
       from written_assessments wa join students s on s.student_id = wa.student_id
      where wa.term = ? and s.active = 1 and s.grade_level between 4 and 6`,
    CURRENT_TERM,
  );
  const levelsByStudent = new Map<string, LevelRow[]>();
  for (const l of levels) {
    const arr = levelsByStudent.get(l.student_id) ?? [];
    arr.push(l);
    levelsByStudent.set(l.student_id, arr);
  }

  const W = BEHORIGHET_WEIGHTS;
  const result: BehorighetForecast[] = [];

  for (const b of base) {
    const grade = b.grade_level;
    const attnRate = b.days_total ? (b.days_total - b.days_absent) / b.days_total : 1;
    const factors: string[] = [];

    let penalty = 0;
    let meetsRequirements: boolean | null = null;

    if (grade >= 7) {
      // --- Betygsbaserat (åk 7–10) ---
      const g = gradesByStudent.get(b.student_id) ?? [];
      const coreFails = g.filter(
        (x) => (CORE_SUBJECTS as readonly string[]).includes(x.subject) && !isGodkant(x.grade),
      );
      const coreBorderline = g.filter(
        (x) => (CORE_SUBJECTS as readonly string[]).includes(x.subject) && x.grade === "E",
      );
      const coreGodkant = CORE_SUBJECTS.length - coreFails.length;
      const totalGodkant = g.filter((x) => isGodkant(x.grade)).length;
      const extraGodkant = totalGodkant - coreGodkant;
      const extraShortfall = Math.max(0, REQUIRED_EXTRA_GODKANT - extraGodkant);

      penalty += coreFails.length * W.coreFail;
      penalty += coreBorderline.length * W.coreBorderline;
      penalty += extraShortfall * W.breadthMissing;

      if (coreFails.length > 0) factors.push(`F/streck i ${coreFails.map((x) => x.subject).join(", ")}`);
      if (totalGodkant < REQUIRED_TOTAL_GODKANT)
        factors.push(`${totalGodkant} av ${REQUIRED_TOTAL_GODKANT} ämnen godkända`);
      else if (coreBorderline.length > 0)
        factors.push(`Endast E i ${coreBorderline.map((x) => x.subject).join(", ")}`);

      meetsRequirements =
        grade === 10 && coreFails.length === 0 && totalGodkant >= REQUIRED_TOTAL_GODKANT;
    } else {
      // --- Omdömesbaserat (åk 4–6) ---
      const ls = levelsByStudent.get(b.student_id) ?? [];
      const coreStort = ls.filter(
        (x) => (CORE_SUBJECTS as readonly string[]).includes(x.subject) && x.level === "stort_behov",
      );
      const coreUppm = ls.filter(
        (x) => (CORE_SUBJECTS as readonly string[]).includes(x.subject) && x.level === "uppmarksam",
      );
      const otherWeak = ls.filter(
        (x) =>
          !(CORE_SUBJECTS as readonly string[]).includes(x.subject) &&
          (x.level === "stort_behov" || x.level === "uppmarksam"),
      );

      penalty += coreStort.length * W.coreWeakLevel;
      penalty += coreUppm.length * W.coreWeakBorderline;
      penalty += otherWeak.length * W.weakOther;

      if (coreStort.length > 0) factors.push(`Stort stödbehov i ${coreStort.map((x) => x.subject).join(", ")}`);
      if (coreUppm.length > 0) factors.push(`Under nivå i ${coreUppm.map((x) => x.subject).join(", ")}`);
    }

    // --- Närvaro (gemensam faktor) ---
    if (attnRate < 0.9) {
      penalty += Math.min(W.attnCap, (0.9 - attnRate) * W.attnPerPoint);
      factors.push(`Låg närvaro (${pct(attnRate)})`);
    }

    // --- Sannolikhet ---
    let probability: number;
    if (grade === 10) {
      // Slutåret: faktisk behörighet styr (godkänt sv/en/ma + ≥8 ämnen).
      probability = meetsRequirements
        ? clamp(0.92 + 0.01 * (10 - penalty), 0.9, 0.99)
        : clamp(0.4 - 0.05 * penalty, 0.05, 0.39);
    } else {
      const discount = BEHORIGHET_DISCOUNT[grade] ?? 0.3;
      probability = sigmoid(BEHORIGHET_BASE_LOGIT - discount * penalty);
    }
    probability = Math.round(probability * 1000) / 1000;

    result.push({
      student_id: b.student_id,
      name: `${b.first_name} ${b.last_name}`,
      class_id: b.class_id,
      grade_level: grade,
      probability,
      bucket: bucketFor(probability),
      factors,
      meetsRequirements,
    });
  }

  result.sort(
    (a, b) =>
      a.probability - b.probability ||
      b.grade_level - a.grade_level ||
      a.name.localeCompare(b.name, "sv-SE"),
  );
  return result;
}

export interface BehorighetSummary {
  total: number;
  risk3: number;
  risk2: number;
  risk1: number;
  risk0: number;
  /** Elever i riskzon (Risk 2 + 3, dvs under 80 % sannolikhet). */
  at_risk: number;
}
export function getBehorighetSummary(list?: BehorighetForecast[]): BehorighetSummary {
  const f = list ?? getBehorighetForecasts();
  const count = (bk: RiskBucket) => f.filter((x) => x.bucket === bk).length;
  const risk3 = count(3);
  const risk2 = count(2);
  return {
    total: f.length,
    risk3,
    risk2,
    risk1: count(1),
    risk0: count(0),
    at_risk: risk3 + risk2,
  };
}

/** Behörighetsprognos för en enskild elev (eller null om utanför åk 4–10). */
export function getBehorighetForStudent(studentId: string): BehorighetForecast | null {
  return getBehorighetForecasts().find((f) => f.student_id === studentId) ?? null;
}

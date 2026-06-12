import "server-only";
import { all } from "./index";

// ---------------------------------------------------------------------------
// Frånvaroprognos (illustrativ, transparent)
//
// Två prognoser per elev, inspirerade av förvaltningens ML-prototyp
// (app-predict-absence: daglig + kronisk risk med SHAP-förklaringar) men
// medvetet implementerad som en ADDITIV modell med handsatta, exponerade
// vikter: varje elevs prognos kan förklaras EXAKT som en summa av bidrag
// (Trust-principen) – ingen svart låda i demon. Viktiga kalibreringsval:
//   • Daglig risk uttrycks som FÖRVÄNTADE FRÅNVARODAGAR NÄSTA VECKA (0–5),
//     inte rå procent – "Låg 29 %" misläses, "≈1 av 5 dagar" gör det inte.
//   • Basen är elevens egen rullande frånvaro – modellen redovisar öppet att
//     den slår baslinjen endast via förändringssignalerna (trend, pågående
//     frånvaro, veckodagsmönster, flerårsdrift).
// Demodata. I skarp drift ersätts detta av batch-scoring (nattligt jobb).
// ---------------------------------------------------------------------------

export const PROGNOS_WEIGHTS = {
  veckodag: 0.5,      // andel av elevens veckodagsavvikelse som räknas
  trend: 0.6,         // vikt på ökningen senaste 4 v mot 12 v
  pagaende: 0.15,     // tillägg om eleven var frånvarande senaste skoldagen
  trygghet: 0.03,     // tillägg vid låg trygghet (≤2/4)
} as const;

/** Kronisk risk: logistisk modell, logit = BAS + summan av bidragen nedan. */
export const KRONISK_WEIGHTS = {
  bas: -3.4,          // ~3 % utgångsrisk vid noll frånvaro
  niva: 16,           // × frånvaroandel senaste 4 veckorna
  trend: 8,           // × ökningen (4 v mot 12 v, endast positiv)
  drift: 20,          // × flerårsdriften per termin (endast positiv)
  ogiltig: 0.8,       // × andelen ogiltig frånvaro av frånvaron
  trygghet: 0.5,      // tillägg vid låg trygghet (≤2/4)
} as const;

export type KroniskBucket = "Hög" | "Förhöjd" | "Låg";
export const KRONISK_BUCKETS: { bucket: KroniskBucket; min: number; tone: "kritisk" | "uppmarksam" | "positiv" }[] = [
  { bucket: "Hög", min: 0.5, tone: "kritisk" },
  { bucket: "Förhöjd", min: 0.25, tone: "uppmarksam" },
  { bucket: "Låg", min: 0, tone: "positiv" },
];

export interface PrognosFactor {
  label: string;
  /** Bidrag: procentenheter (daglig) respektive logit-enheter (kronisk). */
  contribution: number;
}

export interface AbsenceForecast {
  student_id: string;
  name: string;
  class_id: string;
  grade_level: number;
  /** Förväntade frånvarodagar nästa skolvecka (0–5). */
  expectedDays: number;
  /** Elevens bas: frånvaroandel senaste 4 veckorna. */
  baseRate: number;
  chronicP: number;
  chronicBucket: KroniskBucket;
  /** Exakta bidrag till den kroniska logiten (för förklaringsstapeln). */
  chronicFactors: PrognosFactor[];
  /** Vad som lyfter veckoprognosen utöver basen. */
  weekFactors: PrognosFactor[];
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function getAbsenceForecasts(): AbsenceForecast[] {
  const base = all<{
    student_id: string; name: string; class_id: string; grade_level: number;
    days_total: number; days_absent: number; days_invalid: number;
    w4_total: number; w4_absent: number; w12_total: number; w12_absent: number;
  }>(
    `select s.student_id, (s.first_name || ' ' || s.last_name) name, s.class_id, s.grade_level,
       va.days_total, va.days_absent, va.days_invalid,
       va.w4_total, va.w4_absent, va.w12_total, va.w12_absent
     from students s join v_student_attendance va on va.student_id = s.student_id
     where s.active = 1`,
  );

  // Veckodagsprofil per elev (mån–fre), läsåret hittills.
  const dowRows = all<{ student_id: string; dow: number; total: number; absent: number }>(
    `select student_id, cast(strftime('%u', date) as integer) dow,
       count(*) total,
       sum(case when status in ('valid_absence','invalid_absence') then 1 else 0 end) absent
     from attendance_records group by student_id, dow`,
  );
  const dowByStudent = new Map<string, Map<number, number>>();
  for (const r of dowRows) {
    const m = dowByStudent.get(r.student_id) ?? new Map();
    m.set(r.dow, r.total ? r.absent / r.total : 0);
    dowByStudent.set(r.student_id, m);
  }

  // Frånvarande senaste skoldagen (demo-idag, fredag 15 maj)?
  const lastDay = new Set(
    all<{ student_id: string }>(
      `select student_id from attendance_records
       where date = '2026-05-15' and status in ('valid_absence','invalid_absence')`,
    ).map((r) => r.student_id),
  );

  // Flerårsdrift: lutning i frånvaroandel per termin (terminshistoriken).
  const drift = new Map<string, number>();
  {
    const rows = all<{ student_id: string; term: string; rate: number }>(
      `select student_id, term, cast(days_absent as real) / nullif(days_total, 0) rate
       from attendance_term_history`,
    );
    const TERM_IDX: Record<string, number> = {
      HT2022: 0, VT2023: 1, HT2023: 2, VT2024: 3, HT2024: 4, VT2025: 5,
    };
    const byStudent = new Map<string, { x: number; y: number }[]>();
    for (const r of rows) {
      const x = TERM_IDX[r.term];
      if (x == null || r.rate == null) continue;
      const arr = byStudent.get(r.student_id) ?? [];
      arr.push({ x, y: r.rate });
      byStudent.set(r.student_id, arr);
    }
    for (const [sid, pts] of byStudent) {
      if (pts.length < 4) continue;
      const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const my = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      let num = 0, den = 0;
      for (const p of pts) {
        num += (p.x - mx) * (p.y - my);
        den += (p.x - mx) * (p.x - mx);
      }
      drift.set(sid, den ? num / den : 0);
    }
  }

  // Låg trygghet (innevarande termin).
  const lowTrygg = new Set(
    all<{ student_id: string }>(
      `select student_id from wellbeing_surveys where term = 'VT2026' and trygghet <= 2`,
    ).map((r) => r.student_id),
  );

  const W = PROGNOS_WEIGHTS;
  const K = KRONISK_WEIGHTS;

  return base
    .map((b) => {
      const overall = b.days_total ? b.days_absent / b.days_total : 0;
      const rate4 = b.w4_total ? b.w4_absent / b.w4_total : overall;
      const rate12 = b.w12_total ? b.w12_absent / b.w12_total : overall;
      const rise = Math.max(0, rate4 - rate12);
      const dows = dowByStudent.get(b.student_id);
      const absentLast = lastDay.has(b.student_id);
      const trygg = lowTrygg.has(b.student_id);
      const ogiltigShare = b.days_absent ? b.days_invalid / b.days_absent : 0;
      const slope = Math.max(0, drift.get(b.student_id) ?? 0);

      // --- Förväntade dagar nästa vecka: per veckodag, exakt additivt ---
      const weekFactors: PrognosFactor[] = [];
      let expected = 0;
      let dowLift = 0;
      for (let d = 1; d <= 5; d++) {
        const dowRate = dows?.get(d) ?? overall;
        const dowAdj = W.veckodag * (dowRate - overall);
        dowLift += dowAdj;
        const streakAdj = d === 1 && absentLast ? W.pagaende : 0;
        expected += clamp(rate4 + dowAdj + W.trend * rise + streakAdj + (trygg ? W.trygghet : 0), 0, 0.95);
      }
      if (rise > 0.005) weekFactors.push({ label: "Frånvaron ökar (4 v mot 12 v)", contribution: W.trend * rise * 5 });
      if (absentLast) weekFactors.push({ label: "Frånvarande senaste skoldagen", contribution: W.pagaende });
      if (Math.abs(dowLift) > 0.02) weekFactors.push({ label: "Veckodagsmönster", contribution: dowLift });
      if (trygg) weekFactors.push({ label: "Låg trygghet i enkäten", contribution: W.trygghet * 5 });

      // --- Kronisk risk: exakta logit-bidrag ---
      const chronicFactors: PrognosFactor[] = [
        { label: `Frånvaronivå senaste 4 v (${Math.round(rate4 * 100)} %)`, contribution: K.niva * rate4 },
      ];
      if (rise > 0.005) chronicFactors.push({ label: "Ökande trend", contribution: K.trend * rise });
      if (slope > 0.001) chronicFactors.push({ label: "Frånvaron har vuxit över läsåren", contribution: K.drift * slope });
      if (ogiltigShare > 0.3) chronicFactors.push({ label: `Hög andel ogiltig frånvaro (${Math.round(ogiltigShare * 100)} %)`, contribution: K.ogiltig * ogiltigShare });
      if (trygg) chronicFactors.push({ label: "Låg trygghet i enkäten", contribution: K.trygghet });

      const z = K.bas + chronicFactors.reduce((s, f) => s + f.contribution, 0);
      const chronicP = sigmoid(z);
      const chronicBucket = KRONISK_BUCKETS.find((x) => chronicP >= x.min)!.bucket;

      return {
        student_id: b.student_id,
        name: b.name,
        class_id: b.class_id,
        grade_level: b.grade_level,
        expectedDays: Math.round(expected * 10) / 10,
        baseRate: rate4,
        chronicP: Math.round(chronicP * 1000) / 1000,
        chronicBucket,
        chronicFactors,
        weekFactors,
      };
    })
    .sort((a, b) => b.expectedDays - a.expectedDays || b.chronicP - a.chronicP);
}

export function getAbsenceForecastFor(studentId: string): AbsenceForecast | null {
  return getAbsenceForecasts().find((f) => f.student_id === studentId) ?? null;
}

export interface PrognosSummary {
  hog: number;
  forhojd: number;
  /** Elever med ≥1,5 förväntade frånvarodagar nästa vecka. */
  heavyWeek: number;
}

export function getPrognosSummary(list?: AbsenceForecast[]): PrognosSummary {
  const rows = list ?? getAbsenceForecasts();
  return {
    hog: rows.filter((r) => r.chronicBucket === "Hög").length,
    forhojd: rows.filter((r) => r.chronicBucket === "Förhöjd").length,
    heavyWeek: rows.filter((r) => r.expectedDays >= 1.5).length,
  };
}

// Genererade svenska elevanalyser. Rena funktioner – matas med elevens
// faktiska data och returnerar text. All demodata är fiktiv och ska tolkas
// varsamt (se försiktighetsnoten på elevsidan).

import { MERIT_POINTS, type GradeMark, type Level } from "@/lib/constants";
import { pct } from "@/lib/format";

// ---------------------------------------------------------------------------
// Trendberäkning HT2025 → VT2026
// ---------------------------------------------------------------------------
export type Trend = "positiv" | "negativ" | "neutral" | "saknas";

/** Nivåordning: lägre index = bättre. */
const LEVEL_ORDER: Record<Level, number> = {
  over: 0,
  i_linje: 1,
  uppmarksam: 2,
  stort_behov: 3,
};

/** Trend mellan två nivåer (LSR/skriftliga omdömen). */
export function levelTrend(ht: Level | undefined, vt: Level | undefined): Trend {
  if (!ht || !vt) return "saknas";
  const d = LEVEL_ORDER[ht] - LEVEL_ORDER[vt]; // positivt = förbättring (lägre index på VT)
  if (d > 0) return "positiv";
  if (d < 0) return "negativ";
  return "neutral";
}

/** Trend mellan två betyg via meritpoäng (högre = bättre). */
export function gradeTrend(ht: GradeMark | undefined, vt: GradeMark | undefined): Trend {
  if (!ht || !vt) return "saknas";
  const d = (MERIT_POINTS[vt] ?? 0) - (MERIT_POINTS[ht] ?? 0);
  if (d > 0) return "positiv";
  if (d < 0) return "negativ";
  return "neutral";
}

export const TREND_LABEL: Record<Trend, string> = {
  positiv: "Positiv",
  negativ: "Negativ",
  neutral: "Oförändrad",
  saknas: "Data saknas",
};

// ---------------------------------------------------------------------------
// Hjälpare för svensk uppräkning ("Svenska, Matematik och Engelska")
// ---------------------------------------------------------------------------
function joinSv(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} och ${items[items.length - 1]}`;
}

// ---------------------------------------------------------------------------
// Betygsstycke (åk 7–10)
// ---------------------------------------------------------------------------
export interface GradeInput {
  term: string; // etikett för aktuell termin, t.ex. "vårterminen 2026"
  /** Betyg aktuell termin per ämne. */
  current: { subject: string; grade: GradeMark }[];
  /** Trend per ämne HT → VT. */
  trends: { subject: string; trend: Trend }[];
  meritValue: number;
}

export function gradeParagraph(g: GradeInput): string {
  const n = g.current.length;
  if (n === 0) {
    return `Eleven har inga betygssatta ämnen registrerade för ${g.term}.`;
  }
  const passing = g.current.filter((x) => ["A", "B", "C", "D", "E"].includes(x.grade));
  const failing = g.current.filter((x) => x.grade === "F" || x.grade === "-");
  const m = passing.length;

  let s = `Eleven har ${n} betygssatta ämnen från ${g.term}, varav ${m} har betyg A–E. `;
  if (failing.length === 0) {
    s += `Eleven har godkända betyg i alla ämnen. `;
  } else {
    const failSubs = joinSv(failing.map((x) => x.subject));
    s += `Eleven saknar godkänt betyg i ${failing.length === 1 ? "ämnet" : "ämnena"} ${failSubs}. `;
  }
  s += `Meritvärdet uppgår till ${g.meritValue.toLocaleString("sv-SE")} poäng. `;

  const up = g.trends.filter((t) => t.trend === "positiv").map((t) => t.subject);
  const down = g.trends.filter((t) => t.trend === "negativ").map((t) => t.subject);
  if (up.length > 0 && down.length > 0) {
    s += `Sett över terminerna syns en positiv utveckling i ${joinSv(up)}, medan ${joinSv(down)} visar en nedåtgående trend.`;
  } else if (up.length > 0) {
    s += `Sett över terminerna syns en positiv utveckling i ${joinSv(up)}.`;
  } else if (down.length > 0) {
    s += `Sett över terminerna syns en nedåtgående trend i ${joinSv(down)}.`;
  } else {
    s += `Resultaten är i huvudsak oförändrade mellan terminerna.`;
  }
  return s;
}

// ---------------------------------------------------------------------------
// Kunskapsstycke åk 1–6 (LSR och/eller skriftliga omdömen)
// ---------------------------------------------------------------------------
export interface KnowledgeInput {
  term: string;
  /** Bedömningar aktuell termin: etikett + nivå. */
  current: { label: string; level: Level }[];
  trends: { label: string; trend: Trend }[];
  /** "läsa, skriva och räkna" eller "skriftliga omdömen". */
  kind: "lsr" | "written" | "both";
}

export function knowledgeParagraph(k: KnowledgeInput): string {
  const n = k.current.length;
  const what =
    k.kind === "lsr"
      ? "bedömningar i läsa, skriva och räkna"
      : k.kind === "written"
        ? "skriftliga omdömen"
        : "bedömningar i läsa, skriva och räkna samt skriftliga omdömen";
  if (n === 0) {
    return `Det finns inga ${what} registrerade för ${k.term}.`;
  }
  const onTrack = k.current.filter((x) => x.level === "over" || x.level === "i_linje").length;
  const attention = k.current.filter((x) => x.level === "uppmarksam" || x.level === "stort_behov");

  let s = `Eleven har ${n} ${what} från ${k.term}, varav ${onTrack} ligger i linje med eller över förväntad progression. `;
  if (attention.length === 0) {
    s += `Inget område bedöms behöva särskild uppmärksamhet. `;
  } else {
    s += `${attention.length === 1 ? "Ett område" : `${attention.length} områden`} (${joinSv(attention.map((x) => x.label))}) bedöms behöva uppmärksammas. `;
  }

  const up = k.trends.filter((t) => t.trend === "positiv").map((t) => t.label);
  const down = k.trends.filter((t) => t.trend === "negativ").map((t) => t.label);
  if (up.length > 0 && down.length > 0) {
    s += `Mellan terminerna syns framsteg i ${joinSv(up)}, medan ${joinSv(down)} visar en nedåtgående trend.`;
  } else if (up.length > 0) {
    s += `Mellan terminerna syns framsteg i ${joinSv(up)}.`;
  } else if (down.length > 0) {
    s += `Mellan terminerna syns en nedåtgående trend i ${joinSv(down)}.`;
  } else {
    s += `Bedömningarna är i huvudsak oförändrade mellan terminerna.`;
  }
  return s;
}

// ---------------------------------------------------------------------------
// Närvaro-/frånvarostycke
// ---------------------------------------------------------------------------
export interface AttendanceInput {
  absenceRate: number; // 0..1, läsåret hittills
  /** w4 - w12 (positivt = ökande frånvaro). */
  rise: number;
}

export function attendanceParagraph(a: AttendanceInput): string {
  let s = `Elevens totala frånvaro under läsåret uppgår till ${pct(a.absenceRate, 1)} (giltig och ogiltig sammantaget). `;
  if (a.absenceRate >= 0.2) {
    s += `Det är en hög frånvaronivå som bör följas upp. `;
  } else if (a.absenceRate >= 0.1) {
    s += `Det är en frånvaronivå värd att uppmärksamma. `;
  } else {
    s += `Det är en låg frånvaronivå. `;
  }
  if (a.rise > 0.02) {
    s += `Frånvaron har ökat de senaste fyra veckorna jämfört med de senaste tolv (${pct(a.rise, 1)} högre), vilket är en utveckling att hålla under uppsikt.`;
  } else if (a.rise < -0.01) {
    s += `Frånvaron har minskat de senaste fyra veckorna jämfört med de senaste tolv (${pct(-a.rise, 1)} lägre).`;
  } else {
    s += `Frånvaron har varit stabil de senaste veckorna.`;
  }
  return s;
}

// ---------------------------------------------------------------------------
// Trivsel-/wellbeingstycke
// ---------------------------------------------------------------------------
export interface WellbeingInput {
  trivsel: number;
  trygghet: number;
  studiero: number;
  avg: number;
  trend: number | null; // förändring i snitt sedan föregående mätning
}

export function wellbeingParagraph(w: WellbeingInput | null): string {
  if (!w) return "";
  let s = `I trivselenkäten skattar eleven trivsel ${w.trivsel}/4, trygghet ${w.trygghet}/4 och arbetsro ${w.studiero}/4. `;
  const low: string[] = [];
  if (w.trygghet <= 2) low.push("trygghet");
  if (w.trivsel <= 2) low.push("trivsel");
  if (w.studiero <= 2) low.push("arbetsro");
  if (low.length > 0) {
    s += `Den låga skattningen av ${joinSv(low)} är en tidig signal som bör följas upp tillsammans med eleven. `;
  } else {
    s += `Skattningarna ligger på en god nivå. `;
  }
  if (w.trend != null) {
    if (w.trend <= -0.5) s += "Trivseln har sjunkit sedan föregående mätning.";
    else if (w.trend >= 0.5) s += "Trivseln har stigit sedan föregående mätning.";
    else s += "Trivseln är i stort oförändrad sedan föregående mätning.";
  }
  return s.trim();
}

// ---------------------------------------------------------------------------
// Stödinsatsstycke
// ---------------------------------------------------------------------------
export interface SupportInput {
  extra_anpassning: number;
  atgardsprogram: number;
  utredning_pagaende: number;
}

export function supportParagraph(sup: SupportInput): string {
  const parts: string[] = [];
  if (sup.atgardsprogram) {
    parts.push("Eleven har ett upprättat åtgärdsprogram, vilket innebär att skolan beslutat om särskilt stöd.");
  } else if (sup.extra_anpassning) {
    parts.push("Eleven får extra anpassningar inom ramen för den ordinarie undervisningen, men har inget upprättat åtgärdsprogram.");
  } else {
    parts.push("Eleven har varken extra anpassningar eller åtgärdsprogram registrerade.");
  }
  if (sup.utredning_pagaende) {
    parts.push("En utredning av elevens behov av särskilt stöd pågår.");
  }
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Sammansatt analys
// ---------------------------------------------------------------------------
export function buildNarrative(paragraphs: string[]): string[] {
  return paragraphs.filter((p) => p.trim().length > 0);
}

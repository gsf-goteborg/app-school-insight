import "server-only";
import { DEMO_TODAY, STADIA, stadiumForGrade, type Stadium } from "@/lib/constants";
import { getGradeOverview, type AttentionLevel } from "./queries-overview";
import { getArbetslagAlignment } from "./queries-alignment";
import { getBehorighetForecasts, getBehorighetSummary } from "./queries-behorighet";
import { getLosingGround } from "./queries-development";
import { getEarlyWarningSummary } from "./queries-risk";
import { getPriorityStudents, getPrioritySummary } from "./queries-priority";
import { getUtredningsskuld } from "./queries-summary";
import { getEconomyTotals, listInterventions, type Intervention } from "./queries-resources";
import { getHrSummary } from "./queries-hr";

// ---------------------------------------------------------------------------
// Ledningsöversikt – skolledarens kontrollvy
//
// Samlar det skolledaren behöver agera på (åtgärdskö med direktlänkar), läget
// per stadium (behov mot resurser) och uppföljningsdisciplinen i insatsarbetet.
// Bygger helt på de befintliga modellerna – inga nya bedömningar. Demodata.
// ---------------------------------------------------------------------------

export type ActionTone = "kritisk" | "uppmarksam" | "positiv" | "info";

export interface ActionItem {
  label: string;
  value: string;
  desc: string;
  href: string;
  tone: ActionTone;
}

/** Åtgärdskön: de viktigaste sakerna att agera på just nu, med länk till respektive vy. */
export function getActionQueue(): ActionItem[] {
  const warning = getEarlyWarningSummary();
  const priority = getPrioritySummary(getPriorityStudents());
  const skuld = getUtredningsskuld();
  const behorighet = getBehorighetSummary();
  const { overdue } = getInsatsUppfoljning();
  const economy = getEconomyTotals();
  const hr = getHrSummary();
  const deviation = economy.full_year_forecast - economy.full_year_budget;
  const deviationShare = economy.full_year_budget ? deviation / economy.full_year_budget : 0;

  return [
    {
      label: "Elever med hög risk",
      value: String(warning.hog),
      desc: "starkaste tidiga signalerna – bör hanteras av elevhälsan nu",
      href: "/tidig-upptackt",
      tone: warning.hog > 0 ? "kritisk" : "positiv",
    },
    {
      label: "Flera linser utan stödprocess",
      value: String(priority.multiNoFormal),
      desc: "fångas av minst två linser men saknar åtgärdsprogram och utredning",
      href: "/prioritera",
      tone: priority.multiNoFormal > 0 ? "kritisk" : "positiv",
    },
    {
      label: "Utredningsskuld",
      value: String(skuld.no_action),
      desc: "ihållande svårigheter utan formell stödprocess",
      href: "/analys",
      tone: skuld.no_action > 20 ? "uppmarksam" : "info",
    },
    {
      label: "Risk 3 – behörighet",
      value: String(behorighet.risk3),
      desc: "under 40 % skattad sannolikhet för gymnasiebehörighet",
      href: "/behorighet",
      tone: behorighet.risk3 > 0 ? "kritisk" : "positiv",
    },
    {
      label: "Insatser med passerad uppföljning",
      value: String(overdue.length),
      desc: "uppföljningsdatum har passerat utan avslut",
      href: "/insatser",
      tone: overdue.length > 0 ? "uppmarksam" : "positiv",
    },
    {
      label: "Prognosavvikelse helår",
      value: `${deviation >= 0 ? "+" : "−"}${Math.round(Math.abs(deviation) / 1000)} tkr`,
      desc: `${(deviationShare * 100).toFixed(1).replace(".", ",")} % mot budget`,
      href: "/ekonomi",
      tone: deviationShare > 0.02 ? "uppmarksam" : deviation > 0 ? "info" : "positiv",
    },
    {
      label: "Sjukfrånvaro personal",
      value: `${(hr.total_sick_share * 100).toFixed(1).replace(".", ",")} %`,
      desc: "tjänstevägd, läsåret hittills",
      href: "/personal",
      tone: hr.total_sick_share >= 0.06 ? "uppmarksam" : "positiv",
    },
  ];
}

export interface StadiumStatus {
  stadium: Stadium;
  range: string;
  students: number;
  attendanceRate: number;
  avgTrygghet: number;
  flagged: number;
  hog: number;
  behorighetRiskzon: number; // Risk 2–3 i behörighetsprognosen
  tapparMark: number;
  specialFte: number;
  flaggedPerSpecial: number | null;
  attention: AttentionLevel;
}

/** Läget per stadium: behov (signaler, trygghet, risk) mot resurser (särskilt stöd). */
export function getStadiumStatus(): StadiumStatus[] {
  const grades = getGradeOverview();
  const alignment = new Map(getArbetslagAlignment().map((a) => [a.arbetslag, a]));

  const riskzonByStadium = new Map<Stadium, number>();
  for (const f of getBehorighetForecasts()) {
    if (f.bucket < 2) continue;
    const st = stadiumForGrade(f.grade_level);
    riskzonByStadium.set(st, (riskzonByStadium.get(st) ?? 0) + 1);
  }
  const tapparByStadium = new Map<Stadium, number>();
  for (const d of getLosingGround()) {
    const st = stadiumForGrade(d.grade_level);
    tapparByStadium.set(st, (tapparByStadium.get(st) ?? 0) + 1);
  }

  return STADIA.map(({ key, range }) => {
    const rows = grades.filter((g) => stadiumForGrade(g.grade) === key);
    const students = rows.reduce((s, r) => s + r.students, 0);
    const wAvg = (pick: (r: (typeof rows)[number]) => number) =>
      students ? rows.reduce((s, r) => s + pick(r) * r.students, 0) / students : 0;
    const al = alignment.get(key);
    const hog = rows.reduce((s, r) => s + r.hog, 0);
    const flagged = rows.reduce((s, r) => s + r.flagged, 0);
    // Stadiets samlade status = den allvarligaste årskursstatusen inom stadiet.
    const attention: AttentionLevel = rows.some((r) => r.attention === "Prioritera")
      ? "Prioritera"
      : rows.some((r) => r.attention === "Bevaka")
        ? "Bevaka"
        : "Stabilt";
    return {
      stadium: key,
      range,
      students,
      attendanceRate: wAvg((r) => r.attendanceRate),
      avgTrygghet: wAvg((r) => r.avgTrygghet),
      flagged,
      hog,
      behorighetRiskzon: riskzonByStadium.get(key) ?? 0,
      tapparMark: tapparByStadium.get(key) ?? 0,
      specialFte: al?.specialFte ?? 0,
      flaggedPerSpecial: al?.flaggedPerSpecial ?? null,
      attention,
    };
  });
}

export interface InsatsUppfoljning {
  /** Pågående/planerade insatser vars uppföljningsdatum passerat demo-idag. */
  overdue: Intervention[];
  /** Kommande uppföljningar, närmast först. */
  upcoming: Intervention[];
}

export function getInsatsUppfoljning(): InsatsUppfoljning {
  const active = listInterventions().filter((i) => i.status !== "avslutad");
  const overdue = active.filter((i) => i.follow_up_date != null && i.follow_up_date < DEMO_TODAY);
  const upcoming = active
    .filter((i) => i.follow_up_date != null && i.follow_up_date >= DEMO_TODAY)
    .sort((a, b) => (a.follow_up_date ?? "").localeCompare(b.follow_up_date ?? ""));
  return { overdue, upcoming };
}

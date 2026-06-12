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
      label: "Flera underlag utan stödprocess",
      value: String(priority.multiNoFormal),
      desc: "flaggas i minst två underlag men saknar åtgärdsprogram och utredning",
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

// --- Veckans fokus: tre prioriterade åtgärder med vad/varför/nästa steg ---
// Svar på skolledarcitatet från testgruppen: "Jag vill inte ha mer data – jag
// vill veta vad jag ska göra och varför det ser ut som det gör."

export interface FokusItem {
  title: string;     // VAD
  varfor: string;    // VARFÖR det ser ut så
  nastaSteg: string; // GÖR SÅ HÄR
  href: string;
  tone: ActionTone;
}

export function getVeckansFokus(): FokusItem[] {
  const warning = getEarlyWarningSummary();
  const priority = getPrioritySummary(getPriorityStudents());
  const { overdue } = getInsatsUppfoljning();
  const economy = getEconomyTotals();
  const deviationShare = economy.full_year_budget
    ? (economy.full_year_forecast - economy.full_year_budget) / economy.full_year_budget
    : 0;
  const stadia = getStadiumStatus();
  const worst = stadia
    .filter((s) => s.attention === "Prioritera")
    .sort((a, b) => a.avgTrygghet - b.avgTrygghet)[0];

  const candidates: { score: number; item: FokusItem }[] = [];

  if (warning.hog > 0) {
    candidates.push({
      score: 5,
      item: {
        title: `Säkra att de ${warning.hog} eleverna med hög risk hanteras`,
        varfor: "De samlar flest tidiga signaler just nu – frånvaro, kunskapsresultat och trivsel pekar åt fel håll samtidigt.",
        nastaSteg: "Gå igenom listan med elevhälsoteamet och bekräfta att varje elev har en ansvarig och en pågående åtgärd.",
        href: "/tidig-upptackt",
        tone: "kritisk",
      },
    });
  }
  if (priority.multiNoFormal > 0) {
    candidates.push({
      score: 4.5,
      item: {
        title: `Stäng stödgapet för ${priority.multiNoFormal} elever`,
        varfor: "De flaggas i minst två oberoende underlag men saknar både åtgärdsprogram och utredning – störst risk att falla mellan stolarna.",
        nastaSteg: "Be elevhälsan prioritera en första kartläggning, börja med dem som flaggas i flest underlag.",
        href: "/prioritera",
        tone: "kritisk",
      },
    });
  }
  if (overdue.length > 0) {
    candidates.push({
      score: 4,
      item: {
        title: `Återuppta uppföljningen av ${overdue.length} ${overdue.length === 1 ? "insats" : "insatser"}`,
        varfor: "Uppföljningsdatumet har passerat – utan uppföljning vet vi inte om insatsen ger effekt eller behöver justeras.",
        nastaSteg: "Boka uppföljning med insatsens ägare och dokumentera utfallet mot den förväntade effekten.",
        href: "/insatser",
        tone: "uppmarksam",
      },
    });
  }
  if (worst) {
    candidates.push({
      score: 3.5,
      item: {
        title: `Följ upp ${worst.stadium.toLowerCase()}et (${worst.range})`,
        varfor: `Stadiet sticker ut: trygghet ${worst.avgTrygghet.toFixed(1).replace(".", ",")}/4, ${worst.flagged} elever med tidig signal och ${worst.tapparMark} som tappar mark.`,
        nastaSteg: "Ta läget med arbetslaget och stäm av att stödresurserna ligger där behoven är störst.",
        href: "/personal",
        tone: "uppmarksam",
      },
    });
  }
  if (deviationShare >= 0.015) {
    candidates.push({
      score: 3,
      item: {
        title: "Hantera prognosavvikelsen i ekonomin",
        varfor: `Helårsprognosen ligger ${(deviationShare * 100).toFixed(1).replace(".", ",")} % över budget – vikariekostnaderna driver avvikelsen.`,
        nastaSteg: "Gå igenom vikarieanvändningen med administrationen och uppdatera prognosen.",
        href: "/ekonomi",
        tone: "uppmarksam",
      },
    });
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, 3).map((c) => c.item);
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

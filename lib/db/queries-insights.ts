import "server-only";
import {
  getGradeAttendanceFor, getWeekdayAbsence, getGradeSkillSummary,
  getGradeWrittenSummary, getFailShareBySubject, getNationalVsGrades,
  getClassAttendance, getClassSkillSummary, getClassWrittenSummary, getClassGradeDistribution,
} from "./queries";
import { getGradeWellbeing, getClassWellbeing } from "./queries-wellbeing";
import { CURRENT_TERM, SKILL_AREAS, type Level } from "@/lib/constants";
import { pct, num, deltaPct } from "@/lib/format";

// ---------------------------------------------------------------------------
// Förklarbara insikter per årskurs (§4 actionable insights):
// varje insikt svarar på Vad (observation), Varför (möjlig förklaring) och
// Vad göra (förslag på nästa steg). Demodata – förslagen är utgångspunkter
// för arbetslagets analys, inte färdiga beslut.
// ---------------------------------------------------------------------------

export type InsightTone = "kritisk" | "uppmarksam" | "info";

export interface GradeInsight {
  tone: InsightTone;
  what: string;
  why: string;
  action: string;
}

export interface GradeInsights {
  strengths: string[];
  insights: GradeInsight[];
}

const WEEKDAYS = ["måndag", "tisdag", "onsdag", "torsdag", "fredag"];

function attentionShare(rows: { level: Level; n: number }[]): { attn: number; total: number } {
  const total = rows.reduce((s, r) => s + r.n, 0);
  const attn = rows.filter((r) => r.level === "uppmarksam" || r.level === "stort_behov").reduce((s, r) => s + r.n, 0);
  return { attn: total ? attn / total : 0, total };
}

export function getGradeInsights(grade: number): GradeInsights {
  const strengths: string[] = [];
  const insights: GradeInsight[] = [];

  const showLSR = grade >= 1 && grade <= 4;
  const showWritten = grade >= 2 && grade <= 6;
  const showGrades = grade >= 7 && grade <= 10;

  // 1) Närvaro / frånvarotrend
  const attn = getGradeAttendanceFor(grade);
  const rise = (attn?.w4_absence_rate ?? 0) - (attn?.w12_absence_rate ?? 0);
  if (rise > 0.02) {
    const wd = getWeekdayAbsence(grade);
    const peak = [...wd].sort((a, b) => b.absence_rate - a.absence_rate)[0];
    const peakDay = peak ? WEEKDAYS[peak.iso_dow - 1] : null;
    const edgeOfWeek = peak && (peak.iso_dow === 1 || peak.iso_dow === 5);
    insights.push({
      tone: rise > 0.05 ? "kritisk" : "uppmarksam",
      what: `Frånvaron i årskurs ${grade} ökar – ${deltaPct(rise)} de senaste fyra veckorna jämfört med tolvveckorssnittet.`,
      why: peakDay
        ? `Frånvaron är störst på ${peakDay}${edgeOfWeek ? ", i kanten av veckan, vilket ofta hänger ihop med trivsel, motivation eller helgrutiner" : ""}.`
        : "Mönstret kan hänga ihop med trivsel, motivation eller rutiner kring skoldagen.",
      action: "Mentorer och elevhälsa följer närvaron veckovis och kontaktar vårdnadshavare tidigt för att kartlägga orsaker.",
    });
  } else {
    strengths.push("Närvaron är stabil över tid.");
  }

  // 2) Trygghet (wellbeing)
  const gw = getGradeWellbeing().find((g) => g.grade_level === grade);
  if (gw && gw.trygghet < 2.8) {
    insights.push({
      tone: gw.trygghet < 2.4 ? "kritisk" : "uppmarksam",
      what: `Tryggheten skattas lågt i årskurs ${grade} (snitt ${num(gw.trygghet, 1)} av 4 i trivselenkäten).`,
      why: "Låg trygghet samvarierar ofta med ökande frånvaro och sämre arbetsro, och är en tidig signal innan det syns i resultaten.",
      action: "Elevhälsan kartlägger tillsammans med mentorer och överväger trygghetsskapande insatser i gruppen.",
    });
  } else if (gw && gw.trygghet >= 3.3) {
    strengths.push("Eleverna skattar tryggheten högt.");
  }

  // 3) Läsa/skriva/räkna – område som behöver uppmärksammas
  if (showLSR) {
    for (const a of SKILL_AREAS) {
      const rows = getGradeSkillSummary(grade, CURRENT_TERM).filter((r) => r.area === a.key);
      const { attn: share } = attentionShare(rows);
      if (share >= 0.3) {
        insights.push({
          tone: share >= 0.45 ? "kritisk" : "uppmarksam",
          what: `${a.label}: ${pct(share)} av eleverna behöver uppmärksammas.`,
          why: "En stor andel under förväntad progression tyder på att grundfärdigheterna behöver befästas brett, inte bara hos enskilda elever.",
          action: `Planera riktad färdighetsträning i ${a.label.toLowerCase()} i mindre grupp, gärna med speciallärare, och följ upp inom åtta veckor.`,
        });
      } else if (share <= 0.15) {
        strengths.push(`${a.label}: stor andel elever i fas.`);
      }
    }
  }

  // 4) Ämne med störst andel under-/icke godkänt
  if (showWritten || showGrades) {
    if (showWritten) {
      // Skriftliga omdömen: ämne med störst andel att uppmärksamma
      let worst: { subject: string; share: number } | null = null;
      const rows = getGradeWrittenSummary(grade, CURRENT_TERM);
      const subjects = [...new Set(rows.map((r) => r.subject))];
      for (const subj of subjects) {
        const { attn: share } = attentionShare(rows.filter((r) => r.subject === subj));
        if (!worst || share > worst.share) worst = { subject: subj, share };
      }
      if (worst && worst.share >= 0.3) {
        insights.push({
          tone: worst.share >= 0.45 ? "kritisk" : "uppmarksam",
          what: `${worst.subject}: ${pct(worst.share)} av omdömena ligger under förväntad nivå.`,
          why: "Ett återkommande mönster i ett ämne pekar oftare på undervisningsupplägg än på enskilda elever.",
          action: `Lyft ${worst.subject} i kollegialt arbete – gemensam planering och sambedömning – och följ utvecklingen till nästa termin.`,
        });
      }
    }
    if (showGrades) {
      const fails = getFailShareBySubject(grade, CURRENT_TERM).filter((f) => f.total > 0);
      const worst = fails[0];
      if (worst && worst.fail / worst.total >= 0.15) {
        insights.push({
          tone: worst.fail / worst.total >= 0.25 ? "kritisk" : "uppmarksam",
          what: `${worst.subject}: ${pct(worst.fail / worst.total)} av eleverna riskerar F eller streck.`,
          why: "En hög andel underkända i ett ämne motiverar att se över undervisning, anpassningar och bedömning samlat.",
          action: `Kartlägg vilka elever det gäller, sätt in riktat stöd i ${worst.subject} och stäm av mot eventuella åtgärdsprogram.`,
        });
      }
      const best = [...fails].sort((a, b) => a.fail / a.total - b.fail / b.total)[0];
      if (best && best.fail / best.total <= 0.05) strengths.push(`${best.subject}: få elever på F-nivå.`);
    }
  }

  // 5) Åk 10 (sista året): nationella prov vs betyg
  if (grade === 10) {
    const nvg = getNationalVsGrades(10, CURRENT_TERM);
    const gap = [...nvg].sort((a, b) => (b.avg_grade - b.avg_nat) - (a.avg_grade - a.avg_nat))[0];
    if (gap && gap.avg_grade - gap.avg_nat >= 2) {
      insights.push({
        tone: "uppmarksam",
        what: `${gap.subject}: terminsbetygen ligger i snitt klart högre än provbetygen.`,
        why: "Skillnaden kan tyda på olika bedömningsgrunder mellan prov och betygssättning.",
        action: `Genomför sambedömning i ${gap.subject} och analysera provresultat mot betyg för en mer likvärdig bedömning.`,
      });
    }
  }

  return { strengths, insights };
}

// ---------------------------------------------------------------------------
// Samma analys på klassnivå (för en enskild klass).
// ---------------------------------------------------------------------------
export function getClassInsights(classId: string): GradeInsights {
  const grade = parseInt(classId, 10);
  const strengths: string[] = [];
  const insights: GradeInsight[] = [];

  const showLSR = grade >= 1 && grade <= 4;
  const showWritten = grade >= 2 && grade <= 6;
  const showGrades = grade >= 7 && grade <= 10;

  // 1) Närvarotrend (klass)
  const ca = getClassAttendance(grade).find((c) => c.class_id === classId);
  const rise = (ca?.w4_absence_rate ?? 0) - (ca?.w12_absence_rate ?? 0);
  if (rise > 0.02) {
    insights.push({
      tone: rise > 0.05 ? "kritisk" : "uppmarksam",
      what: `Frånvaron i klass ${classId} ökar – ${deltaPct(rise)} de senaste fyra veckorna jämfört med tolvveckorssnittet.`,
      why: "En ökning på klassnivå kan hänga ihop med gruppklimat, trivsel eller rutiner snarare än enskilda elever.",
      action: "Mentor och elevhälsa följer närvaron veckovis och kontaktar vårdnadshavare tidigt för att kartlägga orsaker.",
    });
  } else {
    strengths.push("Närvaron är stabil över tid.");
  }

  // 2) Trygghet (klass)
  const wb = getClassWellbeing(classId);
  if (wb.avgTrygghet < 2.8) {
    insights.push({
      tone: wb.avgTrygghet < 2.4 ? "kritisk" : "uppmarksam",
      what: `Tryggheten skattas lågt i klass ${classId} (snitt ${num(wb.avgTrygghet, 1)} av 4${wb.lowCount > 0 ? `, ${wb.lowCount} elever lågt` : ""}).`,
      why: "Låg trygghet i gruppen samvarierar ofta med ökande frånvaro och sämre arbetsro, och är en tidig signal.",
      action: "Elevhälsan kartlägger tillsammans med mentor och överväger trygghetsskapande insatser i klassen.",
    });
  } else if (wb.avgTrygghet >= 3.3) {
    strengths.push("Eleverna skattar tryggheten högt.");
  }

  // 3) Läsa/skriva/räkna (klass)
  if (showLSR) {
    const rows = getClassSkillSummary(classId, CURRENT_TERM);
    for (const a of SKILL_AREAS) {
      const { attn: share } = attentionShare(rows.filter((r) => r.area === a.key));
      if (share >= 0.3) {
        insights.push({
          tone: share >= 0.45 ? "kritisk" : "uppmarksam",
          what: `${a.label}: ${pct(share)} av klassens elever behöver uppmärksammas.`,
          why: "En stor andel under förväntad progression i gruppen tyder på att grundfärdigheterna behöver befästas brett.",
          action: `Planera riktad färdighetsträning i ${a.label.toLowerCase()} i mindre grupp och följ upp inom åtta veckor.`,
        });
      } else if (share <= 0.15) {
        strengths.push(`${a.label}: stor andel elever i fas.`);
      }
    }
  }

  // 4) Skriftliga omdömen / betyg (klass)
  if (showWritten) {
    const rows = getClassWrittenSummary(classId, CURRENT_TERM);
    const subjects = [...new Set(rows.map((r) => r.subject))];
    let worst: { subject: string; share: number } | null = null;
    for (const subj of subjects) {
      const { attn: share } = attentionShare(rows.filter((r) => r.subject === subj));
      if (!worst || share > worst.share) worst = { subject: subj, share };
    }
    if (worst && worst.share >= 0.3) {
      insights.push({
        tone: worst.share >= 0.45 ? "kritisk" : "uppmarksam",
        what: `${worst.subject}: ${pct(worst.share)} av omdömena ligger under förväntad nivå.`,
        why: "Ett återkommande mönster i ett ämne pekar oftare på undervisningsupplägg än på enskilda elever.",
        action: `Lyft ${worst.subject} i kollegialt arbete – gemensam planering och sambedömning – och följ utvecklingen.`,
      });
    }
  }
  if (showGrades) {
    const dist = getClassGradeDistribution(classId, CURRENT_TERM);
    const subjects = [...new Set(dist.map((d) => d.subject))];
    let worst: { subject: string; share: number } | null = null;
    for (const subj of subjects) {
      const subjRows = dist.filter((d) => d.subject === subj);
      const total = subjRows.reduce((s, d) => s + d.antal, 0);
      const fail = subjRows.filter((d) => d.grade === "F" || d.grade === "-").reduce((s, d) => s + d.antal, 0);
      const share = total ? fail / total : 0;
      if (!worst || share > worst.share) worst = { subject: subj, share };
    }
    if (worst && worst.share >= 0.15) {
      insights.push({
        tone: worst.share >= 0.25 ? "kritisk" : "uppmarksam",
        what: `${worst.subject}: ${pct(worst.share)} av eleverna riskerar F eller streck.`,
        why: "En hög andel underkända i ett ämne motiverar att se över undervisning, anpassningar och bedömning samlat.",
        action: `Kartlägg vilka elever det gäller, sätt in riktat stöd i ${worst.subject} och stäm av mot eventuella åtgärdsprogram.`,
      });
    }
  }

  return { strengths, insights };
}

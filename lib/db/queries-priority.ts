import "server-only";
import { all } from "./index";
import { getEarlyWarnings } from "./queries-risk";
import { getBehorighetForecasts } from "./queries-behorighet";
import { getLosingGround } from "./queries-development";
import { getLongTermTrends, getGrowingAbsence } from "./queries-history";
import { getUtredningsskuldStudents } from "./queries-summary";
import { pct } from "@/lib/format";

// ---------------------------------------------------------------------------
// Elever att prioritera – samlad bild över skolans "linser"
//
// Appen har fem olika sätt att fånga elever som behöver mer: Tidig upptäckt
// (regelbaserade signaler), Behörighetsprognos (utfallsnära risk), utrednings-
// skuldens underlag (ihållande svårigheter), Tappar mark (nedgång från god
// nivå inom läsåret) och Fallande trend (flerterminsnedgång över upp till fyra
// läsår). Den här modulen korsar linserna per elev: en elev som fångas av flera
// oberoende linser är sannolikt i störst behov – särskilt om eleven samtidigt
// saknar en formell stödprocess. Demodata.
// ---------------------------------------------------------------------------

export type LensKey = "tidig" | "behorighet" | "skuld" | "tappar" | "trend" | "franvaro";

export const LENS_META: { key: LensKey; label: string; href: string; rule: string }[] = [
  {
    key: "tidig",
    label: "Tidig signal",
    href: "/tidig-upptackt",
    rule: "Hög eller förhöjd risk i den regelbaserade signalmodellen (Tidig upptäckt).",
  },
  {
    key: "behorighet",
    label: "Behörighetsrisk",
    href: "/behorighet",
    rule: "Risk 2–3 i behörighetsprognosen, dvs. under 80 % skattad sannolikhet (åk 4–10).",
  },
  {
    key: "skuld",
    label: "Ihållande svårigheter",
    href: "/analys",
    rule: "Saknar godtagbart omdöme eller godkänt betyg i minst ett ämne under båda terminerna (utredningsskuldens underlag).",
  },
  {
    key: "tappar",
    label: "Tappar mark",
    href: "/analys",
    rule: "Tydlig nedgång från en god nivå mellan höst- och vårterminen.",
  },
  {
    key: "trend",
    label: "Fallande trend",
    href: "/analys",
    rule: "Resultaten pekar nedåt i flera ämnen sett över upp till fyra läsår (flerterminstrend, inte en enstaka dipp).",
  },
  {
    key: "franvaro",
    label: "Växande frånvaro",
    href: "/tidig-upptackt",
    rule: "Frånvaron har vuxit uthålligt över läsåren (≥ +0,8 p.e. per termin över minst fem terminer) och är redan förhöjd (≥ 8 % nu).",
  },
];

export type LensTone = "kritisk" | "uppmarksam" | "info";

export interface PriorityLens {
  key: LensKey;
  label: string;
  /** Kort underlag, t.ex. "Hög risk (7 p)" eller "Risk 3 (32 %)". */
  detail: string;
  tone: LensTone;
  points: number;
}

export type SupportStatus = "atgardsprogram" | "utredning" | "anpassning" | "ingen";

export const SUPPORT_LABEL: Record<SupportStatus, string> = {
  atgardsprogram: "Åtgärdsprogram",
  utredning: "Utredning pågår",
  anpassning: "Extra anpassning",
  ingen: "Ingen formell process",
};

export interface PriorityStudent {
  student_id: string;
  name: string;
  class_id: string;
  grade_level: number;
  lenses: PriorityLens[];
  support: SupportStatus;
  /** Saknar formell stödprocess (åtgärdsprogram/utredning) trots flera linser. */
  formalGap: boolean;
  /** Sorteringsvikt: summan av linsernas poäng + 1 om formellt stöd saknas. */
  priority: number;
}

export interface PrioritySummary {
  total: number;
  multi: number;
  multiNoFormal: number;
  perLens: Record<LensKey, number>;
}

interface SupportRow {
  student_id: string;
  name: string;
  class_id: string;
  grade_level: number;
  extra_anpassning: number;
  atgardsprogram: number;
  utredning_pagaende: number;
}

/**
 * Alla elever som fångas av minst en lins, sorterade på samlad prioritet.
 * Vyn visar i första hand dem som fångas av flera linser.
 */
export function getPriorityStudents(): PriorityStudent[] {
  const students = new Map<string, SupportRow>(
    all<SupportRow>(
      `select student_id, (first_name || ' ' || last_name) name, class_id, grade_level,
         extra_anpassning, atgardsprogram, utredning_pagaende
       from students where active = 1`,
    ).map((r) => [r.student_id, r]),
  );

  const lensesByStudent = new Map<string, PriorityLens[]>();
  const add = (studentId: string, lens: PriorityLens) => {
    const arr = lensesByStudent.get(studentId) ?? [];
    arr.push(lens);
    lensesByStudent.set(studentId, arr);
  };

  // Lins 1: Tidig upptäckt (endast de actionable nivåerna Hög/Förhöjd).
  for (const r of getEarlyWarnings()) {
    if (r.level === "Bevaka") continue;
    add(r.student_id, {
      key: "tidig",
      label: "Tidig signal",
      detail: `${r.level} risk (${r.score} p)`,
      tone: r.level === "Hög" ? "kritisk" : "uppmarksam",
      points: r.level === "Hög" ? 3 : 2,
    });
  }

  // Lins 2: Behörighetsprognos (Risk 2–3).
  for (const f of getBehorighetForecasts()) {
    if (f.bucket < 2) continue;
    add(f.student_id, {
      key: "behorighet",
      label: "Behörighetsrisk",
      detail: `Risk ${f.bucket} (${pct(f.probability, f.probability < 0.005 ? 1 : 0)})`,
      tone: f.bucket === 3 ? "kritisk" : "uppmarksam",
      points: f.bucket === 3 ? 3 : 2,
    });
  }

  // Lins 3: Ihållande svårigheter (utredningsskuldens underlag).
  for (const u of getUtredningsskuldStudents()) {
    add(u.student_id, {
      key: "skuld",
      label: "Ihållande svårigheter",
      detail: `${u.subjects} ${u.subjects === 1 ? "ämne" : "ämnen"} båda terminerna`,
      tone: "uppmarksam",
      points: 2,
    });
  }

  // Lins 4: Tappar mark (nedgång från god nivå).
  for (const d of getLosingGround()) {
    add(d.student_id, {
      key: "tappar",
      label: "Tappar mark",
      detail: d.detail,
      tone: "info",
      points: 1,
    });
  }

  // Lins 5: Fallande flerterminstrend (upp till fyra läsår).
  for (const t of getLongTermTrends()) {
    if (t.trend !== "negativ") continue;
    add(t.student_id, {
      key: "trend",
      label: "Fallande trend",
      detail: t.detail,
      tone: "uppmarksam",
      points: 2,
    });
  }

  // Lins 6: Växande frånvaro över läsåren (terminshistoriken).
  for (const g of getGrowingAbsence()) {
    add(g.student_id, {
      key: "franvaro",
      label: "Växande frånvaro",
      detail: g.detail,
      tone: "uppmarksam",
      points: 2,
    });
  }

  const result: PriorityStudent[] = [];
  for (const [studentId, lenses] of lensesByStudent) {
    const s = students.get(studentId);
    if (!s) continue;
    const support: SupportStatus =
      s.atgardsprogram === 1
        ? "atgardsprogram"
        : s.utredning_pagaende === 1
          ? "utredning"
          : s.extra_anpassning === 1
            ? "anpassning"
            : "ingen";
    const formalGap = support === "ingen" || support === "anpassning";
    const points = lenses.reduce((sum, l) => sum + l.points, 0);
    result.push({
      student_id: studentId,
      name: s.name,
      class_id: s.class_id,
      grade_level: s.grade_level,
      lenses,
      support,
      formalGap,
      priority: points + (formalGap && lenses.length >= 2 ? 1 : 0),
    });
  }

  result.sort(
    (a, b) =>
      b.lenses.length - a.lenses.length ||
      b.priority - a.priority ||
      a.grade_level - b.grade_level ||
      a.name.localeCompare(b.name, "sv-SE"),
  );
  return result;
}

export function getPrioritySummary(list?: PriorityStudent[]): PrioritySummary {
  const rows = list ?? getPriorityStudents();
  const perLens = { tidig: 0, behorighet: 0, skuld: 0, tappar: 0, trend: 0, franvaro: 0 } as Record<LensKey, number>;
  for (const r of rows) for (const l of r.lenses) perLens[l.key]++;
  const multi = rows.filter((r) => r.lenses.length >= 2);
  return {
    total: rows.length,
    multi: multi.length,
    multiNoFormal: multi.filter((r) => r.formalGap).length,
    perLens,
  };
}

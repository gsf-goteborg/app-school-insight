import type { ReactNode } from "react";
import { pct, num } from "@/lib/format";
import { Highlight } from "@/components/ui/primitives";

/**
 * Genererar startsidans fyra sammanfattningskort som färgmarkerad text. Nyckeltal
 * (antal och andelar) lyfts fram med Highlight, tonade efter om läget är bra
 * (grönt), värt att uppmärksamma (orange) eller kritiskt (rött). Demodata.
 */

const share = (n: number, total: number) => (total > 0 ? n / total : 0);

/** Skriftliga omdömen – åk 2–6. */
export function writtenNarrative(p: {
  totalStudents: number;
  withAny: number;
  allGodtagbara: number;
}): ReactNode {
  const andelMedOmdome = share(p.withAny, p.totalStudents);
  const andelGodtagbara = share(p.allGodtagbara, p.withAny);
  const godtagbaraTone = andelGodtagbara >= 0.7 ? "positiv" : andelGodtagbara >= 0.5 ? "uppmarksam" : "kritisk";
  return (
    <>
      Skolan har <Highlight>{num(p.withAny)}</Highlight> elever som har minst ett skriftligt omdöme denna termin.
      Det motsvarar <Highlight tone="info">{pct(andelMedOmdome, 0)}</Highlight> av eleverna i årskurserna 2–6.
      Av dessa har <Highlight tone={godtagbaraTone}>{num(p.allGodtagbara)}</Highlight> elever godtagbara omdömen i
      alla sina ämnen, vilket är <Highlight tone={godtagbaraTone}>{pct(andelGodtagbara, 0)}</Highlight>. Övriga
      elever har minst ett ämne som behöver uppmärksammas.
    </>
  );
}

/** Betyg och behörighet – åk 7–10. */
export function betygNarrative(p: {
  totalStudents: number;
  atRisk: number;
  meritLeaving: number;
}): ReactNode {
  const andel = share(p.atRisk, p.totalStudents);
  const riskTone = andel >= 0.15 ? "kritisk" : andel >= 0.08 ? "uppmarksam" : "positiv";
  const meritTone = p.meritLeaving >= 220 ? "positiv" : p.meritLeaving >= 200 ? "neutral" : "uppmarksam";
  return (
    <>
      <Highlight tone={riskTone}>{num(p.atRisk)}</Highlight> elever i årskurs 7–10 har ökad risk att inte bli
      behöriga, eftersom de har F eller streck i minst ett av kärnämnena svenska, engelska eller matematik denna
      termin. Det är <Highlight tone={riskTone}>{pct(andel, 0)}</Highlight> av eleverna i årskurserna.
      Snittmeritvärdet i årskurs 10 ligger på <Highlight tone={meritTone}>{num(p.meritLeaving, 1)}</Highlight> poäng.
    </>
  );
}

/** Stödinsatser – hela skolan. */
export function stodNarrative(p: {
  totalStudents: number;
  extraAnpassning: number;
  atgardsprogram: number;
  utredning: number;
}): ReactNode {
  const andelEa = share(p.extraAnpassning, p.totalStudents);
  const andelAp = share(p.atgardsprogram, p.totalStudents);
  return (
    <>
      <Highlight tone="info">{num(p.extraAnpassning)}</Highlight> elever får extra anpassningar inom ordinarie
      undervisning, vilket motsvarar <Highlight tone="info">{pct(andelEa, 0)}</Highlight> av skolans elever. Av dem
      har <Highlight tone="info">{num(p.atgardsprogram)}</Highlight> elever ett åtgärdsprogram
      ({pct(andelAp, 0)} av samtliga elever). För närvarande pågår{" "}
      <Highlight tone="uppmarksam">{num(p.utredning)}</Highlight> utredningar om särskilt stöd.
    </>
  );
}

/** Utredningsskuld – ihållande svårigheter utan åtgärdsprogram eller utredning. */
export function utredningsskuldNarrative(p: {
  lackingTotal: number;
  withAtgardsprogram: number;
  underUtredning: number;
  noAction: number;
}): ReactNode {
  if (p.lackingTotal === 0) {
    return (
      <>Inga elever saknar godtagbart omdöme eller godkänt betyg i något ämne under båda terminerna.</>
    );
  }
  const andelUtanInsats = share(p.noAction, p.lackingTotal);
  const tone = andelUtanInsats >= 0.5 ? "kritisk" : andelUtanInsats >= 0.25 ? "uppmarksam" : "positiv";
  return (
    <>
      Under de två senaste terminerna saknar <Highlight tone="uppmarksam">{num(p.lackingTotal)}</Highlight> elever
      godtagbart omdöme eller godkänt betyg (A–E) i ett eller flera ämnen. Av dessa har{" "}
      <Highlight tone="info">{num(p.withAtgardsprogram)}</Highlight> ett aktivt åtgärdsprogram och{" "}
      <Highlight tone="info">{num(p.underUtredning)}</Highlight> är under utredning. Andelen som varken har
      åtgärdsprogram eller pågående utredning är <Highlight tone={tone}>{pct(andelUtanInsats, 0)}</Highlight>{" "}
      ({num(p.noAction)} elever).
    </>
  );
}

/** Närvaro och frånvaro – hela skolan. */
export function narvaroNarrative(p: {
  attendanceRate: number;
  totalStudents: number;
  over15: number;
  rising: number;
}): ReactNode {
  const andel15 = share(p.over15, p.totalStudents);
  const attnTone = p.attendanceRate >= 0.95 ? "positiv" : p.attendanceRate >= 0.9 ? "neutral" : "uppmarksam";
  const over15Tone = andel15 >= 0.1 ? "kritisk" : andel15 >= 0.05 ? "uppmarksam" : "positiv";
  const risingTone = p.rising >= 20 ? "uppmarksam" : "neutral";
  return (
    <>
      Den samlade närvarograden för läsåret hittills är <Highlight tone={attnTone}>{pct(p.attendanceRate, 1)}</Highlight>.{" "}
      <Highlight tone={over15Tone}>{num(p.over15)}</Highlight> elever har en frånvaro på minst 15 procent, vilket är{" "}
      <Highlight tone={over15Tone}>{pct(andel15, 0)}</Highlight> av skolans elever. Hos{" "}
      <Highlight tone={risingTone}>{num(p.rising)}</Highlight> elever ökar frånvaron – de senaste fyra veckorna
      ligger tydligt över tolvveckorssnittet.
    </>
  );
}

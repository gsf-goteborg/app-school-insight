import Link from "next/link";
import { RoleGate } from "@/components/role-gate";
import { PageHeader, Card, Section, Pill, Note, Disclosure } from "@/components/ui/primitives";
import { getActionQueue, getStadiumStatus, getInsatsUppfoljning, getVeckansFokus } from "@/lib/db/queries-ledning";
import { getSchoolTermSeries } from "@/lib/db/queries-history";
import { getPriorityStudents } from "@/lib/db/queries-priority";
import { LineChart } from "@/components/charts";
import { ActionCoverage } from "@/components/student-action";
import { INTERVENTION_LEVEL_LABEL, type InterventionLevel } from "@/lib/constants";
import type { Intervention } from "@/lib/db/queries-resources";
import { pct, num, delta, deltaPct, dateShort } from "@/lib/format";

// Skolledarens kontrollvy. Designprincip (testgruppscitat): "Jag vill inte ha
// mer data – jag vill veta vad jag ska göra och varför det ser ut som det gör."
// Därför: Veckans fokus + åtgärdstäckning överst, stadium-läget och uppföljningen
// som enda tabeller, riktningen som slutsatser i klartext – kurvor och hela
// åtgärdskön ett klick bort (Disclosure).

const ATTENTION_TONE = {
  Prioritera: "kritisk",
  Bevaka: "uppmarksam",
  Stabilt: "positiv",
} as const;

const ACTION_ACCENT = {
  kritisk: "text-[var(--gbg-red-dark)]",
  uppmarksam: "text-[var(--gbg-orange-dark)]",
  positiv: "text-[var(--gbg-green-dark)]",
  info: "text-[var(--gbg-purple-dark)]",
} as const;

export default function LedningPage() {
  const actions = getActionQueue();
  // Elever som flaggas i flera underlag – grund för åtgärdstäckningen (klientkortet
  // korsar id-listan med de åtgärder som startats i webbläsarens demo-store).
  const multiIds = getPriorityStudents()
    .filter((s) => s.lenses.length >= 2)
    .map((s) => s.student_id);
  const stadia = getStadiumStatus();
  const { overdue, upcoming } = getInsatsUppfoljning();
  const series = getSchoolTermSeries();
  const termLabels = series.map((p) => p.label);

  // Riktning över fyra läsår: första vs senaste termin med data, per mått.
  const firstLast = (vals: (number | null)[]) => {
    const xs = vals.filter((v): v is number => v != null);
    return xs.length >= 2 ? { first: xs[0], last: xs[xs.length - 1] } : null;
  };
  const riktning: { label: string; value: string; deltaText: string; tone: "positiv" | "uppmarksam" | "neutral" }[] = [];
  const pushDir = (
    label: string,
    fl: { first: number; last: number } | null,
    fmt: (v: number) => string,
    dfmt: (d: number) => string,
    lowerBetter = false,
  ) => {
    if (!fl) return;
    const d = fl.last - fl.first;
    const improved = lowerBetter ? d < 0 : d > 0;
    const meaningful = Math.abs(d) > (lowerBetter ? 0.002 : 0.005);
    riktning.push({
      label,
      value: fmt(fl.last),
      deltaText: `${dfmt(d)} sedan HT 2022`,
      tone: !meaningful ? "neutral" : improved ? "positiv" : "uppmarksam",
    });
  };
  // OBS: snittmeritvärdet utelämnas medvetet här – populationen med betyg
  // skiftar kraftigt mellan terminerna (HT 2022 = endast 40 elever), så en
  // delta-siffra vore en sammansättningsartefakt. Meriten finns i kurvorna,
  // där förbehållet om kullskiften står.
  pushDir("Godtagbara omdömen åk 2–6", firstLast(series.map((p) => p.shareWrittenOk)), (v) => pct(v, 0), (d) => `${deltaPct(d)} p.e.`);
  pushDir("Läsa/skriva/räkna åk 1–4", firstLast(series.map((p) => p.shareLsrOk)), (v) => pct(v, 0), (d) => `${deltaPct(d)} p.e.`);
  pushDir("Frånvaro", firstLast(series.map((p) => p.absenceRate)), (v) => pct(v, 1), (d) => `${deltaPct(d)} p.e.`, true);
  pushDir("Trygghet", firstLast(series.map((p) => p.avgTrygghet)), (v) => `${num(v, 1)}/4`, (d) => delta(d, 1));

  return (
    <RoleGate view="ledning">
      <PageHeader
        kicker="Ledningsöversikt"
        title="Skolledarens kontrollvy"
        description="Vad du behöver agera på, om åtgärderna hänger med och åt vilket håll skolan rör sig. Allt länkar till sitt underlag – detaljerna ligger ett klick bort."
      />

      <Section
        title="Veckans fokus"
        description="De tre viktigaste sakerna att agera på just nu – vad, varför det ser ut så och förslag på nästa steg."
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {getVeckansFokus().map((f, i) => (
            <Link key={f.title} href={f.href} className="block">
              <Card className="h-full p-5">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  <span
                    aria-hidden
                    className={`flex size-5 items-center justify-center rounded-full text-[11px] font-bold text-white ${
                      f.tone === "kritisk" ? "bg-[var(--gbg-red)]" : "bg-[var(--gbg-orange)]"
                    }`}
                  >
                    {i + 1}
                  </span>
                  Fokus {i + 1}
                </p>
                <p className="mt-2 font-semibold leading-snug">{f.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                  <span className="font-medium text-[var(--text-default)]">Därför: </span>
                  {f.varfor}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                  <span className="font-medium text-[var(--text-default)]">Nästa steg: </span>
                  {f.nastaSteg}
                </p>
                <p className="mt-3 text-sm font-semibold text-[var(--gbg-blue)]">Till underlaget →</p>
              </Card>
            </Link>
          ))}
        </div>
        <div className="mt-4">
          <ActionCoverage studentIds={multiIds} />
        </div>
      </Section>

      <Section
        title="Läget per stadium"
        description="Behov (signaler, trygghet, risk) mot resurser (särskilt stöd). Status är den allvarligaste årskursstatusen inom stadiet."
      >
        <Card className="table-card">
          <table className="w-full text-[15px]">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-left text-sm text-[var(--text-muted)]">
                <th className="px-4 py-2.5 font-medium">Stadium</th>
                <th className="px-4 py-2.5 font-medium">Elever</th>
                <th className="px-4 py-2.5 font-medium">Närvaro</th>
                <th className="px-4 py-2.5 font-medium">Trygghet</th>
                <th className="px-4 py-2.5 font-medium">Tidiga signaler</th>
                <th className="px-4 py-2.5 font-medium">Riskzon behörighet</th>
                <th className="px-4 py-2.5 font-medium">Tappar mark</th>
                <th className="px-4 py-2.5 font-medium">Flaggade/spec.tjänst</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {stadia.map((s) => (
                <tr key={s.stadium} className="border-b border-[var(--border-subtle)] last:border-0">
                  <td className="px-4 py-2.5">
                    <span className="font-medium">{s.stadium}</span>{" "}
                    <span className="text-sm text-[var(--text-muted)]">{s.range}</span>
                  </td>
                  <td className="px-4 py-2.5 tabular">{num(s.students)}</td>
                  <td className="px-4 py-2.5 tabular">{pct(s.attendanceRate, 1)}</td>
                  <td className={`px-4 py-2.5 tabular ${s.avgTrygghet < 2.8 ? "font-medium text-[var(--gbg-orange-dark)]" : ""}`}>
                    {num(s.avgTrygghet, 1)}/4
                  </td>
                  <td className="px-4 py-2.5 tabular">
                    {num(s.flagged)} <span className="text-sm text-[var(--text-muted)]">(varav {num(s.hog)} hög)</span>
                  </td>
                  <td className="px-4 py-2.5 tabular">{num(s.behorighetRiskzon)}</td>
                  <td className="px-4 py-2.5 tabular">{num(s.tapparMark)}</td>
                  <td className="px-4 py-2.5 tabular">
                    {s.flaggedPerSpecial == null ? (
                      <span className="font-medium text-[var(--gbg-red-dark)]">saknar resurs</span>
                    ) : (
                      num(s.flaggedPerSpecial, 0)
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <Pill tone={ATTENTION_TONE[s.attention]}>{s.attention}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Fördjupa per <Link href="/arskurs" className="font-semibold text-[var(--gbg-blue)] hover:underline">årskurs</Link>,{" "}
          <Link href="/klass" className="font-semibold text-[var(--gbg-blue)] hover:underline">klass</Link> eller i{" "}
          <Link href="/personal" className="font-semibold text-[var(--gbg-blue)] hover:underline">personalplaneringen</Link>{" "}
          – där kan du också <strong>simulera omfördelning</strong> av stödresurser.
        </p>
      </Section>

      <Section
        title="Följs insatserna upp?"
        description="Insatser med passerat uppföljningsdatum kräver agerande. Uppmätt effekt finns på respektive insats sida."
      >
        <Card className="p-5">
          {overdue.length === 0 ? (
            <p className="text-[var(--text-muted)]">Inga insatser har passerat sitt uppföljningsdatum.</p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {overdue.map((i) => (
                <InsatsRow key={i.intervention_id} insats={i} overdue />
              ))}
            </ul>
          )}
          <p className="mt-3 border-t border-[var(--border-subtle)] pt-3 text-sm text-[var(--text-muted)]">
            {num(upcoming.length)} kommande uppföljningar
            {upcoming[0]?.follow_up_date ? `, närmast ${dateShort(upcoming[0].follow_up_date)}` : ""}.{" "}
            <Link href="/insatser" className="font-semibold text-[var(--gbg-blue)] hover:underline">
              Alla insatser →
            </Link>
          </p>
        </Card>
      </Section>

      <Section
        title="Riktning över fyra läsår"
        description="Rör sig skolan åt rätt håll? Grönt = rätt riktning. Kullarna skiftar mellan terminerna – läs mönster, inte exakta nivåer."
      >
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {riktning.map((r) => (
            <Card key={r.label} className="p-4">
              <p className="text-sm font-medium text-[var(--text-muted)]">{r.label}</p>
              <p className="mt-1 font-display text-2xl tabular text-[var(--text-strong)]">{r.value}</p>
              <p className="mt-1">
                <Pill tone={r.tone}>{r.deltaText}</Pill>
              </p>
            </Card>
          ))}
        </div>
        <div className="mt-4">
          <Disclosure
            title="Visa kurvorna"
            description="Samma fyra mått per termin över fyra läsår."
          >
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-semibold text-[var(--text-muted)]">Snittmeritvärde (åk 7–10)</p>
                <LineChart
                  ariaLabel="Snittmeritvärde per termin, fyra läsår"
                  categories={termLabels}
                  series={[{ name: "Meritvärde", data: series.map((p) => (p.avgMerit != null ? Math.round(p.avgMerit * 10) / 10 : null)) }]}
                  valueFormat="dec1"
                  height={220}
                />
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-[var(--text-muted)]">Andel godtagbara resultat</p>
                <LineChart
                  ariaLabel="Andel godtagbara omdömen och läsa-skriva-räkna-nivåer per termin, fyra läsår"
                  categories={termLabels}
                  series={[
                    { name: "Omdömen (åk 2–6)", data: series.map((p) => (p.shareWrittenOk != null ? Math.round(p.shareWrittenOk * 100) : null)) },
                    { name: "Läsa/skriva/räkna (åk 1–4)", data: series.map((p) => (p.shareLsrOk != null ? Math.round(p.shareLsrOk * 100) : null)) },
                  ]}
                  valueFormat="pct0"
                  yMax={100}
                  height={220}
                />
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-[var(--text-muted)]">Frånvaro – lägre är bättre</p>
                <LineChart
                  ariaLabel="Frånvaroandel per termin, fyra läsår"
                  categories={termLabels}
                  series={[{ name: "Frånvaro", data: series.map((p) => (p.absenceRate != null ? Math.round(p.absenceRate * 1000) / 10 : null)) }]}
                  valueFormat="pct1"
                  height={220}
                />
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-[var(--text-muted)]">Snitt trygghet (1–4)</p>
                <LineChart
                  ariaLabel="Snitt trygghet per termin, fyra läsår"
                  categories={termLabels}
                  series={[{ name: "Trygghet", data: series.map((p) => (p.avgTrygghet != null ? Math.round(p.avgTrygghet * 100) / 100 : null)) }]}
                  valueFormat="dec1"
                  yMax={4}
                  height={220}
                />
              </div>
            </div>
          </Disclosure>
        </div>
      </Section>

      <Disclosure
        title="Hela åtgärdskön"
        description="Samtliga bevakade områden med direktlänkar – grönt betyder att inget kräver agerande just nu."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {actions.map((a) => (
            <Link key={a.label} href={a.href} className="block">
              <Card className="h-full p-4">
                <p className="text-sm font-medium text-[var(--text-muted)]">{a.label}</p>
                <p className={`mt-1 font-display text-3xl tabular ${ACTION_ACCENT[a.tone]}`}>{a.value}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{a.desc} →</p>
              </Card>
            </Link>
          ))}
        </div>
      </Disclosure>

      <Note tone="info">
        Demodata. Vyn sammanställer skolans befintliga underlag – tidig upptäckt, behörighetsprognos,
        utredningsskuld och utvecklingsbilden – och ersätter inte verksamhetens samlade professionella bedömning.
      </Note>
    </RoleGate>
  );
}

function InsatsRow({ insats: i, overdue = false }: { insats: Intervention; overdue?: boolean }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <Link href={`/insatser/${i.intervention_id}`} className="font-medium hover:text-[var(--gbg-blue)] hover:underline">
          {i.title}
        </Link>
        <p className="text-sm text-[var(--text-muted)]">
          {INTERVENTION_LEVEL_LABEL[i.level as InterventionLevel] ?? "Insats"}
          {i.subject ? ` · ${i.subject}` : ""}
        </p>
      </div>
      {i.follow_up_date && (
        <span className={`shrink-0 text-sm tabular ${overdue ? "font-semibold text-[var(--gbg-red-dark)]" : "text-[var(--text-muted)]"}`}>
          {dateShort(i.follow_up_date)}
        </span>
      )}
    </li>
  );
}

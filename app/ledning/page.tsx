import Link from "next/link";
import { RoleGate } from "@/components/role-gate";
import { PageHeader, Card, Section, Pill, Note } from "@/components/ui/primitives";
import { getActionQueue, getStadiumStatus, getInsatsUppfoljning, getVeckansFokus } from "@/lib/db/queries-ledning";
import { getSchoolTermTrends } from "@/lib/db/queries-trend";
import { getSchoolTermSeries } from "@/lib/db/queries-history";
import { getPriorityStudents } from "@/lib/db/queries-priority";
import { LineChart } from "@/components/charts";
import { ActionCoverage } from "@/components/student-action";
import { INTERVENTION_LEVEL_LABEL, type InterventionLevel } from "@/lib/constants";
import type { Intervention } from "@/lib/db/queries-resources";
import { pct, num, delta, deltaPct, dateShort } from "@/lib/format";

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
  // Elever som fångas av flera linser – underlag för åtgärdstäckningen (klientkortet
  // korsar id-listan med de åtgärder som startats i webbläsarens demo-store).
  const multiLensIds = getPriorityStudents()
    .filter((s) => s.lenses.length >= 2)
    .map((s) => s.student_id);
  const stadia = getStadiumStatus();
  const { overdue, upcoming } = getInsatsUppfoljning();
  const trends = getSchoolTermTrends();
  const series = getSchoolTermSeries();
  const termLabels = series.map((p) => p.label);

  return (
    <RoleGate view="ledning">
      <PageHeader
        kicker="Ledningsöversikt"
        title="Skolledarens kontrollvy"
        description="Det viktigaste att agera på just nu, läget per stadium och hur insatsarbetet följs upp. Varje kort länkar direkt till underlaget."
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
      </Section>

      <Section
        title="Åtgärdstäckning"
        description="Sluter loopen från upptäckt till handling: andelen prioriterade elever (flera linser) med en påbörjad åtgärd."
      >
        <ActionCoverage studentIds={multiLensIds} />
      </Section>

      <Section
        title="Att agera på"
        description="Hela åtgärdskön med direktlänkar – grönt betyder att inget kräver agerande just nu."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {actions.map((a) => (
            <Link key={a.label} href={a.href} className="block">
              <Card className="h-full p-4 transition-shadow hover:shadow-[var(--shadow-card-hover,var(--shadow-card))]">
                <p className="text-sm font-medium text-[var(--text-muted)]">{a.label}</p>
                <p className={`mt-1 font-display text-3xl tabular ${ACTION_ACCENT[a.tone]}`}>{a.value}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{a.desc} →</p>
              </Card>
            </Link>
          ))}
        </div>
      </Section>

      <Section
        title="Läget per stadium"
        description="Behov (signaler, trygghet, risk) mot resurser (särskilt stöd) per stadium. Status är den allvarligaste årskursstatusen inom stadiet."
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
          (behov ↔ resurser per arbetslag).
        </p>
      </Section>

      <Section
        title="Ger insatserna effekt – och följs de upp?"
        description="Pågående och planerade insatser mot sina uppföljningsdatum. Uppmätt effekt per insats finns på insatsens sida."
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <p className="mb-3 text-sm font-semibold text-[var(--text-muted)]">
              Passerad uppföljning ({num(overdue.length)})
            </p>
            {overdue.length === 0 ? (
              <p className="text-[var(--text-muted)]">Inga insatser har passerat sitt uppföljningsdatum.</p>
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {overdue.map((i) => (
                  <InsatsRow key={i.intervention_id} insats={i} overdue />
                ))}
              </ul>
            )}
          </Card>
          <Card className="p-5">
            <p className="mb-3 text-sm font-semibold text-[var(--text-muted)]">
              Kommande uppföljningar ({num(upcoming.length)})
            </p>
            {upcoming.length === 0 ? (
              <p className="text-[var(--text-muted)]">Inga planerade uppföljningar.</p>
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {upcoming.slice(0, 6).map((i) => (
                  <InsatsRow key={i.intervention_id} insats={i} />
                ))}
              </ul>
            )}
          </Card>
        </div>
      </Section>

      <Section
        title="Utveckling över tid"
        description="Skolans riktning över fyra läsår – rör vi oss åt rätt håll? Notera att kullarna skiftar mellan terminerna; jämför mönster, inte exakta nivåer."
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="p-5">
            <p className="mb-2 text-sm font-semibold text-[var(--text-muted)]">Snittmeritvärde (åk 7–10)</p>
            <LineChart
              ariaLabel="Snittmeritvärde per termin, fyra läsår"
              categories={termLabels}
              series={[{ name: "Meritvärde", data: series.map((p) => (p.avgMerit != null ? Math.round(p.avgMerit * 10) / 10 : null)) }]}
              valueFormat="dec1"
              height={240}
            />
          </Card>
          <Card className="p-5">
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
              height={240}
            />
          </Card>
          <Card className="p-5">
            <p className="mb-2 text-sm font-semibold text-[var(--text-muted)]">Frånvaro (hela skolan) – lägre är bättre</p>
            <LineChart
              ariaLabel="Frånvaroandel per termin, fyra läsår"
              categories={termLabels}
              series={[{ name: "Frånvaro", data: series.map((p) => (p.absenceRate != null ? Math.round(p.absenceRate * 1000) / 10 : null)) }]}
              valueFormat="pct1"
              height={240}
            />
          </Card>
        </div>
        <Card className="mt-4 p-4">
          <p className="mb-2 text-sm font-semibold text-[var(--text-muted)]">Innevarande läsår (HT → VT)</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {trends.map((t) => {
              const d = t.vt - t.ht;
              const up = d > 0.0005;
              const down = d < -0.0005;
              return (
                <span key={t.key} className="flex items-center gap-2 text-sm">
                  <span className="text-[var(--text-muted)]">{t.label}:</span>
                  <span className="tabular font-semibold">{t.format === "pct" ? pct(t.vt, 1) : num(t.vt, 1)}</span>
                  <Pill tone={up ? "positiv" : down ? "uppmarksam" : "neutral"}>
                    {t.format === "pct" ? `${deltaPct(d)} p.e.` : delta(d, 1)}
                  </Pill>
                </span>
              );
            })}
          </div>
        </Card>
      </Section>

      <Note tone="info">
        Demodata. Vyn sammanställer de befintliga modellerna – tidig upptäckt, behörighetsprognos,
        utredningsskuld och utvecklingslinsen – och ersätter inte verksamhetens samlade professionella bedömning.
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

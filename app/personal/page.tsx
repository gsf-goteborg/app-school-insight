import { RoleGate } from "@/components/role-gate";
import { PageHeader, Card, Section, Stat, Pill, Note } from "@/components/ui/primitives";
import { BarChart, LineChart } from "@/components/charts";
import { getStaffingSummary, getStaffingBySubject, getArbetslagLoad } from "@/lib/db/queries-resources";
import { getHrSummary, getHrMonthly, getSickByArbetslag } from "@/lib/db/queries-hr";
import { getArbetslagAlignment } from "@/lib/db/queries-alignment";
import { pct, num } from "@/lib/format";

const monthShort = new Intl.DateTimeFormat("sv-SE", { month: "short" });

export default function PersonalPage() {
  const summary = getStaffingSummary();
  const bySubject = getStaffingBySubject();
  const arbetslag = getArbetslagLoad();
  const hr = getHrSummary();
  const hrMonthly = getHrMonthly();
  const sickByArbetslag = getSickByArbetslag();
  const alignment = getArbetslagAlignment();
  const pressure = [...alignment]
    .filter((a) => a.flaggedPerSpecial != null)
    .sort((a, b) => (b.flaggedPerSpecial ?? 0) - (a.flaggedPerSpecial ?? 0))[0];
  const noSpecial = alignment.filter((a) => a.flaggedPerSpecial == null).map((a) => a.grades);

  return (
    <RoleGate view="personal">
      <PageHeader
        kicker="Personalplanering"
        title="Bemanning och kompetens"
        description="Stöd för att planera bemanning och kompetens utifrån elevernas behov."
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat
          label="Behörig undervisning"
          value={pct(summary.qualified_share, 0)}
          tone={summary.qualified_share >= 0.85 ? "positiv" : "uppmarksam"}
          hint="andel timmar med behörig lärare"
        />
        <Stat label="Lärartäthet" value={num(summary.density, 1)} hint="elever per lärartjänst" />
        <Stat label="Lärartjänster" value={num(summary.teacher_fte, 1)} hint="heltidstjänster" />
      </div>

      <Section title="Andel behörig undervisning per ämne" description="Ämnen längst ner kan behöva kompetensförsörjning.">
        <Card className="p-5">
          <BarChart
            ariaLabel="Andel behörig undervisning per ämne"
            categories={bySubject.map((s) => s.subject)}
            series={[{ name: "Andel behörig", data: bySubject.map((s) => Math.round(s.share * 100)) }]}
            colors={["#005293"]}
            valueFormat="pct0"
            horizontal
            height={Math.max(320, bySubject.length * 26)}
          />
        </Card>
      </Section>

      <Section title="Stadium" description="Bemanning och elevunderlag per stadium (Lågstadium åk 1–4, Mellanstadium åk 5–7, Högstadium åk 8–10).">
        <Card className="table-card">
          <table className="w-full text-[15px]">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-left text-sm text-[var(--text-muted)]">
                <th className="px-4 py-2.5 font-medium">Stadium</th>
                <th className="px-4 py-2.5 text-right font-medium">Medarbetare</th>
                <th className="px-4 py-2.5 text-right font-medium">Tjänster</th>
                <th className="px-4 py-2.5 text-right font-medium">Elever</th>
                <th className="px-4 py-2.5 text-right font-medium">Elever/tjänst</th>
              </tr>
            </thead>
            <tbody>
              {arbetslag.map((a) => {
                const load = a.fte ? a.students / a.fte : 0;
                return (
                  <tr key={a.arbetslag} className="border-b border-[var(--border-subtle)] last:border-0">
                    <td className="px-4 py-2.5 font-medium">{a.arbetslag}</td>
                    <td className="px-4 py-2.5 text-right tabular">{a.staff}</td>
                    <td className="px-4 py-2.5 text-right tabular">{num(a.fte, 1)}</td>
                    <td className="px-4 py-2.5 text-right tabular">{a.students}</td>
                    <td className="px-4 py-2.5 text-right">
                      {load > 0 ? <Pill tone={load > 14 ? "uppmarksam" : "neutral"}>{num(load, 1)}</Pill> : "–"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </Section>

      <Section
        title="HR-nyckeltal och sjukfrånvaro"
        description="Sjukfrånvaro, anställningstrygghet och personalomsättning som underlag för arbetsmiljö och bemanning."
      >
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Total sjukfrånvaro"
            value={pct(hr.total_sick_share, 1)}
            tone={hr.total_sick_share >= 0.06 ? "uppmarksam" : "positiv"}
            hint="tjänstevägd andel av arbetstid"
          />
          <Stat
            label="Långtidssjukskrivna"
            value={num(hr.long_term_count)}
            tone={hr.long_term_count > 0 ? "uppmarksam" : "neutral"}
            hint="≥ 12 % frånvaro"
          />
          <Stat
            label="Andel tillsvidareanställda"
            value={pct(hr.tillsvidare_share, 0)}
            tone={hr.tillsvidare_share >= 0.8 ? "positiv" : "uppmarksam"}
            hint="av antal medarbetare"
          />
          <Stat
            label="Medelanställningstid"
            value={`${num(hr.avg_years_employed, 1)} år`}
            hint="genomsnittlig anställningstid"
          />
          <Stat
            label="Medarbetare"
            value={num(hr.headcount)}
            hint={`motsvarar ${num(hr.total_fte, 1)} tjänster`}
          />
          <Stat
            label="Nyligen anställda"
            value={pct(hr.new_share, 0)}
            tone={hr.new_share >= 0.15 ? "uppmarksam" : "neutral"}
            hint="< 1 års anställning (omsättningsproxy)"
          />
        </div>

        <Card className="mb-4 p-5">
          <h3 className="mb-3 text-base font-semibold">Sjukfrånvaro per månad</h3>
          <LineChart
            ariaLabel="Sjukfrånvaro per månad, korttid och långtid"
            categories={hrMonthly.map((m) => monthShort.format(new Date(m.month)))}
            series={[
              { name: "Korttid (≤ 14 dgr)", data: hrMonthly.map((m) => m.sick_short_rate * 100) },
              { name: "Långtid (> 14 dgr)", data: hrMonthly.map((m) => m.sick_long_rate * 100) },
            ]}
            valueFormat="pct1"
            height={320}
          />
        </Card>

        <Card className="table-card">
          <table className="w-full text-[15px]">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-left text-sm text-[var(--text-muted)]">
                <th className="px-4 py-2.5 font-medium">Stadium</th>
                <th className="px-4 py-2.5 text-right font-medium">Medarbetare</th>
                <th className="px-4 py-2.5 text-right font-medium">Tjänster</th>
                <th className="px-4 py-2.5 text-right font-medium">Sjukfrånvaro</th>
              </tr>
            </thead>
            <tbody>
              {sickByArbetslag.map((a) => (
                <tr key={a.arbetslag} className="border-b border-[var(--border-subtle)] last:border-0">
                  <td className="px-4 py-2.5 font-medium">{a.arbetslag}</td>
                  <td className="px-4 py-2.5 text-right tabular">{a.headcount}</td>
                  <td className="px-4 py-2.5 text-right tabular">{num(a.fte, 1)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Pill tone={a.sick_share >= 0.08 ? "kritisk" : a.sick_share >= 0.06 ? "uppmarksam" : "positiv"}>
                      {pct(a.sick_share, 1)}
                    </Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Section>

      <Section
        title="Behov och resurser per stadium"
        description="Elevernas behov (flaggade i Tidig upptäckt, stödbehov och trygghet) ställt mot bemanningen per stadium, som underlag för att rikta resurser dit trycket är störst."
      >
        <Card className="mb-4 table-card">
          <table className="w-full text-[15px]">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-left text-sm text-[var(--text-muted)]">
                <th className="px-4 py-2.5 font-medium">Stadium</th>
                <th className="px-4 py-2.5 text-right font-medium">Elever</th>
                <th className="px-4 py-2.5 text-right font-medium">Flaggade</th>
                <th className="px-4 py-2.5 text-right font-medium">Hög risk</th>
                <th className="px-4 py-2.5 text-right font-medium">Stödbehov</th>
                <th className="px-4 py-2.5 text-right font-medium">Snitt trygghet</th>
                <th className="px-4 py-2.5 text-right font-medium">Spec.tjänster</th>
                <th className="px-4 py-2.5 text-right font-medium">Flaggade / spec.tjänst</th>
              </tr>
            </thead>
            <tbody>
              {alignment.map((a) => {
                const ratioTone = a.flaggedPerSpecial == null ? "neutral"
                  : a.flaggedPerSpecial >= 25 ? "kritisk" : a.flaggedPerSpecial >= 15 ? "uppmarksam" : "positiv";
                const tryggTone = a.avgTrygghet < 2.4 ? "kritisk" : a.avgTrygghet < 2.8 ? "uppmarksam" : "neutral";
                return (
                  <tr key={a.arbetslag} className="border-b border-[var(--border-subtle)] last:border-0">
                    <td className="px-4 py-2.5 font-medium">{a.arbetslag}<span className="block text-xs text-[var(--text-muted)]">{a.grades}</span></td>
                    <td className="px-4 py-2.5 text-right tabular">{num(a.students)}</td>
                    <td className="px-4 py-2.5 text-right tabular">{num(a.flagged)} <span className="text-[var(--text-muted)]">({pct(a.flaggedShare, 0)})</span></td>
                    <td className="px-4 py-2.5 text-right tabular">{num(a.hog)}</td>
                    <td className="px-4 py-2.5 text-right tabular">{num(a.supportNeed)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Pill tone={tryggTone}>{num(a.avgTrygghet, 1)}</Pill>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular">{num(a.specialFte, 2)}</td>
                    <td className="px-4 py-2.5 text-right">
                      {a.flaggedPerSpecial == null ? <span className="text-[var(--text-muted)]">–</span>
                        : <Pill tone={ratioTone}>{num(a.flaggedPerSpecial, 0)}</Pill>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <Card className="mb-4 p-5">
          <BarChart
            ariaLabel="Flaggade elever per speciallärartjänst och stadium"
            categories={alignment.map((a) => a.grades)}
            series={[{ name: "Flaggade elever per speciallärartjänst", data: alignment.map((a) => Math.round(a.flaggedPerSpecial ?? 0)) }]}
            colors={["#7f3f98"]}
            valueFormat="raw"
            horizontal
            height={Math.max(220, alignment.length * 52)}
          />
        </Card>

        {pressure && (
          <Note tone="uppmarksam">
            Störst tryck i förhållande till särskilt stöd finns i {pressure.grades} – omkring {num(pressure.flaggedPerSpecial ?? 0, 0)}{" "}
            flaggade elever per speciallärartjänst.
            {noSpecial.length > 0 && ` ${noSpecial.join(", ")} saknar egen speciallärarresurs och lutar sig mot övriga stadier.`}{" "}
            Använd detta tillsammans med bemanningsläget för att överväga omfördelning av stöd.
          </Note>
        )}
      </Section>

      <Note tone="info">
        Demodata. Låg behörighet i enskilda ämnen kan indikera behov av kompetensutveckling eller
        rekrytering – tolka tillsammans med verksamhetens kännedom.
      </Note>
    </RoleGate>
  );
}

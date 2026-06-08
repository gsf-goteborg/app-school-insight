import { PageHeader, Section, Note } from "@/components/ui/primitives";
import { BarChart } from "@/components/charts";
import { OverviewTable, type OverviewRow } from "@/components/overview-table";
import { getGradeOverview } from "@/lib/db/queries-overview";

export default function ArskursListPage() {
  const overview = getGradeOverview();
  const rows: OverviewRow[] = overview.map((g) => ({
    id: String(g.grade),
    href: `/arskurs/${g.grade}`,
    label: `Åk ${g.grade}`,
    m: g,
  }));

  const prioritera = overview.filter((g) => g.attention === "Prioritera").map((g) => `åk ${g.grade}`);

  return (
    <div>
      <PageHeader
        kicker="Årskurser"
        title="Jämför årskurser"
        description="Samma nyckeltal för alla årskurser så att du snabbt ser var behovet av uppmärksamhet är störst. Välj en årskurs för fördjupning."
      />

      <Section
        title="Flaggade och hög risk per årskurs"
        description="Antal elever med tidig signal (Tidig upptäckt), varav hög risk. Toppar visar var trycket är störst."
      >
        <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-sm">
          <BarChart
            ariaLabel="Flaggade elever och hög risk per årskurs"
            categories={overview.map((g) => `Åk ${g.grade}`)}
            series={[
              { name: "Flaggade", data: overview.map((g) => g.flagged) },
              { name: "Hög risk", data: overview.map((g) => g.hog) },
            ]}
            colors={["#82bbdb", "#e8364a"]}
            valueFormat="raw"
            height={300}
          />
        </div>
      </Section>

      <Section title="Jämförelse per årskurs" description="Färgen visar läget per nyckeltal. Rödmarkerad rad = prioritera.">
        <OverviewTable rows={rows} firstColLabel="Årskurs" />
      </Section>

      {prioritera.length > 0 && (
        <Note tone="uppmarksam">
          Att prioritera just nu: {prioritera.join(", ")}. Statusen väger samman trygghet, hög risk, närvaro och
          frånvarotrend – öppna årskursen för analys och nästa steg.
        </Note>
      )}
      <div className="mt-4">
        <Note tone="info">Demodata. Nyckeltalen är underlag för dialog – tolka tillsammans med verksamhetens kännedom.</Note>
      </div>
    </div>
  );
}

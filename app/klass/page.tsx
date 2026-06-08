import { PageHeader, Section, Note } from "@/components/ui/primitives";
import { OverviewTable, type OverviewRow } from "@/components/overview-table";
import { getClassOverview } from "@/lib/db/queries-overview";
import { STADIA, stadiumForGrade } from "@/lib/constants";

export default function KlassListPage() {
  const overview = getClassOverview();
  const prioritera = overview.filter((c) => c.attention === "Prioritera").map((c) => c.class_id);

  return (
    <div>
      <PageHeader
        kicker="Klasser"
        title="Jämför klasser"
        description="Samma nyckeltal för alla klasser, grupperade per stadium, så att du snabbt ser vilka klasser som behöver mest uppmärksamhet. Välj en klass för elevlista och fördjupning."
      />

      {STADIA.map((st) => {
        const rows: OverviewRow[] = overview
          .filter((c) => stadiumForGrade(c.grade) === st.key)
          .map((c) => ({
            id: c.class_id,
            href: `/klass/${c.class_id}`,
            label: c.class_id,
            sublabel: c.mentor ? `Mentor: ${c.mentor}` : undefined,
            m: c,
          }));
        if (rows.length === 0) return null;
        return (
          <Section key={st.key} title={`${st.key} (${st.range})`}>
            <OverviewTable rows={rows} firstColLabel="Klass" />
          </Section>
        );
      })}

      {prioritera.length > 0 && (
        <Note tone="uppmarksam">
          Klasser att prioritera just nu: {prioritera.join(", ")}. Statusen väger samman trygghet, hög risk, närvaro
          och frånvarotrend – öppna klassen för elevlista och nästa steg.
        </Note>
      )}
      <div className="mt-4">
        <Note tone="info">Demodata. Undvik att rangordna klasser slentrianmässigt – nyckeltalen är underlag för dialog.</Note>
      </div>
    </div>
  );
}

import Link from "next/link";
import { RoleGate } from "@/components/role-gate";
import { PageHeader, Card, Section, Stat, Note, Disclosure } from "@/components/ui/primitives";
import { PriorityList } from "@/components/priority-list";
import { getPriorityStudents, getPrioritySummary, LENS_META } from "@/lib/db/queries-priority";
import { num } from "@/lib/format";

export default function PrioriteraPage() {
  const rows = getPriorityStudents();
  const summary = getPrioritySummary(rows);

  return (
    <RoleGate view="prioritera">
      <PageHeader
        kicker="Prioriterade elever"
        title="Elever att prioritera"
        description="Korsar skolans sex underlag – tidiga signaler, behörighetsprognos, ihållande svårigheter, tappar mark, fallande flerårstrend och växande frånvaro – till en samlad bild. Elever som flaggas i flera oberoende underlag behöver sannolikt mest, särskilt utan formell stödprocess."
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Flaggas i något underlag" value={num(summary.total)} hint="av 400 aktiva elever" />
        <Stat label="Flaggas i flera underlag" value={num(summary.multi)} tone="uppmarksam" hint="minst två oberoende underlag" />
        <Stat
          label="Flera underlag utan formell stödprocess"
          value={num(summary.multiNoFormal)}
          tone="kritisk"
          hint="varken åtgärdsprogram eller utredning"
        />
      </div>

      <Section
        title="Samlad prioriteringslista"
        description="Varje rad visar vilka underlag som flaggar eleven och varför, samt elevens stödstatus. Namnet länkar till elevens fullständiga bild."
      >
        <PriorityList rows={rows} />
      </Section>

      <Disclosure
        title="Så fungerar prioriteringen"
        description="Listan tillför ingen ny modell – den korsar de befintliga underlagen per elev. Varje underlag är granskningsbart i sin egen vy."
      >
        <Card className="p-5">
          <ul className="space-y-2.5 text-[15px]">
            {LENS_META.map((l) => (
              <li key={l.key} className="grid grid-cols-1 gap-1 sm:grid-cols-[12rem_1fr] sm:gap-3">
                <Link href={l.href} className="font-medium text-[var(--gbg-blue)] hover:underline">
                  {l.label} →
                </Link>
                <span className="text-[var(--text-muted)]">{l.rule}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-[var(--border-subtle)] pt-3 text-sm text-[var(--text-muted)]">
            Sorteringen väger samman underlagens allvarlighetsgrad och om eleven saknar formell stödprocess.
            Underlagen är delvis överlappande (de läser samma data på olika sätt) – att flaggas
            i flera är en stark indikation, inte ett bevis.
          </p>
        </Card>
      </Disclosure>

      <Note tone="info">
        Demodata. Listan är ett underlag för elevhälsans och skolledningens prioritering – inte en automatisk
        rangordning av elever. Varje beslut behöver elevens hela bild och professionell bedömning.
      </Note>
    </RoleGate>
  );
}

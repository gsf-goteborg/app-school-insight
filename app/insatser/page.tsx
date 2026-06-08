import { PageHeader, Section, Note } from "@/components/ui/primitives";
import { InterventionList } from "@/components/intervention-list";
import { NewInterventionForm, UserInterventions } from "@/components/intervention-forms";
import { listInterventions } from "@/lib/db/queries-resources";
import { INTERVENTION_STATUS_LABEL, type InterventionStatus } from "@/lib/constants";

export default function InsatserPage() {
  const all = listInterventions();
  const byStatus = (s: InterventionStatus) => all.filter((i) => i.status === s);

  return (
    <div>
      <PageHeader
        kicker="Insatser"
        title="Insatser"
        description="Planerade, pågående och avslutade insatser – kopplade till den data som låg bakom dem."
        right={<NewInterventionForm />}
      />

      {(["pagaende", "planerad", "avslutad"] as InterventionStatus[]).map((s) => {
        const items = byStatus(s);
        if (items.length === 0) return null;
        return (
          <Section key={s} title={INTERVENTION_STATUS_LABEL[s]} description={`${items.length} insatser`}>
            <InterventionList interventions={items} />
          </Section>
        );
      })}

      <Section title="Dina tillagda insatser" description="Insatser du skapar i demon. Sparas lokalt i webbläsaren.">
        <UserInterventions />
      </Section>

      <Note tone="info">
        Demodata. Insatser du skapar sparas lokalt i din webbläsare och kan tas bort med “Återställ demodata”.
      </Note>
    </div>
  );
}

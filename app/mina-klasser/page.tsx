import { RoleGate } from "@/components/role-gate";
import { PageHeader, Note } from "@/components/ui/primitives";
import { MyClasses, type MinaClassData } from "@/components/my-classes";
import { getClassOverview } from "@/lib/db/queries-overview";
import { getEarlyWarnings } from "@/lib/db/queries-risk";
import { getDevelopment } from "@/lib/db/queries-development";

// Lärarens primära ingång: egna klasser i stället för helskolevyer (vision:
// "For Teachers"). RSC:n bakar in ett kompakt underlag för ALLA klasser;
// klientkomponenten filtrerar till lärarens val (localStorage, statisk export).

export default function MinaKlasserPage() {
  const overview = getClassOverview();
  const warnings = getEarlyWarnings().filter((w) => w.level !== "Bevaka");
  const development = getDevelopment();

  const classes: MinaClassData[] = overview.map((c) => ({
    class_id: c.class_id,
    grade: c.grade,
    mentor: c.mentor,
    attendanceRate: c.attendanceRate,
    avgTrygghet: c.avgTrygghet,
    attention: c.attention,
    flagged: warnings
      .filter((w) => w.class_id === c.class_id)
      .map((w) => ({ id: w.student_id, name: w.name, level: w.level, action: w.action })),
    stretch: development
      .filter((d) => d.class_id === c.class_id && d.category === "stretch")
      .map((d) => ({ id: d.student_id, name: d.name })),
    tappar: development
      .filter((d) => d.class_id === c.class_id && d.category === "tappar")
      .map((d) => ({ id: d.student_id, name: d.name })),
  }));

  return (
    <RoleGate view="mina">
      <PageHeader
        kicker="Mina klasser"
        title="Mina klasser"
        description="Det viktigaste i dina klasser: vilka elever som behöver stöd eller utmaning den här veckan, med förslag på nästa steg. Välj dina klasser en gång – valet sparas i din webbläsare."
      />

      <MyClasses classes={classes} />

      <div className="mt-8">
        <Note tone="info">
          Demodata. I en skarp lösning följer klasstillhörigheten av tjänstefördelningen – här väljer
          du själv klasser för att prova lärarperspektivet. Signalerna är underlag för din egen
          bedömning, inte färdiga slutsatser om elever.
        </Note>
      </div>
    </RoleGate>
  );
}

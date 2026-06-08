import { PageHeader, Note } from "@/components/ui/primitives";
import { StudentSearch } from "@/components/student-search";
import { getAllStudents } from "@/lib/db/queries";

export default function ElevListPage() {
  const students = getAllStudents();
  return (
    <div>
      <PageHeader
        kicker="Elever"
        title="Sök elev"
        description="Slå upp en enskild elev för en samlad bild av närvaro, resultat och insatser."
      />
      <StudentSearch students={students} />
      <div className="mt-6">
        <Note tone="info">
          Elevvyn är medvetet återhållsam och undviker etiketter. Demodata – inga riktiga personuppgifter.
        </Note>
      </div>
    </div>
  );
}

import Link from "next/link";
import { Card, Stat, Note } from "@/components/ui/primitives";
import { GroupedScatter } from "@/components/charts";
import { getResultMatrix, MATRIX_CATEGORIES, NIVA_BOUNDS, type MatrixCategory, type MatrixStudent } from "@/lib/db/queries-history";
import { num } from "@/lib/format";

// Resultatmatrisen nivå × trend: fyra namngivna elevgrupper (PCA-inspirerad,
// men med förklarbara axlar i stället för komponenter). Renderas på Analys.

const GROUP_COLOR: Record<MatrixCategory, string> = {
  lag_still: "#e8364a",
  lag_upp: "#7f3f98",
  hog_tappar: "#f47815",
  hog_haller: "#6a9a1f",
  mitten: "#b0bcc6",
  okand: "#b0bcc6",
};

/** Max antal elever per hörnlista – resten nås via diagrammet/klassvyerna. */
const CHIP_CAP = 10;

function StudentChips({ students }: { students: MatrixStudent[] }) {
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {students.slice(0, CHIP_CAP).map((s) => (
        <li key={s.student_id}>
          <Link
            href={`/elev/${s.student_id}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2 hover:bg-[var(--surface-muted)]"
          >
            <span className="min-w-0">
              <span className="font-medium hover:text-[var(--gbg-blue)] hover:underline">{s.name}</span>
              <span className="ml-2 text-sm text-[var(--text-muted)]">åk {s.grade_level} · {s.class_id}</span>
            </span>
            {s.stepsPerYear != null && (
              <span className="shrink-0 text-sm tabular text-[var(--text-muted)]">
                {s.stepsPerYear > 0 ? "+" : "−"}{Math.abs(s.stepsPerYear).toFixed(1).replace(".", ",")} steg/läsår
              </span>
            )}
          </Link>
        </li>
      ))}
      {students.length > CHIP_CAP && (
        <li className="flex items-center rounded-lg border border-dashed border-[var(--border-strong)] px-3 py-2 text-sm text-[var(--text-muted)]">
          + {students.length - CHIP_CAP} elever till – hovra i diagrammet ovan eller öppna respektive klasslista.
        </li>
      )}
    </ul>
  );
}

export function ResultMatrix() {
  const matrix = getResultMatrix();
  const byCat = (key: MatrixCategory) => matrix.filter((m) => m.category === key);
  const counts = Object.fromEntries(MATRIX_CATEGORIES.map((c) => [c.key, byCat(c.key).length])) as Record<MatrixCategory, number>;

  // Centrera nivåaxeln på respektive skalas mittlinje (mitt emellan hög- och
  // låggränsen) så att 0/0-korset delar diagrammet i fyra rutor trots att
  // betygs- och omdömesskalan har olika gränser.
  const mid = {
    betyg: (NIVA_BOUNDS.betyg.hog + NIVA_BOUNDS.betyg.lag) / 2,
    niva: (NIVA_BOUNDS.niva.hog + NIVA_BOUNDS.niva.lag) / 2,
  };
  const plottable = matrix.filter((m) => m.stepsPerYear != null);
  const groups = MATRIX_CATEGORIES.filter((c) => c.key !== "okand").map((c) => ({
    name: c.label,
    color: GROUP_COLOR[c.key],
    points: plottable
      .filter((m) => m.category === c.key)
      .map((m) => ({
        x: Math.round((m.niva - mid[m.scale]) * 100),
        y: Math.round(m.stepsPerYear! * 100) / 100,
        label: m.name,
        id: m.student_id,
      })),
  }));

  const hogTappar = byCat("hog_tappar");
  const lagUpp = byCat("lag_upp");

  return (
    <div>
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {MATRIX_CATEGORIES.filter((c) => c.key !== "mitten" && c.key !== "okand").map((c) => (
          <Stat key={c.key} label={c.label} value={num(counts[c.key])} tone={c.tone} />
        ))}
      </div>

      <Card className="mb-4 p-5">
        <GroupedScatter
          ariaLabel="Elever placerade efter nuvarande resultatnivå och flerterminstrend, fyra kvadranter"
          groups={groups}
          xName="Nivå (procentenheter från mittlinjen)"
          yName="Trend (steg/läsår)"
          xLines={[0]}
          yLines={[0]}
          linkPrefix="/elev/"
          height={420}
        />
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          Varje punkt är en elev – <strong>hovra för namn, klicka för att öppna elevens sida</strong>. Korset delar
          diagrammet i fyra rutor: höger = hög nivå, vänster = låg, uppåt = stigande, nedåt = fallande.{" "}
          {num(plottable.length)} av {num(matrix.length)} elever har minst fyra terminers historik ({num(counts.okand)}{" "}
          har för kort, främst åk 1). Mittenfältet ({num(counts.mitten)} elever) visas i grått nära mittlinjen.
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <p className="mb-1 text-sm font-semibold text-[var(--text-muted)]">
            Höga resultat – börjar tappa ({num(hogTappar.length)})
          </p>
          <p className="mb-3 text-sm text-[var(--text-muted)]">
            Lätt att missa: resultaten ser fortfarande goda ut, men flerterminstrenden pekar nedåt.
          </p>
          {hogTappar.length === 0 ? (
            <p className="text-[var(--text-muted)]">Inga elever just nu.</p>
          ) : (
            <StudentChips students={hogTappar} />
          )}
        </Card>
        <Card className="p-5">
          <p className="mb-1 text-sm font-semibold text-[var(--text-muted)]">
            Låga resultat – på väg uppåt ({num(lagUpp.length)})
          </p>
          <p className="mb-3 text-sm text-[var(--text-muted)]">
            Det som verkar fungera: håll i pågående stöd och bekräfta vad som gör skillnad.
          </p>
          {lagUpp.length === 0 ? (
            <p className="text-[var(--text-muted)]">Inga elever just nu.</p>
          ) : (
            <StudentChips students={lagUpp} />
          )}
        </Card>
      </div>

      <div className="mt-4">
        <Note tone="neutral">
          <strong>Så beräknas matrisen.</strong> Nivå = snittresultat vårterminen 2026 (betygspoäng åk 7–10, bedömningsnivåer
          åk 1–6); hög ≈ snitt C eller tydligt över förväntan, låg = under snitt D respektive klart under &quot;i linje&quot;.
          Trend = samma flerterminslutning som i underlaget Fallande trend (minst fyra terminer). Angreppssättet är inspirerat
          av en huvudkomponentanalys (PCA) på dessa mått – där laddar första komponenten på nivå och andra på trend – men
          axlarna används direkt så att varje elevs placering går att förklara. Gruppen &quot;låga resultat – står stilla
          eller faller&quot; ({num(counts.lag_still)} elever) fångas redan i{" "}
          <Link href="/prioritera" className="font-semibold text-[var(--gbg-blue)] underline">Prioriterade elever</Link>.
        </Note>
      </div>
    </div>
  );
}

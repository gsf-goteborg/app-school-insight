import "server-only";
import { all } from "./index";
import { STADIA, stadiumForGrade, type Stadium } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Elevpeng / resurstilldelning (§5.6)
//
// Kommunens resurstilldelning till skolan. Elevpeng per elev =
//   grundbelopp (efter stadium) + socioekonomiskt strukturtillägg.
// Strukturtillägg per elev = max(0, klassens index − baslinje) × belopp/index.
// Beräkningen sker server-side från funding_parameters + students → classes.
// ---------------------------------------------------------------------------

type FundingKey =
  | "grundbelopp_lag"
  | "grundbelopp_mellan"
  | "grundbelopp_hog"
  | "baseline_index"
  | "strukturbelopp_per_index";

function getFundingParameters(): Record<FundingKey, number> {
  const rows = all<{ key: string; value: number }>(`select key, value from funding_parameters`);
  const map = {} as Record<FundingKey, number>;
  for (const r of rows) map[r.key as FundingKey] = r.value;
  return map;
}

/** Grundbelopp per elev efter stadium (Lågstadium 1–4, Mellanstadium 5–7, Högstadium 8–10). */
function grundbeloppOf(grade: number, p: Record<FundingKey, number>): number {
  const s = stadiumForGrade(grade);
  if (s === "Lågstadium") return p.grundbelopp_lag;
  if (s === "Mellanstadium") return p.grundbelopp_mellan;
  return p.grundbelopp_hog;
}

export interface ElevpengStadium {
  stadium: Stadium;
  range: string;
  students: number;
  avg_index: number; // elevviktat snittindex inom stadiet
  grundbelopp: number; // summa grundbelopp-del
  strukturtillagg: number; // summa socioekonomisk strukturtilläggs-del
  summa: number; // total elevpeng för stadiet (helår)
}

export interface ElevpengBreakdown {
  total: number; // total elevpeng helår
  grundbelopp: number; // total grundbelopp-del
  strukturtillagg: number; // total socioekonomisk strukturtilläggs-del
  strukturandel: number; // strukturtillägg som andel av total (0–1)
  students: number; // antal elever
  avg_per_student: number; // snitt elevpeng per elev
  avg_index: number; // skolans elevviktade snittindex
  by_stadium: ElevpengStadium[];
}

const STADIUM_ORDER: Stadium[] = STADIA.map((s) => s.key);
const RANGE_OF: Record<Stadium, string> = Object.fromEntries(STADIA.map((s) => [s.key, s.range])) as Record<Stadium, string>;

export function getElevpengBreakdown(): ElevpengBreakdown {
  const p = getFundingParameters();
  const rows = all<{ grade_level: number; socioeconomic_index: number }>(
    `select s.grade_level, c.socioeconomic_index
       from students s
       join classes c on c.class_id = s.class_id
      where s.active = 1`,
  );

  const buckets = new Map<
    Stadium,
    { students: number; index_sum: number; grundbelopp: number; strukturtillagg: number }
  >();

  let totGrund = 0;
  let totStruktur = 0;
  let totIndex = 0;

  for (const r of rows) {
    const grund = grundbeloppOf(r.grade_level, p);
    const struktur =
      Math.max(0, r.socioeconomic_index - p.baseline_index) * p.strukturbelopp_per_index;
    const key = stadiumForGrade(r.grade_level);

    const b =
      buckets.get(key) ?? { students: 0, index_sum: 0, grundbelopp: 0, strukturtillagg: 0 };
    b.students += 1;
    b.index_sum += r.socioeconomic_index;
    b.grundbelopp += grund;
    b.strukturtillagg += struktur;
    buckets.set(key, b);

    totGrund += grund;
    totStruktur += struktur;
    totIndex += r.socioeconomic_index;
  }

  const students = rows.length;
  const total = totGrund + totStruktur;

  const by_stadium: ElevpengStadium[] = STADIUM_ORDER.filter((s) => buckets.has(s)).map((s) => {
    const b = buckets.get(s)!;
    return {
      stadium: s,
      range: RANGE_OF[s],
      students: b.students,
      avg_index: b.students ? b.index_sum / b.students : 0,
      grundbelopp: b.grundbelopp,
      strukturtillagg: b.strukturtillagg,
      summa: b.grundbelopp + b.strukturtillagg,
    };
  });

  return {
    total,
    grundbelopp: totGrund,
    strukturtillagg: totStruktur,
    strukturandel: total ? totStruktur / total : 0,
    students,
    avg_per_student: students ? total / students : 0,
    avg_index: students ? totIndex / students : 0,
    by_stadium,
  };
}

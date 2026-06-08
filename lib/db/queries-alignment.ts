import "server-only";
import { all } from "./index";
import { CURRENT_TERM, STADIA, STADIUM_RANGE, stadiumForGrade } from "@/lib/constants";
import { getEarlyWarnings } from "./queries-risk";

// ---------------------------------------------------------------------------
// Behov ↔ resurser (§6.7: koppling mellan behov och resursplanering).
//
// Sammanför elevernas behov (flaggade i Tidig upptäckt, stödbehov, trygghet) med
// bemanningen per arbetslag, så att skolledningen ser var trycket är störst i
// förhållande till de särskilda stödresurser som finns. Allt är demodata.
// ---------------------------------------------------------------------------

const ARBETSLAG_ORDER: string[] = STADIA.map((s) => s.key);
const GRADE_RANGE: Record<string, string> = STADIUM_RANGE;

function arbetslagForGrade(g: number): string {
  return stadiumForGrade(g);
}

export interface ArbetslagAlignment {
  arbetslag: string;
  grades: string;
  students: number;
  flagged: number;
  flaggedShare: number;
  hog: number;
  supportNeed: number;      // elever med extra anpassning eller åtgärdsprogram
  avgTrygghet: number;      // 1–4, innevarande termin
  teacherFte: number;       // undervisande tjänster (lärare + speciallärare)
  specialFte: number;       // särskilt stöd (speciallärare + specialpedagog)
  studentsPerTeacher: number;
  flaggedPerSpecial: number | null; // flaggade elever per speciallärartjänst (null om ingen)
}

export function getArbetslagAlignment(): ArbetslagAlignment[] {
  const studentRows = all<{ arbetslag: string; n: number; support: number }>(
    `select c.arbetslag,
       count(*) n,
       sum(case when s.extra_anpassning = 1 or s.atgardsprogram = 1 then 1 else 0 end) support
     from students s join classes c on c.class_id = s.class_id
     where s.active = 1
     group by c.arbetslag`,
  );
  const staffRows = all<{ arbetslag: string; teacher_fte: number; special_fte: number }>(
    `select arbetslag,
       coalesce(sum(case when role in ('larare','speciallarare') then fte else 0 end), 0) teacher_fte,
       coalesce(sum(case when role in ('speciallarare','specialpedagog') then fte else 0 end), 0) special_fte
     from staff where arbetslag is not null
     group by arbetslag`,
  );
  const wbRows = all<{ arbetslag: string; trygghet: number }>(
    `select c.arbetslag, avg(w.trygghet) trygghet
     from wellbeing_surveys w
     join students s on s.student_id = w.student_id
     join classes c on c.class_id = s.class_id
     where w.term = ?
     group by c.arbetslag`,
    CURRENT_TERM,
  );

  // Flaggade elever per arbetslag (från riskmodellen).
  const warnings = getEarlyWarnings();
  const flaggedByAl = new Map<string, number>();
  const hogByAl = new Map<string, number>();
  for (const w of warnings) {
    const al = arbetslagForGrade(w.grade_level);
    flaggedByAl.set(al, (flaggedByAl.get(al) ?? 0) + 1);
    if (w.level === "Hög") hogByAl.set(al, (hogByAl.get(al) ?? 0) + 1);
  }

  const studentsByAl = new Map(studentRows.map((r) => [r.arbetslag, r]));
  const staffByAl = new Map(staffRows.map((r) => [r.arbetslag, r]));
  const tryggByAl = new Map(wbRows.map((r) => [r.arbetslag, r.trygghet]));

  return ARBETSLAG_ORDER.filter((al) => studentsByAl.has(al)).map((al) => {
    const st = studentsByAl.get(al)!;
    const staff = staffByAl.get(al) ?? { teacher_fte: 0, special_fte: 0 };
    const flagged = flaggedByAl.get(al) ?? 0;
    return {
      arbetslag: al,
      grades: GRADE_RANGE[al] ?? al,
      students: st.n,
      flagged,
      flaggedShare: st.n ? flagged / st.n : 0,
      hog: hogByAl.get(al) ?? 0,
      supportNeed: st.support,
      avgTrygghet: tryggByAl.get(al) ?? 0,
      teacherFte: staff.teacher_fte,
      specialFte: staff.special_fte,
      studentsPerTeacher: staff.teacher_fte ? st.n / staff.teacher_fte : 0,
      flaggedPerSpecial: staff.special_fte ? flagged / staff.special_fte : null,
    };
  });
}

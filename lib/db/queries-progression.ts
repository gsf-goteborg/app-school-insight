import "server-only";
import { one } from "./index";

// ---------------------------------------------------------------------------
// Stödinsatser per elev (extra anpassning / åtgärdsprogram / utredning)
// ---------------------------------------------------------------------------
export interface StudentSupport {
  extra_anpassning: number;
  atgardsprogram: number;
  utredning_pagaende: number;
}

/** Hämtar elevens stödflaggor. åtgärdsprogram ⊂ extra anpassning. */
export function getStudentSupport(studentId: string): StudentSupport {
  return (
    one<StudentSupport>(
      `select extra_anpassning, atgardsprogram, utredning_pagaende from students where student_id = ?`,
      studentId,
    ) ?? { extra_anpassning: 0, atgardsprogram: 0, utredning_pagaende: 0 }
  );
}

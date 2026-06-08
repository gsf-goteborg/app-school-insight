import "server-only";
import { all, one } from "./index";

// ---------------------------------------------------------------------------
// Ekonomi (§5.6)
// ---------------------------------------------------------------------------
export interface BudgetMonth { category: string; month: string; budget: number; actual: number | null }
export function getBudgetMonthly(): BudgetMonth[] {
  return all<BudgetMonth>(`select category, month, budget, actual from budget_items order by category, month`);
}

export interface Forecast { category: string; full_year_budget: number; full_year_forecast: number; deviation: number }
export function getForecasts(): Forecast[] {
  return all<Forecast>(
    `select category, full_year_budget, full_year_forecast,
       full_year_forecast - full_year_budget as deviation
     from financial_forecasts order by (full_year_forecast - full_year_budget) desc`,
  );
}

export interface EconomyTotals { budget_ytd: number; actual_ytd: number; full_year_budget: number; full_year_forecast: number }
export function getEconomyTotals(): EconomyTotals {
  const ytd = one<{ budget_ytd: number; actual_ytd: number }>(
    `select coalesce(sum(budget),0) budget_ytd, coalesce(sum(actual),0) actual_ytd
     from budget_items where actual is not null`,
  )!;
  const fy = one<{ full_year_budget: number; full_year_forecast: number }>(
    `select coalesce(sum(full_year_budget),0) full_year_budget, coalesce(sum(full_year_forecast),0) full_year_forecast
     from financial_forecasts`,
  )!;
  return { ...ytd, ...fy };
}

export function getCostPerStudent(): number {
  const t = getEconomyTotals();
  const n = one<{ n: number }>(`select count(*) n from students`)!.n || 1;
  return t.full_year_forecast / n;
}

// ---------------------------------------------------------------------------
// Personalplanering (§5.7)
// ---------------------------------------------------------------------------
export interface StaffingSummary {
  teacher_fte: number;
  students: number;
  density: number; // elever per lärartjänst
  qualified_hours: number;
  total_hours: number;
  qualified_share: number; // andel undervisningstimmar med behörig lärare
}
export function getStaffingSummary(): StaffingSummary {
  const teacher = one<{ fte: number }>(`select coalesce(sum(fte),0) fte from staff where role in ('larare','speciallarare')`)!;
  const students = one<{ n: number }>(`select count(*) n from students`)!.n;
  const hours = one<{ q: number; t: number }>(
    `select coalesce(sum(case when is_qualified=1 then hours_per_week else 0 end),0) q,
            coalesce(sum(hours_per_week),0) t
     from staff_assignments where subject is not null and subject <> 'Basundervisning'`,
  )!;
  return {
    teacher_fte: teacher.fte,
    students,
    density: teacher.fte ? students / teacher.fte : 0,
    qualified_hours: hours.q,
    total_hours: hours.t,
    qualified_share: hours.t ? hours.q / hours.t : 0,
  };
}

export interface SubjectStaffing { subject: string; assignments: number; qualified: number; share: number; hours: number }
export function getStaffingBySubject(): SubjectStaffing[] {
  return all<SubjectStaffing>(
    `select subject,
       count(*) assignments,
       sum(case when is_qualified=1 then 1 else 0 end) qualified,
       cast(sum(case when is_qualified=1 then 1 else 0 end) as real)/count(*) share,
       coalesce(sum(hours_per_week),0) hours
     from staff_assignments
     where subject is not null and subject <> 'Basundervisning'
     group by subject order by share asc`,
  );
}

export interface ArbetslagLoad { arbetslag: string; staff: number; fte: number; students: number }
export function getArbetslagLoad(): ArbetslagLoad[] {
  return all<ArbetslagLoad>(
    `select s.arbetslag,
       count(*) staff,
       coalesce(sum(s.fte),0) fte,
       (select count(*) from students st join classes c on c.class_id=st.class_id where c.arbetslag = s.arbetslag) students
     from staff s where s.arbetslag is not null
     group by s.arbetslag order by s.arbetslag`,
  );
}

// ---------------------------------------------------------------------------
// Insatser (§6.6)
// ---------------------------------------------------------------------------
export interface Intervention {
  intervention_id: number; title: string; level: string;
  target_grade: number | null; target_class_id: string | null; target_student_id: string | null;
  subject: string | null; start_date: string | null; follow_up_date: string | null;
  owner_role: string | null; hypothesis: string | null; planned_action: string | null;
  expected_effect: string | null; outcome: string | null; status: string; is_demo: number; created_at: string;
}
export function listInterventions(): Intervention[] {
  return all<Intervention>(`select * from interventions order by
    case status when 'pagaende' then 0 when 'planerad' then 1 else 2 end, follow_up_date`);
}
export function getIntervention(id: number): Intervention | undefined {
  return one<Intervention>(`select * from interventions where intervention_id = ?`, id);
}
export interface Followup { followup_id: number; intervention_id: number; date: string; note: string; effect_observed: string | null }
export function getFollowups(id: number): Followup[] {
  return all<Followup>(`select * from intervention_followups where intervention_id = ? order by date`, id);
}
export function getInterventionsForGrade(grade: number): Intervention[] {
  return all<Intervention>(`select * from interventions where target_grade = ? order by status, follow_up_date`, grade);
}
export function getInterventionsForClass(classId: string): Intervention[] {
  return all<Intervention>(
    `select * from interventions where target_class_id = ? order by status, follow_up_date`, classId,
  );
}
export function getInterventionsForStudent(studentId: string, classId: string, grade: number): Intervention[] {
  return all<Intervention>(
    `select * from interventions
     where target_student_id = ? or target_class_id = ? or target_grade = ?
     order by status, follow_up_date`,
    studentId, classId, grade,
  );
}

// ---------------------------------------------------------------------------
// Kommentarer / kollegial analys (§6.3)
// ---------------------------------------------------------------------------
export interface Comment { comment_id: number; scope: string; scope_ref: string; author_role: string; body: string; created_at: string; is_demo: number }
export function getComments(scope: string, ref: string): Comment[] {
  return all<Comment>(`select * from comments where scope = ? and scope_ref = ? order by created_at desc`, scope, ref);
}

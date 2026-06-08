-- Behörighet och återställning.
-- Demon har ingen skarp inloggning (§13). RLS aktiveras ändå "från början"
-- (§15): publik läsning på alla tabeller, men skrivning endast på insats- och
-- kommentarstabellerna och endast för användarskapade rader (is_demo = false).
-- I en skarp lösning ersätts read_all-policyn av rollstyrda policyer per roll i
-- lib/roles.ts.

-- Aktivera RLS + publik läspolicy på samtliga tabeller.
do $$
declare t text;
begin
  foreach t in array array[
    'user_roles','school_terms','staff','classes','students','staff_assignments',
    'attendance_records','literacy_numeracy_assessments','written_assessments',
    'subject_grades','national_tests','interventions','intervention_followups',
    'comments','budget_items','financial_forecasts'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists read_all on %I', t);
    execute format('create policy read_all on %I for select using (true)', t);
  end loop;
end $$;

-- Skrivpolicyer (endast användarskapade rader).
drop policy if exists write_intervention on interventions;
create policy write_intervention on interventions
  for insert with check (is_demo = false);

drop policy if exists update_intervention on interventions;
create policy update_intervention on interventions
  for update using (is_demo = false) with check (is_demo = false);

drop policy if exists write_followup on intervention_followups;
create policy write_followup on intervention_followups
  for insert with check (is_demo = false);

drop policy if exists write_comment on comments;
create policy write_comment on comments
  for insert with check (is_demo = false);

-- Rättigheter för API-rollerna.
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update on interventions to anon, authenticated;
grant insert on intervention_followups to anon, authenticated;
grant insert on comments to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- Återställ demodata: ta bort allt användarskapat (§14). security definer för
-- att kringgå RLS vid radering.
create or replace function reset_demo() returns void
  language sql security definer set search_path = public as $$
  delete from intervention_followups where is_demo = false;
  delete from interventions where is_demo = false;
  delete from comments where is_demo = false;
$$;

grant execute on function reset_demo() to anon, authenticated;

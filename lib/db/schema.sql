-- SQLite-schema för Skolinsikt (demodata, byggs av scripts/seed.ts).
-- Speglar Postgres-migrationerna i supabase/migrations (framtida Supabase-mål).
-- Fast "idag" för demon: 2026-05-15 (inlinat i vyerna nedan).
-- Booleska värden lagras som 0/1.

pragma journal_mode = wal;
pragma foreign_keys = on;

create table user_roles (
  key   text primary key,
  label text not null
);

create table school_terms (
  key        text primary key,
  label      text not null,
  start_date text not null,
  end_date   text not null
);

create table staff (
  staff_id        text primary key,
  first_name      text not null,
  last_name       text not null,
  role            text not null,
  arbetslag       text,
  fte             real not null default 1.0,
  -- HR-nyckeltal (demodata). sick_share = sjukfrånvaro som andel av arbetstid
  -- innevarande läsår; employment_type = tillsvidare|visstid.
  sick_share      real not null default 0,
  employment_type text not null default 'tillsvidare',
  years_employed  real not null default 0,
  is_demo         integer not null default 1
);

create table classes (
  class_id            text primary key,
  grade_level         integer not null,
  suffix              text not null,
  arbetslag           text not null,
  mentor_staff_id     text references staff(staff_id),
  -- Socioekonomiskt strukturindex (riksgenomsnitt = 100, högre = större behov).
  -- Styr det socioekonomiska tillägget i elevpengen.
  socioeconomic_index real not null default 100,
  is_demo             integer not null default 1
);

create table students (
  student_id       text primary key,
  first_name       text not null,
  last_name        text not null,
  grade_level      integer not null,
  class_id         text not null references classes(class_id),
  gender           text not null,
  active           integer not null default 1,
  -- Stödinsatser på elevnivå (§5.7). extra_anpassning ⊇ atgardsprogram.
  extra_anpassning   integer not null default 0,
  atgardsprogram     integer not null default 0,
  utredning_pagaende integer not null default 0,
  is_demo          integer not null default 1
);

create table staff_assignments (
  assignment_id  text primary key,
  staff_id       text not null references staff(staff_id),
  class_id       text references classes(class_id),
  subject        text,
  grade_level    integer,
  hours_per_week real,
  is_qualified   integer not null default 1,
  is_demo        integer not null default 1
);

create table attendance_records (
  attendance_id  integer primary key autoincrement,
  student_id     text not null references students(student_id),
  date           text not null,
  status         text not null,
  minutes_absent integer not null default 0,
  is_demo        integer not null default 1
);
create index idx_attendance_student_date on attendance_records(student_id, date);
create index idx_attendance_date on attendance_records(date);

-- Historisk närvaro per termin (tre tidigare läsår). Dagliga närvarorader
-- finns endast för innevarande läsår; historiken är terminsaggregat – samma
-- upplösning som skolans egen flerårsrapport för frånvaro.
create table attendance_term_history (
  history_id  integer primary key autoincrement,
  student_id  text not null references students(student_id),
  term        text not null references school_terms(key),
  days_total  integer not null,
  days_absent integer not null,
  is_demo     integer not null default 1
);
create index idx_attendance_history_student on attendance_term_history(student_id);
create index idx_attendance_history_term on attendance_term_history(term);

create table literacy_numeracy_assessments (
  assessment_id     integer primary key autoincrement,
  student_id        text not null references students(student_id),
  term              text not null references school_terms(key),
  area              text not null,
  level             text not null,
  progression_score real,
  comment           text,
  is_demo           integer not null default 1
);
create index idx_lna_student on literacy_numeracy_assessments(student_id);

create table written_assessments (
  assessment_id integer primary key autoincrement,
  student_id    text not null references students(student_id),
  term          text not null references school_terms(key),
  subject       text not null,
  level         text not null,
  comment       text,
  is_demo       integer not null default 1
);
create index idx_written_student on written_assessments(student_id);

create table subject_grades (
  grade_id   integer primary key autoincrement,
  student_id text not null references students(student_id),
  term       text not null references school_terms(key),
  subject    text not null,
  grade      text not null,
  is_final   integer not null default 0,
  is_demo    integer not null default 1
);
create index idx_grades_student on subject_grades(student_id);

create table national_tests (
  test_id    integer primary key autoincrement,
  student_id text not null references students(student_id),
  term       text not null references school_terms(key),
  subject    text not null,
  grade      text not null,
  is_demo    integer not null default 1
);
create index idx_nat_student on national_tests(student_id);

-- Trivselenkät / wellbeing per elev och termin (§ vision: wellbeing-data).
-- Skala 1–4 där 4 = bäst. Tre dimensioner: trivsel, trygghet, arbetsro (studiero).
create table wellbeing_surveys (
  survey_id  integer primary key autoincrement,
  student_id text not null references students(student_id),
  term       text not null references school_terms(key),
  trivsel    integer not null,
  trygghet   integer not null,
  studiero   integer not null,
  is_demo    integer not null default 1
);
create index idx_wellbeing_student on wellbeing_surveys(student_id);

create table interventions (
  intervention_id   integer primary key autoincrement,
  title             text not null,
  level             text not null,
  target_grade      integer,
  target_class_id   text,
  target_student_id text,
  subject           text,
  start_date        text,
  follow_up_date    text,
  owner_role        text,
  hypothesis        text,
  planned_action    text,
  expected_effect   text,
  outcome           text,
  status            text not null default 'planerad',
  is_demo           integer not null default 1,
  created_at        text not null default (datetime('now'))
);

create table intervention_followups (
  followup_id     integer primary key autoincrement,
  intervention_id integer not null references interventions(intervention_id) on delete cascade,
  date            text not null,
  note            text not null,
  effect_observed text,
  is_demo         integer not null default 1,
  created_at      text not null default (datetime('now'))
);

create table comments (
  comment_id  integer primary key autoincrement,
  scope       text not null,
  scope_ref   text not null,
  author_role text not null,
  body        text not null,
  is_demo     integer not null default 1,
  created_at  text not null default (datetime('now'))
);
create index idx_comments_scope on comments(scope, scope_ref);

create table budget_items (
  item_id  integer primary key autoincrement,
  category text not null,
  month    text not null,
  budget   real not null,
  actual   real,
  is_demo  integer not null default 1
);

create table financial_forecasts (
  forecast_id        integer primary key autoincrement,
  category           text not null,
  full_year_budget   real not null,
  full_year_forecast real not null,
  is_demo            integer not null default 1
);

-- Parametrar för elevpeng (kommunens resurstilldelning till skolan, §5.6/§6.7).
-- Nyckel/värde: grundbelopp per elev och stadium + socioekonomiskt strukturbelopp.
create table funding_parameters (
  key   text primary key,
  value real not null,
  label text
);

-- Skolövergripande HR-nyckeltal per månad (demodata) för trendvisning.
create table hr_monthly (
  month           text primary key,
  sick_short_rate real not null, -- korttidssjukfrånvaro (≤14 dagar)
  sick_long_rate  real not null  -- långtidssjukfrånvaro (>14 dagar)
);

-- ---------------------------------------------------------------------------
-- Aggregerande vyer. "Idag" = 2026-05-15. Sen ankomst (late) räknas som
-- närvaro men särredovisas; frånvaro = giltig + ogiltig.
-- ---------------------------------------------------------------------------
create view v_student_attendance as
select
  s.student_id,
  s.class_id,
  s.grade_level,
  count(a.attendance_id)                                       as days_total,
  count(*) filter (where a.status in ('present','late'))       as days_attended,
  count(*) filter (where a.status = 'late')                    as days_late,
  count(*) filter (where a.status = 'valid_absence')           as days_valid,
  count(*) filter (where a.status = 'invalid_absence')         as days_invalid,
  count(*) filter (where a.status in ('valid_absence','invalid_absence')) as days_absent,
  count(*) filter (where a.date > date('2026-05-15','-28 days'))                                                   as w4_total,
  count(*) filter (where a.status in ('valid_absence','invalid_absence') and a.date > date('2026-05-15','-28 days')) as w4_absent,
  count(*) filter (where a.date > date('2026-05-15','-56 days'))                                                   as w8_total,
  count(*) filter (where a.status in ('valid_absence','invalid_absence') and a.date > date('2026-05-15','-56 days')) as w8_absent,
  count(*) filter (where a.date > date('2026-05-15','-84 days'))                                                   as w12_total,
  count(*) filter (where a.status in ('valid_absence','invalid_absence') and a.date > date('2026-05-15','-84 days')) as w12_absent
from students s
left join attendance_records a
  on a.student_id = s.student_id and a.date <= '2026-05-15'
group by s.student_id, s.class_id, s.grade_level;

create view v_class_attendance as
select
  c.class_id,
  c.grade_level,
  sum(sa.days_total)    as days_total,
  sum(sa.days_attended) as days_attended,
  sum(sa.days_absent)   as days_absent,
  sum(sa.days_valid)    as days_valid,
  sum(sa.days_invalid)  as days_invalid,
  cast(sum(sa.w4_absent) as real)  / nullif(sum(sa.w4_total), 0)  as w4_absence_rate,
  cast(sum(sa.w8_absent) as real)  / nullif(sum(sa.w8_total), 0)  as w8_absence_rate,
  cast(sum(sa.w12_absent) as real) / nullif(sum(sa.w12_total), 0) as w12_absence_rate
from classes c
join v_student_attendance sa on sa.class_id = c.class_id
group by c.class_id, c.grade_level;

create view v_grade_attendance as
select
  grade_level,
  sum(days_total)    as days_total,
  sum(days_attended) as days_attended,
  sum(days_absent)   as days_absent,
  sum(days_valid)    as days_valid,
  sum(days_invalid)  as days_invalid,
  cast(sum(w4_absent) as real)  / nullif(sum(w4_total), 0)  as w4_absence_rate,
  cast(sum(w8_absent) as real)  / nullif(sum(w8_total), 0)  as w8_absence_rate,
  cast(sum(w12_absent) as real) / nullif(sum(w12_total), 0) as w12_absence_rate
from v_student_attendance
group by grade_level;

create view v_school_attendance as
select
  sum(days_total)    as days_total,
  sum(days_attended) as days_attended,
  sum(days_absent)   as days_absent,
  sum(days_valid)    as days_valid,
  sum(days_invalid)  as days_invalid
from v_student_attendance;

create view v_grade_weekday_absence as
select
  s.grade_level,
  cast(strftime('%u', a.date) as integer) as iso_dow,
  count(*)                                                                as days_total,
  count(*) filter (where a.status in ('valid_absence','invalid_absence')) as days_absent,
  cast(count(*) filter (where a.status in ('valid_absence','invalid_absence')) as real)
    / nullif(count(*), 0)                                                 as absence_rate
from students s
join attendance_records a on a.student_id = s.student_id
where a.date <= '2026-05-15'
group by s.grade_level, cast(strftime('%u', a.date) as integer);

create view v_grade_distribution as
select
  s.grade_level,
  g.subject,
  g.term,
  g.grade,
  count(*) as antal
from subject_grades g
join students s on s.student_id = g.student_id
group by s.grade_level, g.subject, g.term, g.grade;

-- SQLite-schema för Skolinsikt (demodata, byggs av scripts/seed.ts).
-- Speglar Postgres-migrationerna i supabase/migrations (framtida Supabase-mål).
-- Fast "idag" för demon: 2026-05-15 (inlinat i vyerna nedan).
-- Booleska värden lagras som 0/1.
--
-- FLERSKOLEMODELL: fysiska tabeller har suffixet _all och en school_id-kolumn
-- (default 'FRA' = Framtidsskolan). Vyer med tabellernas gamla namn scopar till
-- Framtidsskolan, så att hela det befintliga frågelagret förblir en-skols-vyer
-- utan ändringar. Huvudmannanivån (utbildningschef) läser *_all-tabellerna via
-- lib/db/queries-huvudman.ts och ser endast aggregat – aldrig elevuppgifter.

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

-- Skolor inom huvudmannens område. Framtidsskolan (FRA) är demons fullt
-- utbyggda skola; övriga visas på skolnivå i huvudmannavyn.
create table schools (
  school_id text primary key,
  name      text not null,
  blurb     text
);

create table staff_all (
  staff_id        text primary key,
  school_id       text not null default 'FRA' references schools(school_id),
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
create index idx_staff_school on staff_all(school_id);

create table classes_all (
  class_id            text primary key,
  school_id           text not null default 'FRA' references schools(school_id),
  grade_level         integer not null,
  suffix              text not null,
  arbetslag           text not null,
  mentor_staff_id     text references staff_all(staff_id),
  -- Socioekonomiskt strukturindex (riksgenomsnitt = 100, högre = större behov).
  -- Styr det socioekonomiska tillägget i elevpengen.
  socioeconomic_index real not null default 100,
  is_demo             integer not null default 1
);
create index idx_classes_school on classes_all(school_id);

create table students_all (
  student_id       text primary key,
  school_id        text not null default 'FRA' references schools(school_id),
  first_name       text not null,
  last_name        text not null,
  grade_level      integer not null,
  class_id         text not null references classes_all(class_id),
  gender           text not null,
  active           integer not null default 1,
  -- Stödinsatser på elevnivå (§5.7). extra_anpassning ⊇ atgardsprogram.
  extra_anpassning   integer not null default 0,
  atgardsprogram     integer not null default 0,
  utredning_pagaende integer not null default 0,
  is_demo          integer not null default 1
);
create index idx_students_school on students_all(school_id);

create table staff_assignments_all (
  assignment_id  text primary key,
  school_id      text not null default 'FRA' references schools(school_id),
  staff_id       text not null references staff_all(staff_id),
  class_id       text references classes_all(class_id),
  subject        text,
  grade_level    integer,
  hours_per_week real,
  is_qualified   integer not null default 1,
  is_demo        integer not null default 1
);

create table attendance_records_all (
  attendance_id  integer primary key autoincrement,
  school_id      text not null default 'FRA' references schools(school_id),
  student_id     text not null references students_all(student_id),
  date           text not null,
  status         text not null,
  minutes_absent integer not null default 0,
  is_demo        integer not null default 1
);
create index idx_attendance_student_date on attendance_records_all(student_id, date);
create index idx_attendance_date on attendance_records_all(date);

-- Historisk närvaro per termin (tre tidigare läsår). Dagliga närvarorader
-- finns endast för innevarande läsår på Framtidsskolan; historiken (och hela
-- närvaron för övriga skolor) är terminsaggregat – samma upplösning som
-- skolans egen flerårsrapport för frånvaro.
create table attendance_term_history_all (
  history_id  integer primary key autoincrement,
  school_id   text not null default 'FRA' references schools(school_id),
  student_id  text not null references students_all(student_id),
  term        text not null references school_terms(key),
  days_total  integer not null,
  days_absent integer not null,
  is_demo     integer not null default 1
);
create index idx_attendance_history_student on attendance_term_history_all(student_id);
create index idx_attendance_history_term on attendance_term_history_all(term);

create table literacy_numeracy_assessments_all (
  assessment_id     integer primary key autoincrement,
  school_id         text not null default 'FRA' references schools(school_id),
  student_id        text not null references students_all(student_id),
  term              text not null references school_terms(key),
  area              text not null,
  level             text not null,
  progression_score real,
  comment           text,
  is_demo           integer not null default 1
);
create index idx_lna_student on literacy_numeracy_assessments_all(student_id);

create table written_assessments_all (
  assessment_id integer primary key autoincrement,
  school_id     text not null default 'FRA' references schools(school_id),
  student_id    text not null references students_all(student_id),
  term          text not null references school_terms(key),
  subject       text not null,
  level         text not null,
  comment       text,
  is_demo       integer not null default 1
);
create index idx_written_student on written_assessments_all(student_id);

create table subject_grades_all (
  grade_id   integer primary key autoincrement,
  school_id  text not null default 'FRA' references schools(school_id),
  student_id text not null references students_all(student_id),
  term       text not null references school_terms(key),
  subject    text not null,
  grade      text not null,
  is_final   integer not null default 0,
  is_demo    integer not null default 1
);
create index idx_grades_student on subject_grades_all(student_id);
create index idx_grades_school_term on subject_grades_all(school_id, term);

create table national_tests_all (
  test_id    integer primary key autoincrement,
  school_id  text not null default 'FRA' references schools(school_id),
  student_id text not null references students_all(student_id),
  term       text not null references school_terms(key),
  subject    text not null,
  grade      text not null,
  is_demo    integer not null default 1
);
create index idx_nat_student on national_tests_all(student_id);

-- Trivselenkät / wellbeing per elev och termin (§ vision: wellbeing-data).
-- Skala 1–4 där 4 = bäst. Tre dimensioner: trivsel, trygghet, arbetsro (studiero).
create table wellbeing_surveys_all (
  survey_id  integer primary key autoincrement,
  school_id  text not null default 'FRA' references schools(school_id),
  student_id text not null references students_all(student_id),
  term       text not null references school_terms(key),
  trivsel    integer not null,
  trygghet   integer not null,
  studiero   integer not null,
  is_demo    integer not null default 1
);
create index idx_wellbeing_student on wellbeing_surveys_all(student_id);

create table interventions_all (
  intervention_id   integer primary key autoincrement,
  school_id         text not null default 'FRA' references schools(school_id),
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
  intervention_id integer not null references interventions_all(intervention_id) on delete cascade,
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

create table budget_items_all (
  item_id   integer primary key autoincrement,
  school_id text not null default 'FRA' references schools(school_id),
  category  text not null,
  month     text not null,
  budget    real not null,
  actual    real,
  is_demo   integer not null default 1
);

create table financial_forecasts_all (
  forecast_id        integer primary key autoincrement,
  school_id          text not null default 'FRA' references schools(school_id),
  category           text not null,
  full_year_budget   real not null,
  full_year_forecast real not null,
  is_demo            integer not null default 1
);

-- Parametrar för elevpeng (kommunens resurstilldelning, §5.6/§6.7) – samma för
-- alla skolor inom huvudmannen, därför ingen skoldimension.
create table funding_parameters (
  key   text primary key,
  value real not null,
  label text
);

-- Skolövergripande HR-nyckeltal per månad (demodata) för trendvisning.
create table hr_monthly_all (
  school_id       text not null default 'FRA' references schools(school_id),
  month           text not null,
  sick_short_rate real not null, -- korttidssjukfrånvaro (≤14 dagar)
  sick_long_rate  real not null, -- långtidssjukfrånvaro (>14 dagar)
  primary key (school_id, month)
);

-- ---------------------------------------------------------------------------
-- Skol-scopade vyer (Framtidsskolan). Hela det befintliga frågelagret läser
-- dessa namn och förblir därmed en-skols-vyer. select * inkluderar school_id,
-- vilket är ofarligt för typade läsningar.
-- ---------------------------------------------------------------------------
create view staff as select * from staff_all where school_id = 'FRA';
create view classes as select * from classes_all where school_id = 'FRA';
create view students as select * from students_all where school_id = 'FRA';
create view staff_assignments as select * from staff_assignments_all where school_id = 'FRA';
create view attendance_records as select * from attendance_records_all where school_id = 'FRA';
create view attendance_term_history as select * from attendance_term_history_all where school_id = 'FRA';
create view literacy_numeracy_assessments as select * from literacy_numeracy_assessments_all where school_id = 'FRA';
create view written_assessments as select * from written_assessments_all where school_id = 'FRA';
create view subject_grades as select * from subject_grades_all where school_id = 'FRA';
create view national_tests as select * from national_tests_all where school_id = 'FRA';
create view wellbeing_surveys as select * from wellbeing_surveys_all where school_id = 'FRA';
create view interventions as select * from interventions_all where school_id = 'FRA';
create view budget_items as select * from budget_items_all where school_id = 'FRA';
create view financial_forecasts as select * from financial_forecasts_all where school_id = 'FRA';
create view hr_monthly as select * from hr_monthly_all where school_id = 'FRA';

-- ---------------------------------------------------------------------------
-- Aggregerande vyer (Framtidsskolan, via de scopade vyerna ovan).
-- "Idag" = 2026-05-15. Sen ankomst (late) räknas som närvaro men särredovisas;
-- frånvaro = giltig + ogiltig.
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

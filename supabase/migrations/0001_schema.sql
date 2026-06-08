-- Skolinsikt – grundschema (demodata).
-- §9 i specifikationen. All seedad data bär is_demo = true.
-- §9:s lösa "grades" realiseras som subject_grades (per ämne); årskursnivå
-- ligger på classes.grade_level / students.grade_level.

-- Referensroller (§7)
create table if not exists user_roles (
  key   text primary key,
  label text not null
);

-- Terminer (§9 school_terms)
create table if not exists school_terms (
  key        text primary key,   -- 'HT2025'
  label      text not null,
  start_date date not null,
  end_date   date not null
);

-- Personal (§5.7 / §9 staff)
create table if not exists staff (
  staff_id   text primary key,
  first_name text not null,
  last_name  text not null,
  role       text not null,       -- larare | speciallarare | specialpedagog | skolledare
  arbetslag  text,
  fte        numeric not null default 1.0,  -- tjänstegrad 0–1
  is_demo    boolean not null default true
);

-- Klasser (§9 classes)
create table if not exists classes (
  class_id        text primary key,  -- '2A'
  grade_level     int  not null,
  suffix          text not null,     -- 'A' | 'B'
  arbetslag       text not null,
  mentor_staff_id text references staff(staff_id),
  is_demo         boolean not null default true
);

-- Elever (§9 students)
create table if not exists students (
  student_id  text primary key,
  first_name  text not null,
  last_name   text not null,
  grade_level int  not null,
  class_id    text not null references classes(class_id),
  gender      text not null,         -- flicka | pojke
  active      boolean not null default true,
  is_demo     boolean not null default true
);

-- Tjänstefördelning / behörighet (§5.7 / §9 staff_assignments)
create table if not exists staff_assignments (
  assignment_id  text primary key,
  staff_id       text not null references staff(staff_id),
  class_id       text references classes(class_id),
  subject        text,
  grade_level    int,
  hours_per_week numeric,
  is_qualified   boolean not null default true,  -- behörig lärare
  is_demo        boolean not null default true
);

-- Närvaro per dag (§5.5 / §9 attendance_records)
create table if not exists attendance_records (
  attendance_id bigint generated always as identity primary key,
  student_id    text not null references students(student_id),
  date          date not null,
  status        text not null,   -- present | valid_absence | invalid_absence | late
  minutes_absent int not null default 0,
  is_demo       boolean not null default true
);
create index if not exists idx_attendance_student_date on attendance_records(student_id, date);
create index if not exists idx_attendance_date on attendance_records(date);

-- Läsa/skriva/räkna åk 1–4 (§5.1 / §9 literacy_numeracy_assessments)
create table if not exists literacy_numeracy_assessments (
  assessment_id     bigint generated always as identity primary key,
  student_id        text not null references students(student_id),
  term              text not null references school_terms(key),
  area              text not null,  -- reading | writing | numeracy
  level             text not null,  -- over | i_linje | uppmarksam | stort_behov
  progression_score numeric,        -- 0–100, numeriskt mått för linjediagram
  comment           text,
  is_demo           boolean not null default true
);
create index if not exists idx_lna_student on literacy_numeracy_assessments(student_id);

-- Skriftliga omdömen åk 2–6 (§5.2 / §9 written_assessments)
create table if not exists written_assessments (
  assessment_id bigint generated always as identity primary key,
  student_id    text not null references students(student_id),
  term          text not null references school_terms(key),
  subject       text not null,
  level         text not null,  -- over | i_linje | uppmarksam | stort_behov
  comment       text,
  is_demo       boolean not null default true
);
create index if not exists idx_written_student on written_assessments(student_id);

-- Betyg åk 7–10 (§5.3 / §9 subject_grades)
create table if not exists subject_grades (
  grade_id   bigint generated always as identity primary key,
  student_id text not null references students(student_id),
  term       text not null references school_terms(key),
  subject    text not null,
  grade      text not null,    -- A,B,C,D,E,F,-
  is_final   boolean not null default false,  -- slutbetyg
  is_demo    boolean not null default true
);
create index if not exists idx_grades_student on subject_grades(student_id);

-- Nationella prov åk 7–10 (§5.4 / §9 national_tests)
create table if not exists national_tests (
  test_id    bigint generated always as identity primary key,
  student_id text not null references students(student_id),
  term       text not null references school_terms(key),
  subject    text not null,
  grade      text not null,    -- provbetyg A..F
  is_demo    boolean not null default true
);
create index if not exists idx_nat_student on national_tests(student_id);

-- Insatser (§5/§6.6 / §9 interventions). Användarskapade rader: is_demo = false.
create table if not exists interventions (
  intervention_id   bigint generated always as identity primary key,
  title             text not null,
  level             text not null,  -- school | grade | class | group | student
  target_grade      int,
  target_class_id   text,
  target_student_id text,
  subject           text,
  start_date        date,
  follow_up_date    date,
  owner_role        text,
  hypothesis        text,
  planned_action    text,
  expected_effect   text,
  outcome           text,
  status            text not null default 'planerad',  -- planerad | pagaende | avslutad
  is_demo           boolean not null default true,
  created_at        timestamptz not null default now()
);

-- Uppföljningar av insatser
create table if not exists intervention_followups (
  followup_id     bigint generated always as identity primary key,
  intervention_id bigint not null references interventions(intervention_id) on delete cascade,
  date            date not null,
  note            text not null,
  effect_observed text,
  is_demo         boolean not null default true,
  created_at      timestamptz not null default now()
);

-- Kommentarer / kollegial analys (§6.3). Användarskapade: is_demo = false.
create table if not exists comments (
  comment_id  bigint generated always as identity primary key,
  scope       text not null,  -- student | class | grade
  scope_ref   text not null,  -- student_id | class_id | grade (som text)
  author_role text not null,
  body        text not null,
  is_demo     boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists idx_comments_scope on comments(scope, scope_ref);

-- Budgetposter per månad (§5.6 / §9 budget_items)
create table if not exists budget_items (
  item_id  bigint generated always as identity primary key,
  category text not null,    -- Personalkostnader | Läromedel | Elevstöd | Vikarier ...
  month    date not null,    -- månadens första dag
  budget   numeric not null,
  actual   numeric,          -- utfall (null för framtida månader)
  is_demo  boolean not null default true
);

-- Helårsprognos per kategori (§5.6 / §9 financial_forecasts)
create table if not exists financial_forecasts (
  forecast_id       bigint generated always as identity primary key,
  category          text not null,
  full_year_budget  numeric not null,
  full_year_forecast numeric not null,
  is_demo           boolean not null default true
);

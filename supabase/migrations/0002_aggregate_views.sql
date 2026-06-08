-- Aggregerande vyer. Tunga summeringar över attendance_records (~72k rader)
-- görs i databasen så vyerna i appen kan läsa billiga sammanställningar.

-- Fast "idag" för demon (mitt i VT 2026). Trender beräknas mot detta datum.
create or replace function demo_today() returns date
  language sql immutable as $$ select date '2026-05-15' $$;

-- Närvaro per elev: livstidssummor (t.o.m. demo_today) + glidande 4/8/12 v.
-- Sen ankomst (late) räknas som närvaro men särredovisas. Frånvaro =
-- giltig + ogiltig frånvaro.
create or replace view v_student_attendance as
select
  s.student_id,
  s.class_id,
  s.grade_level,
  count(a.*)                                                   as days_total,
  count(*) filter (where a.status in ('present','late'))       as days_attended,
  count(*) filter (where a.status = 'late')                    as days_late,
  count(*) filter (where a.status = 'valid_absence')           as days_valid,
  count(*) filter (where a.status = 'invalid_absence')         as days_invalid,
  count(*) filter (where a.status in ('valid_absence','invalid_absence')) as days_absent,
  -- glidande fönster
  count(*) filter (where a.date > demo_today() - 28)                                                   as w4_total,
  count(*) filter (where a.status in ('valid_absence','invalid_absence') and a.date > demo_today() - 28) as w4_absent,
  count(*) filter (where a.date > demo_today() - 56)                                                   as w8_total,
  count(*) filter (where a.status in ('valid_absence','invalid_absence') and a.date > demo_today() - 56) as w8_absent,
  count(*) filter (where a.date > demo_today() - 84)                                                   as w12_total,
  count(*) filter (where a.status in ('valid_absence','invalid_absence') and a.date > demo_today() - 84) as w12_absent
from students s
left join attendance_records a
  on a.student_id = s.student_id and a.date <= demo_today()
group by s.student_id, s.class_id, s.grade_level;

-- Närvaro per klass
create or replace view v_class_attendance as
select
  c.class_id,
  c.grade_level,
  sum(sa.days_total)    as days_total,
  sum(sa.days_attended) as days_attended,
  sum(sa.days_absent)   as days_absent,
  sum(sa.days_valid)    as days_valid,
  sum(sa.days_invalid)  as days_invalid,
  sum(sa.w4_absent)::numeric  / nullif(sum(sa.w4_total), 0)  as w4_absence_rate,
  sum(sa.w8_absent)::numeric  / nullif(sum(sa.w8_total), 0)  as w8_absence_rate,
  sum(sa.w12_absent)::numeric / nullif(sum(sa.w12_total), 0) as w12_absence_rate
from classes c
join v_student_attendance sa on sa.class_id = c.class_id
group by c.class_id, c.grade_level;

-- Närvaro per årskurs
create or replace view v_grade_attendance as
select
  grade_level,
  sum(days_total)    as days_total,
  sum(days_attended) as days_attended,
  sum(days_absent)   as days_absent,
  sum(days_valid)    as days_valid,
  sum(days_invalid)  as days_invalid,
  sum(w4_absent)::numeric  / nullif(sum(w4_total), 0)  as w4_absence_rate,
  sum(w8_absent)::numeric  / nullif(sum(w8_total), 0)  as w8_absence_rate,
  sum(w12_absent)::numeric / nullif(sum(w12_total), 0) as w12_absence_rate
from v_student_attendance
group by grade_level;

-- Närvaro för hela skolan (en rad)
create or replace view v_school_attendance as
select
  sum(days_total)    as days_total,
  sum(days_attended) as days_attended,
  sum(days_absent)   as days_absent,
  sum(days_valid)    as days_valid,
  sum(days_invalid)  as days_invalid
from v_student_attendance;

-- Frånvaro per veckodag och årskurs (underlag till heatmap, §12).
-- iso_dow: 1=måndag … 7=söndag. Skoldagar är 1–5.
create or replace view v_grade_weekday_absence as
select
  s.grade_level,
  extract(isodow from a.date)::int as iso_dow,
  count(*)                                                                 as days_total,
  count(*) filter (where a.status in ('valid_absence','invalid_absence'))  as days_absent,
  count(*) filter (where a.status in ('valid_absence','invalid_absence'))::numeric
    / nullif(count(*), 0)                                                  as absence_rate
from students s
join attendance_records a on a.student_id = s.student_id
where a.date <= demo_today()
group by s.grade_level, extract(isodow from a.date);

-- Betygsfördelning per ämne och årskurs (innevarande term), §5.3 / §12.
create or replace view v_grade_distribution as
select
  s.grade_level,
  g.subject,
  g.term,
  g.grade,
  count(*) as antal
from subject_grades g
join students s on s.student_id = g.student_id
group by s.grade_level, g.subject, g.term, g.grade;

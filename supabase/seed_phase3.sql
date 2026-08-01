-- ════════════════════════════════════════════════════════════════════
-- Phase 2 · Demo seed 3 — marks (ISA-1 / ISA-2 / Assignment / ESA) and
-- rich student details for the Results + Profile pages.
-- Run AFTER seed_phase2.sql. Idempotent (upserts throughout).
--
-- The first student (student@pesu.pesu.pes.edu) gets the hero numbers; every other
-- student is shifted down slightly so faculty views show variety.
-- ⚠ All values are demo data.
-- ════════════════════════════════════════════════════════════════════

-- ── Marks: 4 assessments per Sem-4 course ────────────────────────────
with s as (
  select p.id,
         row_number() over (
           order by (case when u.email = 'student@pesu.pesu.pes.edu' then 0 else 1 end),
                    p.created_at
         ) as r
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role = 'student'
),
m(code, assessment, score, max_score) as (
  values
    -- Personality Development (2 cr) → 164/200 = 82% → A
    ('UQ24CA221B', 'ISA-1', 34, 40), ('UQ24CA221B', 'ISA-2', 32, 40),
    ('UQ24CA221B', 'Assignment', 18, 20), ('UQ24CA221B', 'ESA', 80, 100),
    -- Cryptography (4 cr) → 141/200 = 70.5% → B
    ('SEM4-CRYPTO', 'ISA-1', 28, 40), ('SEM4-CRYPTO', 'ISA-2', 30, 40),
    ('SEM4-CRYPTO', 'Assignment', 15, 20), ('SEM4-CRYPTO', 'ESA', 68, 100),
    -- Software Engineering (4 cr) → 183/200 = 91.5% → S
    ('SEM4-SE', 'ISA-1', 38, 40), ('SEM4-SE', 'ISA-2', 36, 40),
    ('SEM4-SE', 'Assignment', 19, 20), ('SEM4-SE', 'ESA', 90, 100),
    -- Animation (3 cr) → 159/200 = 79.5% → B
    ('SEM4-ANIM', 'ISA-1', 33, 40), ('SEM4-ANIM', 'ISA-2', 31, 40),
    ('SEM4-ANIM', 'Assignment', 17, 20), ('SEM4-ANIM', 'ESA', 78, 100),
    -- Java Technologies (4 cr) → 121/200 = 60.5% → C
    ('SEM4-JAVA', 'ISA-1', 25, 40), ('SEM4-JAVA', 'ISA-2', 27, 40),
    ('SEM4-JAVA', 'Assignment', 14, 20), ('SEM4-JAVA', 'ESA', 55, 100),
    -- Essentials of Innovation & Entrepreneurship-II (2 cr) → 174/200 = 87% → A
    ('SEM4-EIE2', 'ISA-1', 36, 40), ('SEM4-EIE2', 'ISA-2', 35, 40),
    ('SEM4-EIE2', 'Assignment', 18, 20), ('SEM4-EIE2', 'ESA', 85, 100)
)
insert into public.marks (student_id, course, assessment, score, max_score, updated_by)
select
  s.id, m.code, m.assessment,
  -- Rank-1 keeps the scores above; later students drop a bit (never below 0).
  greatest(0, m.score - (s.r - 1) * (case when m.max_score = 100 then 7 else 2 end)),
  m.max_score,
  (select id from public.profiles where role = 'faculty' limit 1)
from s cross join m
on conflict (student_id, course, assessment)
do update set score = excluded.score, max_score = excluded.max_score;

-- ── Rich profile for the primary demo student ────────────────────────
insert into public.student_details (
  student_id, pesu_id, branch, section, dob, blood_group,
  sslc_pct, puc_pct, father_name, father_phone, mother_name, mother_phone,
  address, city, state, pincode, aadhaar_last4
)
select
  u.id, 'PES2UG24CS118', 'Computer Applications', 'B', date '2006-03-14', 'O+',
  92.80, 88.40, 'Ramesh Kumar', '+91 98450 11223', 'Lakshmi Devi', '+91 98450 44556',
  '#42, 4th Cross, Jayanagar', 'Bengaluru', 'Karnataka', '560041', '4821'
from auth.users u
where u.email = 'student@pesu.pesu.pes.edu'
on conflict (student_id) do update set
  pesu_id = excluded.pesu_id, branch = excluded.branch, section = excluded.section,
  dob = excluded.dob, blood_group = excluded.blood_group,
  sslc_pct = excluded.sslc_pct, puc_pct = excluded.puc_pct,
  father_name = excluded.father_name, father_phone = excluded.father_phone,
  mother_name = excluded.mother_name, mother_phone = excluded.mother_phone,
  address = excluded.address, city = excluded.city, state = excluded.state,
  pincode = excluded.pincode, aadhaar_last4 = excluded.aadhaar_last4;


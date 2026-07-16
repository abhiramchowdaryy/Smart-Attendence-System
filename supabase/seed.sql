-- ════════════════════════════════════════════════════════════════════
-- PES Smart Attendance — Demo seed (run AFTER schema.sql)
--
-- Prerequisite: create at least one user first
--   Supabase Dashboard → Authentication → Users → "Add user"
--   (e.g. student@pes.edu / a password; "Auto Confirm User" ON)
-- The signup trigger creates their profile automatically.
--
-- ⚠ Replace the lat/lng below with YOUR current location before the
--   demo, otherwise the geofence check will (correctly!) reject you.
--   Get coordinates from Google Maps → right-click → copy.
-- ════════════════════════════════════════════════════════════════════

-- 1) A demo classroom geofence.
--    ▼▼ EDIT THESE COORDINATES ▼▼  (example: PES University, Bengaluru)
insert into public.geofences (room_name, lat, lng, radius_m)
values ('Room B-204', 12.935100, 77.535800, 100)
on conflict do nothing;

-- 2) An OPEN session on that geofence so students can mark right away.
insert into public.sessions (course, geofence_id)
select 'Data Structures', g.id
from public.geofences g
where g.room_name = 'Room B-204'
  and not exists (
    select 1 from public.sessions s where s.closed_at is null
  );

-- 3) Optional: fill in a nicer demo profile for your first user.
--    (Runs for every user currently signed up; edit as needed.)
update public.profiles
set full_name = coalesce(nullif(full_name, 'New User'), full_name),
    roll_no = coalesce(roll_no, 'PES1UG24CA' || lpad((floor(random() * 900) + 100)::text, 3, '0'))
where roll_no is null;

-- 4) To promote a user to faculty or admin (needed for Phase-2 UIs):
-- update public.profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'you@pes.edu');

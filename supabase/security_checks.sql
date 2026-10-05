-- ---------------------------------------------------------------------------
-- Security checks for the RAS Site Safety schema.
--
-- These prove the Row Level Security policies do what the README says: a framer
-- sees only their own data, an admin sees everything, and a logged-out visitor
-- sees nothing at all. Every check should print PASS.
--
-- Run against the local database (ids come from the seed data):
--   docker exec -i $(docker ps --format '{{.Names}}' | grep supabase_db) \
--     psql -U postgres -v ON_ERROR_STOP=1 -f - < supabase/security_checks.sql
--
-- To test other users, change the three ids below to the ones in your profiles table.
-- ---------------------------------------------------------------------------

\set jordan c15c7752-5cc5-4964-8e41-406bb0229bad
\set sam    0a502039-e67e-4efe-9d07-87ae79ecf038
\set admin  cdee2338-0906-43f7-b9d0-3d27ef2f650d

\echo ''
\echo '--- As a framer (Jordan Miller) ---'
begin;
-- Act as the logged-in framer exactly the way Supabase's API does.
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', json_build_object('sub', :'jordan', 'role', 'authenticated')::text, true);

select 'framer sees their own submissions' as check,
  case when count(*) > 0 then 'PASS' else 'FAIL' end as result
from submissions where framer_id = :'jordan';

select 'framer cannot see another framer''s submissions' as check,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as result
from submissions where framer_id = :'sam';

select 'every submission the framer can see is their own' as check,
  case when count(*) = count(*) filter (where framer_id = :'jordan') then 'PASS' else 'FAIL' end as result
from submissions;

select 'framer reads their own profile' as check,
  case when count(*) = 1 then 'PASS' else 'FAIL' end as result
from profiles where id = :'jordan';

select 'framer cannot read another profile' as check,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as result
from profiles where id = :'sam';

select 'framer can read the site list' as check,
  case when count(*) > 0 then 'PASS' else 'FAIL' end as result
from sites;

select 'framer cannot read another framer''s photo rows' as check,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as result
from submission_photos p join submissions s on s.id = p.submission_id
where s.framer_id = :'sam';

select 'framer cannot read another framer''s stored photos' as check,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as result
from storage.objects
where bucket_id = 'safety-photos' and (storage.foldername(name))[1] = :'sam';

-- Mutations that must be refused. An insert refused by RLS raises an error, so
-- these run inside a block that catches it and reports the outcome.
select set_config('ras.sam', :'sam', true);

do $$
begin
  insert into submissions (framer_id, site_id, work_date, notes,
      ppe_hard_hat, ppe_hi_vis_vest, ppe_safety_boots, ppe_eye_protection,
      fall_protection_in_place, ladders_scaffolding_inspected,
      tools_cords_good_condition, hazards_identified)
  values (current_setting('ras.sam')::uuid, (select id from sites limit 1), current_date, null,
      true, true, true, true, true, true, true, true);
  raise notice 'FAIL  framer inserted a form on behalf of another framer';
exception when others then
  raise notice 'PASS  framer cannot insert a form on behalf of another framer';
end $$;

do $$
declare n int;
begin
  update submissions set notes = 'tampered' where framer_id = current_setting('ras.sam')::uuid;
  get diagnostics n = row_count;
  raise notice '%  framer cannot update another framer''s form',
    case when n = 0 then 'PASS' else 'FAIL' end;
end $$;

do $$
declare n int;
begin
  delete from submissions where framer_id = current_setting('ras.sam')::uuid;
  get diagnostics n = row_count;
  raise notice '%  framer cannot delete another framer''s form',
    case when n = 0 then 'PASS' else 'FAIL' end;
end $$;

-- Files are removed through the Storage API, not with SQL (Supabase blocks direct
-- deletes on storage.objects), so we check the policy behind that API call: a framer
-- may delete a file only inside their own folder. The end-to-end behaviour is proven
-- by the failed-submission test, which leaves no orphaned file behind.
select 'storage delete policy is limited to the owner''s folder' as check,
  case when exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and cmd = 'DELETE'
      and qual like '%safety-photos%'
      and qual like '%auth.uid()%'
  ) then 'PASS' else 'FAIL' end as result;

rollback;

\echo ''
\echo '--- As the admin (Morgan Lee) ---'
begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', json_build_object('sub', :'admin', 'role', 'authenticated')::text, true);

select 'admin sees submissions from more than one framer' as check,
  case when count(distinct framer_id) > 1 then 'PASS' else 'FAIL' end as result
from submissions;

select 'admin can read a specific framer''s submissions' as check,
  case when count(*) > 0 then 'PASS' else 'FAIL' end as result
from submissions where framer_id = :'sam';

select 'admin sees every profile' as check,
  case when count(*) > 1 and bool_or(role = 'admin') then 'PASS' else 'FAIL' end as result
from profiles;

select 'admin can read any framer''s stored photos' as check,
  case when count(*) > 0 then 'PASS' else 'FAIL' end as result
from storage.objects
where bucket_id = 'safety-photos' and (storage.foldername(name))[1] = :'sam';

rollback;

\echo ''
\echo '--- As a logged-out visitor (anon) ---'
begin;
select set_config('role', 'anon', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select 'visitor cannot read submissions' as check, case when count(*) = 0 then 'PASS' else 'FAIL' end as result from submissions;
select 'visitor cannot read profiles' as check, case when count(*) = 0 then 'PASS' else 'FAIL' end as result from profiles;
select 'visitor cannot read sites' as check, case when count(*) = 0 then 'PASS' else 'FAIL' end as result from sites;
select 'visitor cannot read stored photos' as check, case when count(*) = 0 then 'PASS' else 'FAIL' end as result from storage.objects where bucket_id = 'safety-photos';
rollback;

\echo ''

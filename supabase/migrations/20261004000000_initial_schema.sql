-- =============================================================================
-- RAS Site Safety: initial database schema
--
-- Four tables:
--   profiles           one row per login user (name + role)
--   sites              construction job sites
--   submissions        one daily safety form
--   submission_photos  the photos attached to a form (files live in Storage)
--
-- Security is enforced HERE with Row Level Security (RLS), not only in the UI:
--   framers can create and read only their own submissions and photos,
--   admins can read everything.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Tables
-- -----------------------------------------------------------------------------

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null,
  role       text not null default 'framer' check (role in ('framer', 'admin')),
  created_at timestamptz not null default now()
);

create table public.sites (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  address    text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.submissions (
  id         uuid primary key default gen_random_uuid(),
  framer_id  uuid not null references public.profiles (id) on delete cascade,
  site_id    uuid not null references public.sites (id),
  work_date  date not null,

  -- Safety checklist: every item is a required yes/no answer.
  ppe_hard_hat                  boolean not null,
  ppe_hi_vis_vest               boolean not null,
  ppe_safety_boots              boolean not null,
  ppe_eye_protection            boolean not null,
  fall_protection_in_place      boolean not null,
  ladders_scaffolding_inspected boolean not null,
  tools_cords_good_condition    boolean not null,
  hazards_identified            boolean not null,

  notes      text,

  -- Worked out by the database, so it can never disagree with the answers:
  -- 'complete' when every item is yes, otherwise 'flagged'.
  status text generated always as (
    case
      when ppe_hard_hat and ppe_hi_vis_vest and ppe_safety_boots and ppe_eye_protection
       and fall_protection_in_place and ladders_scaffolding_inspected
       and tools_cords_good_condition and hazards_identified
      then 'complete'
      else 'flagged'
    end
  ) stored,

  created_at timestamptz not null default now(),

  -- Assumption: one form per framer, per site, per day.
  constraint one_submission_per_day unique (framer_id, site_id, work_date)
);

create table public.submission_photos (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  storage_path  text not null unique,          -- path inside the 'safety-photos' bucket
  file_name     text not null,
  mime_type     text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes    integer not null check (size_bytes > 0 and size_bytes <= 10485760),  -- 10 MB
  created_at    timestamptz not null default now()
);

-- Indexes for the dashboard filters (site, worker, date range).
create index submissions_site_date_idx   on public.submissions (site_id, work_date);
create index submissions_framer_date_idx on public.submissions (framer_id, work_date);
create index submission_photos_submission_idx on public.submission_photos (submission_id);


-- -----------------------------------------------------------------------------
-- 2. Create a profile automatically when a login user is created
--    New users are always 'framer'. Only someone with the service key (the seed
--    script, or you in the Supabase dashboard) can promote a user to 'admin'.
-- -----------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- -----------------------------------------------------------------------------
-- 3. Helper: is the logged-in user an admin?
--    'security definer' lets it read profiles without triggering the profiles
--    policy again (which would loop forever).
-- -----------------------------------------------------------------------------

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;


-- -----------------------------------------------------------------------------
-- 4. Row Level Security
--    With RLS on, a table returns NOTHING unless a policy allows it.
--    There are no update/delete policies, so nobody can change a submitted form
--    through the app (a safety record should not be edited afterwards).
-- -----------------------------------------------------------------------------

alter table public.profiles          enable row level security;
alter table public.sites             enable row level security;
alter table public.submissions       enable row level security;
alter table public.submission_photos enable row level security;

-- profiles: read your own; admins read all (to show worker names and filters).
create policy "profiles: read own or admin"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

-- sites: any logged-in user can read the list of sites.
create policy "sites: logged-in users can read"
  on public.sites for select to authenticated
  using (true);

-- submissions: framers read their own, admins read all.
create policy "submissions: read own or admin"
  on public.submissions for select to authenticated
  using (framer_id = (select auth.uid()) or public.is_admin());

-- submissions: a framer can only create a form for themselves.
create policy "submissions: framers create their own"
  on public.submissions for insert to authenticated
  with check (framer_id = (select auth.uid()) and not public.is_admin());

-- photos: readable if you could read the submission they belong to.
create policy "photos: read own or admin"
  on public.submission_photos for select to authenticated
  using (
    exists (
      select 1 from public.submissions s
      where s.id = submission_id
        and (s.framer_id = (select auth.uid()) or public.is_admin())
    )
  );

-- photos: you can only attach photos to your own submission, from your own folder.
create policy "photos: attach to own submission"
  on public.submission_photos for insert to authenticated
  with check (
    storage_path like (select auth.uid())::text || '/%'
    and exists (
      select 1 from public.submissions s
      where s.id = submission_id and s.framer_id = (select auth.uid())
    )
  );


-- -----------------------------------------------------------------------------
-- 5. Photo storage
--    A PRIVATE bucket: files are only reachable with short-lived signed links.
--    Files are stored as  {user_id}/{submission_id}/{file name}
--    so the first folder tells us who owns the file.
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'safety-photos',
  'safety-photos',
  false,
  10485760,                                        -- 10 MB per file
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "safety photos: upload to own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'safety-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "safety photos: read own or admin"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'safety-photos'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin())
  );

--    A framer may also delete a file in their own folder. The app uses this when a
--    submission fails to save, to remove the photos it just uploaded instead of
--    leaving orphaned files in the bucket.
create policy "safety photos: delete own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'safety-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

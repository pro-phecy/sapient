create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  university text not null default '',
  course_of_study text not null default '',
  semester text not null default '',
  semester_start date,
  semester_end date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  workload text not null default 'medium' check (workload in ('light', 'medium', 'heavy')),
  color text not null default '#8057f6',
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  course_name text not null,
  day text not null check (day in ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun')),
  start_time time not null,
  end_time time not null,
  location text not null default '',
  lecturer text not null default '',
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  course_name text,
  file_name text not null,
  storage_path text not null unique,
  size_bytes bigint,
  mime_type text not null default 'application/octet-stream',
  file_kind text not null default 'resource' check (file_kind in ('resource', 'timetable')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.classes enable row level security;
alter table public.resources enable row level security;

revoke all on public.profiles, public.courses, public.classes, public.resources from anon;
grant select, insert, update, delete on public.profiles, public.courses, public.classes, public.resources to authenticated;

drop policy if exists "Users manage their profile" on public.profiles;
create policy "Users manage their profile"
  on public.profiles for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users manage their courses" on public.courses;
create policy "Users manage their courses"
  on public.courses for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their classes" on public.classes;
create policy "Users manage their classes"
  on public.classes for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (course_id is null or exists (
      select 1 from public.courses c where c.id = course_id and c.user_id = (select auth.uid())
    ))
  );

drop policy if exists "Users manage their resource metadata" on public.resources;
create policy "Users manage their resource metadata"
  on public.resources for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (course_id is null or exists (
      select 1 from public.courses c where c.id = course_id and c.user_id = (select auth.uid())
    ))
  );

create or replace function public.handle_new_slyde_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, university)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'university', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_slyde on auth.users;
create trigger on_auth_user_created_slyde
  after insert on auth.users
  for each row execute procedure public.handle_new_slyde_user();

insert into storage.buckets (id, name, public, file_size_limit)
values ('student-files', 'student-files', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

drop policy if exists "Users read their own student files" on storage.objects;
create policy "Users read their own student files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'student-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users upload their own student files" on storage.objects;
create policy "Users upload their own student files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'student-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users update their own student files" on storage.objects;
create policy "Users update their own student files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'student-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'student-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users delete their own student files" on storage.objects;
create policy "Users delete their own student files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'student-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

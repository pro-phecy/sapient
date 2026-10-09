create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  time_zone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_devices_user_id_idx on public.push_devices(user_id);
alter table public.push_devices enable row level security;
revoke all on public.push_devices from anon;
grant select, insert, update, delete on public.push_devices to authenticated;

drop policy if exists "Users manage their push devices" on public.push_devices;
create policy "Users manage their push devices"
  on public.push_devices for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists public.push_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.push_devices(id) on delete cascade,
  reminder_type text not null check (reminder_type in ('class', 'study')),
  reference_id text not null,
  local_date date not null,
  created_at timestamptz not null default now(),
  unique (device_id, reminder_type, reference_id, local_date)
);

alter table public.push_reminder_deliveries enable row level security;
revoke all on public.push_reminder_deliveries from anon, authenticated;

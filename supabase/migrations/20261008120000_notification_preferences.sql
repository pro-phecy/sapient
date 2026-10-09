alter table public.profiles
  add column if not exists class_reminders_enabled boolean not null default false,
  add column if not exists study_reminders_enabled boolean not null default false,
  add column if not exists study_plan jsonb not null default '[]'::jsonb;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 50),
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  description text default '',
  category_id uuid references public.categories(id) on delete set null,
  scheduled_at timestamptz not null,
  deadline timestamptz not null,
  duration_minutes integer check (duration_minutes is null or duration_minutes between 1 and 1440),
  priority smallint not null default 2 check (priority in (1, 2, 3)),
  completed boolean not null default false,
  completed_at timestamptz,
  timer_started_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  frequency text not null default 'daily' check (frequency in ('daily', 'weekly')),
  start_minute integer,
  duration_minutes integer,
  created_at timestamptz not null default now()
);

alter table public.habits add column if not exists start_minute integer;
alter table public.habits add column if not exists duration_minutes integer;
alter table public.habits drop constraint if exists habits_start_minute_check;
alter table public.habits add constraint habits_start_minute_check check (start_minute is null or start_minute between 0 and 1439);
alter table public.habits drop constraint if exists habits_duration_minutes_check;
alter table public.habits add constraint habits_duration_minutes_check check (duration_minutes is null or duration_minutes between 1 and 720);

create index if not exists idx_categories_user_id on public.categories(user_id);
create index if not exists idx_tasks_user_id on public.tasks(user_id);
create index if not exists idx_tasks_scheduled_at on public.tasks(scheduled_at);
create index if not exists idx_tasks_user_scheduled_at on public.tasks(user_id, scheduled_at);
create index if not exists idx_habits_user_id on public.habits(user_id);
create index if not exists idx_profiles_display_name on public.profiles(display_name);

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.tasks enable row level security;
alter table public.habits enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "categories_select_own" on public.categories;
create policy "categories_select_own" on public.categories
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "categories_insert_own" on public.categories;
create policy "categories_insert_own" on public.categories
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "categories_update_own" on public.categories;
create policy "categories_update_own" on public.categories
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "categories_delete_own" on public.categories;
create policy "categories_delete_own" on public.categories
for delete to authenticated
using (auth.uid() = user_id);

drop policy if exists "tasks_select_own" on public.tasks;
create policy "tasks_select_own" on public.tasks
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "tasks_insert_own" on public.tasks;
create policy "tasks_insert_own" on public.tasks
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "tasks_update_own" on public.tasks;
create policy "tasks_update_own" on public.tasks
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "tasks_delete_own" on public.tasks;
create policy "tasks_delete_own" on public.tasks
for delete to authenticated
using (auth.uid() = user_id);

drop policy if exists "habits_select_own" on public.habits;
create policy "habits_select_own" on public.habits
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "habits_insert_own" on public.habits;
create policy "habits_insert_own" on public.habits
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "habits_update_own" on public.habits;
create policy "habits_update_own" on public.habits
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "habits_delete_own" on public.habits;
create policy "habits_delete_own" on public.habits
for delete to authenticated
using (auth.uid() = user_id);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
begin
  v_display_name := trim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  if v_display_name = '' then
    raise exception 'Display name is required';
  end if;

  insert into public.profiles (id, display_name)
  values (new.id, v_display_name)
  on conflict (id) do update
    set display_name = excluded.display_name;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

insert into public.profiles (id, display_name)
select
  u.id,
  coalesce(nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''), split_part(u.email, '@', 1), 'User')
from auth.users u
on conflict (id) do nothing;

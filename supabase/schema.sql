create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  experience_points integer not null default 0 check (experience_points >= 0),
  current_level integer not null default 1 check (current_level >= 1),
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 50),
  color text not null default '#E5484D',
  icon text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  description text not null default '',
  category_id uuid references public.categories(id) on delete set null,
  scheduled_at timestamptz not null,
  deadline timestamptz not null,
  duration_minutes integer check (duration_minutes is null or duration_minutes between 1 and 1440),
  priority smallint not null default 2 check (priority in (1, 2, 3)),
  completed boolean not null default false,
  completed_at timestamptz,
  timer_started_at timestamptz,
  actual_duration_minutes integer not null default 0 check (actual_duration_minutes >= 0),
  completion_xp integer not null default 0 check (completion_xp >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  icon text not null default 'book-open',
  frequency_type text not null default 'daily',
  interval_days integer,
  custom_days smallint[] not null default '{}'::smallint[],
  time_minute integer,
  duration_minutes integer,
  anchor_date date not null default current_date,
  current_streak integer not null default 0,
  best_streak integer not null default 0,
  last_completed_on date,
  next_occurrence_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.habit_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  completed_on date not null,
  completed boolean not null default true,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  xp_awarded integer not null default 0 check (xp_awarded >= 0),
  unique (habit_id, completed_on)
);

create table if not exists public.habit_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  session_date date not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists experience_points integer;
alter table public.profiles add column if not exists current_level integer;

alter table public.categories add column if not exists color text;
alter table public.categories add column if not exists icon text;
alter table public.categories add column if not exists updated_at timestamptz;
alter table public.categories add column if not exists deleted_at timestamptz;

alter table public.tasks add column if not exists description text;
alter table public.tasks add column if not exists actual_duration_minutes integer;
alter table public.tasks add column if not exists completion_xp integer;
alter table public.tasks add column if not exists updated_at timestamptz;
alter table public.tasks add column if not exists deleted_at timestamptz;

alter table public.habits add column if not exists icon text;
alter table public.habits add column if not exists frequency_type text;
alter table public.habits add column if not exists interval_days integer;
alter table public.habits add column if not exists custom_days smallint[];
alter table public.habits add column if not exists time_minute integer;
alter table public.habits add column if not exists anchor_date date;
alter table public.habits add column if not exists current_streak integer;
alter table public.habits add column if not exists best_streak integer;
alter table public.habits add column if not exists last_completed_on date;
alter table public.habits add column if not exists next_occurrence_on date;
alter table public.habits add column if not exists updated_at timestamptz;
alter table public.habits add column if not exists deleted_at timestamptz;
alter table public.habits add column if not exists frequency text;
alter table public.habits add column if not exists start_minute integer;

alter table public.habit_completions add column if not exists completed boolean;
alter table public.habit_completions add column if not exists updated_at timestamptz;
alter table public.habit_completions add column if not exists completed_at timestamptz;
alter table public.habit_completions add column if not exists xp_awarded integer;

update public.profiles
set experience_points = coalesce(experience_points, 0),
    current_level = coalesce(current_level, 1);

update public.categories
set color = case
      when color in ('#E5484D', '#EC4899', '#A855F7', '#8B5CF6', '#6366F1', '#3B82F6', '#0EA5E9', '#06B6D4', '#14B8A6', '#10B981', '#84CC16', '#EAB308') then color
      when color = '#30A46C' then '#10B981'
      when color = '#F5A623' then '#EAB308'
      else '#E5484D'
    end,
    icon = case
      when icon in ('briefcase', 'heart', 'user', 'book-open', 'dumbbell', 'droplets', 'utensils', 'bed', 'brain', 'music', 'sun', 'moon', 'coffee', 'shopping-cart') then icon
      else 'user'
    end,
    updated_at = coalesce(updated_at, created_at, now());

update public.tasks
set description = coalesce(description, ''),
    actual_duration_minutes = coalesce(actual_duration_minutes, 0),
    completion_xp = coalesce(completion_xp, 0),
    updated_at = coalesce(updated_at, created_at, now());

update public.habits
set frequency_type = case
      when coalesce(frequency_type, frequency, 'daily') = 'weekly' then 'custom_days'
      when coalesce(frequency_type, frequency, 'daily') = 'interval' then 'interval'
      else 'daily'
    end,
    interval_days = case
      when coalesce(frequency_type, frequency, 'daily') = 'interval' then coalesce(interval_days, 2)
      else null
    end,
    custom_days = case
      when coalesce(frequency_type, frequency, 'daily') = 'weekly'
        then coalesce(nullif(custom_days, '{}'::smallint[]), array[extract(dow from created_at)::smallint])
      else '{}'::smallint[]
    end,
    icon = case
      when icon in ('briefcase', 'heart', 'user', 'book-open', 'dumbbell', 'droplets', 'utensils', 'bed', 'brain', 'music', 'sun', 'moon', 'coffee', 'shopping-cart') then icon
      else 'book-open'
    end,
    time_minute = coalesce(time_minute, start_minute),
    anchor_date = coalesce(anchor_date, created_at::date, current_date),
    current_streak = coalesce(current_streak, 0),
    best_streak = coalesce(best_streak, 0),
    updated_at = coalesce(updated_at, created_at, now());

update public.habit_completions
set completed = coalesce(completed, true),
    completed_at = coalesce(completed_at, now()),
    updated_at = coalesce(updated_at, completed_at, now()),
    xp_awarded = coalesce(xp_awarded, 0);

alter table public.categories alter column color set default '#E5484D';
alter table public.categories alter column color set not null;
alter table public.categories alter column icon set default 'user';
alter table public.categories alter column icon set not null;
alter table public.categories alter column updated_at set default now();
alter table public.categories alter column updated_at set not null;

alter table public.tasks alter column description set default '';
alter table public.tasks alter column description set not null;
alter table public.tasks alter column actual_duration_minutes set default 0;
alter table public.tasks alter column actual_duration_minutes set not null;
alter table public.tasks alter column completion_xp set default 0;
alter table public.tasks alter column completion_xp set not null;
alter table public.tasks alter column updated_at set default now();
alter table public.tasks alter column updated_at set not null;

alter table public.habits alter column icon set default 'book-open';
alter table public.habits alter column icon set not null;
alter table public.habits alter column frequency_type set default 'daily';
alter table public.habits alter column frequency_type set not null;
alter table public.habits alter column custom_days set default '{}'::smallint[];
alter table public.habits alter column custom_days set not null;
alter table public.habits alter column anchor_date set default current_date;
alter table public.habits alter column anchor_date set not null;
alter table public.habits alter column current_streak set default 0;
alter table public.habits alter column current_streak set not null;
alter table public.habits alter column best_streak set default 0;
alter table public.habits alter column best_streak set not null;
alter table public.habits alter column updated_at set default now();
alter table public.habits alter column updated_at set not null;

alter table public.habit_completions alter column completed set default true;
alter table public.habit_completions alter column completed set not null;
alter table public.habit_completions alter column completed_at drop not null;
alter table public.habit_completions alter column updated_at set default now();
alter table public.habit_completions alter column updated_at set not null;
alter table public.habit_completions alter column xp_awarded set default 0;
alter table public.habit_completions alter column xp_awarded set not null;

alter table public.profiles drop constraint if exists profiles_progress_values_check;
alter table public.profiles add constraint profiles_progress_values_check
  check (experience_points >= 0 and current_level >= 1);

alter table public.categories drop constraint if exists categories_color_check;
alter table public.categories add constraint categories_color_check
  check (color in ('#E5484D', '#EC4899', '#A855F7', '#8B5CF6', '#6366F1', '#3B82F6', '#0EA5E9', '#06B6D4', '#14B8A6', '#10B981', '#84CC16', '#EAB308'));
alter table public.categories drop constraint if exists categories_icon_check;
alter table public.categories add constraint categories_icon_check
  check (icon in ('briefcase', 'heart', 'user', 'book-open', 'dumbbell', 'droplets', 'utensils', 'bed', 'brain', 'music', 'sun', 'moon', 'coffee', 'shopping-cart'));

alter table public.habits drop constraint if exists habits_frequency_type_check;
alter table public.habits add constraint habits_frequency_type_check
  check (frequency_type in ('daily', 'interval', 'custom_days'));
alter table public.habits drop constraint if exists habits_interval_days_check;
alter table public.habits add constraint habits_interval_days_check
  check (interval_days is null or interval_days between 2 and 365);
alter table public.habits drop constraint if exists habits_custom_days_check;
alter table public.habits add constraint habits_custom_days_check
  check (
    custom_days <@ array[0,1,2,3,4,5,6]::smallint[]
  );
alter table public.habits drop constraint if exists habits_time_minute_check;
alter table public.habits add constraint habits_time_minute_check
  check (time_minute is null or time_minute between 0 and 1439);
alter table public.habits drop constraint if exists habits_duration_minutes_check;
alter table public.habits add constraint habits_duration_minutes_check
  check (duration_minutes is null or duration_minutes between 1 and 720);
alter table public.habits drop constraint if exists habits_streak_values_check;
alter table public.habits add constraint habits_streak_values_check
  check (current_streak >= 0 and best_streak >= 0);
alter table public.habits drop constraint if exists habits_frequency_payload_check;
alter table public.habits add constraint habits_frequency_payload_check
  check (
    (frequency_type = 'daily' and interval_days is null and cardinality(custom_days) = 0)
    or (frequency_type = 'interval' and interval_days is not null and cardinality(custom_days) = 0)
    or (frequency_type = 'custom_days' and interval_days is null and cardinality(custom_days) > 0)
  );
alter table public.habits drop constraint if exists habits_icon_check;
alter table public.habits add constraint habits_icon_check
  check (icon in ('briefcase', 'heart', 'user', 'book-open', 'dumbbell', 'droplets', 'utensils', 'bed', 'brain', 'music', 'sun', 'moon', 'coffee', 'shopping-cart'));

alter table public.habits drop column if exists frequency;
alter table public.habits drop column if exists start_minute;

create index if not exists idx_categories_user_created_at on public.categories(user_id, created_at);
create index if not exists idx_categories_user_updated_at on public.categories(user_id, updated_at);
create index if not exists idx_tasks_user_scheduled_at on public.tasks(user_id, scheduled_at);
create index if not exists idx_tasks_user_updated_at on public.tasks(user_id, updated_at);
create index if not exists idx_habits_user_created_at on public.habits(user_id, created_at);
create index if not exists idx_habits_user_updated_at on public.habits(user_id, updated_at);
create index if not exists idx_habits_user_next_occurrence on public.habits(user_id, next_occurrence_on);
create index if not exists idx_habit_completions_user_habit_date on public.habit_completions(user_id, habit_id, completed_on);
create index if not exists idx_habit_completions_user_updated_at on public.habit_completions(user_id, updated_at);
create index if not exists idx_habit_sessions_user_habit_date on public.habit_sessions(user_id, habit_id, session_date);
create index if not exists idx_habit_sessions_user_active on public.habit_sessions(user_id, habit_id, ended_at);
create index if not exists idx_profiles_display_name on public.profiles(display_name);

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.tasks enable row level security;
alter table public.habits enable row level security;
alter table public.habit_completions enable row level security;
alter table public.habit_sessions enable row level security;

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

drop policy if exists "habit_completions_select_own" on public.habit_completions;
create policy "habit_completions_select_own" on public.habit_completions
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "habit_completions_insert_own" on public.habit_completions;
create policy "habit_completions_insert_own" on public.habit_completions
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "habit_completions_update_own" on public.habit_completions;
create policy "habit_completions_update_own" on public.habit_completions
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "habit_completions_delete_own" on public.habit_completions;
create policy "habit_completions_delete_own" on public.habit_completions
for delete to authenticated
using (auth.uid() = user_id);

drop policy if exists "habit_sessions_select_own" on public.habit_sessions;
create policy "habit_sessions_select_own" on public.habit_sessions
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "habit_sessions_insert_own" on public.habit_sessions;
create policy "habit_sessions_insert_own" on public.habit_sessions
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "habit_sessions_update_own" on public.habit_sessions;
create policy "habit_sessions_update_own" on public.habit_sessions
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "habit_sessions_delete_own" on public.habit_sessions;
create policy "habit_sessions_delete_own" on public.habit_sessions
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

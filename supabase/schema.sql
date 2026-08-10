-- ============================================================================
--  RODION APP — полная схема базы данных
--  Выполнить целиком в Supabase → SQL Editor → New query → Run.
--  Скрипт идемпотентный: можно запускать повторно без ошибок.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. ПРОФИЛИ
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id              uuid primary key references auth.users on delete cascade,
  username        text,
  total_xp        integer     default 0,
  level           integer     default 1,
  current_streak  integer     default 0,
  longest_streak  integer     default 0,
  last_active_date date,
  unlocked_weeks  integer     default 0,
  -- настройки (раздел /settings)
  daily_goal      integer     default 10,   -- дневная цель рассылок, 5..50
  streak_threshold integer    default 70,   -- % чеклиста для стрика, 60..90
  language        text        default 'ru', -- 'ru' | 'en'
  created_at      timestamptz default now()
);

-- Мягкие миграции: если таблица уже существовала со старой формой.
alter table public.profiles add column if not exists daily_goal integer default 10;
alter table public.profiles add column if not exists streak_threshold integer default 70;
alter table public.profiles add column if not exists language text default 'ru';
alter table public.profiles add column if not exists unlocked_weeks integer default 0;

alter table public.profiles
  drop constraint if exists profiles_daily_goal_check;
alter table public.profiles
  add constraint profiles_daily_goal_check check (daily_goal between 5 and 50);

alter table public.profiles
  drop constraint if exists profiles_streak_threshold_check;
alter table public.profiles
  add constraint profiles_streak_threshold_check check (streak_threshold between 60 and 90);

-- ---------------------------------------------------------------------------
-- 2. ЗАПИСИ ДНЯ
-- ---------------------------------------------------------------------------
create table if not exists public.daily_logs (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users on delete cascade not null,
  date           date not null,
  sleep_time     time,
  wake_time      time,
  wake_quality   text,                        -- 'easy' | 'normal' | 'hard'
  morning_comment text,
  checklist      jsonb default '{}'::jsonb,   -- { taskId: boolean }
  custom_tasks   jsonb default '[]'::jsonb,   -- [{ id, title }]
  meal_1_time    time,
  meal_1_note    text,
  meal_2_time    time,
  meal_2_note    text,
  fasting_ok     boolean default false,
  day_comment    text,
  completion_pct integer default 0,
  xp_earned      integer default 0,
  created_at     timestamptz default now(),
  unique (user_id, date)
);

create index if not exists daily_logs_user_date_idx on public.daily_logs (user_id, date desc);

-- ---------------------------------------------------------------------------
-- 3. КОНТАКТЫ РАССЫЛОК
-- ---------------------------------------------------------------------------
create table if not exists public.outreach_contacts (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users on delete cascade not null,
  name           text not null,
  niche          text,
  audience_size  text,
  platform       text,
  status         text default 'sent',         -- sent|ignored|read|replied|refused|call|closed
  note           text,
  status_history jsonb default '[]'::jsonb,   -- [{ status, at }]
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index if not exists outreach_user_created_idx on public.outreach_contacts (user_id, created_at desc);
create index if not exists outreach_user_status_idx  on public.outreach_contacts (user_id, status);

-- ---------------------------------------------------------------------------
-- 4. ОФФЕРЫ (библиотека сообщений)
-- ---------------------------------------------------------------------------
create table if not exists public.offers (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users on delete cascade not null,
  title      text not null,
  niche      text,
  content    text not null,
  result     text default 'not_sent',         -- not_sent|ignored|read|replied|call|closed
  note       text,
  contact_id uuid references public.outreach_contacts (id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists offers_user_created_idx on public.offers (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 5. ЗАМЕТКИ
-- ---------------------------------------------------------------------------
create table if not exists public.notes (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users on delete cascade not null,
  content    text not null,
  tag        text default 'thought',          -- idea|goal|insight|thought
  deleted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists notes_user_created_idx on public.notes (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 6. ЛОГ НАЧИСЛЕНИЙ XP
--    once_key делает начисление идемпотентным: одно и то же событие
--    (например «задача X отмечена 2026-08-10») не начислит XP дважды.
-- ---------------------------------------------------------------------------
create table if not exists public.xp_transactions (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users on delete cascade not null,
  amount     integer not null,
  reason     text not null,
  once_key   text,
  created_at timestamptz default now()
);

alter table public.xp_transactions add column if not exists once_key text;

create unique index if not exists xp_once_key_uniq  on public.xp_transactions (user_id, once_key) where once_key is not null;
create index        if not exists xp_user_created_idx on public.xp_transactions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 7. ИНТЕГРАЦИЯ С GOOGLE SHEETS
--    refresh_token читается ТОЛЬКО сервером (service role).
--    Клиенту выдаются права на отдельные колонки — токен ему недоступен.
-- ---------------------------------------------------------------------------
create table if not exists public.google_integrations (
  user_id          uuid primary key references auth.users on delete cascade,
  refresh_token    text,
  google_email     text,
  sheet_id         text,
  last_synced_at   timestamptz,
  last_sync_status text,
  connected_at     timestamptz default now()
);

-- ============================================================================
--  RLS — на всех таблицах, доступ строго к своим строкам
-- ============================================================================
alter table public.profiles            enable row level security;
alter table public.daily_logs          enable row level security;
alter table public.outreach_contacts   enable row level security;
alter table public.offers              enable row level security;
alter table public.notes               enable row level security;
alter table public.xp_transactions     enable row level security;
alter table public.google_integrations enable row level security;

-- profiles (id = auth.uid())
drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_insert" on public.profiles;
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_select" on public.profiles for select using (id = auth.uid());
create policy "profiles_insert" on public.profiles for insert with check (id = auth.uid());
create policy "profiles_update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Остальные таблицы: user_id = auth.uid()
do $policies$
declare t text;
begin
  foreach t in array array['daily_logs','outreach_contacts','offers','notes','xp_transactions']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);

    execute format('create policy %I on public.%I for select using (user_id = auth.uid())', t || '_select', t);
    execute format('create policy %I on public.%I for insert with check (user_id = auth.uid())', t || '_insert', t);
    execute format('create policy %I on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_update', t);
    execute format('create policy %I on public.%I for delete using (user_id = auth.uid())', t || '_delete', t);
  end loop;
end
$policies$;

-- google_integrations: строка своя, но колонки ограничены грантами ниже
drop policy if exists "google_select" on public.google_integrations;
drop policy if exists "google_update" on public.google_integrations;
create policy "google_select" on public.google_integrations for select using (user_id = auth.uid());
create policy "google_update" on public.google_integrations for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Колоночные привилегии: refresh_token недоступен клиенту ни на чтение, ни на запись.
revoke all on public.google_integrations from anon, authenticated;
grant select (user_id, google_email, sheet_id, last_synced_at, last_sync_status, connected_at)
  on public.google_integrations to authenticated;
grant update (sheet_id) on public.google_integrations to authenticated;

-- ============================================================================
--  ФУНКЦИИ
-- ============================================================================

-- Уровень по количеству XP (единый источник правды с lib/xp.ts)
create or replace function public.level_for_xp(p_xp integer)
returns integer
language sql
immutable
as $fn$
  select case
    when p_xp >= 8000 then 7
    when p_xp >= 4000 then 6
    when p_xp >= 2000 then 5
    when p_xp >= 1000 then 4
    when p_xp >=  500 then 3
    when p_xp >=  200 then 2
    else 1
  end;
$fn$;

-- Атомарное начисление XP.
-- p_once_key = null  -> начисляет всегда
-- p_once_key задан   -> начислит ровно один раз за всё время
create or replace function public.award_xp(
  p_amount   integer,
  p_reason   text,
  p_once_key text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_user    uuid := auth.uid();
  v_rows    integer := 0;
  v_total   integer;
  v_level   integer;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  insert into public.xp_transactions (user_id, amount, reason, once_key)
  values (v_user, p_amount, p_reason, p_once_key)
  on conflict (user_id, once_key) where once_key is not null do nothing;

  get diagnostics v_rows = row_count;

  if v_rows > 0 then
    update public.profiles
       set total_xp = coalesce(total_xp, 0) + p_amount,
           level    = public.level_for_xp(coalesce(total_xp, 0) + p_amount)
     where id = v_user
     returning total_xp, level into v_total, v_level;
  else
    select total_xp, level into v_total, v_level from public.profiles where id = v_user;
  end if;

  return json_build_object(
    'awarded', case when v_rows > 0 then p_amount else 0 end,
    'total_xp', coalesce(v_total, 0),
    'level',    coalesce(v_level, 1)
  );
end;
$fn$;

grant execute on function public.award_xp(integer, text, text) to authenticated;

-- Пересчёт total_xp из лога транзакций (страховка от рассинхрона)
create or replace function public.resync_xp()
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_user  uuid := auth.uid();
  v_total integer;
begin
  if v_user is null then raise exception 'not authenticated'; end if;

  select coalesce(sum(amount), 0) into v_total
    from public.xp_transactions where user_id = v_user;

  update public.profiles
     set total_xp = v_total,
         level    = public.level_for_xp(v_total)
   where id = v_user;

  return json_build_object('total_xp', v_total, 'level', public.level_for_xp(v_total));
end;
$fn$;

grant execute on function public.resync_xp() to authenticated;

-- Автообновление updated_at
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

drop trigger if exists touch_outreach on public.outreach_contacts;
create trigger touch_outreach before update on public.outreach_contacts
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_offers on public.offers;
create trigger touch_offers before update on public.offers
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_notes on public.notes;
create trigger touch_notes before update on public.notes
  for each row execute function public.touch_updated_at();

-- Автосоздание профиля при регистрации
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.profiles (id, username)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Профили для пользователей, зарегистрированных до установки триггера
insert into public.profiles (id, username)
select u.id, split_part(u.email, '@', 1)
  from auth.users u
  left join public.profiles p on p.id = u.id
 where p.id is null
on conflict (id) do nothing;

-- ============================================================================
--  ГОТОВО
-- ============================================================================

-- ============================================================================
--  RODION APP — МИГРАЦИЯ v2 «HUNTER SYSTEM»
--
--  Выполнить целиком в Supabase → SQL Editor → Run.
--  Идемпотентна: можно запускать повторно.
--
--  Что делает:
--   1. архивирует текущие данные (копии таблиц с префиксом _archive_);
--   2. добавляет прогрессивную квоту, счётчики режима, цепочку, дедлайн;
--   3. расширяет карточку контакта (TG, IG, дата касания, комментарий);
--   4. создаёт ленту активности, задачи дня, проекты, отчёты, подписки push;
--   5. обнуляет профиль под новый цикл.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. АРХИВ — снимок данных до обнуления. Ничего не удаляем.
-- ---------------------------------------------------------------------------
do $archive$
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = '_archive_profiles') then
    create table public._archive_profiles     as table public.profiles;
    create table public._archive_daily_logs   as table public.daily_logs;
    create table public._archive_contacts     as table public.outreach_contacts;
    create table public._archive_offers       as table public.offers;
    create table public._archive_notes        as table public.notes;
    create table public._archive_xp           as table public.xp_transactions;

    -- Архив читает только владелец строк.
    alter table public._archive_profiles   enable row level security;
    alter table public._archive_daily_logs enable row level security;
    alter table public._archive_contacts   enable row level security;
    alter table public._archive_offers     enable row level security;
    alter table public._archive_notes      enable row level security;
    alter table public._archive_xp         enable row level security;

    create policy "own" on public._archive_profiles   for select using (id = auth.uid());
    create policy "own" on public._archive_daily_logs for select using (user_id = auth.uid());
    create policy "own" on public._archive_contacts   for select using (user_id = auth.uid());
    create policy "own" on public._archive_offers     for select using (user_id = auth.uid());
    create policy "own" on public._archive_notes      for select using (user_id = auth.uid());
    create policy "own" on public._archive_xp         for select using (user_id = auth.uid());
  end if;
end
$archive$;

-- ---------------------------------------------------------------------------
-- 2. ПРОФИЛЬ — квота, режим, цепочка, ставки
-- ---------------------------------------------------------------------------
alter table public.profiles
  -- прогрессивная квота рассылок
  add column if not exists current_quota   integer default 5,
  add column if not exists quota_streak    integer default 0,
  add column if not exists daily_record    integer default 0,
  add column if not exists quota_last_date date,
  -- ставки и цикл
  add column if not exists deadline_date   date default '2027-04-15',
  add column if not exists cycle_start_date date default current_date,
  -- счётчики режима (воздержание). Сбрасываются вечерним чекином.
  add column if not exists mode_porn_days  integer default 0,
  add column if not exists mode_mb_days    integer default 0,
  add column if not exists mode_sugar_days integer default 0,
  add column if not exists mode_last_checkin date,
  -- цепочка дней с хотя бы одной рассылкой
  add column if not exists chain_days      integer default 0,
  add column if not exists chain_last_date date,
  -- первые события воронки — чтобы показать спецэкран ровно один раз
  add column if not exists first_reply_at  timestamptz,
  add column if not exists first_call_at   timestamptz,
  add column if not exists first_closed_at timestamptz,
  -- прочее
  add column if not exists sound_enabled   boolean default false,
  add column if not exists avg_deal_amount integer default 0,
  add column if not exists timezone        text default 'Europe/Moscow',
  add column if not exists push_enabled    boolean default false;

-- Старые ограничения из v1 больше не нужны: дневная цель заменена квотой.
alter table public.profiles drop constraint if exists profiles_daily_goal_check;

-- ---------------------------------------------------------------------------
-- 3. КОНТАКТЫ — полная карточка эксперта
--    §12 отменяет §11: instagram_handle не нужен, храним готовый URL.
-- ---------------------------------------------------------------------------

-- Если предыдущая версия успела создать генерируемую колонку — снимаем её,
-- иначе ALTER ниже упрётся в неизменяемый GENERATED-столбец.
do $ig$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'outreach_contacts'
       and column_name = 'instagram_url' and is_generated = 'ALWAYS'
  ) then
    alter table public.outreach_contacts drop column instagram_url;
  end if;
end
$ig$;

alter table public.outreach_contacts
  drop column if exists instagram_handle,
  add column if not exists instagram_url      text,
  add column if not exists telegram_handle    text,
  add column if not exists first_contact_date date default current_date,
  add column if not exists comment            text,
  -- «Следующий шаг» — открывается на 4-м уровне
  add column if not exists next_step          text,
  -- когда контакт впервые ответил: нужен счётчику скорости (уровень 4)
  add column if not exists replied_at         timestamptz;

-- Ниша теперь свободный текст — прежние коды раскрываем в человеческие слова.
update public.outreach_contacts set niche = case niche
  when 'english'    then 'Английский язык'
  when 'fitness'    then 'Фитнес'
  when 'psychology' then 'Психология'
  when 'finance'    then 'Финансы'
  when 'marketing'  then 'Маркетинг'
  when 'realestate' then 'Недвижимость'
  when 'creative'   then 'Творчество'
  when 'other'      then 'Другое'
  else niche end
where niche in ('english','fitness','psychology','finance','marketing','realestate','creative','other');

update public.offers set niche = case niche
  when 'english'    then 'Английский язык'
  when 'fitness'    then 'Фитнес'
  when 'psychology' then 'Психология'
  when 'finance'    then 'Финансы'
  when 'marketing'  then 'Маркетинг'
  when 'realestate' then 'Недвижимость'
  when 'creative'   then 'Творчество'
  when 'other'      then 'Другое'
  else niche end
where niche in ('english','fitness','psychology','finance','marketing','realestate','creative','other');

-- ---------------------------------------------------------------------------
-- 4. ЛЕНТА АКТИВНОСТИ
-- ---------------------------------------------------------------------------
create table if not exists public.activity_feed (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid references auth.users on delete cascade not null,
  type          text not null,          -- sent | replied | call | closed | quota | record
  contact_name  text,
  contact_niche text,
  detail        text,                   -- «завтра 12:00» и подобное
  xp_earned     integer default 0,
  created_at    timestamptz default now()
);

create index if not exists activity_user_created_idx
  on public.activity_feed (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 5. ЗАДАЧИ ДНЯ
-- ---------------------------------------------------------------------------
create table if not exists public.daily_tasks (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users on delete cascade not null,
  date       date not null,
  text       text not null,
  completed  boolean default false,
  created_at timestamptz default now()
);

create index if not exists daily_tasks_user_date_idx
  on public.daily_tasks (user_id, date, created_at);

-- ---------------------------------------------------------------------------
-- 6. ПРОЕКТЫ — раздел открывается на 5-м уровне
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references auth.users on delete cascade not null,
  contact_id   uuid references public.outreach_contacts (id) on delete set null,
  expert_name  text not null,
  niche        text,
  status       text default 'prep',      -- prep | launch | done
  stages       jsonb default '[]'::jsonb, -- [{ id, title, done }]
  launch_date  date,
  deal_amount  integer default 0,
  note         text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists projects_user_idx on public.projects (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 7. ЕЖЕНЕДЕЛЬНЫЕ ОТЧЁТЫ — открываются на 6-м уровне
-- ---------------------------------------------------------------------------
create table if not exists public.weekly_reports (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users on delete cascade not null,
  week_start  date not null,
  sent        integer default 0,
  replied     integer default 0,
  calls       integer default 0,
  closed      integer default 0,
  xp_earned   integer default 0,
  best_day    date,
  best_count  integer default 0,
  created_at  timestamptz default now(),
  unique (user_id, week_start)
);

-- ---------------------------------------------------------------------------
-- 8. PUSH-ПОДПИСКИ
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users on delete cascade not null,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz default now(),
  unique (endpoint)
);

create index if not exists push_user_idx on public.push_subscriptions (user_id);

-- ---------------------------------------------------------------------------
-- 9. RLS для новых таблиц
-- ---------------------------------------------------------------------------
alter table public.activity_feed      enable row level security;
alter table public.daily_tasks        enable row level security;
alter table public.projects           enable row level security;
alter table public.weekly_reports     enable row level security;
alter table public.push_subscriptions enable row level security;

do $policies$
declare t text;
begin
  foreach t in array array['activity_feed','daily_tasks','projects','weekly_reports','push_subscriptions']
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

drop trigger if exists touch_projects on public.projects;
create trigger touch_projects before update on public.projects
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 10. УРОВНИ — новая шкала на 9 ступеней
-- ---------------------------------------------------------------------------
create or replace function public.level_for_xp(p_xp integer)
returns integer
language sql
immutable
as $fn$
  select case
    when p_xp >= 40000 then 9
    when p_xp >= 22000 then 8
    when p_xp >= 12000 then 7
    when p_xp >=  6500 then 6
    when p_xp >=  3500 then 5
    when p_xp >=  1800 then 4
    when p_xp >=   800 then 3
    when p_xp >=   300 then 2
    else 1
  end;
$fn$;

-- ---------------------------------------------------------------------------
-- 11. ОБНУЛЕНИЕ ЦИКЛА
--     Данные уже в архиве (шаг 1), поэтому чистим рабочие таблицы.
-- ---------------------------------------------------------------------------
do $reset$
declare v_marker text := 'hunter-v2-reset';
begin
  -- Повторный запуск скрипта не должен обнулять прогресс второй раз.
  if exists (select 1 from public.xp_transactions where once_key = v_marker) then
    return;
  end if;

  delete from public.xp_transactions;
  delete from public.activity_feed;
  delete from public.daily_logs;

  update public.profiles set
    total_xp         = 0,
    level            = 1,
    current_streak   = 0,
    longest_streak   = 0,
    current_quota    = 5,
    quota_streak     = 0,
    daily_record     = 0,
    quota_last_date  = null,
    chain_days       = 0,
    chain_last_date  = null,
    mode_porn_days   = 0,
    mode_mb_days     = 0,
    mode_sugar_days  = 0,
    mode_last_checkin = null,
    first_reply_at   = null,
    first_call_at    = null,
    first_closed_at  = null,
    unlocked_weeks   = 0,
    cycle_start_date = current_date;

  -- Метка-страховка от повторного обнуления.
  insert into public.xp_transactions (user_id, amount, reason, once_key)
  select id, 0, 'cycle_reset', v_marker from public.profiles limit 1;
end
$reset$;

-- ============================================================================
--  ГОТОВО
-- ============================================================================

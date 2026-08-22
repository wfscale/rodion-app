-- ============================================================================
--  RODION APP — МИГРАЦИЯ v8 «ВОРОНКА ПРОДЮСИРОВАНИЯ»
--
--  Выполнить целиком в Supabase → SQL Editor → New query → Run.
--  Идемпотентна: можно запускать повторно, ничего не сломается.
--
--  Что делает:
--   1. превращает проект из списка галочек в путь по этапам с датами;
--   2. заводит активы эксперта на старте и на сегодня — «с чего начали»;
--   3. добавляет ссылки на площадки эксперта;
--   4. вводит исход «не сложилось» вместо удаления проекта;
--   5. создаёт задачи проекта: дневные и недельные;
--   6. добавляет статус рассылки «Удалил чат».
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. ПРОЕКТ — ПУТЬ, А НЕ КАРТОЧКА
--
--    Запуск идёт всегда одной дорогой: созвон → анкета знакомства →
--    договор → кастдевы → MVP → прогрев → продажи. Раньше проект был
--    списком произвольных галочек, и на третьем эксперте эти списки
--    расходились так, что сравнить два запуска было нельзя.
--
--    stages остаётся jsonb, но у элемента появляется дата: теперь это
--    [{ id, title, done, due }]. id совпадает с шагом воронки из
--    lib/pipeline.ts — по нему подтягивается название и подсказка.
-- ---------------------------------------------------------------------------
alter table public.projects
  -- Куда вернуться, чтобы вспомнить, с кем работаешь.
  add column if not exists instagram_url text,
  add column if not exists telegram_url  text,
  -- Границы проекта. launch_date уже есть и означает конец — дату запуска.
  add column if not exists started_at    date default current_date,
  -- Активы эксперта: {ig_followers, ig_reach, tg_subs, tg_reach}.
  -- Один jsonb, а не четыре колонки: набор метрик будет меняться, а
  -- добавлять колонку под каждую новую площадку — это миграция на ровном месте.
  add column if not exists assets_start  jsonb not null default '{}'::jsonb,
  add column if not exists assets_now    jsonb not null default '{}'::jsonb;

-- Старые строки могли получить null до появления not null.
update public.projects
   set assets_start = coalesce(assets_start, '{}'::jsonb),
       assets_now   = coalesce(assets_now,   '{}'::jsonb)
 where assets_start is null
    or assets_now is null;

update public.projects
   set started_at = coalesce(started_at, created_at::date, current_date)
 where started_at is null;

-- ---------------------------------------------------------------------------
-- 2. ИСХОД «НЕ СЛОЖИЛОСЬ»
--
--    После анкеты знакомства бывает видно, что интересного запуска здесь не
--    выйдет. Удалять такой проект нельзя: тогда из истории пропадает сам
--    факт, что подход был, и кажется, будто работы было меньше, чем на
--    самом деле. Статусов теперь три: в работе, запустили, не сложилось.
--
--    Старые prep и launch — это «в работе» на разных этапах; этап теперь
--    живёт в stages, а не в статусе.
-- ---------------------------------------------------------------------------
-- Ловим не только prep/launch, но и любое другое значение: ограничение ниже
-- упадёт на первой же неожиданной строке, а миграция обязана проходить с
-- любой историей, накопленной за три смены схемы.
update public.projects
   set status = 'active'
 where status is null
    or status not in ('active', 'done', 'lost');

alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects
  add constraint projects_status_check check (status in ('active', 'done', 'lost'));

-- ---------------------------------------------------------------------------
-- 3. ЗАДАЧИ ПРОЕКТА
--
--    scope делит их на два непересекающихся мира. Дневная задача проекта
--    поднимается в «Задачи дня» на главной — там, где человек и смотрит,
--    что делать прямо сейчас. Недельная остаётся внутри проекта: если
--    поднять и её, список дня перестанет быть списком дня.
--
--    Отдельная таблица, а не jsonb в проекте: задачи отмечают по одной и
--    с двух экранов сразу, а переписывать весь массив ради одной галочки
--    значит терять чужие отметки при гонке.
-- ---------------------------------------------------------------------------
create table if not exists public.project_tasks (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users on delete cascade not null,
  project_id uuid references public.projects (id) on delete cascade not null,
  text       text not null,
  scope      text default 'day',   -- 'day' | 'week'
  -- Для дневной задачи — на какой день она поднимается в список дня.
  -- Для недельной остаётся null.
  date       date,
  done       boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.project_tasks drop constraint if exists project_tasks_scope_check;
alter table public.project_tasks
  add constraint project_tasks_scope_check check (scope in ('day', 'week'));

create index if not exists project_tasks_project_idx
  on public.project_tasks (user_id, project_id, created_at);

-- Главная спрашивает ровно одно: что у меня сегодня. Частичный индекс
-- отвечает на этот вопрос, не перебирая недельные задачи вообще.
create index if not exists project_tasks_today_idx
  on public.project_tasks (user_id, date)
  where scope = 'day';

alter table public.project_tasks enable row level security;

drop policy if exists "project_tasks_select" on public.project_tasks;
drop policy if exists "project_tasks_insert" on public.project_tasks;
drop policy if exists "project_tasks_update" on public.project_tasks;
drop policy if exists "project_tasks_delete" on public.project_tasks;

create policy "project_tasks_select" on public.project_tasks
  for select using (user_id = auth.uid());
create policy "project_tasks_insert" on public.project_tasks
  for insert with check (user_id = auth.uid());
create policy "project_tasks_update" on public.project_tasks
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "project_tasks_delete" on public.project_tasks
  for delete using (user_id = auth.uid());

drop trigger if exists touch_project_tasks on public.project_tasks;
create trigger touch_project_tasks before update on public.project_tasks
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 4. СТАТУС «УДАЛИЛ ЧАТ»
--
--    Прочитал и снёс переписку — это не блокировка. Человек не закрывал
--    дверь, он просто убрал сообщение с глаз, и писать туда больше нет
--    смысла ровно так же. Но складывать это в «Заблокировал» значит врать
--    себе про то, насколько резко реагирует аудитория.
--
--    Схема статусов текстовая и ограничения не имеет — колонку менять не
--    нужно, шкала живёт в lib/types.ts. Здесь только проверка, что старых
--    значений этого имени в базе нет.
-- ---------------------------------------------------------------------------
update public.outreach_contacts
   set status = 'deleted_chat'
 where status in ('deleted', 'chat_deleted');

update public.offers
   set result = 'deleted_chat'
 where result in ('deleted', 'chat_deleted');

-- ---------------------------------------------------------------------------
-- ПРОВЕРКА
--
--    После Run: одна строка со сводкой. projects_ok должно быть true.
-- ---------------------------------------------------------------------------
select
  (select count(*) from public.projects)                          as projects,
  (select count(*) from public.project_tasks)                     as project_tasks,
  (select count(*) from public.projects where status = 'lost')    as lost,
  -- coalesce: bool_and по пустой таблице вернул бы null, а не true.
  (select coalesce(bool_and(status in ('active', 'done', 'lost')), true)
     from public.projects)                                        as projects_ok,
  (select count(*) from public.outreach_contacts
    where status = 'deleted_chat')                                as deleted_chats;

-- ============================================================================
--  ГОТОВО
-- ============================================================================

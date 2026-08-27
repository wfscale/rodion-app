-- ============================================================================
--  RODION APP — МИГРАЦИЯ v13 «ВРЕМЯ НА ЗАДАЧУ И СПРИНТЫ»
--
--  Выполнить целиком в Supabase → SQL Editor → New query → Run.
--  Идемпотентна: можно запускать повторно, ничего не сломается.
--
--  Что делает:
--   1. позволяет отвести задаче время и увидеть бюджет дня;
--   2. заводит рекорд спринта — сколько рассылок за один заход.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. ВРЕМЯ НА ЗАДАЧУ
--
--    Минуты, а не часы: «полтора часа» вводится как 90 и складывается без
--    дробей. Ноль и null — разные вещи: null означает «время не оценивал»,
--    и такая задача просто не участвует в бюджете дня.
--
--    Смысл не в учёте, а в столкновении с арифметикой. Восемь задач по часу
--    в день, где свободно четыре, — это не план, а способ вечером считать
--    себя неудачником. Сумма показывает это утром, когда ещё можно убрать
--    лишнее.
-- ---------------------------------------------------------------------------
alter table public.daily_tasks
  add column if not exists minutes integer;

alter table public.project_tasks
  add column if not exists minutes integer;

alter table public.daily_tasks drop constraint if exists daily_tasks_minutes_check;
alter table public.daily_tasks
  add constraint daily_tasks_minutes_check
  check (minutes is null or (minutes > 0 and minutes <= 1440));

alter table public.project_tasks drop constraint if exists project_tasks_minutes_check;
alter table public.project_tasks
  add constraint project_tasks_minutes_check
  check (minutes is null or (minutes > 0 and minutes <= 1440));

-- ---------------------------------------------------------------------------
-- 2. РЕКОРД СПРИНТА
--
--    Спринт — заход, в течение которого делаются только рассылки. Сам заход
--    нигде не хранится: он живёт в браузере и умирает вместе с ним. А вот
--    рекорд — сколько рассылок удалось сделать за один заход — это то, что
--    в следующий раз хочется побить, и он обязан пережить перезагрузку.
--
--    Длительность рядом с рекордом обязательна: двенадцать за час и
--    двенадцать за двадцать минут — разные достижения, и без второго числа
--    рекорд превращается в бессмысленную цифру.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists sprint_record         integer default 0,
  add column if not exists sprint_record_minutes integer default 0;

update public.profiles
   set sprint_record = coalesce(sprint_record, 0),
       sprint_record_minutes = coalesce(sprint_record_minutes, 0)
 where sprint_record is null
    or sprint_record_minutes is null;

alter table public.profiles drop constraint if exists profiles_sprint_record_check;
alter table public.profiles
  add constraint profiles_sprint_record_check
  check (sprint_record >= 0 and sprint_record_minutes >= 0);

-- ---------------------------------------------------------------------------
-- ПРОВЕРКА
-- ---------------------------------------------------------------------------
select
  sprint_record,
  sprint_record_minutes,
  (select count(*) from public.daily_tasks where minutes is not null)   as timed_tasks,
  (select count(*) from public.project_tasks where minutes is not null) as timed_project_tasks
  from public.profiles;

-- ============================================================================
--  ГОТОВО
-- ============================================================================

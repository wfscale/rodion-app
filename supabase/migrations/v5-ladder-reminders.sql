-- ============================================================================
--  RODION APP — МИГРАЦИЯ v5 «ЛЕСТНИЦА, НАПОМИНАНИЯ, ЧИСТАЯ ВОРОНКА»
--
--  Выполнить целиком в Supabase → SQL Editor → New query → Run.
--  Идемпотентна: можно запускать повторно.
--
--  Что делает:
--   1. убирает статус «Отказ» — он дублировал «Ответил — отказ»;
--   2. заводит таблицу напоминаний с датой и временем;
--   3. расширяет шкалу уровней с 9 до 20 ступеней;
--   4. пересчитывает уровень у всех профилей под новую шкалу.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. СТАТУС «ОТКАЗ» УХОДИТ
--
--    Два почти одинаковых слова в списке заставляли выбирать между ними
--    каждый раз, а отличались они только тем, был ли ответ. Теперь ответ
--    есть всегда: «Ответил — отказ» это ответ, отсутствие ответа — просто
--    «Отправлено». Старые строки переезжают в «Ответил — отказ»: раз статус
--    ставили руками, значит человек как-то отреагировал.
-- ---------------------------------------------------------------------------
update public.outreach_contacts
   set status = 'replied_no'
 where status in ('refused', 'ignored');

update public.offers
   set result = 'replied_no'
 where result in ('refused', 'ignored');

-- История статусов — тот же переезд, иначе недельные отчёты задним числом
-- перестанут видеть в этих контактах ответ.
update public.outreach_contacts c
   set status_history = coalesce(
     (
       select jsonb_agg(
                case
                  when entry->>'status' in ('refused', 'ignored')
                    then jsonb_set(entry, '{status}', '"replied_no"')
                  else entry
                end
                order by ord
              )
         from jsonb_array_elements(c.status_history) with ordinality as t(entry, ord)
     ),
     '[]'::jsonb
   )
 where jsonb_typeof(c.status_history) = 'array'
   and (
     c.status_history @> '[{"status":"refused"}]'::jsonb
     or c.status_history @> '[{"status":"ignored"}]'::jsonb
   );

-- ---------------------------------------------------------------------------
-- 2. НАПОМИНАНИЯ
--
--    due_at — text, а не timestamptz, намеренно. Напоминание «в 14:00»
--    должно сработать в 14:00 по тем часам, на которые смотрит человек,
--    независимо от часового пояса устройства и сервера. Формат
--    'YYYY-MM-DDTHH:mm' сортируется как дата, поэтому индекс работает.
--
--    contact_id делит напоминания на два мира: с привязкой оно всплывает
--    в блоке касаний на странице рассылок, без привязки живёт только во
--    вкладке «Напоминания».
-- ---------------------------------------------------------------------------
create table if not exists public.reminders (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users on delete cascade not null,
  title      text not null,
  note       text,
  due_at     text not null,
  contact_id uuid references public.outreach_contacts (id) on delete cascade,
  done       boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists reminders_user_due_idx
  on public.reminders (user_id, done, due_at);

alter table public.reminders enable row level security;

drop policy if exists "reminders_select" on public.reminders;
drop policy if exists "reminders_insert" on public.reminders;
drop policy if exists "reminders_update" on public.reminders;
drop policy if exists "reminders_delete" on public.reminders;

create policy "reminders_select" on public.reminders
  for select using (user_id = auth.uid());
create policy "reminders_insert" on public.reminders
  for insert with check (user_id = auth.uid());
create policy "reminders_update" on public.reminders
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "reminders_delete" on public.reminders
  for delete using (user_id = auth.uid());

drop trigger if exists touch_reminders on public.reminders;
create trigger touch_reminders before update on public.reminders
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 3. ДВАДЦАТЬ УРОВНЕЙ
--
--    Единственный источник правды по порогам — lib/xp.ts. Эта функция
--    обязана повторять его один в один, иначе клиент и база разойдутся в
--    номере уровня. Пороги 1..6 не менялись: понижать уже взятый уровень
--    нельзя, это обнуляет доверие к шкале.
-- ---------------------------------------------------------------------------
create or replace function public.level_for_xp(p_xp integer)
returns integer
language sql
immutable
as $fn$
  select case
    when p_xp >= 240000 then 20
    when p_xp >= 195000 then 19
    when p_xp >= 160000 then 18
    when p_xp >= 133000 then 17
    when p_xp >= 110000 then 16
    when p_xp >=  90000 then 15
    when p_xp >=  73000 then 14
    when p_xp >=  58500 then 13
    when p_xp >=  46000 then 12
    when p_xp >=  35500 then 11
    when p_xp >=  27000 then 10
    when p_xp >=  20000 then 9
    when p_xp >=  14500 then 8
    when p_xp >=  10000 then 7
    when p_xp >=   6500 then 6
    when p_xp >=   3500 then 5
    when p_xp >=   1800 then 4
    when p_xp >=    800 then 3
    when p_xp >=    300 then 2
    else 1
  end;
$fn$;

-- Уровень в профиле — кэш. После смены шкалы его нужно пересчитать,
-- иначе шапка покажет старую ступень до первого начисления XP.
update public.profiles
   set level = public.level_for_xp(coalesce(total_xp, 0))
 where level is distinct from public.level_for_xp(coalesce(total_xp, 0));

-- ============================================================================
--  ГОТОВО
-- ============================================================================

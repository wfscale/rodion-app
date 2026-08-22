-- ============================================================================
--  RODION APP — МИГРАЦИЯ v3 «ОФФЕРЫ И КАСАНИЯ»
--
--  Выполнить целиком в Supabase → SQL Editor → Run. Идемпотентна.
--
--  Что делает:
--   1. добавляет касания: дата последнего, счётчик, признак «остыл»;
--   2. вводит статус «Ответил — отказ» (ответ был, но исход отрицательный);
--   3. связывает оффер с контактом жёстче: результат оффера тянется
--      за статусом контакта автоматически.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. КАСАНИЯ
-- ---------------------------------------------------------------------------
alter table public.outreach_contacts
  -- Дата последнего касания. Первое касание = дата создания контакта.
  add column if not exists last_touch_at date default current_date,
  -- Сколько раз уже писали. Нужен, чтобы знать шаг каскада напоминаний.
  add column if not exists touch_count integer default 1,
  -- Ручная пометка «больше не напоминать»: человек остыл или неинтересен.
  add column if not exists muted boolean default false;

-- У существующих контактов последнее касание = дата первого.
update public.outreach_contacts
   set last_touch_at = coalesce(last_touch_at, first_contact_date, created_at::date)
 where last_touch_at is null;

create index if not exists contacts_touch_idx
  on public.outreach_contacts (user_id, last_touch_at);

-- ---------------------------------------------------------------------------
-- 2. ОФФЕРЫ — связь с контактом
--    Один контакт = один оффер (тот текст, которым его касались первый раз).
--    Уникальность не даёт наплодить дублей при повторных сохранениях.
-- ---------------------------------------------------------------------------
create unique index if not exists offers_contact_uniq
  on public.offers (contact_id)
  where contact_id is not null;

-- Результат оффера повторяет статус контакта: пользователю больше не нужно
-- вручную решать, «сработал» текст или нет — это видно по исходу.
create or replace function public.sync_offer_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.offers
     set result = case new.status
       when 'not_sent'   then 'not_sent'
       when 'sent'       then 'not_sent'
       when 'read'       then 'read'
       when 'replied'    then 'replied'
       when 'replied_no' then 'replied'
       when 'refused'    then 'ignored'
       when 'call'       then 'call'
       when 'closed'     then 'closed'
       else result
     end
   where contact_id = new.id;

  return new;
end;
$fn$;

drop trigger if exists sync_offer_on_status on public.outreach_contacts;
create trigger sync_offer_on_status
  after update of status on public.outreach_contacts
  for each row
  when (old.status is distinct from new.status)
  execute function public.sync_offer_result();

-- ============================================================================
--  ГОТОВО
-- ============================================================================

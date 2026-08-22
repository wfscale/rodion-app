-- ============================================================================
--  RODION APP — МИГРАЦИЯ v4 «РЕЗУЛЬТАТ ОФФЕРА = СТАТУС РАССЫЛКИ»
--
--  Выполнить целиком в Supabase → SQL Editor → Run. Идемпотентна.
--
--  Что меняет:
--   1. результат оффера теперь буквально повторяет статус контакта —
--      без таблицы соответствий, которая неизбежно разъехалась бы;
--   2. подтягивает результат при ЛЮБОМ изменении, а не только статуса;
--   3. разово синхронизирует уже существующие офферы.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Триггер: зеркалим статус контакта в результат его оффера
-- ---------------------------------------------------------------------------
create or replace function public.sync_offer_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  -- Прямое зеркало: шкалы совпадают один в один, переводить нечего.
  update public.offers
     set result = new.status
   where contact_id = new.id
     and result is distinct from new.status;

  return new;
end;
$fn$;

-- Ловим любое обновление контакта, а не только смену статуса: статус мог
-- измениться и в общем UPDATE карточки, тогда узкий триггер его пропускал.
drop trigger if exists sync_offer_on_status on public.outreach_contacts;
create trigger sync_offer_on_status
  after update on public.outreach_contacts
  for each row
  execute function public.sync_offer_result();

-- ---------------------------------------------------------------------------
-- 2. Новый оффер сразу получает текущий статус своего контакта
-- ---------------------------------------------------------------------------
create or replace function public.set_offer_result_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.contact_id is not null then
    select status into new.result
      from public.outreach_contacts
     where id = new.contact_id;
  end if;

  return new;
end;
$fn$;

drop trigger if exists set_offer_result on public.offers;
create trigger set_offer_result
  before insert on public.offers
  for each row
  execute function public.set_offer_result_on_insert();

-- ---------------------------------------------------------------------------
-- 3. Разовая синхронизация уже созданных офферов
-- ---------------------------------------------------------------------------
update public.offers o
   set result = c.status
  from public.outreach_contacts c
 where o.contact_id = c.id
   and o.result is distinct from c.status;

-- ============================================================================
--  ГОТОВО
-- ============================================================================

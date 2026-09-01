-- v14 · База не просрочена, оффер пишется под человека
--
-- 1. last_touch_at больше не проставляется при вставке.
--    Раньше стоял default current_date, и собранная база получала дату
--    касания в день, когда её нашли. База лежит неделями — это нормально,
--    её для того и собирают заранее. Но в день, когда по ней проходишь,
--    человек открывался уже просроченным на месяц: каскад 1/3/7/15/30
--    считал от даты находки, а не от даты сообщения.
--    Отсчёт обязан начинаться в момент отправки и ни секундой раньше.
--
-- 2. offer_text — какой оффер ушёл конкретно этому человеку.
--    Массовой рассылкой одним текстом занимаются те, у кого нет ответов.
--    Тексты пробуют разные, и без записи о том, что именно ушло, ответ
--    невозможно связать с формулировкой.

alter table public.outreach_contacts
  add column if not exists offer_text text;

comment on column public.outreach_contacts.offer_text is
  'Текст оффера, который реально ушёл этому человеку.';

-- Снимаем default: дату касания теперь ставит только отправка.
alter table public.outreach_contacts
  alter column last_touch_at drop default;

-- Лечим уже собранную базу: у ненаписанных касания не было.
update public.outreach_contacts
   set last_touch_at = null,
       touch_count = 0
 where status = 'not_sent'
   and (last_touch_at is not null or coalesce(touch_count, 0) <> 0);

-- Проверка
select
  (select count(*) from information_schema.columns
    where table_name = 'outreach_contacts' and column_name = 'offer_text') as has_offer_text,
  (select count(*) from information_schema.columns
    where table_name = 'outreach_contacts'
      and column_name = 'last_touch_at'
      and column_default is null) as touch_default_dropped,
  (select count(*) from public.outreach_contacts
    where status = 'not_sent' and last_touch_at is not null) as leads_still_touched;

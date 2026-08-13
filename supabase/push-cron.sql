-- ============================================================================
--  RODION APP — РАСПИСАНИЕ PUSH-УВЕДОМЛЕНИЙ
--
--  Выполнить в Supabase → SQL Editor → Run ПОСЛЕ того, как в Vercel добавлены
--  переменные CRON_SECRET, VAPID_PRIVATE_KEY и NEXT_PUBLIC_VAPID_PUBLIC_KEY.
--
--  Почему не Vercel Cron: на тарифе Hobby задание запускается раз в сутки,
--  а слотов четыре. pg_cron внутри Supabase такого ограничения не имеет.
--
--  ВАЖНО: подставь свой CRON_SECRET вместо ЗАМЕНИ_НА_СЕКРЕТ (два места ниже
--  на каждое задание — всего четыре строки).
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Время в cron указывается в UTC. Ниже — расчёт для Екатеринбурга (UTC+5):
--   09:30 местного = 04:30 UTC
--   14:00 местного = 09:00 UTC
--   20:00 местного = 15:00 UTC
--   23:00 местного = 18:00 UTC
-- Для Москвы (UTC+3) вычти из UTC-часов ещё 2.

select cron.unschedule('push-morning') where exists (select 1 from cron.job where jobname = 'push-morning');
select cron.unschedule('push-midday')  where exists (select 1 from cron.job where jobname = 'push-midday');
select cron.unschedule('push-evening') where exists (select 1 from cron.job where jobname = 'push-evening');
select cron.unschedule('push-night')   where exists (select 1 from cron.job where jobname = 'push-night');

select cron.schedule('push-morning', '30 4 * * *', $$
  select net.http_post(
    url := 'https://rodion-app.vercel.app/api/push/send?slot=morning',
    headers := '{"Content-Type":"application/json","x-cron-secret":"ЗАМЕНИ_НА_СЕКРЕТ"}'::jsonb
  );
$$);

select cron.schedule('push-midday', '0 9 * * *', $$
  select net.http_post(
    url := 'https://rodion-app.vercel.app/api/push/send?slot=midday',
    headers := '{"Content-Type":"application/json","x-cron-secret":"ЗАМЕНИ_НА_СЕКРЕТ"}'::jsonb
  );
$$);

select cron.schedule('push-evening', '0 15 * * *', $$
  select net.http_post(
    url := 'https://rodion-app.vercel.app/api/push/send?slot=evening',
    headers := '{"Content-Type":"application/json","x-cron-secret":"ЗАМЕНИ_НА_СЕКРЕТ"}'::jsonb
  );
$$);

select cron.schedule('push-night', '0 18 * * *', $$
  select net.http_post(
    url := 'https://rodion-app.vercel.app/api/push/send?slot=night',
    headers := '{"Content-Type":"application/json","x-cron-secret":"ЗАМЕНИ_НА_СЕКРЕТ"}'::jsonb
  );
$$);

-- Часовой пояс профиля влияет на то, какой день считается сегодняшним.
update public.profiles set timezone = 'Asia/Yekaterinburg' where timezone is null or timezone = 'Europe/Moscow';

-- Проверить, что задания встали:
select jobname, schedule, active from cron.job where jobname like 'push-%';

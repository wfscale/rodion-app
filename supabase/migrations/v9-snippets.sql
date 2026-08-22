-- ============================================================================
--  RODION APP — МИГРАЦИЯ v9 «ЗАГОТОВКИ»
--
--  Выполнить целиком в Supabase → SQL Editor → New query → Run.
--  Идемпотентна: можно запускать повторно, ничего не сломается.
--
--  Что делает: заводит библиотеку готовых сообщений с копированием в один тап.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- ЗАГОТОВКИ
--
--    Между «ответил» и «созвон» теряется больше людей, чем на самой рассылке,
--    и теряется на одних и тех же вопросах: сколько стоит, что конкретно
--    делаешь, покажи кейсы. Каждый такой ответ набирается заново, вечером
--    набирается хуже, а на десятом за день — совсем плохо.
--
--    Раздел заметок стоял мёртвым по обратной причине: он требует что-то
--    написать, ничего не давая взамен. Заготовка требует написать один раз,
--    а отдаёт при каждом ответе. Поэтому она и живёт на этой странице.
--
--    used_count — не статистика, а порядок. Список сам всплывает тем, чем
--    реально пользуешься, и не превращается в архив, который надо разбирать.
-- ---------------------------------------------------------------------------
create table if not exists public.snippets (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references auth.users on delete cascade not null,
  -- Короткое имя, по которому заготовка находится глазом за полсекунды.
  title        text not null,
  content      text not null,
  used_count   integer default 0,
  last_used_at timestamptz,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Порядок списка — сразу из индекса: сначала частое, при равенстве свежее.
create index if not exists snippets_user_used_idx
  on public.snippets (user_id, used_count desc, last_used_at desc nulls last);

alter table public.snippets drop constraint if exists snippets_used_count_check;
alter table public.snippets
  add constraint snippets_used_count_check check (used_count >= 0);

alter table public.snippets enable row level security;

drop policy if exists "snippets_select" on public.snippets;
drop policy if exists "snippets_insert" on public.snippets;
drop policy if exists "snippets_update" on public.snippets;
drop policy if exists "snippets_delete" on public.snippets;

create policy "snippets_select" on public.snippets
  for select using (user_id = auth.uid());
create policy "snippets_insert" on public.snippets
  for insert with check (user_id = auth.uid());
create policy "snippets_update" on public.snippets
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "snippets_delete" on public.snippets
  for delete using (user_id = auth.uid());

drop trigger if exists touch_snippets on public.snippets;
create trigger touch_snippets before update on public.snippets
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- СЧЁТЧИК ИСПОЛЬЗОВАНИЙ
--
--    Отдельная функция, а не update с клиента: копируют быстро и подряд, и
--    два тапа успевают прочитать одно и то же значение, а записать +1 дважды
--    от одного и того же числа. Инкремент на стороне базы такого не допускает.
-- ---------------------------------------------------------------------------
create or replace function public.use_snippet(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_user  uuid := auth.uid();
  v_count integer;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  update public.snippets
     set used_count   = coalesce(used_count, 0) + 1,
         last_used_at = now()
   where id = p_id and user_id = v_user
   returning used_count into v_count;

  return coalesce(v_count, 0);
end;
$fn$;

grant execute on function public.use_snippet(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- ПРОВЕРКА
-- ---------------------------------------------------------------------------
select count(*) as snippets from public.snippets;

-- ============================================================================
--  ГОТОВО
-- ============================================================================

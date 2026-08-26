-- ============================================================================
--  RODION APP — МИГРАЦИЯ v11 «ЦЕЛИ»
--
--  Выполнить целиком в Supabase → SQL Editor → New query → Run.
--  Идемпотентна: можно запускать повторно, ничего не сломается.
--
--  Что делает: заводит цели с суммой и сроком.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- ЦЕЛИ
--
--    Цель — это сумма и дата. Всё остальное в приложении отвечает на вопрос
--    «что делать сегодня», и ни одна его часть не отвечает на вопрос «зачем».
--
--    target_amount допускает null намеренно: «закрыть эксперта» и «сделать
--    запуск» — такие же цели, просто без суммы. Заставлять придумывать для
--    них цифру значит получить выдуманную цифру.
--
--    started_at нужен, чтобы считать фактический темп: сколько в среднем
--    выходит в день с начала. Без него остаётся только обратный отсчёт, а
--    обратный отсчёт сам по себе — счётчик долга и ничего больше.
--
--    pinned — та единственная цель, которая висит перед глазами каждый день.
--    Их может быть пять, но смотреть на пять одновременно нельзя: внимание
--    делится, и не работает ни одна.
-- ---------------------------------------------------------------------------
create table if not exists public.goals (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users on delete cascade not null,
  title          text not null,
  note           text,
  -- Копейки не нужны: цели ставят в тысячах.
  target_amount  integer,
  current_amount integer default 0,
  deadline       date not null,
  started_at     date default current_date,
  pinned         boolean default false,
  done           boolean default false,
  done_at        timestamptz,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

alter table public.goals drop constraint if exists goals_amount_check;
alter table public.goals
  add constraint goals_amount_check
  check (
    (target_amount is null or target_amount > 0)
    and coalesce(current_amount, 0) >= 0
  );

-- Список читается всегда одним и тем же способом: сначала незакрытые, внутри
-- них — по ближайшему сроку.
create index if not exists goals_user_deadline_idx
  on public.goals (user_id, done, deadline);

-- Закреплённая цель ищется на каждой отрисовке главной — пусть её находит
-- индекс, а не перебор.
create index if not exists goals_pinned_idx
  on public.goals (user_id)
  where pinned and not done;

alter table public.goals enable row level security;

drop policy if exists "goals_select" on public.goals;
drop policy if exists "goals_insert" on public.goals;
drop policy if exists "goals_update" on public.goals;
drop policy if exists "goals_delete" on public.goals;

create policy "goals_select" on public.goals
  for select using (user_id = auth.uid());
create policy "goals_insert" on public.goals
  for insert with check (user_id = auth.uid());
create policy "goals_update" on public.goals
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "goals_delete" on public.goals
  for delete using (user_id = auth.uid());

drop trigger if exists touch_goals on public.goals;
create trigger touch_goals before update on public.goals
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- ОДНА ЗАКРЕПЛЁННАЯ ЦЕЛЬ
--
--    Снимать закрепление с прежней руками — значит рано или поздно получить
--    две закреплённых и не понять почему. База следит за этим сама.
-- ---------------------------------------------------------------------------
create or replace function public.unpin_other_goals()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.pinned then
    update public.goals
       set pinned = false
     where user_id = new.user_id
       and id <> new.id
       and pinned;
  end if;
  return new;
end;
$fn$;

drop trigger if exists goals_single_pin on public.goals;
create trigger goals_single_pin after insert or update of pinned on public.goals
  for each row when (new.pinned) execute function public.unpin_other_goals();

-- ---------------------------------------------------------------------------
-- ПРОВЕРКА
-- ---------------------------------------------------------------------------
select
  (select count(*) from public.goals)                          as goals,
  (select count(*) from public.goals where pinned and not done) as pinned;

-- ============================================================================
--  ГОТОВО
-- ============================================================================

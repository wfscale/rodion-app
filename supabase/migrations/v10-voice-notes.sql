-- ============================================================================
--  RODION APP — МИГРАЦИЯ v10 «ГОЛОСОВЫЕ ЗАМЕТКИ»
--
--  Выполнить целиком в Supabase → SQL Editor → New query → Run.
--  Идемпотентна: можно запускать повторно, ничего не сломается.
--
--  Что делает: разрешает прикрепить к заметке запись голоса и заводит под
--  неё приватное хранилище.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. ЗВУК ЖИВЁТ НА ЗАМЕТКЕ, А НЕ ОТДЕЛЬНОЙ СУЩНОСТЬЮ
--
--    Голосовая заметка — это та же заметка, у которой есть запись. Отдельная
--    таблица потребовала бы своей даты, своих меток, своего поиска, своей
--    корзины и своей правки текста — то есть повторить всё, что у заметок уже
--    работает, и потом чинить в двух местах.
--
--    Расшифровка ложится в content. Значит поиск по заметкам ищет и по
--    сказанному вслух, а не только по набранному руками, — ради этого стоило
--    городить всё остальное.
-- ---------------------------------------------------------------------------
alter table public.notes
  -- Путь в хранилище: {user_id}/{uuid}.{ext}. null — обычная текстовая заметка.
  add column if not exists audio_path     text,
  -- Длительность в секундах: показать её надо до того, как файл загрузится.
  add column if not exists audio_duration integer;

alter table public.notes drop constraint if exists notes_audio_duration_check;
alter table public.notes
  add constraint notes_audio_duration_check
  check (audio_duration is null or audio_duration >= 0);

-- Заметки со звуком — единицы против сотен текстовых. Частичный индекс
-- отвечает на «покажи все голосовые», не перебирая остальные.
create index if not exists notes_audio_idx
  on public.notes (user_id, created_at desc)
  where audio_path is not null;

-- ---------------------------------------------------------------------------
-- 2. ХРАНИЛИЩЕ
--
--    Приватное. Это мысли вслух, и публичная ссылка на них не нужна никому,
--    включая владельца: воспроизведение идёт по подписанной ссылке, которая
--    живёт час.
--
--    Лимит 25 МБ на файл — это около двух часов речи в opus. Больше одной
--    записи столько всё равно не бывает, а без лимита случайный видеофайл,
--    перетащенный не туда, съел бы квоту тарифа целиком.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('voice-notes', 'voice-notes', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = 26214400;

-- ---------------------------------------------------------------------------
-- 3. ДОСТУП К ФАЙЛАМ
--
--    Первая папка в пути — это id владельца, и сравнение идёт по ней.
--    Так политика не зависит от того, кто числится owner объекта: файл,
--    перезалитый другим способом, всё равно останется доступен только своему.
-- ---------------------------------------------------------------------------
drop policy if exists "voice_notes_select" on storage.objects;
drop policy if exists "voice_notes_insert" on storage.objects;
drop policy if exists "voice_notes_update" on storage.objects;
drop policy if exists "voice_notes_delete" on storage.objects;

create policy "voice_notes_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "voice_notes_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "voice_notes_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "voice_notes_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- ---------------------------------------------------------------------------
-- ПРОВЕРКА
--
--    bucket_ok должно быть true, policies — 4.
-- ---------------------------------------------------------------------------
select
  (select count(*) from public.notes where audio_path is not null) as voice_notes,
  (select exists (select 1 from storage.buckets where id = 'voice-notes')) as bucket_ok,
  (select count(*) from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'voice_notes_%')                              as policies;

-- ============================================================================
--  ГОТОВО
-- ============================================================================

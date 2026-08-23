'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { audioPath } from '@/lib/audio';
import { createClient } from '@/lib/supabase/client';
import type { Note, NoteTag } from '@/lib/types';

/** Сколько дней заметка лежит в корзине до безвозвратного удаления. */
export const TRASH_DAYS = 30;

/** Приватное хранилище записей голоса. */
export const VOICE_BUCKET = 'voice-notes';

/** Запись, которую надо приложить к заметке. */
export type NoteAudio = { blob: Blob; mime: string; seconds: number };

export function useNotes() {
  const { user } = useApp();
  const supabase = useMemo(() => createClient(), []);

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;

    // Чистим корзину от всего, что пролежало дольше 30 дней. Сначала звук:
    // удалить строку первой значит навсегда потерять путь к файлу, и он
    // останется в хранилище мусором, о котором никто уже не узнает.
    const cutoff = new Date(Date.now() - TRASH_DAYS * 86_400_000).toISOString();

    const { data: expired } = await supabase
      .from('notes')
      .select('id, audio_path')
      .eq('user_id', user.id)
      .not('deleted_at', 'is', null)
      .lt('deleted_at', cutoff);

    const expiredAudio = ((expired as { audio_path: string | null }[]) ?? [])
      .map((row) => row.audio_path)
      .filter((path): path is string => Boolean(path));

    if (expiredAudio.length > 0) {
      await supabase.storage.from(VOICE_BUCKET).remove(expiredAudio);
    }

    if ((expired?.length ?? 0) > 0) {
      await supabase
        .from('notes')
        .delete()
        .eq('user_id', user.id)
        .not('deleted_at', 'is', null)
        .lt('deleted_at', cutoff);
    }

    const { data, error: loadError } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (loadError) setError(loadError.message);
    setNotes((data as Note[]) ?? []);
    setLoading(false);
  }, [supabase, user]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Новая заметка. audio — необязательная запись голоса.
   *
   * Файл уходит в хранилище первым, и только после успеха появляется строка:
   * заметка со ссылкой на несуществующий файл выглядит как потерянная мысль,
   * а это ровно то, ради чего голосовые и заводились.
   */
  const addNote = useCallback(
    async (content: string, tag: NoteTag, audio?: NoteAudio) => {
      if (!user) return;
      // Без звука пустая заметка бессмысленна, со звуком — нормальна:
      // расшифровки может не быть, а мысль записана.
      if (!content.trim() && !audio) return;

      let path: string | null = null;

      if (audio) {
        const id =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

        path = audioPath(user.id, id, audio.mime);

        const { error: uploadError } = await supabase.storage
          .from(VOICE_BUCKET)
          .upload(path, audio.blob, { contentType: audio.mime, upsert: false });

        if (uploadError) {
          setError(uploadError.message);
          return;
        }
      }

      const { data, error: insertError } = await supabase
        .from('notes')
        .insert({
          user_id: user.id,
          content: content.trim(),
          tag,
          audio_path: path,
          audio_duration: audio ? Math.round(audio.seconds) : null,
        } as never)
        .select('*')
        .single();

      if (insertError) {
        // Строка не появилась — файл остался бы висеть без владельца.
        if (path) await supabase.storage.from(VOICE_BUCKET).remove([path]);
        setError(insertError.message);
        return;
      }

      setNotes((previous) => [data as Note, ...previous]);
    },
    [supabase, user],
  );

  /**
   * Ссылка на запись, действительная час.
   *
   * Хранилище приватное, и постоянной ссылки у файла нет. Подписываем по
   * требованию — при первом нажатии на воспроизведение, а не для всего
   * списка сразу: в списке из сорока заметок это сорок лишних запросов.
   */
  const audioUrl = useCallback(
    async (path: string): Promise<string | null> => {
      const { data, error: signError } = await supabase.storage
        .from(VOICE_BUCKET)
        .createSignedUrl(path, 3600);

      if (signError) {
        setError(signError.message);
        return null;
      }
      return data?.signedUrl ?? null;
    },
    [supabase],
  );

  const updateNote = useCallback(
    async (id: string, patch: { content?: string; tag?: NoteTag }) => {
      setNotes((previous) =>
        previous.map((note) =>
          note.id === id
            ? { ...note, ...patch, updated_at: new Date().toISOString() }
            : note,
        ),
      );

      const { error: updateError } = await supabase
        .from('notes')
        .update(patch as never)
        .eq('id', id);

      if (updateError) setError(updateError.message);
    },
    [supabase],
  );

  /** Мягкое удаление — заметка уезжает в корзину. */
  const trashNote = useCallback(
    async (id: string) => {
      const deletedAt = new Date().toISOString();
      setNotes((previous) =>
        previous.map((note) => (note.id === id ? { ...note, deleted_at: deletedAt } : note)),
      );

      const { error: updateError } = await supabase
        .from('notes')
        .update({ deleted_at: deletedAt } as never)
        .eq('id', id);

      if (updateError) setError(updateError.message);
    },
    [supabase],
  );

  const restoreNote = useCallback(
    async (id: string) => {
      setNotes((previous) =>
        previous.map((note) => (note.id === id ? { ...note, deleted_at: null } : note)),
      );

      const { error: updateError } = await supabase
        .from('notes')
        .update({ deleted_at: null } as never)
        .eq('id', id);

      if (updateError) setError(updateError.message);
    },
    [supabase],
  );

  const deleteForever = useCallback(
    async (id: string) => {
      const path = notes.find((note) => note.id === id)?.audio_path ?? null;

      setNotes((previous) => previous.filter((note) => note.id !== id));

      const { error: deleteError } = await supabase.from('notes').delete().eq('id', id);
      if (deleteError) {
        setError(deleteError.message);
        return;
      }

      // Запись удаляется следом: строки уже нет, и путь к файлу больше
      // взять неоткуда.
      if (path) await supabase.storage.from(VOICE_BUCKET).remove([path]);
    },
    [supabase, notes],
  );

  const active = useMemo(() => notes.filter((note) => !note.deleted_at), [notes]);
  const trashed = useMemo(() => notes.filter((note) => note.deleted_at), [notes]);

  return {
    notes: active,
    trashed,
    loading,
    error,
    addNote,
    audioUrl,
    updateNote,
    trashNote,
    restoreNote,
    deleteForever,
    reload: load,
  };
}

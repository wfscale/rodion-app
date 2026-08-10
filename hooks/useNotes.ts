'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { createClient } from '@/lib/supabase/client';
import type { Note, NoteTag } from '@/lib/types';

/** Сколько дней заметка лежит в корзине до безвозвратного удаления. */
export const TRASH_DAYS = 30;

export function useNotes() {
  const { user } = useApp();
  const supabase = useMemo(() => createClient(), []);

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;

    // Чистим корзину от всего, что пролежало дольше 30 дней.
    const cutoff = new Date(Date.now() - TRASH_DAYS * 86_400_000).toISOString();
    await supabase
      .from('notes')
      .delete()
      .eq('user_id', user.id)
      .not('deleted_at', 'is', null)
      .lt('deleted_at', cutoff);

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

  const addNote = useCallback(
    async (content: string, tag: NoteTag) => {
      if (!user || !content.trim()) return;

      const { data, error: insertError } = await supabase
        .from('notes')
        .insert({ user_id: user.id, content: content.trim(), tag } as never)
        .select('*')
        .single();

      if (insertError) {
        setError(insertError.message);
        return;
      }

      setNotes((previous) => [data as Note, ...previous]);
    },
    [supabase, user],
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
      setNotes((previous) => previous.filter((note) => note.id !== id));
      const { error: deleteError } = await supabase.from('notes').delete().eq('id', id);
      if (deleteError) setError(deleteError.message);
    },
    [supabase],
  );

  const active = useMemo(() => notes.filter((note) => !note.deleted_at), [notes]);
  const trashed = useMemo(() => notes.filter((note) => note.deleted_at), [notes]);

  return {
    notes: active,
    trashed,
    loading,
    error,
    addNote,
    updateNote,
    trashNote,
    restoreNote,
    deleteForever,
    reload: load,
  };
}

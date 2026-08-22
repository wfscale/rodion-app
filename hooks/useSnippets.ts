'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { sortSnippets } from '@/lib/snippets';
import { createClient } from '@/lib/supabase/client';
import type { Snippet } from '@/lib/types';

export type SnippetDraft = { title: string; content: string };

/**
 * Библиотека заготовок.
 *
 * ready=false означает, что таблицы ещё нет — не прогнали migration-v9. Это
 * не поломка приложения, а невыполненный шаг установки, и раздел обязан
 * сказать это спокойно, а не показать белый экран.
 */
export function useSnippets() {
  const { user } = useApp();
  const supabase = useMemo(() => createClient(), []);

  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [ready, setReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;

    const { data, error: loadError } = await supabase
      .from('snippets')
      .select('*')
      .eq('user_id', user.id);

    if (loadError) {
      setReady(false);
      setSnippets([]);
    } else {
      setReady(true);
      setSnippets(sortSnippets((data as Snippet[]) ?? []));
    }
    setLoading(false);
  }, [supabase, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (draft: SnippetDraft, id: string | null) => {
      if (!user || !draft.title.trim() || !draft.content.trim()) return;

      const patch = { title: draft.title.trim(), content: draft.content.trim() };

      if (id) {
        setSnippets((previous) => previous.map((s) => (s.id === id ? { ...s, ...patch } : s)));
        const { error: updateError } = await supabase
          .from('snippets')
          .update(patch as never)
          .eq('id', id);
        if (updateError) setError(updateError.message);
        return;
      }

      const { data, error: insertError } = await supabase
        .from('snippets')
        .insert({ user_id: user.id, ...patch } as never)
        .select('*')
        .single();

      if (insertError) {
        setReady(false);
        setError(insertError.message);
        return;
      }
      if (data) setSnippets((previous) => sortSnippets([...previous, data as Snippet]));
    },
    [supabase, user],
  );

  /**
   * Отметить использование.
   *
   * Счётчик крутится в базе функцией use_snippet: копируют быстро и подряд,
   * и два тапа успели бы прочитать одно значение и записать +1 дважды от
   * одного и того же числа.
   *
   * Порядок списка при этом НЕ пересчитывается: если строка уедет вверх
   * из-под пальца сразу после тапа, следующий тап попадёт не туда. Список
   * пересобирается при следующем заходе на страницу.
   */
  const use = useCallback(
    async (id: string) => {
      setSnippets((previous) =>
        previous.map((s) =>
          s.id === id
            ? { ...s, used_count: (s.used_count ?? 0) + 1, last_used_at: new Date().toISOString() }
            : s,
        ),
      );
      const { error: rpcError } = await supabase.rpc('use_snippet', { p_id: id });
      if (rpcError) setError(rpcError.message);
    },
    [supabase],
  );

  const remove = useCallback(
    async (id: string) => {
      setSnippets((previous) => previous.filter((s) => s.id !== id));
      const { error: deleteError } = await supabase.from('snippets').delete().eq('id', id);
      if (deleteError) setError(deleteError.message);
    },
    [supabase],
  );

  return { snippets, ready, loading, error, clearError: () => setError(null), save, use, remove };
}

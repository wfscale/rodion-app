'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { forecast } from '@/lib/forecast';
import { rublesPerOutreach, sortGoals } from '@/lib/goals';
import { createClient } from '@/lib/supabase/client';
import type { Goal } from '@/lib/types';

export type GoalDraft = {
  title: string;
  note: string | null;
  target_amount: number | null;
  deadline: string;
};

/**
 * Цели.
 *
 * ready=false означает, что таблицы ещё нет — не прогнали migration-v11.
 * Это не поломка приложения, а невыполненный шаг установки, и раздел обязан
 * сказать это спокойно, а не показать белый экран.
 */
export function useGoals() {
  const { user, today } = useApp();
  const supabase = useMemo(() => createClient(), []);

  const [goals, setGoals] = useState<Goal[]>([]);
  const [ready, setReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;

    const { data, error: loadError } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.id);

    if (loadError) {
      setReady(false);
      setGoals([]);
    } else {
      setReady(true);
      setGoals(sortGoals((data as Goal[]) ?? []));
    }
    setLoading(false);
  }, [supabase, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (draft: GoalDraft, id: string | null) => {
      if (!user || !draft.title.trim() || !draft.deadline) return;

      const patch = {
        title: draft.title.trim(),
        note: draft.note?.trim() || null,
        target_amount: draft.target_amount && draft.target_amount > 0 ? draft.target_amount : null,
        deadline: draft.deadline,
      };

      if (id) {
        setGoals((previous) =>
          sortGoals(previous.map((g) => (g.id === id ? { ...g, ...patch } : g))),
        );
        const { error: updateError } = await supabase
          .from('goals')
          .update(patch as never)
          .eq('id', id);
        if (updateError) setError(updateError.message);
        return;
      }

      const { data, error: insertError } = await supabase
        .from('goals')
        .insert({
          user_id: user.id,
          ...patch,
          // Первая цель сразу становится закреплённой: цель, которую не
          // видно каждый день, ничем не отличается от незаписанной.
          pinned: goals.filter((g) => !g.done).length === 0,
          started_at: today,
        } as never)
        .select('*')
        .single();

      if (insertError) {
        setReady(false);
        setError(insertError.message);
        return;
      }
      if (data) setGoals((previous) => sortGoals([...previous, data as Goal]));
    },
    [supabase, user, today, goals],
  );

  const patchGoal = useCallback(
    async (id: string, patch: Partial<Goal>) => {
      setGoals((previous) =>
        sortGoals(previous.map((g) => (g.id === id ? { ...g, ...patch } : g))),
      );
      const { error: updateError } = await supabase
        .from('goals')
        .update(patch as never)
        .eq('id', id);
      if (updateError) setError(updateError.message);
    },
    [supabase],
  );

  /** Пополнить накопленное. Отрицательное тоже допустимо — деньги уходят. */
  const addAmount = useCallback(
    async (id: string, amount: number) => {
      const goal = goals.find((g) => g.id === id);
      if (!goal || !amount) return;
      await patchGoal(id, { current_amount: Math.max(0, (goal.current_amount ?? 0) + amount) });
    },
    [goals, patchGoal],
  );

  /**
   * Закрепление — одно на всех.
   *
   * Снимаем с прежней здесь же, не дожидаясь ответа базы: триггер в базе
   * делает то же самое, но экран не должен на секунду показывать две
   * закреплённых цели.
   */
  const pin = useCallback(
    async (id: string) => {
      setGoals((previous) =>
        sortGoals(previous.map((g) => ({ ...g, pinned: g.id === id }))),
      );
      const { error: updateError } = await supabase
        .from('goals')
        .update({ pinned: true } as never)
        .eq('id', id);
      if (updateError) setError(updateError.message);
    },
    [supabase],
  );

  const setDone = useCallback(
    async (id: string, done: boolean) => {
      await patchGoal(id, { done, done_at: done ? new Date().toISOString() : null });
    },
    [patchGoal],
  );

  const remove = useCallback(
    async (id: string) => {
      setGoals((previous) => previous.filter((g) => g.id !== id));
      const { error: deleteError } = await supabase.from('goals').delete().eq('id', id);
      if (deleteError) setError(deleteError.message);
    },
    [supabase],
  );

  /** Та единственная, что висит перед глазами. */
  const pinned = useMemo(
    () => goals.find((goal) => goal.pinned && !goal.done) ?? null,
    [goals],
  );

  return {
    goals,
    pinned,
    ready,
    loading,
    error,
    save,
    addAmount,
    pin,
    setDone,
    remove,
    reload: load,
  };
}

/**
 * Сколько рублей приносит одна рассылка.
 *
 * Средний чек, делённый на цену закрытия в рассылках. null — считать не из
 * чего: либо закрытий ещё не было, либо чек не задан. Показывать в этом
 * случае выдуманное число нельзя: на него потом смотрят каждый день и по
 * нему принимают решения.
 */
export function useGoalMath(): number | null {
  const { contacts, profile } = useApp();

  const data = useMemo(() => forecast(contacts), [contacts]);

  return useMemo(
    () => rublesPerOutreach(profile?.avg_deal_amount ?? 0, data.close.per),
    [profile?.avg_deal_amount, data.close.per],
  );
}

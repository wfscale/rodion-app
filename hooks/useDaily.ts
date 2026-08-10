'use client';

import { useCallback, useMemo } from 'react';
import { useApp } from '@/components/AppProvider';
import { countTasks, FASTING_TASK_ID } from '@/lib/tasks';
import type { Checklist, CustomTask, DailyLog, WakeQuality } from '@/lib/types';
import { onceKey, XP } from '@/lib/xp';

/** Пустая запись дня — используется, пока в базе ещё ничего нет. */
function emptyLog(userId: string, date: string, customTasks: CustomTask[]): DailyLog {
  return {
    id: `temp-${date}`,
    user_id: userId,
    date,
    sleep_time: null,
    wake_time: null,
    wake_quality: null,
    morning_comment: null,
    checklist: {},
    custom_tasks: customTasks,
    meal_1_time: null,
    meal_1_note: null,
    meal_2_time: null,
    meal_2_note: null,
    fasting_ok: false,
    day_comment: null,
    completion_pct: 0,
    xp_earned: 0,
    created_at: new Date().toISOString(),
  };
}

/**
 * Всё, что касается сегодняшнего дня: чеклист, чекин, питание, заметка.
 * Мутации идут через AppProvider, поэтому кольцо прогресса, стрик и XP
 * обновляются согласованно.
 */
export function useDaily() {
  const { user, logs, today, habits, upsertToday, awardXp, profile } = useApp();

  const stored = useMemo(() => logs.find((log) => log.date === today) ?? null, [logs, today]);

  /**
   * Кастомные задачи переносятся на все последующие дни: если записи за
   * сегодня ещё нет, берём набор из последнего дня с записью.
   */
  const inheritedCustomTasks = useMemo<CustomTask[]>(() => {
    if (stored) return stored.custom_tasks ?? [];
    const previous = logs.find((log) => log.date < today && (log.custom_tasks?.length ?? 0) > 0);
    return previous?.custom_tasks ?? [];
  }, [stored, logs, today]);

  const log = useMemo<DailyLog>(
    () => stored ?? emptyLog(user?.id ?? '', today, inheritedCustomTasks),
    [stored, user?.id, today, inheritedCustomTasks],
  );

  const checklist: Checklist = log.checklist ?? {};
  const customTasks: CustomTask[] = log.custom_tasks ?? [];

  const counts = useMemo(
    () => countTasks(checklist, Boolean(log.fasting_ok), habits, customTasks),
    [checklist, log.fasting_ok, habits, customTasks],
  );

  const checkinDone = Boolean(log.wake_time || log.sleep_time || log.wake_quality);

  /** Пересчитывает процент и сохраняет день одним запросом. */
  const saveWith = useCallback(
    async (patch: Partial<DailyLog>) => {
      const nextChecklist = (patch.checklist ?? checklist) as Checklist;
      const nextFasting = patch.fasting_ok ?? Boolean(log.fasting_ok);
      const nextCustom = (patch.custom_tasks ?? customTasks) as CustomTask[];

      const { pct } = countTasks(nextChecklist, nextFasting, habits, nextCustom);

      await upsertToday({ ...patch, completion_pct: pct });
      return pct;
    },
    [checklist, log.fasting_ok, customTasks, habits, upsertToday],
  );

  /* ------------------------------------------------------------------ */
  /*  Чеклист                                                            */
  /* ------------------------------------------------------------------ */

  const toggleTask = useCallback(
    async (taskId: string) => {
      const turningOn = !checklist[taskId];
      const next: Checklist = { ...checklist, [taskId]: turningOn };

      const pct = await saveWith({ checklist: next });

      if (!turningOn) return;

      await awardXp(XP.TASK, 'task', onceKey.task(today, taskId));
      if (pct === 100) {
        await awardXp(XP.FULL_DAY, 'fullDay', onceKey.fullDay(today));
      }
    },
    [checklist, saveWith, awardXp, today],
  );

  const toggleFasting = useCallback(async () => {
    const turningOn = !log.fasting_ok;
    const pct = await saveWith({ fasting_ok: turningOn });

    if (!turningOn) return;

    await awardXp(XP.FASTING, 'fasting', onceKey.fasting(today));
    if (pct === 100) {
      await awardXp(XP.FULL_DAY, 'fullDay', onceKey.fullDay(today));
    }
  }, [log.fasting_ok, saveWith, awardXp, today]);

  /**
   * Отмечает задачу выполненной, не снимая её (используется страницей рассылок,
   * когда дневная цель достигнута).
   */
  const markTaskDone = useCallback(
    async (taskId: string) => {
      if (checklist[taskId]) return;
      const next: Checklist = { ...checklist, [taskId]: true };
      const pct = await saveWith({ checklist: next });

      await awardXp(XP.TASK, 'task', onceKey.task(today, taskId));
      if (pct === 100) {
        await awardXp(XP.FULL_DAY, 'fullDay', onceKey.fullDay(today));
      }
    },
    [checklist, saveWith, awardXp, today],
  );

  /* ------------------------------------------------------------------ */
  /*  Кастомные задачи                                                   */
  /* ------------------------------------------------------------------ */

  const addCustomTask = useCallback(
    async (title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;

      const task: CustomTask = {
        id: `c_${Date.now().toString(36)}`,
        title: trimmed.slice(0, 120),
      };

      await saveWith({ custom_tasks: [...customTasks, task] });
    },
    [customTasks, saveWith],
  );

  const removeCustomTask = useCallback(
    async (taskId: string) => {
      const nextTasks = customTasks.filter((task) => task.id !== taskId);
      const nextChecklist: Checklist = { ...checklist };
      delete nextChecklist[taskId];

      await saveWith({ custom_tasks: nextTasks, checklist: nextChecklist });
    },
    [customTasks, checklist, saveWith],
  );

  /* ------------------------------------------------------------------ */
  /*  Утренний чекин, питание, заметка                                   */
  /* ------------------------------------------------------------------ */

  const saveCheckin = useCallback(
    async (input: {
      sleep_time: string | null;
      wake_time: string | null;
      wake_quality: WakeQuality | null;
      morning_comment: string | null;
    }) => {
      await saveWith(input);
      await awardXp(XP.CHECKIN, 'checkin', onceKey.checkin(today));
    },
    [saveWith, awardXp, today],
  );

  const saveMeals = useCallback(
    async (input: Partial<
      Pick<DailyLog, 'meal_1_time' | 'meal_1_note' | 'meal_2_time' | 'meal_2_note'>
    >) => {
      await saveWith(input);
    },
    [saveWith],
  );

  const saveDayComment = useCallback(
    async (text: string) => {
      await saveWith({ day_comment: text });
    },
    [saveWith],
  );

  return {
    log,
    today,
    checklist,
    customTasks,
    habits,
    counts,
    checkinDone,
    fastingTaskId: FASTING_TASK_ID,
    dailyGoal: profile?.daily_goal ?? 10,

    toggleTask,
    toggleFasting,
    markTaskDone,
    addCustomTask,
    removeCustomTask,
    saveCheckin,
    saveMeals,
    saveDayComment,
  };
}

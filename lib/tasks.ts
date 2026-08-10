import type { Dict } from '@/lib/i18n';
import type { Checklist, CustomTask, DailyLog } from '@/lib/types';

/**
 * Ключ задачи в jsonb-поле checklist. Никогда не менять существующие id —
 * от них зависят все прошлые записи в базе.
 */
export type TaskDef = {
  id: string;
  /** Ключ в словаре t.tasks */
  labelKey: keyof Dict['tasks'];
  /** Задача блока «быстрый дофамин» */
  discipline?: boolean;
};

/** Фиксированные задачи — удалить нельзя. */
export const FIXED_TASKS: TaskDef[] = [
  { id: 'water', labelKey: 'water' },
  { id: 'pushups', labelKey: 'pushups' },
  { id: 'cold_shower', labelKey: 'coldShower' },
  { id: 'walk', labelKey: 'walk' },
  { id: 'd3', labelKey: 'd3' },
  { id: 'outreach', labelKey: 'outreach' },
  { id: 'no_reels', labelKey: 'noReels' },
  { id: 'sleep_early', labelKey: 'sleepEarly' },
  { id: 'no_sugar', labelKey: 'noSugar', discipline: true },
  { id: 'no_porn', labelKey: 'noPorn', discipline: true },
  { id: 'no_mb', labelKey: 'noMb', discipline: true },
];

/** Три задачи блока дисциплины — выводятся отдельной секцией. */
export const DISCIPLINE_TASKS = FIXED_TASKS.filter((task) => task.discipline);

/** Остальные фиксированные задачи — основной список. */
export const CORE_TASKS = FIXED_TASKS.filter((task) => !task.discipline);

/**
 * Пул привычек, открывающихся с 5-й недели.
 * Порядок фиксирован: привычки добавляются строго по нему.
 */
export const HABIT_POOL: TaskDef[] = [
  { id: 'reading', labelKey: 'reading' },
  { id: 'morning_pages', labelKey: 'morningPages' },
  { id: 'stretching', labelKey: 'stretching' },
  { id: 'no_phone_first_hour', labelKey: 'noPhoneFirstHour' },
  { id: 'plan_tomorrow', labelKey: 'planTomorrow' },
  { id: 'steps', labelKey: 'steps' },
];

/** Псевдо-задача: чекбокс голодания участвует в проценте выполнения дня. */
export const FASTING_TASK_ID = 'fasting_ok';

/** Человекочитаемое название задачи. Для «рассылок» подставляется дневная цель. */
export function taskLabel(task: TaskDef, t: Dict, dailyGoal: number): string {
  if (task.id === 'outreach') {
    return `${t.tasks.outreach} (${dailyGoal}+ ${t.tasks.outreachSuffix})`;
  }
  return t.tasks[task.labelKey];
}

/**
 * Полный список задач дня: фиксированные + открытые привычки + кастомные.
 * Именно от него считается процент выполнения.
 */
export function allTasksForDay(
  unlockedHabits: TaskDef[],
  customTasks: CustomTask[],
): { id: string; isCustom: boolean }[] {
  return [
    ...FIXED_TASKS.map((task) => ({ id: task.id, isCustom: false })),
    ...unlockedHabits.map((task) => ({ id: task.id, isCustom: false })),
    ...customTasks.map((task) => ({ id: task.id, isCustom: true })),
    { id: FASTING_TASK_ID, isCustom: false },
  ];
}

/** Сколько задач выполнено и сколько всего. */
export function countTasks(
  checklist: Checklist,
  fastingOk: boolean,
  unlockedHabits: TaskDef[],
  customTasks: CustomTask[],
): { done: number; total: number; pct: number } {
  const tasks = allTasksForDay(unlockedHabits, customTasks);

  const done = tasks.filter((task) =>
    task.id === FASTING_TASK_ID ? fastingOk : Boolean(checklist[task.id]),
  ).length;

  const total = tasks.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return { done, total, pct };
}

/**
 * Пересчёт процента для уже сохранённой записи дня (история, таблица недели).
 * Опирается на custom_tasks самой записи — набор задач в прошлом мог отличаться.
 */
export function completionForLog(log: DailyLog, unlockedHabits: TaskDef[]): number {
  return countTasks(
    log.checklist ?? {},
    Boolean(log.fasting_ok),
    unlockedHabits,
    log.custom_tasks ?? [],
  ).pct;
}

import { daysBetween } from '@/lib/date';
import type { GoalStep } from '@/lib/types';

/**
 * Цели: срок, доли и шаги.
 *
 * Здесь нет ни одного прогноза, и это главное решение модуля.
 *
 * Раньше сумма переводилась в число рассылок через среднюю конверсию и
 * средний чек. Для продюсирования запусков такая арифметика врёт: один
 * эксперт может дать два миллиона, а десять — ноль. «До цели 1083 рассылки»
 * выглядит точным числом и не значит ничего, а число, которое не значит
 * ничего, хуже отсутствующего: на него принимают решения.
 *
 * Осталось три вещи, каждая из которых — факт, а не мнение:
 *
 *  — СРОК. Сколько дней прошло и сколько осталось.
 *  — ДВЕ ДОЛИ. «41% собрано» против «30% срока». Обгоняет ли деньга время —
 *    видно мгновенно и без единого допущения о том, как эта деньга придёт.
 *  — ШАГИ. Их пишет сам человек: закрыть эксперта, подписать договор,
 *    сделать запуск. Сумма зависит не только от него, шаги — только от него.
 */

export type GoalLike = {
  target_amount: number | null;
  current_amount: number;
  deadline: string;
  started_at: string;
  done: boolean;
};

/** Сколько дней осталось. Отрицательное — просрочено на столько же. */
export function daysLeft(deadline: string, today: string): number {
  return daysBetween(deadline, today);
}

/** Сколько дней идёт работа над целью. Минимум один: день старта уже день. */
export function daysPassed(startedAt: string, today: string): number {
  return Math.max(1, daysBetween(today, startedAt) + 1);
}

/** Прогресс к сумме, 0..100. У цели без суммы — 0 или 100. */
export function goalProgress(goal: GoalLike): number {
  if (goal.done) return 100;
  if (!goal.target_amount || goal.target_amount <= 0) return 0;
  const pct = (Math.max(0, goal.current_amount || 0) / goal.target_amount) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

/** Сколько ещё нужно собрать. Ноль — сумма набрана. */
export function remaining(goal: GoalLike): number {
  if (!goal.target_amount) return 0;
  return Math.max(0, goal.target_amount - Math.max(0, goal.current_amount || 0));
}




/**
 * Какая доля срока прошла, 0..100.
 *
 * Считается от даты старта до дедлайна. Это вторая половина честного
 * ответа на «успеваю ли я»: первая — сколько собрано.
 */
export function timeProgress(goal: GoalLike, today: string): number {
  const total = daysBetween(goal.deadline, goal.started_at);
  if (total <= 0) return 100;
  const passed = daysBetween(today, goal.started_at);
  return Math.max(0, Math.min(100, Math.round((passed / total) * 100)));
}

export type GoalState = 'done' | 'overdue' | 'ahead' | 'ontrack' | 'behind' | 'fresh';

/**
 * Насколько доля собранного расходится с долей прошедшего времени.
 *
 * Порог в пять пунктов, а не ноль: деньги приходят кусками, и объявлять
 * отставанием любое отклонение значит сообщать об отставании почти каждый
 * день.
 */
export const GOAL_DRIFT = 5;

/**
 * Состояние цели: обгоняешь время или отстаёшь.
 *
 * 'fresh' — работа только началась и судить не о чем. Называть нулевой
 * прогресс отставанием в первые дни — самый быстрый способ добиться, чтобы
 * на цель перестали смотреть.
 */
export function goalState(goal: GoalLike, today: string): GoalState {
  if (goal.done) return 'done';
  if (daysLeft(goal.deadline, today) < 0) return 'overdue';
  // У цели без суммы сравнивать нечего: она либо сделана, либо нет.
  if (!goal.target_amount) return 'ontrack';

  const time = timeProgress(goal, today);
  if (time < 10 && goal.current_amount <= 0) return 'fresh';

  const drift = goalProgress(goal) - time;
  if (drift >= GOAL_DRIFT) return 'ahead';
  if (drift <= -GOAL_DRIFT) return 'behind';
  return 'ontrack';
}

/* -------------------------------------------------------------------------- */
/*  Шаги                                                                       */
/* -------------------------------------------------------------------------- */

export type StepProgress = { done: number; total: number; pct: number };

export function stepProgress(steps: GoalStep[]): StepProgress {
  const list = Array.isArray(steps) ? steps : [];
  const total = list.length;
  const done = list.filter((step) => step.done).length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

/** Шаги приходят из jsonb — там может лежать что угодно, включая null. */
export function stepsOf(goal: { steps?: unknown }): GoalStep[] {
  if (!Array.isArray(goal.steps)) return [];
  return goal.steps.filter(
    (step): step is GoalStep =>
      Boolean(step) && typeof step === 'object' && typeof (step as GoalStep).title === 'string',
  );
}

/** id шага генерируется на клиенте: сервер о новом шаге ещё не знает. */
export function newStepId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `step-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

/**
 * Порядок списка: сначала незакрытые по ближайшему сроку, закрытые в конец.
 *
 * Закреплённая не поднимается наверх намеренно — она и так висит на главной,
 * а в списке важнее срок.
 */
export function sortGoals<T extends { deadline: string; done: boolean }>(goals: T[]): T[] {
  return [...goals].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return a.deadline.localeCompare(b.deadline);
  });
}

/** Насколько горит срок: с этого числа дней цель начинает светиться. */
export const GOAL_SOON_DAYS = 7;
export const GOAL_URGENT_DAYS = 3;

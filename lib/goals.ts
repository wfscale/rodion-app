import { daysBetween, shiftDate } from '@/lib/date';

/**
 * Цели: срок, темп и перевод суммы в рассылки.
 *
 * Голый обратный отсчёт — счётчик долга. «Осталось 47 дней и 30 000 рублей»
 * не говорит, что делать сегодня, зато каждый день сообщает, что ты не там,
 * где должен быть. Такой счётчик демотивирует ровно с той скоростью, с
 * какой уменьшается.
 *
 * Поэтому здесь всё считается в двух других единицах:
 *
 *  — ТЕМП. Не «осталось 30 000», а «нужно 640 в день». Дневное число можно
 *    перебить сегодня; остаток перебить нельзя, его можно только не успеть.
 *
 *  — РАССЫЛКИ. Приложение знает, во сколько рассылок обходится закрытие и
 *    сколько в среднем приносит сделка. Значит любую сумму можно назвать в
 *    том единственном действии, которое человек контролирует напрямую:
 *    «до цели ≈ 96 рассылок». Это число падает каждый раз, когда он
 *    работает, — в отличие от суммы, которая ждёт чужого решения.
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
 * Сколько нужно в день, чтобы успеть.
 *
 * Срок вышел, а сумма нет — возвращаем весь остаток: это честно, «нужно
 * 30 000 сегодня» лучше, чем деление на ноль или тихий ноль.
 */
export function requiredPace(goal: GoalLike, today: string): number {
  const left = remaining(goal);
  if (left === 0) return 0;
  const days = daysLeft(goal.deadline, today);
  if (days <= 0) return left;
  return Math.ceil(left / days);
}

/** Сколько в среднем выходит в день с начала работы над целью. */
export function actualPace(goal: GoalLike, today: string): number {
  const done = Math.max(0, goal.current_amount || 0);
  if (done === 0) return 0;
  return Math.round(done / daysPassed(goal.started_at, today));
}

/**
 * Когда цель будет достигнута при нынешнем темпе. null — темпа ещё нет.
 *
 * Это единственное честное «успеваешь или нет»: не мнение приложения, а
 * продолжение той скорости, с которой человек уже идёт.
 */
export function projectedDate(goal: GoalLike, today: string): string | null {
  const pace = actualPace(goal, today);
  if (pace <= 0) return null;
  const left = remaining(goal);
  if (left === 0) return today;
  return shiftDate(today, Math.ceil(left / pace));
}

export type GoalState = 'done' | 'overdue' | 'ahead' | 'ontrack' | 'behind' | 'fresh';

/**
 * Состояние цели.
 *
 * 'fresh' — работа ещё не началась и судить не о чем. Называть нулевой
 * прогресс отставанием в первый же день — самый быстрый способ добиться,
 * чтобы на цель перестали смотреть.
 */
export function goalState(goal: GoalLike, today: string): GoalState {
  if (goal.done) return 'done';

  const left = daysLeft(goal.deadline, today);
  if (left < 0) return 'overdue';
  if (!goal.target_amount) return 'ontrack';

  const pace = actualPace(goal, today);
  if (pace <= 0) return 'fresh';

  const projected = projectedDate(goal, today);
  if (!projected) return 'fresh';

  const slack = daysBetween(goal.deadline, projected);
  if (slack >= 3) return 'ahead';
  if (slack >= 0) return 'ontrack';
  return 'behind';
}

/** На сколько дней идёшь впереди срока. Отрицательное — отстаёшь. */
export function slackDays(goal: GoalLike, today: string): number | null {
  const projected = projectedDate(goal, today);
  if (!projected) return null;
  return daysBetween(goal.deadline, projected);
}

/**
 * Сколько рублей приносит одна рассылка.
 *
 * Средний чек, делённый на число рассылок, в которое обходится закрытие.
 * null — считать не из чего: либо закрытий ещё не было, либо чек не задан.
 * Врать выдуманным средним нельзя: на это число потом смотрят каждый день.
 */
export function rublesPerOutreach(
  avgDeal: number,
  outreachesPerClose: number,
): number | null {
  if (avgDeal <= 0 || outreachesPerClose <= 0) return null;
  return avgDeal / outreachesPerClose;
}

/**
 * Во сколько рассылок обходится остаток цели.
 *
 * То самое число, ради которого всё считается: сумма, названная в
 * действии, которое зависит только от тебя.
 */
export function outreachesToGoal(
  goal: GoalLike,
  rublesPer: number | null,
): number | null {
  if (rublesPer === null || rublesPer <= 0) return null;
  const left = remaining(goal);
  if (left === 0) return 0;
  return Math.ceil(left / rublesPer);
}

/** Сколько рассылок в день нужно, чтобы успеть к сроку. */
export function outreachesPerDay(
  goal: GoalLike,
  rublesPer: number | null,
  today: string,
): number | null {
  const total = outreachesToGoal(goal, rublesPer);
  if (total === null) return null;
  if (total === 0) return 0;
  const days = daysLeft(goal.deadline, today);
  return days <= 0 ? total : Math.ceil(total / days);
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

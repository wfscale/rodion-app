import { daysBetween, shiftDate } from '@/lib/date';

export type StreakSource = { date: string; completion_pct: number };

export type StreakResult = {
  current: number;
  longest: number;
  /** Засчитан ли сегодняшний день. Если нет — серия ещё держится, но под угрозой. */
  todayCounted: boolean;
};

/**
 * Стрик — «дни в ударе».
 *
 * День засчитывается, если выполнено не меньше threshold% чеклиста.
 * Считается всегда заново из истории записей, а не инкрементом в базе:
 * так значение не разъезжается после правок задним числом или входа
 * с другого устройства.
 *
 * Важная деталь: если сегодняшний день ещё не набрал порог, серия НЕ рвётся —
 * она просто не включает сегодня. Иначе стрик обнулялся бы каждое утро.
 */
export function computeStreak(
  logs: StreakSource[],
  threshold: number,
  today: string,
): StreakResult {
  const qualifying = new Set(
    logs.filter((log) => (log.completion_pct ?? 0) >= threshold).map((log) => log.date),
  );

  const todayCounted = qualifying.has(today);

  // Текущая серия: идём назад от сегодня (или от вчера, если сегодня ещё не взят).
  let cursor = todayCounted ? today : shiftDate(today, -1);
  let current = 0;
  while (qualifying.has(cursor)) {
    current += 1;
    cursor = shiftDate(cursor, -1);
  }

  // Рекорд: самая длинная цепочка подряд идущих дат за всю историю.
  const sorted = Array.from(qualifying).sort();
  let longest = 0;
  let run = 0;
  let previous: string | null = null;

  for (const date of sorted) {
    run = previous !== null && daysBetween(date, previous) === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
    previous = date;
  }

  return { current, longest: Math.max(longest, current), todayCounted };
}

/** Пороги, за которые начисляется разовый бонус XP. */
export const STREAK_BONUSES = [
  { days: 3, xp: 30, reasonKey: 'streak3' },
  { days: 7, xp: 100, reasonKey: 'streak7' },
  { days: 14, xp: 250, reasonKey: 'streak14' },
] as const;

/** Какие бонусы полагаются за достигнутую длину серии. */
export function bonusesForStreak(streak: number) {
  return STREAK_BONUSES.filter((bonus) => streak >= bonus.days);
}

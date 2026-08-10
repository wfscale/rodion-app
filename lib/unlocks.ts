import { daysBetween, weekStart } from '@/lib/date';
import type { Dict } from '@/lib/i18n';
import { HABIT_POOL, type TaskDef } from '@/lib/tasks';

/** Порог среднего выполнения за неделю, открывающий следующую фишку. */
export const UNLOCK_THRESHOLD = 70;

export type UnlockDef = {
  week: number;
  titleKey: keyof Dict['unlocks'];
  descKey: keyof Dict['unlocks'];
};

/** Именованные разблокировки. Уровни выше 5 добавляют привычки из пула. */
export const UNLOCKS: UnlockDef[] = [
  { week: 1, titleKey: 'w1Title', descKey: 'w1Desc' },
  { week: 2, titleKey: 'w2Title', descKey: 'w2Desc' },
  { week: 3, titleKey: 'w3Title', descKey: 'w3Desc' },
  { week: 4, titleKey: 'w4Title', descKey: 'w4Desc' },
  { week: 5, titleKey: 'w5Title', descKey: 'w5Desc' },
];

export type WeekSummary = {
  /** Порядковый номер недели с момента регистрации, начиная с 1. */
  index: number;
  /** Понедельник этой недели, ISO. */
  start: string;
  avgCompletion: number;
  daysLogged: number;
  /** Неделя полностью прошла (можно считать разблокировку). */
  complete: boolean;
  qualified: boolean;
};

type LogLike = { date: string; completion_pct: number };

/**
 * Разбор истории по неделям (с понедельника).
 *
 * Пропущенные дни считаются нулями — иначе один идеальный день из семи
 * давал бы 100% средних и открывал фишку незаслуженно. Учитываются только
 * дни начиная с даты регистрации и не позже сегодняшнего.
 */
export function summarizeWeeks(
  logs: LogLike[],
  createdAt: string,
  today: string,
  threshold: number = UNLOCK_THRESHOLD,
): WeekSummary[] {
  const byDate = new Map(logs.map((log) => [log.date, log.completion_pct ?? 0]));
  const firstMonday = weekStart(createdAt);
  const totalDays = daysBetween(today, firstMonday);
  if (totalDays < 0) return [];

  const weekCount = Math.floor(totalDays / 7) + 1;
  const weeks: WeekSummary[] = [];

  for (let w = 0; w < weekCount; w += 1) {
    const start = shift(firstMonday, w * 7);
    let sum = 0;
    let counted = 0;
    let daysLogged = 0;

    for (let d = 0; d < 7; d += 1) {
      const date = shift(start, d);
      // За пределами прожитого периода день не учитывается вовсе.
      if (daysBetween(date, createdAt) < 0) continue;
      if (daysBetween(date, today) > 0) continue;

      counted += 1;
      const pct = byDate.get(date);
      if (pct !== undefined) {
        daysLogged += 1;
        sum += pct;
      }
    }

    const avg = counted === 0 ? 0 : Math.round(sum / counted);
    const complete = daysBetween(today, start) >= 7;

    weeks.push({
      index: w + 1,
      start,
      avgCompletion: avg,
      daysLogged,
      complete,
      qualified: complete && avg > threshold,
    });
  }

  return weeks;
}

function shift(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Текущий уровень разблокировок.
 * Уровень 1 доступен сразу; каждая закрытая неделя с результатом выше порога
 * добавляет ещё один.
 */
export function computeUnlockLevel(weeks: WeekSummary[]): number {
  return 1 + weeks.filter((week) => week.qualified).length;
}

/** Привычки из пула, открытые на данном уровне (с 5-го, по одной каждые 2 недели). */
export function unlockedHabits(level: number): TaskDef[] {
  if (level < 5) return [];
  const count = 1 + Math.floor((level - 5) / 2);
  return HABIT_POOL.slice(0, Math.min(count, HABIT_POOL.length));
}

/** Открыта ли конкретная фишка. */
export const featureUnlocked = {
  /** Неделя 2 — конверсия воронки на странице рассылок. */
  funnelStats: (level: number) => level >= 2,
  /** Неделя 3 — Pomodoro в разделе рассылок. */
  focusMode: (level: number) => level >= 3,
  /** Неделя 4 — еженедельный отчёт. */
  weeklyReport: (level: number) => level >= 4,
  /** Неделя 5 — привычки из пула. */
  habitPool: (level: number) => level >= 5,
};

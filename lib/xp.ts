import type { Dict } from '@/lib/i18n';

// ---------------------------------------------------------------------------
// Стоимость действий в XP
// ---------------------------------------------------------------------------
export const XP = {
  TASK: 10,
  OUTREACH_SENT: 15,
  REPLIED: 30,
  CALL: 75,
  CLOSED: 200,
  CHECKIN: 20,
  FULL_DAY: 50,
  FASTING: 10,
  DAILY_GOAL: 50,
  STREAK_3: 30,
  STREAK_7: 100,
  STREAK_14: 250,
} as const;

// ---------------------------------------------------------------------------
// Уровни. Порог — минимальный XP для входа в уровень.
// Названия берутся из словаря (t.levels), индекс = level - 1.
// ---------------------------------------------------------------------------
export const LEVEL_THRESHOLDS = [0, 200, 500, 1000, 2000, 4000, 8000] as const;
export const MAX_LEVEL = LEVEL_THRESHOLDS.length;

export type LevelInfo = {
  level: number;
  name: string;
  /** XP, с которого начинается текущий уровень */
  floor: number;
  /** XP, с которого начнётся следующий (null на максимальном) */
  ceiling: number | null;
  /** Прогресс внутри уровня, 0..100 */
  progressPct: number;
  /** Сколько XP осталось до следующего уровня (0 на максимальном) */
  xpToNext: number;
  isMax: boolean;
};

/** Номер уровня по общему XP. Совпадает с SQL-функцией level_for_xp(). */
export function levelForXp(totalXp: number): number {
  const xp = Math.max(0, totalXp || 0);
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i += 1) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  return level;
}

/** Полная информация об уровне для хедера, профиля и прогресс-бара. */
export function getLevelInfo(totalXp: number, t: Dict): LevelInfo {
  const xp = Math.max(0, totalXp || 0);
  const level = levelForXp(xp);
  const floor = LEVEL_THRESHOLDS[level - 1];
  const isMax = level >= MAX_LEVEL;
  const ceiling = isMax ? null : LEVEL_THRESHOLDS[level];

  const span = ceiling === null ? 0 : ceiling - floor;
  const progressPct = ceiling === null ? 100 : Math.round(((xp - floor) / span) * 100);

  return {
    level,
    name: t.levels[level - 1] ?? t.levels[t.levels.length - 1],
    floor,
    ceiling,
    progressPct: Math.max(0, Math.min(100, progressPct)),
    xpToNext: ceiling === null ? 0 : Math.max(0, ceiling - xp),
    isMax,
  };
}

// ---------------------------------------------------------------------------
// Ключи идемпотентности для award_xp.
// Один и тот же ключ = XP начислится ровно один раз за всё время.
// Благодаря этому нельзя фармить опыт, снимая и заново ставя галочку.
// ---------------------------------------------------------------------------
export const onceKey = {
  task: (date: string, taskId: string) => `task:${date}:${taskId}`,
  checkin: (date: string) => `checkin:${date}`,
  fullDay: (date: string) => `fullday:${date}`,
  fasting: (date: string) => `fasting:${date}`,
  dailyGoal: (date: string) => `dailygoal:${date}`,
  streak: (days: number) => `streak:${days}`,
  contactStatus: (contactId: string, status: string) => `contact:${contactId}:${status}`,
};

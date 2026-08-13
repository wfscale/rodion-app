import type { Dict } from '@/lib/i18n';

// ---------------------------------------------------------------------------
// Стоимость действий в XP.
//
// Соотношение намеренно перекошено в сторону рассылок: одна рассылка стоит
// 8 XP, одна привычка — 1 XP. Закрыть весь блок привычек = 6 XP, меньше
// одной рассылки. Приложение должно вознаграждать то, что меняет жизнь.
// ---------------------------------------------------------------------------
export const XP = {
  OUTREACH_SENT: 8,
  REPLIED: 80,
  CALL: 250,
  CLOSED: 1000,
  QUOTA_DONE: 100,
  DAILY_RECORD: 200,
  /** Каждые 5 рассылок сверх квоты. Потолка нет. */
  BONUS_OVER_QUOTA: 50,

  MODE_KEPT: 8,
  CHECKIN: 3,
  HABIT: 1,
} as const;

// ---------------------------------------------------------------------------
// Уровни. Пользователь никогда не видит полный список — только текущий
// и тизер следующего, поэтому названия и пороги живут только здесь.
// ---------------------------------------------------------------------------
export const LEVEL_THRESHOLDS = [
  0, 300, 800, 1800, 3500, 6500, 12000, 22000, 40000,
] as const;

export const MAX_LEVEL = LEVEL_THRESHOLDS.length; // 9

export type LevelInfo = {
  level: number;
  name: string;
  floor: number;
  ceiling: number | null;
  progressPct: number;
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
// Что открывает каждый уровень.
//
// Тизер показывается только для следующего уровня и только до 7-го:
// уровни 8 и 9 открываются без предупреждения.
// ---------------------------------------------------------------------------
export type FeatureKey =
  | 'offers'      // уровень 2 — библиотека офферов
  | 'niches'      // уровень 3 — аналитика по нишам
  | 'speed'       // уровень 4 — счётчик скорости + «следующий шаг»
  | 'project'     // уровень 5 — раздел «Проект»
  | 'report'      // уровень 6 — еженедельный отчёт
  | 'scale';      // уровень 7 — дашборд масштаба

export const FEATURE_LEVEL: Record<FeatureKey, number> = {
  offers: 2,
  niches: 3,
  speed: 4,
  project: 5,
  report: 6,
  scale: 7,
};

/** Открыта ли фича на текущем уровне. */
export function unlocked(feature: FeatureKey, level: number): boolean {
  return level >= FEATURE_LEVEL[feature];
}

/** Ключ фичи, которая откроется на данном уровне (для анимации повышения). */
export function featureAtLevel(level: number): FeatureKey | null {
  const entry = (Object.keys(FEATURE_LEVEL) as FeatureKey[]).find(
    (key) => FEATURE_LEVEL[key] === level,
  );
  return entry ?? null;
}

/** Тизер следующего уровня. null — если дальше тайна (уровни 8 и 9). */
export function nextLevelTeaser(currentLevel: number): FeatureKey | null {
  return featureAtLevel(currentLevel + 1);
}

// ---------------------------------------------------------------------------
// Ключи идемпотентности для award_xp.
// Один ключ = одно начисление за всё время.
// ---------------------------------------------------------------------------
export const onceKey = {
  habit: (date: string, habitId: string) => `habit:${date}:${habitId}`,
  checkin: (date: string) => `checkin:${date}`,
  modeKept: (date: string) => `mode:${date}`,
  quota: (date: string) => `quota:${date}`,
  record: (date: string, count: number) => `record:${date}:${count}`,
  bonus: (date: string, step: number) => `bonus:${date}:${step}`,
  contactStatus: (contactId: string, status: string) => `contact:${contactId}:${status}`,
};

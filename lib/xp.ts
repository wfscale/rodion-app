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
  /** Каждые 25 рассылок за всё время — веха, которая не сгорает. */
  MILESTONE: 150,
  /** Ровное число за день (кратное 5) — плата за «добей до круглого». */
  ROUND_DAY: 25,

  MODE_KEPT: 8,
  CHECKIN: 3,
  HABIT: 1,
  /** Первая заметка за день. Символически — мысль это не результат. */
  NOTE_FIRST: 2,
} as const;

/** Каждые сколько рассылок за всё время отмечается веха. */
export const MILESTONE_STEP = 25;

// ---------------------------------------------------------------------------
// Уровни — двадцать ступеней.
//
// Кривая держит темп: первые ступени берутся за дни, средние за недели,
// последние за месяцы. Полного списка пользователь не видит никогда —
// открывается блоками по пять (см. revealCeiling).
//
// Пороги 1..6 неизменны с прошлой версии: понижать или повышать уже взятый
// уровень нельзя, это обнуляет доверие к шкале.
// ---------------------------------------------------------------------------
export const LEVEL_THRESHOLDS = [
  0,       // 1
  300,     // 2
  800,     // 3
  1_800,   // 4
  3_500,   // 5
  6_500,   // 6
  10_000,  // 7
  14_500,  // 8
  20_000,  // 9
  27_000,  // 10
  35_500,  // 11
  46_000,  // 12
  58_500,  // 13
  73_000,  // 14
  90_000,  // 15
  110_000, // 16
  133_000, // 17
  160_000, // 18
  195_000, // 19
  240_000, // 20
] as const;

export const MAX_LEVEL = LEVEL_THRESHOLDS.length; // 20

/**
 * Уровни открываются блоками по три.
 *
 * Три — потому что дальше начинается «сколько же там ещё». Впереди всегда
 * видно две-три ступени: достаточно, чтобы понимать, куда шагать, и мало,
 * чтобы прикидывать объём всего пути. Взял последнюю ступень блока —
 * проявились следующие три.
 */
export const REVEAL_BLOCK = 3;

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
    name: levelName(level, t),
    floor,
    ceiling,
    progressPct: Math.max(0, Math.min(100, progressPct)),
    xpToNext: ceiling === null ? 0 : Math.max(0, ceiling - xp),
    isMax,
  };
}

/** Название уровня из словаря. За границей массива — последнее известное. */
export function levelName(level: number, t: Dict): string {
  return t.levels[level - 1] ?? t.levels[t.levels.length - 1];
}

/** Порог входа на уровень. */
export function thresholdFor(level: number): number {
  const index = Math.max(1, Math.min(MAX_LEVEL, level)) - 1;
  return LEVEL_THRESHOLDS[index];
}

// ---------------------------------------------------------------------------
// Что открывает каждый уровень.
//
// Закрытых дверей без комнаты за ними быть не должно: каждый ключ ниже —
// реально работающий раздел или правило игры, а не обещание.
// ---------------------------------------------------------------------------
export type FeatureKey =
  | 'offers'       // 2  — библиотека офферов (+ разбор паттернов внутри)
  | 'niches'       // 3  — аналитика по нишам
  | 'speed'        // 4  — счётчик скорости + «следующий шаг»
  | 'project'      // 5  — раздел «Проект»
  | 'report'       // 6  — еженедельный отчёт
  | 'scale'        // 7  — дашборд масштаба
  | 'heatmap'      // 8  — тепловая карта дней
  | 'prime'        // 9  — приоритетный список контактов
  | 'achievements' // 10 — витрина достижений
  | 'hourly'       // 11 — часы отклика
  | 'compare'      // 12 — динамика недель
  | 'doubleXp'     // 13 — перк: каждая 10-я рассылка дня ×2
  | 'focus'        // 14 — режим фокуса на главной
  | 'mentor'       // 15 — личный разбор воронки
  | 'hall'         // 16 — зал славы
  | 'themes'       // 17 — акценты интерфейса
  | 'overdrive'    // 18 — вторая планка дня
  | 'annual'       // 19 — годовой холст
  | 'apex';        // 20 — всё открыто

export const FEATURE_LEVEL: Record<FeatureKey, number> = {
  offers: 2,
  niches: 3,
  speed: 4,
  project: 5,
  report: 6,
  scale: 7,
  heatmap: 8,
  prime: 9,
  achievements: 10,
  hourly: 11,
  compare: 12,
  doubleXp: 13,
  focus: 14,
  mentor: 15,
  hall: 16,
  themes: 17,
  overdrive: 18,
  annual: 19,
  apex: 20,
};

/** Порядок = порядок уровней. Используется списком «что открыто». */
export const FEATURE_ORDER = (Object.keys(FEATURE_LEVEL) as FeatureKey[]).sort(
  (a, b) => FEATURE_LEVEL[a] - FEATURE_LEVEL[b],
);

/** Открыта ли фича на текущем уровне. */
export function unlocked(feature: FeatureKey, level: number): boolean {
  return level >= FEATURE_LEVEL[feature];
}

/** Ключ фичи, которая откроется на данном уровне. */
export function featureAtLevel(level: number): FeatureKey | null {
  return FEATURE_ORDER.find((key) => FEATURE_LEVEL[key] === level) ?? null;
}

/** Тизер следующего уровня. null — уже максимум. */
export function nextLevelTeaser(currentLevel: number): FeatureKey | null {
  return featureAtLevel(currentLevel + 1);
}

// ---------------------------------------------------------------------------
// Постепенное раскрытие лестницы.
//
// Двадцать строк сразу — это список дел, а не игра: мозг видит объём и
// заранее устаёт. Видно только пройденное, текущее и две-три ступени впереди.
// Ни счётчика «осталось столько-то», ни строк-заглушек: пользователь не
// должен знать ни сколько всего уровней, ни что дорога вообще продолжается.
// Взял последнюю видимую ступень — появились следующие три.
// ---------------------------------------------------------------------------

/** До какого уровня включительно видно лестницу. */
export function revealCeiling(level: number): number {
  const safe = Math.max(1, Math.min(MAX_LEVEL, level || 1));
  return Math.min(MAX_LEVEL, Math.ceil((safe + 1) / REVEAL_BLOCK) * REVEAL_BLOCK);
}

/** Сколько уровней ещё скрыто за туманом. */
export function hiddenAhead(level: number): number {
  return Math.max(0, MAX_LEVEL - revealCeiling(level));
}

export type LadderRow = {
  level: number;
  /** null — уровень ещё за туманом, показывается как «???». */
  feature: FeatureKey | null;
  threshold: number;
  state: 'done' | 'current' | 'next' | 'locked' | 'hidden';
};

/**
 * Строки лестницы для страницы прогресса.
 *
 * Возвращает ровно то, что можно показать: пройденные уровни, текущий,
 * ближайшие открытые к показу и — если туман есть — ни строчкой больше.
 */
export function levelLadder(level: number): LadderRow[] {
  const current = Math.max(1, Math.min(MAX_LEVEL, level || 1));
  const ceiling = revealCeiling(current);

  const rows: LadderRow[] = [];
  for (let n = 1; n <= ceiling; n += 1) {
    rows.push({
      level: n,
      feature: featureAtLevel(n),
      threshold: thresholdFor(n),
      state: n < current ? 'done' : n === current ? 'current' : n === current + 1 ? 'next' : 'locked',
    });
  }
  return rows;
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
  /** Веха по общему числу рассылок: 25, 50, 75… */
  milestone: (total: number) => `milestone:${total}`,
  /** Ровное число рассылок за конкретный день. */
  roundDay: (date: string, count: number) => `round:${date}:${count}`,
  /** Двойной удар — каждая 10-я рассылка дня. */
  overdrive: (date: string, count: number) => `overdrive:${date}:${count}`,
  /** Первая заметка дня. */
  note: (date: string) => `note:${date}`,
  /** Закрытое напоминание. */
  reminder: (id: string) => `reminder:${id}`,
};

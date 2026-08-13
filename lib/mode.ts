import { daysBetween } from '@/lib/date';
import type { Dict } from '@/lib/i18n';

/**
 * Режим — три счётчика воздержания: порно, мастурбация, сладкое.
 *
 * Ручного сброса нет намеренно. Счётчик двигает только вечерний чекин
 * «Сегодня держался? Да / Нет»: «да» прибавляет день, «нет» обнуляет.
 * Кнопка сброса под рукой превращала бы срыв в один безболезненный тап.
 */
export const MODE_KEYS = ['porn', 'mb', 'sugar'] as const;
export type ModeKey = (typeof MODE_KEYS)[number];

/** Порог, с которого режим считается устоявшимся. */
export const MODE_ACTIVE_DAYS = 14;

/** Подпись под счётчиком — меняется по мере роста серии. */
export function modeStageKey(days: number): keyof Dict['mode']['stages'] {
  if (days <= 0) return 's0';
  if (days <= 3) return 's1';
  if (days <= 7) return 's2';
  if (days <= 14) return 's3';
  if (days <= 21) return 's4';
  return 's5';
}

export type ModeCounters = { porn: number; mb: number; sugar: number };

/** Бейдж «РЕЖИМ АКТИВЕН» — когда все три счётчика взяли порог. */
export function isModeActive(counters: ModeCounters): boolean {
  return MODE_KEYS.every((key) => counters[key] >= MODE_ACTIVE_DAYS);
}

/** Нужен ли сегодня вечерний чекин (ещё не отвечал за этот день). */
export function needsEveningCheckin(
  lastCheckin: string | null,
  today: string,
): boolean {
  return lastCheckin !== today;
}

/**
 * Применение ответа вечернего чекина.
 * held = держался по этому пункту.
 */
export function applyCheckin(counters: ModeCounters, held: Record<ModeKey, boolean>): ModeCounters {
  return {
    porn: held.porn ? counters.porn + 1 : 0,
    mb: held.mb ? counters.mb + 1 : 0,
    sugar: held.sugar ? counters.sugar + 1 : 0,
  };
}

/**
 * Пропущенные вечера не обнуляют счётчики: человек мог просто не открыть
 * приложение. Но и не наращивают — засчитывается только явный ответ.
 * Функция нужна лишь чтобы показать, сколько вечеров остались без ответа.
 */
export function missedEvenings(lastCheckin: string | null, today: string): number {
  if (!lastCheckin) return 0;
  return Math.max(0, daysBetween(today, lastCheckin) - 1);
}

/** Дней до дедлайна. Отрицательное значение означает, что срок прошёл. */
export function daysUntilDeadline(deadline: string, today: string): number {
  return daysBetween(deadline, today);
}

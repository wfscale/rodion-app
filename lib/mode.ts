import { daysBetween } from '@/lib/date';
import type { Dict } from '@/lib/i18n';

/**
 * Режим — шесть счётчиков воздержания.
 *
 * Счёт идёт по умолчанию: день засчитывается сам, по факту смены суток, а
 * отмечается только срыв. Раньше было наоборот — счётчик двигал вечерний
 * чекин «держался? да / нет», — и он замирал у человека, который на самом
 * деле держался, просто не открыл вечером приложение. Замерший счётчик
 * обесценивает выдержку ровно тем, что её не замечает.
 *
 * Ключи porn, mb, sugar не переименовывать: на них висит вся история в
 * profiles.mode_*_days.
 */
export const MODE_KEYS = ['porn', 'mb', 'sugar', 'flour', 'music', 'reels'] as const;
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

/**
 * Счётчики всех пунктов.
 *
 * Тип выведен из MODE_KEYS намеренно: список пунктов и набор полей не должны
 * разъезжаться — иначе новый пункт появится на экране, но не будет расти.
 */
export type ModeCounters = Record<ModeKey, number>;

/**
 * Бейдж «РЕЖИМ АКТИВЕН» — когда все шесть счётчиков взяли порог.
 *
 * Порог оставлен на четырнадцати днях, хотя пунктов стало вдвое больше.
 * Считать «шесть по 14» недостижимым — рассуждение из старой механики: там
 * серия росла только от вечернего ответа, и четырнадцать ответов подряд не
 * набирались никогда. Теперь дни идут сами, и между человеком и бейджем
 * стоит только реальный срыв. Понизить порог сейчас значило бы удешевить
 * ровно то, что впервые стало брать по-настоящему.
 */
export function isModeActive(counters: ModeCounters): boolean {
  return MODE_KEYS.every((key) => counters[key] >= MODE_ACTIVE_DAYS);
}

/**
 * День ещё не начислен — счётчики отстают от сегодняшнего дня.
 *
 * Прятать за этим форму «Что сорвалось?» нельзя: срыв случается в любой
 * день, в том числе уже начисленный. Отметить его нужно уметь всегда.
 */
export function needsEveningCheckin(
  lastCheckin: string | null,
  today: string,
): boolean {
  return lastCheckin !== today;
}

/**
 * Начисление пропущенных дней всем счётчикам сразу.
 *
 * Не открывал приложение — значит держался: это и есть счёт по умолчанию.
 * Поэтому пропуск в пять суток даёт каждому счётчику +5, а не +1. Потолка
 * нет намеренно: обрезать начисление означало бы наказывать за то, что
 * приложение не открывали, — ровно та ошибка, от которой уходим.
 *
 * changed = счётчики и день начисления нужно сохранить.
 */
export function rollMode(
  counters: ModeCounters,
  lastCounted: string | null,
  today: string,
): { counters: ModeCounters; changed: boolean } {
  if (lastCounted === today) return { counters, changed: false };

  // Первый запуск: начислять не за что, но день зафиксировать надо — иначе
  // счётчики некуда будет двигать от завтрашнего дня.
  if (!lastCounted) return { counters, changed: true };

  // Часы уехали назад — смена таймзоны или правка даты вручную. Двигать день
  // начисления в прошлое нельзя: те же сутки начислились бы второй раз.
  const gap = daysBetween(today, lastCounted);
  if (gap <= 0) return { counters, changed: false };

  const grown = { ...counters };
  for (const key of MODE_KEYS) grown[key] = counters[key] + gap;

  return { counters: grown, changed: true };
}

/**
 * Срыв по одному пункту.
 *
 * Обнуляется только он: сорваться на сладком и потерять заодно месяц без
 * порно — это не счёт, а наказание, и после него счётчики перестают что-либо
 * значить.
 */
export function breakStreak(counters: ModeCounters, key: ModeKey): ModeCounters {
  return { ...counters, [key]: 0 };
}

/** Дней до дедлайна. Отрицательное значение означает, что срок прошёл. */
export function daysUntilDeadline(deadline: string, today: string): number {
  return daysBetween(deadline, today);
}

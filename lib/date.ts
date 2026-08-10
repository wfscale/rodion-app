import { addDays, format, parseISO, startOfWeek } from 'date-fns';

/**
 * Час, до которого сутки считаются «вчерашними».
 *
 * У Родиона отбой в 1:00 — если резать день по полуночи, то задача
 * «Лёг спать до 1:00» физически не может быть отмечена: в 00:30 календарь
 * уже показывает следующие сутки. Поэтому логический день кончается в 4:00.
 */
export const DAY_ROLLOVER_HOUR = 4;

/** Логическая «сегодняшняя» дата в формате YYYY-MM-DD. */
export function getLogicalDate(now: Date = new Date()): string {
  const d = new Date(now);
  if (d.getHours() < DAY_ROLLOVER_HOUR) d.setDate(d.getDate() - 1);
  return format(d, 'yyyy-MM-dd');
}

/** Сдвиг ISO-даты на n дней. */
export function shiftDate(iso: string, days: number): string {
  return format(addDays(parseISO(iso), days), 'yyyy-MM-dd');
}

/** Понедельник недели, содержащей дату. */
export function weekStart(iso: string): string {
  return format(startOfWeek(parseISO(iso), { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

/** Массив из 7 ISO-дат: Пн..Вс недели, содержащей дату. */
export function weekDates(iso: string): string[] {
  const monday = weekStart(iso);
  return Array.from({ length: 7 }, (_, i) => shiftDate(monday, i));
}

/** Разница в целых днях между двумя ISO-датами (a - b). */
export function daysBetween(a: string, b: string): number {
  const ms = parseISO(a).getTime() - parseISO(b).getTime();
  return Math.round(ms / 86_400_000);
}

/** «10 августа, воскресенье» / «10 August, Sunday» */
export function formatLongDate(iso: string, lang: 'ru' | 'en'): string {
  const d = parseISO(iso);
  return d.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  });
}

/** «10 авг» / «10 Aug» */
export function formatShortDate(iso: string, lang: 'ru' | 'en'): string {
  return parseISO(iso).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric',
    month: 'short',
  });
}

/** «10 авг, 14:32» из timestamptz. */
export function formatDateTime(ts: string, lang: 'ru' | 'en'): string {
  const d = new Date(ts);
  return d.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Текущее время как HH:MM — для дефолтов в time-инпутах. */
export function nowTime(): string {
  return format(new Date(), 'HH:mm');
}

/** Приводит time из Postgres («12:00:00») к виду для <input type="time"> («12:00»). */
export function toTimeInput(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 5);
}

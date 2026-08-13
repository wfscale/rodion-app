import { shiftDate, weekStart } from '@/lib/date';
import type { OutreachContact, StatusHistoryEntry } from '@/lib/types';

/**
 * Сводка за неделю.
 *
 * Считается из истории статусов, а не из текущего состояния контакта:
 * человек, который сегодня «Закрыт», на прошлой неделе мог быть только
 * «Ответил». Иначе отчёт за прошедшую неделю менялся бы задним числом.
 */
export type WeekStats = {
  weekStart: string;
  sent: number;
  replied: number;
  calls: number;
  closed: number;
  bestDay: string | null;
  bestCount: number;
};

/** Попадает ли дата в неделю, начинающуюся с monday. */
function inWeek(iso: string, monday: string): boolean {
  return iso >= monday && iso < shiftDate(monday, 7);
}

/** Первый переход контакта в указанный статус. */
function firstTransition(
  history: StatusHistoryEntry[] | null,
  status: string,
): string | null {
  const entry = (history ?? []).find((h) => h.status === status);
  return entry ? entry.at.slice(0, 10) : null;
}

export function statsForWeek(contacts: OutreachContact[], monday: string): WeekStats {
  let sent = 0;
  let replied = 0;
  let calls = 0;
  let closed = 0;

  // Лучший день недели по числу новых рассылок.
  const perDay = new Map<string, number>();

  for (const contact of contacts) {
    const touched = contact.first_contact_date;
    if (touched && inWeek(touched, monday)) {
      sent += 1;
      perDay.set(touched, (perDay.get(touched) ?? 0) + 1);
    }

    const history = contact.status_history;
    // «Ответил — отказ» тоже ответ: разговор состоялся.
    for (const status of ['replied', 'replied_no']) {
      const at = firstTransition(history, status);
      if (at && inWeek(at, monday)) {
        replied += 1;
        break;
      }
    }

    const callAt = firstTransition(history, 'call');
    if (callAt && inWeek(callAt, monday)) calls += 1;

    const closedAt = firstTransition(history, 'closed');
    if (closedAt && inWeek(closedAt, monday)) closed += 1;
  }

  let bestDay: string | null = null;
  let bestCount = 0;
  for (const [day, count] of Array.from(perDay.entries())) {
    if (count > bestCount) {
      bestDay = day;
      bestCount = count;
    }
  }

  return { weekStart: monday, sent, replied, calls, closed, bestDay, bestCount };
}

/**
 * Недели, за которые отчёта ещё нет.
 *
 * Текущая неделя не считается: она не закончилась, и её итог поменяется.
 */
export function missingWeeks(input: {
  cycleStart: string;
  today: string;
  existing: string[];
}): string[] {
  const { cycleStart, today, existing } = input;
  const have = new Set(existing);

  const first = weekStart(cycleStart);
  const current = weekStart(today);

  const result: string[] = [];
  let cursor = first;

  // Ограничение на 104 недели — страховка от бесконечного цикла при кривой дате.
  for (let i = 0; i < 104 && cursor < current; i += 1) {
    if (!have.has(cursor)) result.push(cursor);
    cursor = shiftDate(cursor, 7);
  }

  return result;
}

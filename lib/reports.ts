import { shiftDate, weekStart } from '@/lib/date';
import { normalizeStatus, SENT_STATUSES } from '@/lib/types';
import type { OutreachContact, StatusHistoryEntry, WeeklyReport } from '@/lib/types';

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

/**
 * Числа отчёта в том виде, в каком они лежат в строке `weekly_reports`.
 *
 * `xp_earned` сюда не входит намеренно: он не считается из контактов, и
 * запись его нулём затирала бы то, что могло попасть в строку другим путём.
 */
export type WeekRow = {
  week_start: string;
  sent: number;
  replied: number;
  calls: number;
  closed: number;
  best_day: string | null;
  best_count: number;
};

/** Сохранённая строка отчёта — ровно те поля, по которым идёт сверка. */
type SavedReport = Pick<WeeklyReport, keyof WeekRow>;

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

/**
 * Написали ли этому человеку вообще.
 *
 * Собранная база (`not_sent`) рассылкой не считается — инвариант 7. Дата
 * касания у неё уже проставлена, и без этой проверки неделя сбора базы
 * получала бы чужие рассылки: сумма недель уходила выше общего счёта.
 * Ровно так же считают счётчик дня и воронка (`sentToday`, `sentByDate`).
 */
function wasSent(contact: OutreachContact): boolean {
  return SENT_STATUSES.includes(normalizeStatus(contact.status));
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
    if (touched && inWeek(touched, monday) && wasSent(contact)) {
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

/** Понедельники всех закончившихся недель цикла, по возрастанию. */
function closedWeeks(cycleStart: string, today: string): string[] {
  const first = weekStart(cycleStart);
  const current = weekStart(today);

  const result: string[] = [];
  let cursor = first;

  // Ограничение на 104 недели — страховка от бесконечного цикла при кривой дате.
  for (let i = 0; i < 104 && cursor < current; i += 1) {
    result.push(cursor);
    cursor = shiftDate(cursor, 7);
  }

  return result;
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
  const have = new Set(input.existing);
  return closedWeeks(input.cycleStart, input.today).filter((monday) => !have.has(monday));
}

/** Числа недели в форме строки таблицы. */
export function toWeekRow(stats: WeekStats): WeekRow {
  return {
    week_start: stats.weekStart,
    sent: stats.sent,
    replied: stats.replied,
    calls: stats.calls,
    closed: stats.closed,
    best_day: stats.bestDay,
    best_count: stats.bestCount,
  };
}

/** Совпадает ли сохранённая строка с пересчётом. */
export function sameNumbers(saved: SavedReport, fresh: WeekRow): boolean {
  return (
    saved.sent === fresh.sent &&
    saved.replied === fresh.replied &&
    saved.calls === fresh.calls &&
    saved.closed === fresh.closed &&
    (saved.best_day ?? null) === fresh.best_day &&
    saved.best_count === fresh.best_count
  );
}

/**
 * Строки отчётов, которые нужно записать.
 *
 * Отчёт за закрытую неделю не меняется — но только пока не менялась формула.
 * Строка, посчитанная старой формулой, останется неверной навсегда, если
 * доверять одному факту её существования. Поэтому недели пересчитываются
 * каждый раз, а наружу выходят только те, где числа разошлись с сохранёнными
 * (или строки нет вовсе): дешёвый пересчёт в памяти против одной записи в
 * базу тогда, когда есть что менять.
 */
export function reportsToWrite(input: {
  contacts: OutreachContact[];
  cycleStart: string;
  today: string;
  existing: SavedReport[];
}): WeekRow[] {
  const saved = new Map(input.existing.map((row) => [row.week_start, row]));

  const result: WeekRow[] = [];
  for (const monday of closedWeeks(input.cycleStart, input.today)) {
    const fresh = toWeekRow(statsForWeek(input.contacts, monday));
    const previous = saved.get(monday);
    if (!previous || !sameNumbers(previous, fresh)) result.push(fresh);
  }

  return result;
}

import { daysBetween, shiftDate, weekStart } from '@/lib/date';
import { followUpState, needsTouch } from '@/lib/followup';
import {
  CALL_STATUSES,
  REPLIED_STATUSES,
  SENT_STATUSES,
  type OutreachContact,
} from '@/lib/types';

/**
 * Аналитика поверх рассылок.
 *
 * Всё считается из контактов на клиенте: данных мало (сотни строк), а любая
 * предрасчитанная таблица в базе рано или поздно разъезжается с истиной.
 * Ни одна функция здесь не знает про React и не форматирует текст — только
 * числа, чтобы их можно было проверить тестами.
 */

/* -------------------------------------------------------------------------- */
/*  Ряды по дням                                                               */
/* -------------------------------------------------------------------------- */

export type DayPoint = { date: string; sent: number };

/** Сколько рассылок в каждый день окна, включая нули. */
export function dailySeries(
  contacts: OutreachContact[],
  today: string,
  days: number,
): DayPoint[] {
  const counts = new Map<string, number>();
  for (const contact of contacts) {
    const date = (contact.first_contact_date ?? '').slice(0, 10);
    if (!date) continue;
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }

  return Array.from({ length: days }, (_, i) => {
    const date = shiftDate(today, -(days - 1 - i));
    return { date, sent: counts.get(date) ?? 0 };
  });
}

/**
 * Ширина окна «за всё время» в днях.
 *
 * От первой рассылки до сегодня включительно. Минимум — неделя: график из
 * двух точек не кривая, а отрезок. Максимум ограничивает вызывающий, чтобы
 * годы истории не превращались в тысячу узлов SVG.
 */
export function spanDays(
  contacts: OutreachContact[],
  today: string,
  max: number,
): number {
  let earliest: string | null = null;
  for (const contact of contacts) {
    const date = (contact.first_contact_date ?? '').slice(0, 10);
    if (!date) continue;
    if (earliest === null || date < earliest) earliest = date;
  }

  if (earliest === null || earliest > today) return 7;

  // +1: обе границы включительно, иначе первый день выпадает из окна.
  const span = daysBetween(today, earliest) + 1;
  return Math.max(7, Math.min(max, span));
}

/** XP по дням из транзакций — вторая метрика того же графика. */
export function xpSeries(
  transactions: { created_at: string; amount: number }[],
  today: string,
  days: number,
  logicalDate: (input: Date) => string,
): DayPoint[] {
  const counts = new Map<string, number>();
  for (const tx of transactions) {
    const date = logicalDate(new Date(tx.created_at));
    counts.set(date, (counts.get(date) ?? 0) + tx.amount);
  }

  return Array.from({ length: days }, (_, i) => {
    const date = shiftDate(today, -(days - 1 - i));
    return { date, sent: counts.get(date) ?? 0 };
  });
}

/* -------------------------------------------------------------------------- */
/*  Тепловая карта                                                             */
/* -------------------------------------------------------------------------- */

export type HeatCell = { date: string; sent: number; level: 0 | 1 | 2 | 3 | 4 };

/**
 * Сетка недель для тепловой карты: колонка — неделя, строка — день недели.
 * Уровень считается от личного максимума, а не от абсолютной шкалы: карта
 * должна показывать твой ритм, а не сравнивать тебя с кем-то.
 */
export function heatmap(
  contacts: OutreachContact[],
  today: string,
  weeks: number,
): HeatCell[][] {
  const firstMonday = shiftDate(weekStart(today), -(weeks - 1) * 7);
  const series = dailySeries(contacts, shiftDate(firstMonday, weeks * 7 - 1), weeks * 7);
  const max = Math.max(1, ...series.map((point) => point.sent));

  const level = (sent: number): HeatCell['level'] => {
    if (sent <= 0) return 0;
    const share = sent / max;
    if (share >= 0.75) return 4;
    if (share >= 0.5) return 3;
    if (share >= 0.25) return 2;
    return 1;
  };

  const grid: HeatCell[][] = [];
  for (let w = 0; w < weeks; w += 1) {
    const column: HeatCell[] = [];
    for (let d = 0; d < 7; d += 1) {
      const point = series[w * 7 + d];
      column.push({ date: point.date, sent: point.sent, level: level(point.sent) });
    }
    grid.push(column);
  }
  return grid;
}

/* -------------------------------------------------------------------------- */
/*  Приоритетный список                                                        */
/* -------------------------------------------------------------------------- */

export type PrimeRow = { contact: OutreachContact; score: number };

/**
 * Насколько контакт «тёплый» прямо сейчас.
 *
 * Логика простая и потому надёжная: тот, кто уже ответил, стоит дороже
 * молчащего; просроченное касание дороже сегодняшнего; чем больше касаний
 * сделано, тем ближе человек. Заглушённые и закрытые не участвуют вовсе.
 */
export function primeScore(contact: OutreachContact, today: string): number {
  if (contact.muted) return 0;

  const state = followUpState({
    status: contact.status,
    lastTouchAt: contact.last_touch_at,
    touchCount: contact.touch_count ?? 1,
    muted: Boolean(contact.muted),
    today,
  });

  let score = 0;

  if (contact.status === 'call') score += 60;
  else if (contact.status === 'replied') score += 45;
  else if (contact.status === 'read') score += 20;
  else if (contact.status === 'sent') score += 10;
  else return 0; // closed, replied_no, blocked, not_sent — работа окончена

  if (state.urgency === 'overdue') score += 25 + Math.min(15, Math.abs(state.daysUntil));
  else if (state.urgency === 'due') score += 20;
  else if (state.urgency === 'soon') score += 5;

  // Каждое сделанное касание — вложенный труд, его жалко бросать.
  score += Math.min(15, (contact.touch_count ?? 1) * 3);

  return score;
}

export function primeList(contacts: OutreachContact[], today: string, limit = 8): PrimeRow[] {
  return contacts
    .map((contact) => ({ contact, score: primeScore(contact, today) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.contact.name.localeCompare(b.contact.name))
    .slice(0, limit);
}

/* -------------------------------------------------------------------------- */
/*  Часы отклика                                                               */
/* -------------------------------------------------------------------------- */

export type HourWindow = { from: number; to: number; sent: number; replied: number; rate: number };

/** Окна по четыре часа: ночь, раннее утро, утро, день, вечер, поздний вечер. */
export const HOUR_WINDOWS: [number, number][] = [
  [0, 4],
  [4, 8],
  [8, 12],
  [12, 16],
  [16, 20],
  [20, 24],
];

/**
 * В какое время суток отправленные сообщения чаще получают ответ.
 *
 * Время берётся из created_at — момента, когда рассылка была занесена.
 * Это не идеальная метка отправки, но единственная честная: другой в данных
 * нет, а заносятся рассылки сразу после отправки.
 */
export function replyByHour(contacts: OutreachContact[]): HourWindow[] {
  return HOUR_WINDOWS.map(([from, to]) => {
    let sent = 0;
    let replied = 0;

    for (const contact of contacts) {
      if (!SENT_STATUSES.includes(contact.status)) continue;
      const stamp = contact.created_at;
      if (!stamp) continue;

      const hour = new Date(stamp).getHours();
      if (Number.isNaN(hour) || hour < from || hour >= to) continue;

      sent += 1;
      if (REPLIED_STATUSES.includes(contact.status)) replied += 1;
    }

    return {
      from,
      to,
      sent,
      replied,
      rate: sent > 0 ? Math.round((replied / sent) * 100) : 0,
    };
  }).filter((window) => window.sent > 0);
}

/* -------------------------------------------------------------------------- */
/*  Динамика недель                                                            */
/* -------------------------------------------------------------------------- */

export type WeekPoint = { weekStart: string; sent: number; replied: number };

/** Рассылки и ответы по неделям, от старых к свежим. */
export function weeklySeries(
  contacts: OutreachContact[],
  today: string,
  weeks: number,
): WeekPoint[] {
  const current = weekStart(today);

  return Array.from({ length: weeks }, (_, i) => {
    const monday = shiftDate(current, -(weeks - 1 - i) * 7);
    const next = shiftDate(monday, 7);

    let sent = 0;
    let replied = 0;

    for (const contact of contacts) {
      const date = (contact.first_contact_date ?? '').slice(0, 10);
      if (date >= monday && date < next) sent += 1;

      const first = (contact.status_history ?? []).find(
        (entry) => entry.status === 'replied' || entry.status === 'replied_no',
      );
      const at = first ? first.at.slice(0, 10) : null;
      if (at && at >= monday && at < next) replied += 1;
    }

    return { weekStart: monday, sent, replied };
  });
}

/** Изменение в процентах между двумя числами. null — сравнивать не с чем. */
export function deltaPct(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

/* -------------------------------------------------------------------------- */
/*  Зал славы                                                                  */
/* -------------------------------------------------------------------------- */

export type BestDay = { date: string; sent: number };

/** Лучшие дни за всё время по числу рассылок. */
export function hallOfFame(contacts: OutreachContact[], limit = 5): BestDay[] {
  const counts = new Map<string, number>();
  for (const contact of contacts) {
    const date = (contact.first_contact_date ?? '').slice(0, 10);
    if (!date) continue;
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([date, sent]) => ({ date, sent }))
    .sort((a, b) => b.sent - a.sent || b.date.localeCompare(a.date))
    .slice(0, limit);
}

/* -------------------------------------------------------------------------- */
/*  Личный разбор                                                              */
/* -------------------------------------------------------------------------- */

export type WeakLink = 'volume' | 'followup' | 'offer' | 'transition' | 'closing' | 'scale';

export type FunnelNumbers = {
  sent: number;
  replied: number;
  calls: number;
  closed: number;
  /** Сколько контактов ждут касания прямо сейчас. */
  overdueTouches: number;
};

/**
 * Где именно рвётся воронка.
 *
 * Порядок проверок = порядок причин. Сначала объём: при тридцати рассылках
 * любая конверсия — шум. Потом брошенные касания: они дешевле новых контактов.
 * Дальше по воронке сверху вниз.
 */
export function weakLink(numbers: FunnelNumbers): WeakLink {
  const { sent, replied, calls, closed, overdueTouches } = numbers;

  if (sent < 30) return 'volume';
  if (overdueTouches >= 5) return 'followup';

  const replyRate = replied / sent;
  if (replyRate < 0.08) return 'offer';

  if (replied > 0 && calls / replied < 0.25) return 'transition';
  if (calls > 0 && closed / calls < 0.3) return 'closing';

  return 'scale';
}

/** Сколько контактов сегодня требуют касания. */
export function overdueTouchCount(contacts: OutreachContact[], today: string): number {
  return contacts.filter((contact) =>
    needsTouch(
      followUpState({
        status: contact.status,
        lastTouchAt: contact.last_touch_at,
        touchCount: contact.touch_count ?? 1,
        muted: Boolean(contact.muted),
        today,
      }),
    ),
  ).length;
}

/* -------------------------------------------------------------------------- */
/*  Достижения                                                                 */
/* -------------------------------------------------------------------------- */

export const ACHIEVEMENT_IDS = [
  'sent25',
  'sent100',
  'sent500',
  'replies10',
  'replies50',
  'calls5',
  'closed1',
  'closed5',
  'chain7',
  'chain30',
  'record20',
  'quota10',
] as const;

export type AchievementId = (typeof ACHIEVEMENT_IDS)[number];

export type Achievement = {
  id: AchievementId;
  value: number;
  target: number;
  done: boolean;
  pct: number;
};

export type AchievementInput = {
  sent: number;
  replied: number;
  calls: number;
  closed: number;
  chain: number;
  record: number;
  quotaStreak: number;
};

const TARGETS: Record<AchievementId, { target: number; field: keyof AchievementInput }> = {
  sent25: { target: 25, field: 'sent' },
  sent100: { target: 100, field: 'sent' },
  sent500: { target: 500, field: 'sent' },
  replies10: { target: 10, field: 'replied' },
  replies50: { target: 50, field: 'replied' },
  calls5: { target: 5, field: 'calls' },
  closed1: { target: 1, field: 'closed' },
  closed5: { target: 5, field: 'closed' },
  chain7: { target: 7, field: 'chain' },
  chain30: { target: 30, field: 'chain' },
  record20: { target: 20, field: 'record' },
  quota10: { target: 10, field: 'quotaStreak' },
};

/**
 * Медали.
 *
 * Показываются все и всегда — в отличие от уровней, здесь туман не нужен:
 * достижение это не следующая ступень, а витрина. Видеть незакрытую полку
 * полезно, она сама подсказывает, чего не хватает.
 */
export function achievements(input: AchievementInput): Achievement[] {
  return ACHIEVEMENT_IDS.map((id) => {
    const { target, field } = TARGETS[id];
    const value = Math.max(0, input[field] ?? 0);
    return {
      id,
      value,
      target,
      done: value >= target,
      pct: Math.max(0, Math.min(100, Math.round((value / target) * 100))),
    };
  });
}

/** Воронка за всё время — общий вход для разбора и достижений. */
export function funnelTotals(contacts: OutreachContact[]) {
  return {
    sent: contacts.filter((c) => SENT_STATUSES.includes(c.status)).length,
    replied: contacts.filter((c) => REPLIED_STATUSES.includes(c.status)).length,
    calls: contacts.filter((c) => CALL_STATUSES.includes(c.status)).length,
    closed: contacts.filter((c) => c.status === 'closed').length,
  };
}

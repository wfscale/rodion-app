import { daysBetween } from '@/lib/date';
import type { ContactStatus } from '@/lib/types';

/**
 * Когда напомнить о себе.
 *
 * Смысл: рассылка вслепую — это то, что делают все. Разница начинается на
 * втором и третьем касании, когда человек видит, что им действительно
 * заинтересованы. Приложение должно само показывать, кого пора тронуть.
 *
 * Интервалы растут: часто в начале, реже потом. Так касания читаются как
 * настойчивость, а не как навязчивость.
 */

/** Шаги каскада для тех, кто молчит: 1 → 3 → 7 → 15 → 30 дней. */
export const SILENT_STEPS = [1, 3, 7, 15, 30] as const;

/** Диалог начался, но замер — напомнить через столько дней. */
export const REPLIED_IDLE_DAYS = 3;

/** Созвон назначен — напомнить за день. */
export const CALL_REMINDER_DAYS = 1;

export type FollowUpUrgency = 'none' | 'soon' | 'due' | 'overdue' | 'cold';

export type FollowUpState = {
  urgency: FollowUpUrgency;
  /** Через сколько дней наступит следующее касание. Отрицательное — просрочено. */
  daysUntil: number;
  /** Сколько дней прошло с последнего касания. */
  daysSinceTouch: number;
  /** Номер следующего касания (1 — первое напоминание после отправки). */
  nextTouchNumber: number;
};

/** Статусы, по которым напоминания не нужны вовсе. */
// Заблокировавшему писать некуда — это худший исход и конец истории.
const SILENT_IGNORED: ContactStatus[] = ['not_sent', 'refused', 'replied_no', 'blocked', 'closed'];

/**
 * Через сколько дней после последнего касания пора писать снова.
 * null — по этому статусу напоминания не предусмотрены.
 */
export function intervalFor(status: ContactStatus, touchCount: number): number | null {
  if (SILENT_IGNORED.includes(status)) return null;

  if (status === 'call') return CALL_REMINDER_DAYS;
  if (status === 'replied') return REPLIED_IDLE_DAYS;

  // sent / read — молчат. Шаг каскада зависит от числа уже сделанных касаний.
  const index = Math.max(0, touchCount - 1);
  if (index >= SILENT_STEPS.length) return null; // каскад исчерпан
  return SILENT_STEPS[index];
}

/**
 * Состояние касания на сегодня.
 *
 * urgency:
 *   none     — рано или не нужно
 *   soon     — остался день
 *   due      — сегодня
 *   overdue  — просрочено
 *   cold     — каскад исчерпан, человек остыл
 */
export function followUpState(input: {
  status: ContactStatus;
  lastTouchAt: string | null;
  touchCount: number;
  muted: boolean;
  today: string;
}): FollowUpState {
  const { status, lastTouchAt, touchCount, muted, today } = input;

  const daysSinceTouch = lastTouchAt ? Math.max(0, daysBetween(today, lastTouchAt)) : 0;
  const base: FollowUpState = {
    urgency: 'none',
    daysUntil: 0,
    daysSinceTouch,
    nextTouchNumber: (touchCount || 1) + 1,
  };

  if (muted || !lastTouchAt) return base;

  const interval = intervalFor(status, touchCount || 1);

  // Каскад исчерпан только у молчащих: с ними больше делать нечего.
  if (interval === null) {
    const exhausted = (status === 'sent' || status === 'read') && touchCount > SILENT_STEPS.length;
    return { ...base, urgency: exhausted ? 'cold' : 'none' };
  }

  const daysUntil = interval - daysSinceTouch;

  let urgency: FollowUpUrgency = 'none';
  if (daysUntil < 0) urgency = 'overdue';
  else if (daysUntil === 0) urgency = 'due';
  else if (daysUntil === 1) urgency = 'soon';

  return { ...base, urgency, daysUntil };
}

/** Нужен ли контакт в списке «сегодня коснуться». */
export function needsTouch(state: FollowUpState): boolean {
  return state.urgency === 'due' || state.urgency === 'overdue';
}

/**
 * Порядок в списке напоминаний: сначала самые просроченные.
 * Внутри одной срочности — кто дольше молчит.
 */
export function compareUrgency(a: FollowUpState, b: FollowUpState): number {
  const rank: Record<FollowUpUrgency, number> = {
    overdue: 0,
    due: 1,
    soon: 2,
    cold: 3,
    none: 4,
  };
  const byRank = rank[a.urgency] - rank[b.urgency];
  if (byRank !== 0) return byRank;
  return b.daysSinceTouch - a.daysSinceTouch;
}

/** Цвет подсветки строки в таблице. Возвращает CSS-цвет или null. */
export function urgencyColor(urgency: FollowUpUrgency): string | null {
  switch (urgency) {
    case 'overdue':
      return '#FF6B6B'; // просрочено — красный
    case 'due':
      return '#FFD166'; // сегодня — жёлтый
    case 'soon':
      return 'rgba(255,255,255,0.28)'; // завтра — едва заметно
    case 'cold':
      return 'rgba(255,255,255,0.12)'; // остыл — почти невидимо
    default:
      return null;
  }
}

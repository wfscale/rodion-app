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

/** Шаги каскада: 1 → 3 → 7 → 15 → 30 дней. */
export const TOUCH_STEPS = [1, 3, 7, 15, 30] as const;

/** Прежнее имя каскада — оставлено, чтобы не плодить два списка чисел. */
export const SILENT_STEPS = TOUCH_STEPS;

/** Созвон назначен — напомнить за день. */
export const CALL_REMINDER_DAYS = 1;

export type FollowUpUrgency = 'none' | 'soon' | 'due' | 'overdue' | 'cold';

/**
 * Почему человек в списке. Формулировка касания зависит от того, молчал он
 * вообще или ответил и пропал: это разные письма.
 */
export type FollowUpReason = 'silent' | 'replied' | 'call' | 'none';

export type FollowUpState = {
  urgency: FollowUpUrgency;
  reason: FollowUpReason;
  /** Через сколько дней наступит следующее касание. Отрицательное — просрочено. */
  daysUntil: number;
  /** Сколько дней прошло с последнего касания. */
  daysSinceTouch: number;
  /** Номер следующего касания (1 — первое напоминание после отправки). */
  nextTouchNumber: number;
};

/**
 * Статусы, по которым напоминаний нет вовсе.
 *
 * «Ответил — отказ» здесь потому, что человек уже сказал «нет» словами:
 * дожимать после явного отказа — это спам, а не настойчивость. Заблокировавшему
 * писать физически некуда, закрытый уже клиент.
 */
const NO_FOLLOWUP: ContactStatus[] = ['not_sent', 'replied_no', 'blocked', 'closed'];

/**
 * Статусы, которые ведут по каскаду 1/3/7/15/30.
 *
 * «Ответил» в этом списке намеренно: люди отвечают что-то вежливое и уходят
 * в игнор. Такой контакт теплее холодного и стоит дожима больше всех
 * остальных — тут разговор уже начат.
 */
const CASCADE_STATUSES: ContactStatus[] = ['sent', 'read', 'replied'];

/** Ведёт ли статус по каскаду касаний. */
export function isCascadeStatus(status: ContactStatus): boolean {
  return CASCADE_STATUSES.includes(status);
}

/** Почему контакт вообще требует касания. */
export function reasonFor(status: ContactStatus): FollowUpReason {
  if (status === 'call') return 'call';
  if (status === 'replied') return 'replied';
  if (status === 'sent' || status === 'read') return 'silent';
  return 'none';
}

/**
 * Через сколько дней после последнего касания пора писать снова.
 * null — по этому статусу напоминания не предусмотрены.
 */
export function intervalFor(status: ContactStatus, touchCount: number): number | null {
  if (NO_FOLLOWUP.includes(status)) return null;

  if (status === 'call') return CALL_REMINDER_DAYS;

  // sent / read / replied — шаг каскада зависит от числа сделанных касаний.
  const index = Math.max(0, touchCount - 1);
  if (index >= TOUCH_STEPS.length) return null; // каскад исчерпан
  return TOUCH_STEPS[index];
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
    reason: reasonFor(status),
    daysUntil: 0,
    daysSinceTouch,
    nextTouchNumber: (touchCount || 1) + 1,
  };

  if (muted || !lastTouchAt) return base;

  const interval = intervalFor(status, touchCount || 1);

  // Каскад исчерпан только у тех, кого он вёл: с остальными делать нечего.
  if (interval === null) {
    const exhausted = isCascadeStatus(status) && touchCount > TOUCH_STEPS.length;
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

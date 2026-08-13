import { bonusStepsReached } from '@/lib/quota';
import { onceKey, XP } from '@/lib/xp';
import type { ContactStatus } from '@/lib/types';

/**
 * Каскад реакций на действие пользователя.
 *
 * Вынесен из провайдера в чистую функцию намеренно: здесь легче всего
 * незаметно потерять начисление, показать оверлей дважды или наградить
 * за одно и то же по второму разу. Чистый вход-выход покрывается тестами.
 */

export type ToastTone = 'normal' | 'round' | 'record';
export type OverlayKind = 'quota' | 'first-reply' | 'first-call' | 'first-closed';
export type FxKind = 'add' | 'reply' | 'close';

export type GameEvent =
  | { kind: 'xp'; amount: number; reason: string; onceKey?: string }
  | { kind: 'toast'; textKey: string; vars?: Record<string, number>; tone: ToastTone }
  | { kind: 'overlay'; overlay: OverlayKind; xp: number }
  | { kind: 'fx'; fx: FxKind }
  | { kind: 'profile'; patch: Record<string, unknown> };

export type AddOutreachInput = {
  /** Сколько рассылок стало за сегодня ПОСЛЕ добавления. */
  sentToday: number;
  quota: number;
  /** Рекорд за всё время ДО этого добавления. */
  record: number;
  date: string;
  /** Уже начисленные бонусные пятёрки за сегодня. */
  awardedBonusSteps: number[];
};

/**
 * Что происходит при добавлении рассылки.
 *
 * Порядок событий важен: сначала базовый XP, затем рекорд, затем закрытие
 * квоты, затем бонусы сверх неё. Тост показывается ровно один — самый
 * значимый из случившегося, иначе экран превращается в фейерверк.
 */
export function onOutreachAdded(input: AddOutreachInput): GameEvent[] {
  const { sentToday, quota, record, date, awardedBonusSteps } = input;
  const events: GameEvent[] = [];

  events.push({ kind: 'fx', fx: 'add' });
  events.push({ kind: 'xp', amount: XP.OUTREACH_SENT, reason: 'outreach' });

  const isRecord = sentToday > record && sentToday > 0;
  const justClosedQuota = sentToday === quota;
  const isRound = sentToday > 0 && sentToday % 10 === 0;

  if (isRecord) {
    events.push({
      kind: 'xp',
      amount: XP.DAILY_RECORD,
      reason: 'record',
      onceKey: onceKey.record(date, sentToday),
    });
    events.push({ kind: 'profile', patch: { daily_record: sentToday } });
  }

  if (justClosedQuota) {
    events.push({
      kind: 'xp',
      amount: XP.QUOTA_DONE,
      reason: 'quota',
      onceKey: onceKey.quota(date),
    });
    events.push({ kind: 'overlay', overlay: 'quota', xp: XP.QUOTA_DONE });
  }

  // Бонус за каждые полные 5 сверх квоты. Начисляем только новые пятёрки.
  for (const step of bonusStepsReached(sentToday, quota)) {
    if (awardedBonusSteps.includes(step)) continue;
    events.push({
      kind: 'xp',
      amount: XP.BONUS_OVER_QUOTA,
      reason: 'bonus',
      onceKey: onceKey.bonus(date, step),
    });
  }

  // Ровно один тост, по убыванию значимости.
  if (isRecord) {
    events.push({ kind: 'toast', textKey: 'record', vars: { n: sentToday }, tone: 'record' });
  } else if (isRound) {
    events.push({ kind: 'toast', textKey: 'round', vars: { n: sentToday }, tone: 'round' });
  } else if (!justClosedQuota) {
    // При закрытии квоты тост не нужен — уже показывается полноэкранный оверлей.
    events.push({ kind: 'toast', textKey: 'added', vars: { n: XP.OUTREACH_SENT }, tone: 'normal' });
  }

  return events;
}

export type StatusChangeInput = {
  contactId: string;
  status: ContactStatus;
  /** Были ли у пользователя раньше события такого типа. */
  hadFirstReply: boolean;
  hadFirstCall: boolean;
  hadFirstClosed: boolean;
};

/** Сколько XP даёт переход в статус. Остальные статусы не награждаются. */
const STATUS_XP: Partial<Record<ContactStatus, { amount: number; reason: string }>> = {
  replied: { amount: XP.REPLIED, reason: 'replied' },
  call: { amount: XP.CALL, reason: 'call' },
  closed: { amount: XP.CLOSED, reason: 'closed' },
};

/**
 * Что происходит при продвижении контакта по воронке.
 *
 * XP привязан к паре «контакт + статус», поэтому вернуть контакт назад и
 * снова двинуть вперёд не даст повторного начисления.
 */
export function onStatusChanged(input: StatusChangeInput): GameEvent[] {
  const { contactId, status, hadFirstReply, hadFirstCall, hadFirstClosed } = input;
  const events: GameEvent[] = [];

  const reward = STATUS_XP[status];
  if (!reward) return events;

  events.push({ kind: 'fx', fx: status === 'closed' ? 'close' : 'reply' });
  events.push({
    kind: 'xp',
    amount: reward.amount,
    reason: reward.reason,
    onceKey: onceKey.contactStatus(contactId, status),
  });

  // Первое событие каждого типа за всю жизнь — полноэкранный оверлей.
  const nowIso = new Date().toISOString();

  if (status === 'replied' && !hadFirstReply) {
    events.push({ kind: 'overlay', overlay: 'first-reply', xp: XP.REPLIED });
    events.push({ kind: 'profile', patch: { first_reply_at: nowIso } });
  } else if (status === 'call' && !hadFirstCall) {
    events.push({ kind: 'overlay', overlay: 'first-call', xp: XP.CALL });
    events.push({ kind: 'profile', patch: { first_call_at: nowIso } });
  } else if (status === 'closed' && !hadFirstClosed) {
    events.push({ kind: 'overlay', overlay: 'first-closed', xp: XP.CLOSED });
    events.push({ kind: 'profile', patch: { first_closed_at: nowIso } });
  } else {
    // Не первое событие — обходимся тостом.
    events.push({
      kind: 'toast',
      textKey: reward.reason,
      vars: { n: reward.amount },
      tone: 'normal',
    });
  }

  return events;
}

/** Суммарный XP, который начислит набор событий (для тестов и отладки). */
export function totalXp(events: GameEvent[]): number {
  return events.reduce((sum, e) => (e.kind === 'xp' ? sum + e.amount : sum), 0);
}

/** Есть ли в наборе оверлей указанного вида. */
export function hasOverlay(events: GameEvent[], overlay: OverlayKind): boolean {
  return events.some((e) => e.kind === 'overlay' && e.overlay === overlay);
}

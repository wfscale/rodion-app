/**
 * Тексты push-уведомлений.
 *
 * Отдельным модулем и без React: их дёргает серверный роут по расписанию,
 * а покрыть тестами формулировки проще, чем ловить их на живых пушах.
 */

export type PushSlot = 'morning' | 'midday' | 'evening' | 'night';

export type PushInput = {
  slot: PushSlot;
  /** Рассылок за сегодня. */
  sent: number;
  /** Дневная квота. */
  quota: number;
  /** Рассылок за вчера. */
  sentYesterday: number;
  /** Вчерашняя квота — по ней судим, дотянул человек или нет. */
  quotaYesterday: number;
  /** Серия закрытых дней. */
  streak: number;
};

export type PushMessage = {
  title: string;
  body: string;
  tag: string;
  url: string;
};

/**
 * null означает «в этот слот писать нечего».
 * Вечером и днём молчим, если квота уже закрыта: дёргать человека, который
 * своё сделал, — верный способ научить его игнорировать уведомления.
 */
export function buildPush(input: PushInput): PushMessage | null {
  const { slot, sent, quota, sentYesterday, quotaYesterday, streak } = input;

  if (slot === 'morning') {
    const done = sentYesterday >= quotaYesterday && quotaYesterday > 0;
    return {
      title: 'Твой рост',
      body: done
        ? `Вчера: ${sentYesterday} рассылок. Сегодня квота ${quota}. Начинай.`
        : `Вчера не дотянул. Сегодня закрываешь. ${quota} рассылок.`,
      tag: 'quota',
      url: '/',
    };
  }

  if (slot === 'midday') {
    if (sent >= quota) return null;
    const pct = quota > 0 ? sent / quota : 0;
    const body =
      pct < 0.3
        ? `Только ${sent} из ${quota}. Полдня прошло. Садись.`
        : pct <= 0.7
          ? `${sent} из ${quota}. Хорошо. Не останавливайся.`
          : `${sent} из ${quota}. Почти. Добей.`;
    return { title: 'Твой рост', body, tag: 'quota', url: '/' };
  }

  if (slot === 'evening') {
    return sent >= quota
      ? {
          title: 'Твой рост',
          body: `Закрыл ${quota}. Стрик: ${streak} дней. Завтра квота растёт.`,
          tag: 'quota',
          url: '/',
        }
      : {
          title: 'Твой рост',
          body: `${sent} из ${quota}. Завтра с нуля. Квота та же — ещё шанс.`,
          tag: 'quota',
          url: '/',
        };
  }

  // Ночной чекин режима — единственное уведомление, которое требует ответа.
  return {
    title: 'Сегодня держался?',
    body: 'Отметь вечерний чекин режима.',
    tag: 'mode',
    url: '/progress',
  };
}

/** Час по местному времени пользователя, в который отправляется слот. */
export const SLOT_HOURS: Record<PushSlot, number> = {
  morning: 9,
  midday: 14,
  evening: 20,
  night: 23,
};

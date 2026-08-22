import { CALL_STATUSES, SENT_STATUSES, normalizeStatus } from '@/lib/types';
import type { ContactStatus, StatusHistoryEntry } from '@/lib/types';

/**
 * Прогноз по собственной конверсии.
 *
 * Единственный честный ответ на вопрос «сколько ещё писать». Не обещание, а
 * арифметика: прошлый созвон стоил столько-то рассылок, значит следующий
 * будет стоить примерно столько же.
 *
 * Смысл именно в этом кадре: «70 рассылок — одно закрытие» превращает
 * бесконечную работу в понятную цену. Пока цена не названа, каждая
 * неотвеченная рассылка ощущается провалом; названная — она просто
 * очередной шаг из семидесяти.
 *
 * Счётчик обязан идти вниз. Поэтому «осталось» считается от последнего
 * реального события, а не как остаток от средней: средняя растёт вместе с
 * молчанием, и счётчик полз бы вверх — ровно то ощущение, ради снятия
 * которого он и делается.
 */

/** Ниже этого числа рассылок конверсия — шум, а не статистика. */
export const FORECAST_MIN_SENT = 10;

export type ForecastContact = {
  status: ContactStatus | string;
  first_contact_date: string;
  status_history?: StatusHistoryEntry[] | null;
};

export type ForecastLine = {
  /** Событий за всё время. */
  count: number;
  /** Во сколько рассылок обходится одно событие. 0 — событий не было. */
  per: number;
  /** Рассылок с последнего события. */
  since: number;
  /** Сколько ещё писать по этой же цене. 0 — по арифметике уже пора. */
  left: number;
};

export type Forecast = {
  sent: number;
  /** Хватает ли данных, чтобы вообще считать. */
  enough: boolean;
  call: ForecastLine;
  close: ForecastLine;
};

const EMPTY_LINE: ForecastLine = { count: 0, per: 0, since: 0, left: 0 };

/**
 * Когда контакт впервые дошёл до одного из статусов.
 *
 * Берётся самая ранняя запись истории: контакт мог уйти в созвон, вернуться
 * и уйти снова, но заплачено за него было один раз — в первый.
 */
export function reachedAt(
  contact: ForecastContact,
  statuses: ContactStatus[],
): string | null {
  const history = contact.status_history ?? [];
  const hits = history
    .filter((entry) => statuses.includes(normalizeStatus(entry.status)))
    .map((entry) => (entry.at ?? '').slice(0, 10))
    .filter(Boolean)
    .sort();

  if (hits.length > 0) return hits[0];

  // Истории может не быть у строк, заведённых до её появления. Тогда днём
  // события считаем день касания: занижать цену события хуже, чем завысить.
  return statuses.includes(normalizeStatus(contact.status))
    ? contact.first_contact_date
    : null;
}

function lineFor(
  /** Все дошедшие рассылки — по ним считается «сколько прошло с последнего». */
  reached: ForecastContact[],
  /** Только те, кто дошёл до события. */
  events: ForecastContact[],
  statuses: ContactStatus[],
): ForecastLine {
  const sent = reached.length;

  const dates = events
    .map((contact) => reachedAt(contact, statuses))
    .filter((date): date is string => Boolean(date))
    .sort();

  const count = dates.length;
  if (count === 0 || sent === 0) return EMPTY_LINE;

  const last = dates[dates.length - 1];

  /*
   * Цена события считается по рассылкам ДО последнего события, а не по всем.
   *
   * Иначе средняя растёт ровно с той же скоростью, с какой копится «прошло
   * с последнего», и остаток стоит на месте: сколько ни пиши, всегда
   * «осталось три». Замороженная на момент события цена даёт то, ради чего
   * счётчик и нужен, — он идёт вниз с каждой рассылкой.
   */
  const upTo = reached.filter((contact) => contact.first_contact_date <= last).length;
  const per = Math.max(1, Math.round(upTo / count));

  // Рассылки, сделанные строго после дня последнего события. Тот же день не
  // считаем: рассылка и событие в одну дату — это, скорее всего, оно и есть.
  const since = reached.filter((contact) => contact.first_contact_date > last).length;

  return { count, per, since, left: Math.max(0, per - since) };
}

export function forecast(contacts: ForecastContact[]): Forecast {
  const reached = contacts.filter((contact) =>
    SENT_STATUSES.includes(normalizeStatus(contact.status)),
  );
  const sent = reached.length;

  const callContacts = contacts.filter((contact) =>
    CALL_STATUSES.includes(normalizeStatus(contact.status)),
  );
  const closedContacts = contacts.filter(
    (contact) => normalizeStatus(contact.status) === 'closed',
  );

  return {
    sent,
    enough: sent >= FORECAST_MIN_SENT,
    call: lineFor(reached, callContacts, CALL_STATUSES),
    close: lineFor(reached, closedContacts, ['closed']),
  };
}

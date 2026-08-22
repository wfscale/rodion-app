/**
 * Заготовки — готовые сообщения, которые отправляют не один раз.
 *
 * Между «ответил» и «созвон» теряется больше людей, чем на самой рассылке, и
 * теряется на одних и тех же вопросах: сколько стоит, что конкретно делаешь,
 * покажи кейсы. Каждый такой ответ набирается заново, вечером — хуже, а на
 * десятом за день совсем плохо.
 *
 * Отсюда правило раздела: заготовку пишут один раз, а отдаёт она при каждом
 * ответе. Ровно поэтому она стоит там, где раньше было пусто: заметки просят
 * что-то написать, ничего не обещая взамен, и потому не открывались месяцами.
 */

export type SnippetLike = {
  used_count: number;
  last_used_at: string | null;
  created_at: string;
};

/**
 * Порядок списка: чем чаще пользуешься, тем выше.
 *
 * Ручной сортировки нет намеренно. Наверх заготовка попадает работой, а не
 * тем, что её перетащили, — иначе через месяц список снова придётся разбирать.
 * При равном счёте выше та, которой пользовались позже: одинаково частые
 * заготовки различает свежесть, а не случайный порядок из базы.
 */
export function sortSnippets<T extends SnippetLike>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const used = (b.used_count ?? 0) - (a.used_count ?? 0);
    if (used !== 0) return used;

    const last = (b.last_used_at ?? '').localeCompare(a.last_used_at ?? '');
    if (last !== 0) return last;

    return (b.created_at ?? '').localeCompare(a.created_at ?? '');
  });
}

/**
 * Однострочный предпросмотр.
 *
 * Берётся первая непустая строка, а не первые N символов: заготовки часто
 * начинаются с обращения на отдельной строке, и обрезка по символам показала
 * бы у всех одно и то же «Привет!».
 */
export function snippetPreview(content: string, max = 90): string {
  const line = (content ?? '')
    .split('\n')
    .map((part) => part.trim())
    .find((part) => part.length > 0);

  if (!line) return '';
  return line.length > max ? `${line.slice(0, max).trimEnd()}…` : line;
}

/** Сколько всего раз заготовками пользовались. */
export function totalUses(list: SnippetLike[]): number {
  return list.reduce((sum, item) => sum + Math.max(0, item.used_count ?? 0), 0);
}

/**
 * База: люди, найденные, но ещё не написанные.
 *
 * Рассылка распадается на два разных занятия — «найти двадцать аккаунтов» и
 * «написать двадцати людям». Раньше они шли вперемешку: нашёл, написал,
 * снова ищешь. Каждое переключение стоит внимания, и к десятому человеку
 * его не остаётся.
 *
 * Поэтому база собирается отдельно и живёт до тех пор, пока по ней не
 * пройдёшь. Отдельной таблицы у неё нет: база — это контакты со статусом
 * not_sent, который в шкале был с самого начала. Написал — статус меняется,
 * и человек уходит в общий список. Не нашёл личку — удаляется.
 */

/** Что удалось вытащить из одной строки вставленного списка. */
export type ParsedLead = {
  /** Ник без собаки и без домена. */
  handle: string;
  /** Ссылка на профиль целиком. */
  instagram_url: string;
};

/**
 * Ник из чего угодно, что похоже на инстаграм.
 *
 * Вставляют по-разному: полной ссылкой из адресной строки, ссылкой из
 * профиля с хвостом ?igsh=..., просто ником с собакой и без. Разбирать это
 * руками — двадцать правок на двадцать строк, то есть ровно та работа,
 * которой вставка списком и должна избавить.
 */
export function parseHandle(raw: string): string | null {
  let value = (raw ?? '').trim();
  if (!value) return null;

  // Мусор вокруг: кавычки, запятые, точки с запятой из скопированной таблицы.
  value = value.replace(/^["'`(<\[]+/, '').replace(/["'`)>\],;]+$/, '');
  if (!value) return null;

  // Ссылка: берём последний непустой сегмент пути до знака вопроса.
  const link = value.match(/(?:instagram\.com|instagr\.am)\/([^/?#\s]+)/i);
  if (link) value = link[1];
  else if (/^https?:\/\//i.test(value) || value.includes('/')) {
    // Ссылка есть, но не на инстаграм — это не лид, а что-то чужое.
    if (!/^@?[\w.]+$/.test(value)) return null;
  }

  value = value.replace(/^@+/, '').trim();

  // Служебные пути инстаграма ником не являются.
  if (/^(p|reel|reels|stories|explore|accounts|direct)$/i.test(value)) return null;

  // Ник инстаграма: буквы, цифры, точка и подчёркивание, до 30 знаков.
  if (!/^[A-Za-z0-9._]{1,30}$/.test(value)) return null;
  // Из одних точек ника не бывает — это остаток разметки.
  if (!/[A-Za-z0-9_]/.test(value)) return null;

  return value.toLowerCase();
}

/** Ссылка на профиль по нику. */
export function instagramUrl(handle: string): string {
  return `https://instagram.com/${handle}`;
}

/**
 * Разбор вставленного списка.
 *
 * known — ники, которые уже есть: и в базе, и среди написанных. Повтор
 * означал бы второе сообщение тому же человеку, а это худшее, что можно
 * сделать с холодной базой.
 */
export function parseLeads(text: string, known: Iterable<string> = []): ParsedLead[] {
  const seen = new Set<string>();
  for (const item of known) {
    const handle = parseHandle(item);
    if (handle) seen.add(handle);
  }

  const result: ParsedLead[] = [];

  // Разделителем считаем не только перевод строки: список часто прилетает
  // одной строкой через запятую или пробел.
  for (const chunk of (text ?? '').split(/[\n\r,;\t ]+/)) {
    const handle = parseHandle(chunk);
    if (!handle || seen.has(handle)) continue;
    seen.add(handle);
    result.push({ handle, instagram_url: instagramUrl(handle) });
  }

  return result;
}

/** Сколько строк вставили и сколько из них стало лидами. */
export type LeadIntakeSummary = { added: number; skipped: number };

export function summarizeIntake(text: string, parsed: ParsedLead[]): LeadIntakeSummary {
  const lines = (text ?? '')
    .split(/[\n\r,;\t ]+/)
    .map((part) => part.trim())
    .filter(Boolean).length;

  return { added: parsed.length, skipped: Math.max(0, lines - parsed.length) };
}

/**
 * Ник телеграма из чего угодно.
 *
 * Ник ищут в шапке инстаграма и приносят сюда как придётся: копией из био
 * («@ivanov»), ссылкой из кнопки («https://t.me/ivanov?start=1»), просто
 * словом. Собаку при этом приходится дописывать руками — на двадцати
 * людях это двадцать лишних движений ровно там, где всё и должно быть
 * быстрым.
 *
 * Здесь собака снимается всегда: в поле её рисует сам интерфейс, а хранится
 * и уходит в ссылку голый ник.
 */
export function parseTelegram(raw: string): string {
  let value = (raw ?? '').trim();
  if (!value) return '';

  value = value.replace(/^["'`(<\[]+/, '').replace(/["'`)>\],;]+$/, '');

  // Ссылка любого вида: t.me, telegram.me, telegram.dog, с протоколом и без.
  const link = value.match(/(?:t\.me|telegram\.me|telegram\.dog)\/([^/?#\s]+)/i);
  if (link) value = link[1];

  // Приглашения в каналы ником не являются.
  if (/^(joinchat|\+)/i.test(value)) return '';

  value = value.replace(/^@+/, '').replace(/[^A-Za-z0-9_]/g, '');

  return value.slice(0, 32);
}

/**
 * Какой текст записать человеку при отправке.
 *
 * Свой, если он написан; иначе заготовка, которая стояла в тот момент.
 * Пустую строку не записываем: «оффер неизвестен» и «оффер пустой» — разные
 * вещи, и вторая не должна выглядеть как первая.
 *
 * Записывается всегда, а не только когда текст правили руками: иначе через
 * неделю у половины ответивших не будет видно, на что они ответили.
 */
export function offerForSend(
  own: string | null | undefined,
  fallback: string | null | undefined,
): string | null {
  const mine = (own ?? '').trim();
  if (mine) return mine;
  const base = (fallback ?? '').trim();
  return base || null;
}

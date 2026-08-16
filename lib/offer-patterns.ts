import { REPLIED_STATUSES, normalizeStatus, type ContactStatus } from '@/lib/types';

/**
 * Разбор офферов: что общего у текстов, на которые отвечают.
 *
 * Здесь нет никакой магии и нет нейросети — только честная арифметика по
 * твоим собственным сообщениям. Каждый признак это правило, которое можно
 * проверить глазами: «есть личное наблюдение», «есть вопрос», «короткий».
 * Дальше считается доля ответов с признаком и без него, и разница между
 * ними и есть ответ на вопрос «что работает».
 *
 * Отказ считается ответом намеренно. Человек прочитал и не смог промолчать —
 * значит текст пробил тишину. Это ровно тот признак, который стоит повторять;
 * договариваться будешь дальше, но сначала надо, чтобы отвечали.
 */

export const PATTERN_IDS = [
  'personal',
  'greeting',
  'question',
  'numbers',
  'short',
  'long',
  'sincere',
  'compliment',
  'problem',
  'value',
  'cta',
  'link',
  'emoji',
  'structured',
] as const;

export type PatternId = (typeof PATTERN_IDS)[number];

/** Сколько офферов нужно с обеих сторон, чтобы вывод не был случайностью. */
export const MIN_SAMPLE = 3;

/** Короткий оффер — до 400 символов, длинный — от 900. */
export const SHORT_LIMIT = 400;
export const LONG_LIMIT = 900;

const EMOJI =
  /[\u{1F300}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;

/** Есть ли в тексте хоть одно слово из набора. */
function has(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

/**
 * Правила распознавания. Все проверки идут по тексту в нижнем регистре,
 * корнями без окончаний — русский язык в переписке склоняется как попало.
 */
const TESTS: Record<PatternId, (lower: string, raw: string) => boolean> = {
  // Личное наблюдение: видно, что смотрел именно этого человека.
  personal: (lower) =>
    has(lower, [
      'смотрел', 'посмотрел', 'видел', 'читал', 'слушал', 'наткнул', 'заметил',
      'подписан', 'у тебя', 'у вас', 'твой', 'твоя', 'твои', 'твоё', 'твое',
      'ваш', 'ваша', 'ваши',
    ]),

  // Обращение и приветствие в начале, а не сразу текст с ноги.
  greeting: (lower) =>
    /^\s*(привет|здравств|добрый (день|вечер)|доброе утро|хай|hi|hello)/.test(lower),

  question: (_lower, raw) => raw.includes('?'),

  // Конкретика: цифры, проценты, суммы. Абстракции не цепляют.
  numbers: (_lower, raw) => /\d/.test(raw),

  short: (_lower, raw) => raw.trim().length > 0 && raw.trim().length <= SHORT_LIMIT,
  long: (_lower, raw) => raw.trim().length >= LONG_LIMIT,

  // Искренность: живая речь вместо шаблона.
  sincere: (lower) =>
    has(lower, [
      'честно', 'искренне', 'по факту', 'реально', 'правда', 'зацепил', 'кайф',
      'откликнул', 'мне понравил', 'от души', 'без воды', 'не буду душнить',
    ]),

  compliment: (lower) =>
    has(lower, [
      'круто', 'классно', 'сильно', 'мощно', 'нравит', 'понравил', 'топ',
      'красиво', 'здорово', 'уважа', 'респект',
    ]),

  // Названа проблема — есть за что зацепиться.
  problem: (lower) =>
    has(lower, [
      'проблем', 'не хватает', 'теряеш', 'упуска', 'слаб', 'боль', 'сложно',
      'мало ', 'просад', 'не доход', 'сливаеш', 'буксу',
    ]),

  // Обещан результат в деньгах или цифрах.
  value: (lower) =>
    has(lower, [
      'выручк', 'продаж', 'заработ', 'доход', 'прибыл', 'рост', 'конверси',
      'окуп', 'х2', 'x2', 'запуск', 'результат',
    ]),

  // Есть понятный следующий шаг.
  cta: (lower) =>
    has(lower, [
      'давай', 'предлага', 'могу ', 'скину', 'накидаю', 'покажу', 'созвон',
      'созвонимся', 'интересно', 'напиши', 'если откликнет', 'обсуд',
    ]),

  link: (lower) => lower.includes('http') || lower.includes('t.me/') || lower.includes('.com/'),

  emoji: (_lower, raw) => EMOJI.test(raw),

  // Разбит на абзацы, а не сплошная стена.
  structured: (_lower, raw) => raw.includes('\n\n') || (raw.match(/\n/g) ?? []).length >= 2,
};

/** Какие признаки есть у конкретного текста. */
export function patternsOf(content: string): PatternId[] {
  const raw = content ?? '';
  const lower = raw.toLowerCase();
  return PATTERN_IDS.filter((id) => TESTS[id](lower, raw));
}

export type PatternSample = {
  content: string;
  result: ContactStatus | string;
};

export type PatternRow = {
  id: PatternId;
  /** Офферов с признаком. */
  withCount: number;
  withReplies: number;
  withRate: number;
  /** Офферов без признака. */
  withoutCount: number;
  withoutReplies: number;
  withoutRate: number;
  /** Разница долей в процентных пунктах. Положительная — признак помогает. */
  lift: number;
  /** Хватает ли выборки, чтобы верить цифре. */
  reliable: boolean;
};

/** Дошёл ли оффер до ответа. Отказ — тоже ответ. */
export function isReplied(result: ContactStatus | string): boolean {
  return REPLIED_STATUSES.includes(normalizeStatus(String(result)));
}

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/**
 * Сравнительная таблица признаков.
 *
 * Сортировка: сначала то, чему можно верить, внутри — по силе влияния.
 * Признаки, которых нет ни в одном оффере, выпадают: пустая строка в таблице
 * ничего не сообщает.
 */
export function comparePatterns(samples: PatternSample[]): PatternRow[] {
  const total = samples.length;
  if (total === 0) return [];

  const parsed = samples.map((sample) => ({
    ids: new Set(patternsOf(sample.content)),
    replied: isReplied(sample.result),
  }));

  const rows: PatternRow[] = [];

  for (const id of PATTERN_IDS) {
    let withCount = 0;
    let withReplies = 0;
    let withoutCount = 0;
    let withoutReplies = 0;

    for (const item of parsed) {
      if (item.ids.has(id)) {
        withCount += 1;
        if (item.replied) withReplies += 1;
      } else {
        withoutCount += 1;
        if (item.replied) withoutReplies += 1;
      }
    }

    if (withCount === 0) continue;

    const withRate = pct(withReplies, withCount);
    const withoutRate = pct(withoutReplies, withoutCount);

    rows.push({
      id,
      withCount,
      withReplies,
      withRate,
      withoutCount,
      withoutReplies,
      withoutRate,
      lift: withRate - withoutRate,
      reliable: withCount >= MIN_SAMPLE && withoutCount >= MIN_SAMPLE,
    });
  }

  return rows.sort((a, b) => {
    if (a.reliable !== b.reliable) return a.reliable ? -1 : 1;
    const byLift = Math.abs(b.lift) - Math.abs(a.lift);
    if (byLift !== 0) return byLift;
    return b.withCount - a.withCount;
  });
}

export type LengthBucket = 'short' | 'medium' | 'long';

export type LengthRow = {
  bucket: LengthBucket;
  count: number;
  replies: number;
  rate: number;
};

/** Длина текста как отдельная ось: короткие, средние, длинные. */
export function bucketOf(content: string): LengthBucket {
  const length = (content ?? '').trim().length;
  if (length <= SHORT_LIMIT) return 'short';
  if (length >= LONG_LIMIT) return 'long';
  return 'medium';
}

export function compareLengths(samples: PatternSample[]): LengthRow[] {
  const order: LengthBucket[] = ['short', 'medium', 'long'];
  const map = new Map<LengthBucket, { count: number; replies: number }>(
    order.map((bucket) => [bucket, { count: 0, replies: 0 }]),
  );

  for (const sample of samples) {
    const cell = map.get(bucketOf(sample.content));
    if (!cell) continue;
    cell.count += 1;
    if (isReplied(sample.result)) cell.replies += 1;
  }

  return order
    .map((bucket) => {
      const cell = map.get(bucket) ?? { count: 0, replies: 0 };
      return { bucket, count: cell.count, replies: cell.replies, rate: pct(cell.replies, cell.count) };
    })
    .filter((row) => row.count > 0);
}

export type PatternSummary = {
  total: number;
  replied: number;
  rate: number;
  /** Признак с самым сильным положительным влиянием, если он надёжен. */
  best: PatternRow | null;
  /** Признак, который заметно мешает. */
  worst: PatternRow | null;
};

export function summarize(samples: PatternSample[], rows: PatternRow[]): PatternSummary {
  const total = samples.length;
  const replied = samples.filter((sample) => isReplied(sample.result)).length;

  const reliable = rows.filter((row) => row.reliable);
  const best = reliable.filter((row) => row.lift > 0)[0] ?? null;

  const negatives = reliable.filter((row) => row.lift < 0);
  const worst = negatives.length > 0
    ? negatives.reduce((min, row) => (row.lift < min.lift ? row : min))
    : null;

  return { total, replied, rate: pct(replied, total), best, worst };
}

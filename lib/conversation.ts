/**
 * Переписка с экспертом: хранение, разбор пасты из Telegram и правила диалога.
 *
 * Оффер решает, ответят ли вообще. Дальше решает переписка — и именно там
 * теряется большинство: человек ответил, разговор ушёл в монолог, последнее
 * слово осталось за ним, и контакт тихо умер. Здесь нет нейросети: каждое
 * правило ниже можно проверить глазами по своей же переписке, и именно
 * поэтому им можно верить.
 */

export type MessageRole = 'me' | 'them';

export type ChatMessage = {
  role: MessageRole;
  text: string;
};

/** Максимум сообщений в одной переписке: дальше это уже не разбор, а архив. */
export const MAX_MESSAGES = 200;

/* -------------------------------------------------------------------------- */
/*  Чтение и запись                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Приводит значение из базы к массиву сообщений.
 *
 * Колонка jsonb может содержать что угодно: null у старых строк, объект
 * вместо массива после ручной правки, мусор из будущей версии. Всё, что не
 * похоже на сообщение, отбрасывается молча — падать из-за одной битой
 * записи переписка не должна.
 */
export function parseMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];

  const messages: ChatMessage[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const text = typeof row.text === 'string' ? row.text.trim() : '';
    if (!text) continue;
    messages.push({ role: row.role === 'them' ? 'them' : 'me', text });
  }

  return messages.slice(0, MAX_MESSAGES);
}

/* -------------------------------------------------------------------------- */
/*  Разбор вставленной переписки                                               */
/* -------------------------------------------------------------------------- */

export type ChatBlock = { author: string; text: string };

/**
 * Заголовок сообщения в экспорте Telegram: «Имя, [16.08.2025 14:03]».
 *
 * Имя берётся до последней запятой: у людей в никнеймах запятые встречаются,
 * а вот скобка с датой стоит строго в конце строки.
 */
const CHAT_HEADER = /^(.+),\s*\[[^\]]*\]\s*$/;

/**
 * Разбирает вставленную переписку на блоки «кто — что сказал».
 *
 * Работает с экспортом Telegram; если заголовков не нашлось, возвращает
 * пустой список — вызывающий тогда просто добавит текст одним сообщением.
 * Угадывать, где чья реплика, без заголовков нельзя: ошибка здесь молча
 * испортит весь дальнейший разбор.
 */
export function parseChat(raw: string): ChatBlock[] {
  const lines = (raw ?? '').replace(/\r\n/g, '\n').split('\n');

  const blocks: ChatBlock[] = [];
  let author: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (author === null) return;
    const text = buffer.join('\n').trim();
    if (text) blocks.push({ author, text });
    buffer = [];
  };

  for (const line of lines) {
    const header = CHAT_HEADER.exec(line.trim());
    if (header) {
      flush();
      author = header[1].trim();
      continue;
    }
    if (author !== null) buffer.push(line);
  }
  flush();

  return blocks.slice(0, MAX_MESSAGES);
}

/** Имена собеседников в порядке первого появления. */
export function authorsOf(blocks: ChatBlock[]): string[] {
  const seen: string[] = [];
  for (const block of blocks) {
    if (!seen.includes(block.author)) seen.push(block.author);
  }
  return seen;
}

/** Превращает блоки в сообщения: указанный автор — это ты, остальные — эксперт. */
export function assignRoles(blocks: ChatBlock[], me: string): ChatMessage[] {
  return blocks.map((block) => ({
    role: block.author === me ? 'me' : 'them',
    text: block.text,
  }));
}

/* -------------------------------------------------------------------------- */
/*  Метрики диалога                                                            */
/* -------------------------------------------------------------------------- */

export type ChatMetrics = {
  total: number;
  mine: number;
  theirs: number;
  /** Средняя длина твоего сообщения в символах. */
  myLength: number;
  theirLength: number;
  /** Самая длинная серия твоих сообщений подряд. */
  longestMonologue: number;
  /** Сколько твоих сообщений содержат вопрос. */
  myQuestions: number;
  /** Кто написал последним. null — переписки нет. */
  lastRole: MessageRole | null;
  /** Есть ли вопрос в твоём последнем сообщении. */
  endsWithQuestion: boolean;
};

function averageLength(messages: ChatMessage[]): number {
  if (messages.length === 0) return 0;
  const sum = messages.reduce((total, message) => total + message.text.trim().length, 0);
  return Math.round(sum / messages.length);
}

export function chatMetrics(messages: ChatMessage[]): ChatMetrics {
  const mine = messages.filter((message) => message.role === 'me');
  const theirs = messages.filter((message) => message.role === 'them');

  let longestMonologue = 0;
  let run = 0;
  for (const message of messages) {
    run = message.role === 'me' ? run + 1 : 0;
    if (run > longestMonologue) longestMonologue = run;
  }

  const last = messages[messages.length - 1] ?? null;
  const lastMine = [...mine].pop() ?? null;

  return {
    total: messages.length,
    mine: mine.length,
    theirs: theirs.length,
    myLength: averageLength(mine),
    theirLength: averageLength(theirs),
    longestMonologue,
    myQuestions: mine.filter((message) => message.text.includes('?')).length,
    lastRole: last?.role ?? null,
    endsWithQuestion: Boolean(lastMine?.text.includes('?')),
  };
}

/* -------------------------------------------------------------------------- */
/*  Разбор: что пошло не так                                                   */
/* -------------------------------------------------------------------------- */

export const CHAT_ISSUE_IDS = [
  'monologue',   // три и больше своих сообщений подряд
  'wall',        // твои сообщения втрое длиннее его
  'noQuestion',  // ни одного вопроса за всю переписку
  'deadEnd',     // последнее слово твоё и без вопроса
  'ballTheirs',  // ответил он, а ты молчишь
  'oneSided',    // говоришь в основном ты
] as const;

export type ChatIssueId = (typeof CHAT_ISSUE_IDS)[number];

/**
 * Что мешает переписке дойти до созвона.
 *
 * Порядок — по тому, насколько дорого обходится ошибка: неотвеченное
 * сообщение эксперта стоит сделки прямо сейчас, а слишком длинные реплики
 * стоят её медленно. Список намеренно короткий: шесть правил можно держать
 * в голове, двадцать — нельзя, и тогда не работает ни одно.
 */
/**
 * Своё сообщение считается длинным от этой отметки.
 *
 * Без абсолютного порога правило ловит нормальный разговор: человек ответил
 * «да», ты написал две строки — и формально уже «втрое длиннее». Замечание
 * должно срабатывать на стене текста, а не на односложной реплике собеседника.
 */
const WALL_LENGTH = 300;

/** Меньше этого числа своих сообщений перекос ещё не виден. */
const ONE_SIDED_MIN = 4;

export function chatIssues(metrics: ChatMetrics): ChatIssueId[] {
  if (metrics.total === 0) return [];

  const issues: ChatIssueId[] = [];

  if (metrics.lastRole === 'them') issues.push('ballTheirs');
  if (metrics.lastRole === 'me' && !metrics.endsWithQuestion) issues.push('deadEnd');
  if (metrics.longestMonologue >= 3) issues.push('monologue');
  if (metrics.mine > 0 && metrics.myQuestions === 0) issues.push('noQuestion');

  // Втрое — не придирка: на такой разнице человек перестаёт читать целиком
  // и отвечает на последнюю строку, а не на смысл. Но только если твои
  // сообщения длинные сами по себе (см. WALL_LENGTH).
  if (
    metrics.theirs > 0 &&
    metrics.theirLength > 0 &&
    metrics.myLength >= WALL_LENGTH &&
    metrics.myLength >= metrics.theirLength * 3
  ) {
    issues.push('wall');
  }

  // Считаем только там, где диалог вообще состоялся и накопился: «два против
  // одного» — это ещё не перекос, это начало разговора.
  if (
    metrics.theirs > 0 &&
    metrics.mine >= ONE_SIDED_MIN &&
    metrics.mine >= metrics.theirs * 2
  ) {
    issues.push('oneSided');
  }

  return issues;
}

/**
 * Оценка переписки, 0..100.
 *
 * Нужна не ради цифры, а ради сравнения: один и тот же диалог до правок и
 * после должен давать разные числа, иначе разбор нечем закрыть.
 */
export function chatScore(metrics: ChatMetrics): number {
  if (metrics.total === 0) return 0;

  const penalties: Record<ChatIssueId, number> = {
    ballTheirs: 30,
    deadEnd: 20,
    monologue: 15,
    noQuestion: 15,
    wall: 10,
    oneSided: 10,
  };

  const lost = chatIssues(metrics).reduce((sum, id) => sum + penalties[id], 0);
  return Math.max(0, 100 - lost);
}

/* -------------------------------------------------------------------------- */
/*  Сводка по всем перепискам                                                  */
/* -------------------------------------------------------------------------- */

export type ChatDigest = {
  /** Контактов с сохранённой перепиской. */
  chats: number;
  averageScore: number;
  /** Сколько раз встретилась каждая ошибка. */
  counts: Record<ChatIssueId, number>;
  /** Самая частая ошибка. null — переписок нет или ошибок не нашлось. */
  worst: ChatIssueId | null;
  /** Сколько переписок ждут твоего ответа прямо сейчас. */
  waiting: number;
};

export function digestChats(conversations: ChatMessage[][]): ChatDigest {
  const counts = Object.fromEntries(CHAT_ISSUE_IDS.map((id) => [id, 0])) as Record<
    ChatIssueId,
    number
  >;

  let chats = 0;
  let scoreSum = 0;
  let waiting = 0;

  for (const messages of conversations) {
    if (messages.length === 0) continue;
    chats += 1;

    const metrics = chatMetrics(messages);
    scoreSum += chatScore(metrics);

    for (const id of chatIssues(metrics)) {
      counts[id] += 1;
      if (id === 'ballTheirs') waiting += 1;
    }
  }

  let worst: ChatIssueId | null = null;
  for (const id of CHAT_ISSUE_IDS) {
    if (counts[id] === 0) continue;
    if (worst === null || counts[id] > counts[worst]) worst = id;
  }

  return {
    chats,
    averageScore: chats > 0 ? Math.round(scoreSum / chats) : 0,
    counts,
    worst,
    waiting,
  };
}

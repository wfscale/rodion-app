/**
 * Сессия фокуса — «на что я сейчас смотрю и сколько минут».
 *
 * Механизм один на два сценария, и это принципиально. Час только на
 * рассылки и два часа на конкретную задачу — это одно и то же действие:
 * человек закрывает себе выбор на отрезок времени. Отличается только то,
 * чем заход кончается: у задачи — отметкой «сделано», у рассылок — числом,
 * которое хочется побить в следующий раз.
 *
 * Сама сессия нигде не хранится дольше браузера: заход, который пережил
 * закрытую вкладку и три дня, — это не заход, а мусор в базе. Пережить
 * обязана только пара чисел рекорда, и она лежит в профиле.
 *
 * XP за спринт не начисляется. Рассылки внутри спринта уже дают свои 8 XP
 * каждая, и вторая выплата за то же действие просто удвоила бы шкалу.
 * Награда здесь другая — рекорд и момент, когда его перебиваешь.
 */

export type SessionKind = 'task' | 'outreach';

export type Session = {
  id: string;
  kind: SessionKind;
  /** Текст задачи или «Рассылки» — то, что видно в строке фокуса. */
  label: string;
  minutes: number;
  /** epoch ms. Остаток всегда считается от него, а не тикающим счётчиком. */
  startedAt: number;
  /** Что отметить выполненным, когда время выйдет. */
  taskId?: string;
  taskSource?: 'day' | 'project';
  /** Сколько рассылок было на старте — чтобы посчитать сделанное за заход. */
  sentAtStart?: number;
};

/** Чем кончился заход. */
export type SessionEndReason = 'time' | 'stopped';

export type SessionEnd = {
  session: Session;
  /** Момент окончания, epoch ms. Для 'time' — когда время вышло, не когда заметили. */
  at: number;
  /**
   * 'time' — время вышло само, задачу можно зачёркивать.
   * 'stopped' — сняли руками, и это не выполнение: человек прервался.
   */
  reason: SessionEndReason;
};

export const MINUTE_MS = 60_000;

/**
 * Длительности спринта.
 *
 * 15 — порог входа. Он здесь не для работы, а чтобы спринт вообще запустили
 *      в день, когда не хочется ничего; пятнадцать минут не страшно начать.
 * 25 — помидор, привычная всем единица.
 * 45 — рабочий блок: столько внимание держится без усилия.
 * 60 — то, что просил человек дословно: «ставлю таймер условно на час».
 * 90 — потолок. Дальше это уже не заход, а рабочий день, и таймер перестаёт
 *      что-либо означать: под конец на него просто не смотрят.
 *
 * Пять вариантов, а не десять: выбор длительности не должен превращаться в
 * решение. Чем дольше выбираешь, тем выше шанс не начать.
 */
export const SPRINT_OPTIONS = [15, 25, 45, 60, 90] as const;

/** С какого остатка заход считается финишной прямой. */
export const FINAL_STRETCH_MS = MINUTE_MS;

/**
 * Сколько времени после конца сессию ещё можно подобрать.
 *
 * Вернулся через двадцать минут — заход честно завершается: человек отходил.
 * Открыл приложение на следующее утро — сессия молча выбрасывается, ничего
 * не отмечая. Задача, зачёркнутая сама по себе за ночь, — это враньё в
 * списке дня, а вранью в списке перестают верить целиком.
 */
export const STALE_GRACE_MS = 60 * MINUTE_MS;

/** Сколько миллисекунд отвели на заход. */
export function durationMs(session: Session): number {
  return Math.max(0, Math.floor(session.minutes || 0)) * MINUTE_MS;
}

/**
 * Сколько прошло с начала.
 *
 * Отрицательного не бывает: часы устройства могут перевести назад, и
 * «прошло минус три минуты» превратило бы полосу прогресса в мусор.
 */
export function elapsedMs(session: Session, now: number): number {
  return Math.max(0, now - session.startedAt);
}

/** Сколько осталось. Ноль — время вышло. */
export function remainingMs(session: Session, now: number): number {
  return Math.max(0, durationMs(session) - elapsedMs(session, now));
}

export function isOver(session: Session, now: number): boolean {
  return elapsedMs(session, now) >= durationMs(session);
}

/** Последняя минута — единственное место, где строку фокуса стоит усилить. */
export function isFinalStretch(remaining: number): boolean {
  return remaining > 0 && remaining <= FINAL_STRETCH_MS;
}

/** Заход, который кончился слишком давно, чтобы его показывать. */
export function isStale(session: Session, now: number): boolean {
  return now - session.startedAt > durationMs(session) + STALE_GRACE_MS;
}

/**
 * Сколько минут заход реально длился — для рекорда и результата.
 *
 * Ограничен сверху отведённым временем: после того как таймер отзвонил,
 * работа уже не идёт, и приписывать заходу минуты, которые человек провёл
 * в другом приложении, значит занижать собственный рекорд.
 * Снизу — одна минута: заход длиной ноль минут сделал бы темп бесконечным.
 */
export function runMinutes(session: Session, now: number): number {
  const minutes = Math.round(elapsedMs(session, now) / MINUTE_MS);
  return Math.max(1, Math.min(Math.max(1, Math.floor(session.minutes || 0)), minutes));
}

/**
 * Доля пройденного, 0..100, от уже посчитанного остатка.
 *
 * Полоса обязана считаться из того же числа, что и цифры на экране: если
 * взять для неё свой Date.now(), полоса и часы разъезжаются на кадр, и это
 * видно ровно в тот момент, когда на них смотрят — на последней секунде.
 */
export function pctFromRemaining(remaining: number, minutes: number): number {
  const total = Math.max(0, Math.floor(minutes || 0)) * MINUTE_MS;
  if (total <= 0) return 100;
  const done = Math.max(0, Math.min(total, total - Math.max(0, remaining)));
  return Math.round((done / total) * 100);
}

/** Доля пройденного на момент now. */
export function sessionPct(session: Session, now: number): number {
  return pctFromRemaining(remainingMs(session, now), session.minutes);
}

/**
 * «12:34». Больше часа — «1:05:00».
 *
 * Часы появляются только когда они есть: «0:59:00» вместо «59:00» съедает
 * место в строке и заставляет читать число, а не видеть его.
 */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor((Number.isFinite(ms) ? ms : 0) / 1000));
  const seconds = total % 60;
  const minutes = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600);

  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
  return `${Math.floor(total / 60)}:${ss}`;
}

/** Темп захода — рассылок в час, округлённых до целого. */
export function pacePerHour(count: number, minutes: number): number {
  const safeMinutes = Math.max(0, Math.floor(minutes || 0));
  const safeCount = Math.max(0, Math.floor(count || 0));
  if (safeMinutes <= 0) return 0;
  return Math.round((safeCount / safeMinutes) * 60);
}

export type SprintResult = {
  /** Сколько рассылок сделано за заход. */
  count: number;
  /** Сколько минут заход длился. */
  minutes: number;
  /** Темп, рассылок в час. */
  perHour: number;
};

/**
 * Итог захода.
 *
 * Считается разницей счётчика, а не собственным счётчиком внутри сессии:
 * рассылку можно завести с любого экрана и из любой вкладки, и второй
 * счётчик того же события рано или поздно разошёлся бы с первым.
 */
export function sprintResult(input: {
  sentAtStart?: number;
  sentNow: number;
  minutes: number;
}): SprintResult {
  const start = Math.max(0, Math.floor(input.sentAtStart ?? input.sentNow));
  const now = Math.max(0, Math.floor(input.sentNow || 0));
  const minutes = Math.max(1, Math.floor(input.minutes || 0));
  const count = Math.max(0, now - start);

  return { count, minutes, perHour: pacePerHour(count, minutes) };
}

/**
 * Побит ли рекорд.
 *
 * Как честно сравнить заходы разной длины — единственный неочевидный вопрос
 * всей механики, и ответ здесь такой: сначала число, потом плотность.
 *
 * Не по темпу. Темп рекордом быть не может: две рассылки за пять минут дают
 * 24 в час и перебивают любой честный час работы. Рекорд, который ставится
 * пятиминутным заходом, перестаёт что-либо значить с первого раза, а вся
 * шкала приложения — квота, вехи, XP — считает штуки, и второй рекорд в
 * другой единице спорил бы с ней.
 *
 * Но и одного числа мало: двенадцать за час и двенадцать за двадцать минут —
 * разные достижения, и делать вид, что это один результат, нечестно.
 * Поэтому при равном числе выигрывает более плотный заход, и длительность
 * хранится рядом с числом всегда.
 */
export function isRecord(
  count: number,
  minutes: number,
  recordCount: number,
  recordMinutes: number,
): boolean {
  const safe = Math.max(0, Math.floor(count || 0));
  const previous = Math.max(0, Math.floor(recordCount || 0));

  // Ноль рекордом не бывает: заход без единой рассылки — это не достижение,
  // даже если до него не было ни одного захода вообще.
  if (safe <= 0) return false;
  if (safe !== previous) return safe > previous;

  return pacePerHour(safe, minutes) > pacePerHour(previous, recordMinutes);
}

/** Похоже ли прочитанное из хранилища на сессию. */
export function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;

  return (
    typeof s.id === 'string' &&
    s.id.length > 0 &&
    (s.kind === 'task' || s.kind === 'outreach') &&
    typeof s.label === 'string' &&
    typeof s.minutes === 'number' &&
    Number.isFinite(s.minutes) &&
    s.minutes > 0 &&
    typeof s.startedAt === 'number' &&
    Number.isFinite(s.startedAt) &&
    s.startedAt > 0
  );
}

/**
 * Разбор строки из localStorage.
 *
 * Молча возвращает null на любом мусоре: хранилище переживает выкатки, и
 * сессия старого формата не имеет права уронить экран, на который человек
 * зашёл работать.
 */
export function parseSession(raw: string | null): Session | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

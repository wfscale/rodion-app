import type { Dict } from '@/lib/i18n';

/**
 * Время вокруг задач дня.
 *
 * Список задач без времени врёт о размере дня: пять пунктов могут занять час,
 * а могут не поместиться в сутки. Оценка рядом с задачей превращает список в
 * бюджет — сколько выйдет, если закрыть всё, и сколько уже потрачено.
 *
 * Оценка необязательна намеренно: задачи вносят пачкой, и обязательное поле
 * времени убило бы сам сценарий быстрой записи. Поэтому null — не «ноль
 * минут», а «не оценивали», и такая задача в суммы не входит вообще.
 */

/** Потолок одной оценки — сутки. Больше суток на задачу дня не бывает. */
export const MAX_TASK_MINUTES = 1440;

/**
 * Есть ли у задачи настоящая оценка.
 *
 * Отдельный предикат, потому что «оценка есть» — это не просто `!== null`:
 * ноль, минус и NaN могли доехать из старых строк или чужого импорта, и
 * считать их оценкой значит показать «0 мин» там, где времени просто нет.
 */
export function hasEstimate(minutes: number | null | undefined): minutes is number {
  return typeof minutes === 'number' && Number.isFinite(minutes) && minutes > 0;
}

/**
 * «1 ч 30 мин», «2 ч», «45 мин».
 *
 * Формат повторяет `formatTimeLeft` из lib/date.ts, но берёт единицы из
 * словаря, а не из кода: время задачи человек не только читает, но и вводит,
 * и подпись поля с подписью значения обязаны меняться в одном месте.
 *
 * Ноль печатается как «0 мин», а не прячется в пустую строку: пустая строка
 * посреди фразы («Закрыто ») читается как сломанное приложение. Решение
 * «показывать ли вообще» принимает вызывающий — он один знает контекст.
 */
export function formatMinutes(minutes: number, t: Dict): string {
  const total = Math.max(0, Math.round(minutes || 0));
  const h = Math.floor(total / 60);
  const m = total % 60;

  if (h === 0) return `${m} ${t.time.minutes}`;
  if (m === 0) return `${h} ${t.time.hours}`;
  return `${h} ${t.time.hours} ${m} ${t.time.minutes}`;
}

/** Минимум, который нужен от задачи, чтобы посчитать бюджет дня. */
export type TimedTask = {
  minutes: number | null;
  completed: boolean;
};

export type TaskBudget = {
  /** Сумма по всем задачам с оценкой — во сколько обойдётся закрыть всё. */
  total: number;
  /** Сумма по выполненным. Это уже потраченное время, а не обещанное. */
  done: number;
  /** Сколько ещё предстоит: total - done. */
  left: number;
  /** Сколько задач без оценки. В суммы не входят, но о них надо сказать. */
  untimed: number;
};

/**
 * Бюджет дня по списку задач.
 *
 * `untimed` возвращается наравне с минутами не для симметрии: «3 ч» выглядит
 * полной картиной дня ровно до того момента, когда выясняется, что половина
 * задач просто не оценена. Число неоценённых — единственное, что удерживает
 * сумму от вранья.
 */
export function taskBudget(tasks: readonly TimedTask[]): TaskBudget {
  let total = 0;
  let done = 0;
  let untimed = 0;

  for (const task of tasks) {
    if (!hasEstimate(task.minutes)) {
      untimed += 1;
      continue;
    }

    const minutes = Math.round(task.minutes);
    total += minutes;
    if (task.completed) done += minutes;
  }

  return { total, done, left: total - done, untimed };
}

/** Единица — часы: «ч», «час», «h», «hr». */
function isHourUnit(unit: string): boolean {
  return unit.startsWith('ч') || unit.startsWith('h');
}

/** Единица — минуты: «м», «мин», «m», «min». */
function isMinuteUnit(unit: string): boolean {
  return unit.startsWith('м') || unit.startsWith('m');
}

/*
 * Число, необязательная единица, необязательный «хвост» из минут:
 * «90», «1.5ч», «2 h», «45 мин.», «1 ч 30 мин».
 */
const ESTIMATE = /^(\d+(?:\.\d+)?)\s*([a-zа-яё.]*)\s*(\d+)?\s*([a-zа-яё.]*)$/;

/**
 * Разбор того, что человек набрал в поле времени.
 *
 * Грамматика ровно такая, чтобы напечатанное приложением можно было
 * перепечатать обратно: «1 ч 30 мин» обязано разбираться в 90, иначе правка
 * оценки превращается в пересчёт в уме. Плюс то, что пишут вместо этого —
 * «1.5ч», «1,5 ч», «2h», «45м». Мусор возвращает null: молча посчитать
 * «завтра» за минуты хуже, чем не понять.
 *
 * Голое дробное число — часы: «1.5» это полтора часа, полутора минут не
 * бывает. Голое целое — минуты: так пишут чаще всего.
 */
export function parseMinutes(input: string): number | null {
  const raw = input.trim().toLowerCase().replace(/,/g, '.');
  if (!raw) return null;

  const match = ESTIMATE.exec(raw);
  if (!match) return null;

  const [, headText, headUnit, tailText, tailUnit] = match;
  const head = Number(headText);
  if (!Number.isFinite(head)) return null;

  let minutes: number;

  if (tailText === undefined) {
    if (isHourUnit(headUnit)) minutes = head * 60;
    else if (isMinuteUnit(headUnit)) minutes = head;
    else if (headUnit === '') minutes = Number.isInteger(head) ? head : head * 60;
    else return null;
  } else {
    // Две части — это только «часы + минуты»; «45 мин 30» смысла не имеет,
    // как и дробные часы с хвостом («1.5ч30»).
    if (!isHourUnit(headUnit) || !Number.isInteger(head)) return null;
    if (tailUnit !== '' && !isMinuteUnit(tailUnit)) return null;
    minutes = head * 60 + Number(tailText);
  }

  const rounded = Math.round(minutes);
  if (rounded < 1) return null;
  return Math.min(rounded, MAX_TASK_MINUTES);
}

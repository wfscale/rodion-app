/**
 * Механика ровного числа.
 *
 * Наблюдение, ради которого она существует: 22 рассылки выглядят как
 * недоделанная работа, 25 — как законченная. Мозг сам просит добить до ровного,
 * и это единственный вид давления, который не изматывает, а тянет.
 *
 * Приложение обязано превращать это наблюдение в видимую цель: не «молодец»,
 * а «до 25 осталось три». Тогда норма перевыполняется каждый день, но ровно
 * настолько, чтобы завтра снова хотелось сесть.
 */

/** Ровное число — кратное пяти. */
export const ROUND_STEP = 5;
/** Если до пятёрки остался один шаг, цель растягивается до десятка. */
export const ROUND_STRETCH = 10;

/** Ближайшее кратное step, строго большее n. */
export function nextMultiple(n: number, step: number): number {
  const safe = Math.max(0, Math.floor(n || 0));
  return (Math.floor(safe / step) + 1) * step;
}

/** Само по себе ровное ли число. Ноль ровным не считается — это ещё не работа. */
export function isRound(n: number, step: number = ROUND_STEP): boolean {
  return n > 0 && n % step === 0;
}

/**
 * Вес круглого числа: чем реже оно встречается, тем громче о нём говорить.
 * 4 — сотня, 3 — полтинник, 2 — четверть сотни, 1 — десяток, 0 — пятёрка.
 */
export function milestoneWeight(n: number): number {
  if (n <= 0) return 0;
  if (n % 100 === 0) return 4;
  if (n % 50 === 0) return 3;
  if (n % 25 === 0) return 2;
  if (n % 10 === 0) return 1;
  return 0;
}

export type RoundTarget = {
  /** До какого числа добивать. */
  target: number;
  /** Сколько осталось. Всегда ≥ 1. */
  remaining: number;
  /** Цель растянута до десятка, потому что до пятёрки оставался один шаг. */
  stretched: boolean;
  /** Вес цели, см. milestoneWeight. */
  weight: number;
};

/**
 * Куда добивать от текущего числа.
 *
 * Правило одно: ближайшая пятёрка. Но если до неё остался ровно один шаг,
 * цель не должна быть подачкой — она растягивается до десятка. Поэтому 22
 * даёт «ещё 3 до 25», а 24 — «ещё 6 до 30»: и то и другое ощущается
 * как задача, а не как формальность.
 */
export function roundTarget(n: number): RoundTarget {
  const current = Math.max(0, Math.floor(n || 0));
  const five = nextMultiple(current, ROUND_STEP);

  if (five - current <= 1) {
    const ten = nextMultiple(current, ROUND_STRETCH);
    return {
      target: ten,
      remaining: ten - current,
      stretched: ten !== five,
      weight: milestoneWeight(ten),
    };
  }

  return {
    target: five,
    remaining: five - current,
    stretched: false,
    weight: milestoneWeight(five),
  };
}

export type NudgeKind = 'quota' | 'round-day' | 'round-total';

export type Nudge = {
  kind: NudgeKind;
  target: number;
  remaining: number;
  weight: number;
};

/**
 * Что показать под счётчиком прямо сейчас — ровно одна цель.
 *
 * Порядок жёсткий: пока квота не закрыта, никаких круглых чисел — иначе
 * появляется второй смысл дня и первый размывается. После квоты ведём к
 * ровному счёту за день, а когда и он ровный — к ровному счёту за всё время.
 * Так цель никогда не кончается, но их никогда не две.
 */
export function pickNudge(input: {
  sentToday: number;
  quota: number;
  total: number;
}): Nudge {
  const { sentToday, quota, total } = input;

  if (sentToday < quota) {
    return {
      kind: 'quota',
      target: quota,
      remaining: quota - sentToday,
      weight: milestoneWeight(quota),
    };
  }

  if (!isRound(sentToday)) {
    const day = roundTarget(sentToday);
    return { kind: 'round-day', target: day.target, remaining: day.remaining, weight: day.weight };
  }

  const all = roundTarget(total);
  return { kind: 'round-total', target: all.target, remaining: all.remaining, weight: all.weight };
}

/**
 * Вехи по общему числу рассылок, достигнутые этим шагом.
 *
 * Возвращает список, а не одно число: контакт можно завести задним числом
 * пачкой, и тогда счётчик перепрыгивает сразу через веху.
 */
export function milestonesCrossed(before: number, after: number, step: number): number[] {
  if (step <= 0 || after <= before) return [];
  const first = Math.floor(before / step) + 1;
  const last = Math.floor(after / step);

  const result: number[] = [];
  for (let i = first; i <= last; i += 1) result.push(i * step);
  return result;
}

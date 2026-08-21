import { daysBetween, shiftDate } from '@/lib/date';
import { calculateQuota } from '@/lib/quota';

/**
 * Щит и привал — страховка «дня в ударе».
 *
 * Серия закрытых дней (`quota_streak`) — самое дорогое, что копится в
 * приложении, и одновременно самое хрупкое: один вечер без сил обнуляет
 * недели работы. Страх потерять серию заставляет добивать квоту через
 * отвращение, а действие, сделанное через отвращение, закрепляется как
 * наказание — и человек перестаёт открывать приложение вообще.
 *
 * Отсюда два механизма, намеренно разных по цене:
 *
 *  — ЩИТ. Ограниченный ресурс: три заряда, каждый закрывает ровно один
 *    день. Серия переживает день без квоты, но НЕ растёт: заряд спасает
 *    накопленное, а не заменяет работу. Новый заряд восстанавливается за
 *    четыре закрытых дня, поэтому «жить на щитах» арифметически нельзя.
 *
 *  — ПРИВАЛ. Осознанная остановка без ограничения по длине: серия замирает
 *    на текущем числе и не растёт ни дня. Нужен, когда работа ушла в
 *    обработку уже полученных заявок и новые рассылки просто не к месту.
 *
 * Общее правило обоих: закрытая квота всегда сильнее защиты. Сделал норму
 * в защищённый день — день засчитан как обычный, серия +1, щит возвращается
 * в запас, привал снимается сам. Приложение не должно наказывать за работу
 * ни в каком виде, включая «ты же был на паузе».
 */

/**
 * Сколько щитов можно держать про запас.
 *
 * Это же число зашито в ограничение profiles_shield_charges_check
 * (migration-v7). Меняешь здесь — правь и там одной миграцией, иначе база
 * начнёт отбивать законные значения.
 */
export const SHIELD_MAX = 3;

/** Сколько закрытых дней восстанавливают один заряд. */
export const SHIELD_REGEN_DAYS = 4;

/** Состояние страховки — ровно те поля профиля, что нужны логике. */
export type GuardState = {
  /** Доступные заряды щита, 0..SHIELD_MAX. */
  charges: number;
  /** Закрытых дней в счёт следующего заряда. */
  progress: number;
  /** Логический день, на который взведён щит. null — щит не взведён. */
  shieldDate: string | null;
  /** Тратить заряд самому, если день кончился без квоты. */
  auto: boolean;
  /** День начала привала. null — привала нет. */
  pauseStart: string | null;
};

/** Чем защищён конкретный день. */
export type DayGuard = 'shield' | 'pause' | null;

/**
 * Чем защищён день.
 *
 * Привал сильнее щита: если человек на привале, заряд тратить не за что.
 */
export function guardFor(state: GuardState, date: string): DayGuard {
  if (state.pauseStart && date >= state.pauseStart) return 'pause';
  if (state.shieldDate === date) return 'shield';
  return null;
}

/** Какой день привала идёт сейчас. День включения считается первым. */
export function pauseDay(pauseStart: string | null, today: string): number {
  if (!pauseStart) return 0;
  return Math.max(1, daysBetween(today, pauseStart) + 1);
}

/** Сколько закрытых дней осталось до нового заряда. 0 — запас полон. */
export function daysUntilShield(state: GuardState): number {
  if (state.charges >= SHIELD_MAX) return 0;
  return Math.max(1, SHIELD_REGEN_DAYS - (state.progress % SHIELD_REGEN_DAYS));
}

/** Можно ли взвести щит на сегодня. */
export function canArmShield(state: GuardState, today: string): boolean {
  return state.charges > 0 && state.shieldDate !== today && !state.pauseStart;
}

/**
 * Взвести щит на сегодня.
 *
 * Заряд списывается сразу, а не на границе суток: иначе кнопка «засейвить»
 * не давала бы того, ради чего её жмут, — ощущения, что вопрос уже закрыт.
 */
export function armShield(state: GuardState, today: string): GuardState {
  if (!canArmShield(state, today)) return state;
  return { ...state, charges: state.charges - 1, shieldDate: today };
}

/** Снять щит с сегодняшнего дня и вернуть заряд. Прошлые дни не трогает. */
export function disarmShield(state: GuardState, today: string): GuardState {
  if (state.shieldDate !== today) return state;
  return { ...state, charges: Math.min(SHIELD_MAX, state.charges + 1), shieldDate: null };
}

/**
 * Уйти на привал с сегодняшнего дня.
 *
 * Взведённый щит при этом возвращается в запас: привал закрывает день и так,
 * а сгоревший впустую заряд ощущался бы как штраф за смену решения.
 */
export function startPause(state: GuardState, today: string): GuardState {
  if (state.pauseStart) return state;
  const returned = state.shieldDate === today ? disarmShield(state, today) : state;
  return { ...returned, pauseStart: today };
}

/** Вернуться в работу. */
export function endPause(state: GuardState): GuardState {
  if (!state.pauseStart) return state;
  return { ...state, pauseStart: null };
}

/** Насколько горит время до конца логического дня. */
export type BurnLevel = 'safe' | 'warn' | 'danger';

/**
 * Пороги подобраны под реальный вечер: шесть часов — это ещё «успею после
 * дел», два часа — «садись сейчас или не успеешь».
 */
export function burnLevel(minutesLeft: number): BurnLevel {
  if (minutesLeft <= 120) return 'danger';
  if (minutesLeft <= 360) return 'warn';
  return 'safe';
}

/**
 * Готовое состояние страховки для экрана.
 *
 * Собирается один раз в провайдере: и компактной строке на главной, и полной
 * карточке на рассылках нужен один и тот же набор, и считать его дважды —
 * верный способ показать в двух местах разные числа.
 */
export type GuardView = {
  /** Прогнана ли migration-v7. Без неё колонок щита в профиле нет. */
  ready: boolean;
  charges: number;
  /** Закрытых дней до нового заряда. 0 — запас полон. */
  regenIn: number;
  auto: boolean;
  /** Чем защищён сегодняшний день. */
  today: DayGuard;
  /** Какой день привала идёт. 0 — привала нет. */
  pauseDay: number;
  /** Минут до того, как логический день сгорит. */
  minutesLeft: number;
  burn: BurnLevel;
  /** Можно ли прямо сейчас взвести щит. */
  canArm: boolean;
};

export type RollGuardInput = {
  today: string;
  /** profiles.quota_last_date — последний разобранный день. */
  lastDate: string | null;
  /** Текущая квота: ею же судим все неразобранные дни. */
  quota: number;
  quotaStreak: number;
  /** Сколько рассылок пришлось на каждую дату. */
  sentByDate: Record<string, number>;
  guard: GuardState;
};

export type RollGuardResult = {
  quotaStreak: number;
  currentQuota: number;
  guard: GuardState;
  /** Есть ли что писать в базу. */
  changed: boolean;
  /** Дни, на которые заряд ушёл автоматически. */
  spent: string[];
  /** Дни, где щит был взведён, но квота всё равно закрыта — заряд вернулся. */
  refunded: string[];
  /** Сколько зарядов восстановилось за закрытые дни. */
  earned: number;
  /** День, на котором серия всё-таки порвалась. null — выстояла. */
  brokenAt: string | null;
};

/**
 * Разбор всех дней, прошедших с последнего запуска.
 *
 * Считает по дню за раз, а не «был ли пропуск» целиком: три дня поездки под
 * тремя зарядами обязаны пережиться так же, как три отдельных вечера. День
 * судится по числу рассылок, и только если он не закрыт — ищется защита.
 *
 * Отдельная функция от rollQuotaForNewDay(), а не замена ей: пока миграция
 * v7 не прогнана, колонок щита в профиле нет, и приложение обязано работать
 * по-старому.
 */
export function rollGuardForNewDay(input: RollGuardInput): RollGuardResult {
  const { today, lastDate, quota, sentByDate } = input;

  const idle = (changed: boolean): RollGuardResult => ({
    quotaStreak: input.quotaStreak,
    currentQuota: calculateQuota(input.quotaStreak),
    guard: input.guard,
    changed,
    spent: [],
    refunded: [],
    earned: 0,
    brokenAt: null,
  });

  // За сегодня уже разбирали.
  if (lastDate === today) return idle(false);
  // Первый запуск: судить нечего, просто отмечаемся.
  if (!lastDate) return idle(true);

  const gap = daysBetween(today, lastDate);
  // Часы на устройстве уехали назад — молча ничего не делаем.
  if (gap <= 0) return idle(false);

  let streak = Math.max(0, input.quotaStreak || 0);
  let { charges, progress, shieldDate } = input.guard;
  // Привал разбор дней не трогает: включают и выключают его только вручную.
  const { auto, pauseStart } = input.guard;

  const spent: string[] = [];
  const refunded: string[] = [];
  let earned = 0;
  let brokenAt: string | null = null;

  for (let i = 0; i < gap; i += 1) {
    const date = shiftDate(lastDate, i);
    const sent = sentByDate[date] ?? 0;
    const closed = quota > 0 && sent >= quota;

    if (closed) {
      streak += 1;

      // Щит на закрытом дне не тратится: работа сделана, заряд возвращается.
      if (shieldDate === date) {
        charges = Math.min(SHIELD_MAX, charges + 1);
        shieldDate = null;
        refunded.push(date);
      }

      /*
       * Привал закрытый день НЕ снимает.
       *
       * Внутри суток порядок событий отсюда не виден, и «закрыл квоту, а
       * вечером ушёл в поездку» выглядело бы точно так же, как «был на
       * привале и всё-таки отработал». Снять привал по первому признаку
       * значит оставить человека без защиты ровно в ту ночь, когда он её
       * и включал. Возврат в работу — всегда явная кнопка; серия при этом
       * за отработанный день всё равно выросла.
       */

      progress += 1;
      while (progress >= SHIELD_REGEN_DAYS && charges < SHIELD_MAX) {
        progress -= SHIELD_REGEN_DAYS;
        charges += 1;
        earned += 1;
      }
      // При полном запасе копить нечего — счётчик обнуляется.
      if (charges >= SHIELD_MAX) progress = 0;
      continue;
    }

    const cover = guardFor({ charges, progress, shieldDate, auto, pauseStart }, date);

    if (cover === 'pause') continue; // серия замерла, но цела
    if (cover === 'shield') {
      shieldDate = null; // заряд списан ещё при взведении
      continue;
    }

    if (auto && charges > 0) {
      charges -= 1;
      spent.push(date);
      continue;
    }

    streak = 0;
    brokenAt = date;
  }

  return {
    quotaStreak: streak,
    currentQuota: calculateQuota(streak),
    guard: { charges, progress, shieldDate, auto, pauseStart },
    changed: true,
    spent,
    refunded,
    earned,
    brokenAt,
  };
}

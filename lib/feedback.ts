// ---------------------------------------------------------------------------
// Подсистема тактильной и звуковой отдачи (ТЗ §14).
//
// Смысл: телефон должен физически отзываться на каждое действие. Рассылка —
// это микро-усилие, и без отклика оно остаётся незамеченным. Вибрация и звук
// закрывают петлю «сделал → получил».
//
// Модуль чистый: ни React, ни DOM-разметки. Всё безопасно вызывается на
// сервере — при SSR каждая функция просто выходит.
// ---------------------------------------------------------------------------

export type FeedbackKind = 'add' | 'reply' | 'close';

// ---------------------------------------------------------------------------
// Вибрация
// ---------------------------------------------------------------------------

/**
 * Обёртка над navigator.vibrate.
 *
 * Молча ничего не делает, если API недоступно: Safari на iOS Vibration API
 * не поддерживает вообще, и это не ошибка — просто на айфоне обратная связь
 * остаётся только звуковой и визуальной. Проверять поддержку на стороне
 * вызова не нужно.
 */
export function vibrate(pattern: number | number[]): void {
  if (typeof window === 'undefined') return;
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;

  try {
    navigator.vibrate(pattern);
  } catch {
    // Некоторые браузеры бросают, если вызов пришёл без жеста пользователя.
    // Вибрация — украшение, ронять из-за неё поток действия нельзя.
  }
}

// ---------------------------------------------------------------------------
// Звук
//
// Синтез на месте, без внешних файлов: три коротких сигнала не стоят
// сетевых запросов и кэша, а Web Audio даёт их точнее любого mp3.
// ---------------------------------------------------------------------------

/*
 * Единственный AudioContext на всё приложение.
 *
 * Создавать его на каждый звук нельзя: браузеры держат ограниченное число
 * контекстов (в Chrome — около шести), незакрытые текут памятью, а на
 * мобильных лишний контекст ещё и будит аудиотракт.
 */
let audioCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  if (!audioCtx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;

    try {
      audioCtx = new Ctor();
    } catch {
      return null;
    }
  }

  // После автоплей-политики контекст просыпается только внутри жеста
  // пользователя. Все наши звуки как раз идут от тапа, так что момент верный.
  if (audioCtx.state === 'suspended') void audioCtx.resume().catch(() => {});

  return audioCtx;
}

type ToneSpec = {
  /** Начальная частота, Гц. */
  freq: number;
  /** Куда съезжает частота к концу ноты. Нет — держится ровно. */
  glideTo?: number;
  /** Сдвиг начала относительно момента вызова, сек. */
  at: number;
  /** Длительность ноты, сек. */
  dur: number;
  /** Пиковая громкость 0..1. Всё держим тихим: звук — намёк, не сигнал тревоги. */
  peak: number;
  type: OscillatorType;
};

function playTone(ctx: AudioContext, spec: ToneSpec): void {
  const start = ctx.currentTime + spec.at;
  const end = start + spec.dur;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = spec.type;
  osc.frequency.setValueAtTime(spec.freq, start);
  if (spec.glideTo !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(spec.glideTo, end);
  }

  /*
   * Огибающая: атака 8 мс, дальше экспоненциальный спад.
   * Без атаки получается щелчок динамика, без спада — обрубленный «пшик».
   * В ноль экспонентой уйти нельзя, поэтому целимся в 0.0001.
   */
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(spec.peak, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(start);
  osc.stop(end);

  // Узлы одноразовые: отцепляем их, чтобы граф не разрастался за сессию.
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
}

/*
 * Три голоса системы.
 *
 * 'add'   — рутина, звучит десятки раз за день: должен быть почти незаметен.
 * 'reply' — событие, звонче и выше, восходящая пара нот.
 * 'close' — редчайшее событие: мажорное трезвучие вверх, но уложенное
 *           в 0.49 сек, чтобы остаться поздравлением, а не фанфарами.
 */
const VOICES: Record<FeedbackKind, ToneSpec[]> = {
  // Тихий клик: треугольник 880 → 660 Гц за 60 мс.
  add: [{ freq: 880, glideTo: 660, at: 0, dur: 0.06, peak: 0.05, type: 'triangle' }],

  // Звонче: B5 → E6, две ноты по 120 мс, синус.
  reply: [
    { freq: 987.77, at: 0, dur: 0.12, peak: 0.08, type: 'sine' },
    { freq: 1318.51, at: 0.1, dur: 0.14, peak: 0.09, type: 'sine' },
  ],

  // Триумф: C6 – E6 – G6 – C7, шаг 90 мс, хвост гаснет на 0.49 сек.
  close: [
    { freq: 1046.5, at: 0, dur: 0.16, peak: 0.07, type: 'sine' },
    { freq: 1318.51, at: 0.09, dur: 0.16, peak: 0.07, type: 'sine' },
    { freq: 1567.98, at: 0.18, dur: 0.16, peak: 0.07, type: 'sine' },
    { freq: 2093.0, at: 0.27, dur: 0.22, peak: 0.06, type: 'sine' },
  ],
};

/**
 * Синтетический звук события. По умолчанию звуки в приложении выключены,
 * поэтому enabled приходит из настроек, а не решается здесь.
 */
export function playSound(kind: FeedbackKind, enabled: boolean): void {
  if (!enabled) return;

  const ctx = getContext();
  if (!ctx) return;

  try {
    for (const spec of VOICES[kind]) playTone(ctx, spec);
  } catch {
    // Железо или политика браузера могут отказать в любой момент.
    // Отсутствие звука не должно ломать сохранение рассылки.
  }
}

// ---------------------------------------------------------------------------
// Комбинированная отдача
// ---------------------------------------------------------------------------

/*
 * Паттерны вибрации. Из ТЗ §14 заданы два: 50 мс на добавление и
 * «двойной удар» [100, 50, 100] на закрытие сделки. Ответ лежит между ними —
 * один импульс подлиннее, чтобы отличался от рутинного добавления.
 */
const HAPTICS: Record<FeedbackKind, number | number[]> = {
  add: 50,
  reply: 80,
  close: [100, 50, 100],
};

/**
 * Полная отдача на событие: вибрация всегда, звук — если включён в настройках.
 * Вызывать одной строкой из обработчика действия.
 */
export function celebrate(kind: FeedbackKind, soundEnabled: boolean): void {
  if (typeof window === 'undefined') return;

  vibrate(HAPTICS[kind]);
  playSound(kind, soundEnabled);
}

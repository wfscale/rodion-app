'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  durationMs,
  isOver,
  isStale,
  parseSession,
  pctFromRemaining,
  remainingMs,
  type Session,
  type SessionEnd,
  type SessionEndReason,
  type SessionKind,
} from '@/lib/session';

/**
 * Идущая сессия фокуса.
 *
 * Живёт в localStorage, а не в базе и не в React-состоянии страницы. В
 * состоянии страницы она не пережила бы переход на другой раздел, а человек
 * во время захода как раз ходит между рассылками и главной. В базе ей делать
 * нечего: заход эфемерен, он умирает вместе с браузером — хранить надо не
 * его, а рекорд.
 *
 * Остаток всегда считается от startedAt. Тикающий счётчик «минус секунда
 * каждую секунду» останавливается вместе со свёрнутой вкладкой: браузер
 * душит таймеры в фоне, и час, проведённый в Telegram, превратился бы в
 * пятнадцать минут — ровно в том сценарии, ради которого таймер и заводили.
 */

/** Идущая сессия. */
const STORAGE_KEY = 'rodion.session';
/**
 * id последней завершённой сессии.
 *
 * Одна строка вместо списка: сессия всегда одна, и для «завершить ровно
 * один раз» достаточно помнить последнюю. Список копил бы ключи вечно.
 */
const DONE_KEY = 'rodion.session.done';

export type SessionStart = {
  kind: SessionKind;
  label: string;
  minutes: number;
  taskId?: string;
  taskSource?: 'day' | 'project';
  /** Счётчик рассылок на старте — по нему считается сделанное за заход. */
  sentAtStart?: number;
};

export type UseSession = {
  /** Идущая сессия или null. */
  session: Session | null;
  /** Остаток в миллисекундах. 0, если сессии нет. */
  remaining: number;
  /** Сколько захода пройдено, 0..100. */
  pct: number;
  /** Время вышло само — задачу можно зачёркивать. Снятый руками заход сюда не попадает. */
  over: boolean;
  /**
   * Чем кончился последний заход. Появляется ровно один раз на завершение,
   * даже если открыто два экрана.
   */
  finished: SessionEnd | null;
  /** Запускает заход. Вернёт null, если один уже идёт: фокус бывает только один. */
  start: (input: SessionStart) => Session | null;
  /** Снимает заход досрочно. Задача при этом не отмечается — человек прервался. */
  stop: () => Session | null;
  /** Убрать результат с экрана после того, как он показан. */
  dismiss: () => void;
};

function readStored(): Session | null {
  try {
    return parseSession(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeStored(session: Session | null): void {
  try {
    if (session) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // приватный режим: заход просто не переживёт перезагрузку
  }
}

/**
 * Забрать право завершить сессию.
 *
 * false означает, что её уже завершила другая вкладка: задача отмечена,
 * рекорд записан, тост показан. Второй раз этого делать нельзя — в базу
 * ушёл бы повторный апдейт, а человек увидел бы два одинаковых сообщения.
 */
function claimEnd(id: string): boolean {
  try {
    if (window.localStorage.getItem(DONE_KEY) === id) return false;
    window.localStorage.setItem(DONE_KEY, id);
    return true;
  } catch {
    // Хранилище недоступно — пусть лучше завершится дважды, чем ни разу:
    // незачёркнутая задача хуже повторного тоста.
    return true;
  }
}

function newId(): string {
  // randomUUID нет в старых Safari и вне защищённого контекста, а id нужен
  // только чтобы отличить один заход от другого на одном устройстве.
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useSession(onFinish?: (end: SessionEnd) => void): UseSession {
  const [session, setSession] = useState<Session | null>(null);
  const [now, setNow] = useState(0);
  const [finished, setFinished] = useState<SessionEnd | null>(null);

  /*
   * Обработчик держим в ref. Страница пересоздаёт его на каждый рендер, а
   * подписка на тик из-за этого пересобираться не должна: секунда обнулялась
   * бы при каждом изменении любого состояния страницы.
   */
  const finishRef = useRef(onFinish);
  useEffect(() => {
    finishRef.current = onFinish;
  });

  const end = useCallback((current: Session, at: number, reason: SessionEndReason) => {
    writeStored(null);
    setSession(null);
    if (!claimEnd(current.id)) return;

    const result: SessionEnd = { session: current, at, reason };
    setFinished(result);
    finishRef.current?.(result);
  }, []);

  /*
   * Восстановление и синхронизация между вкладками.
   *
   * Хранилище читается только в эффекте: на сервере его нет, и первый
   * клиентский рендер обязан совпасть с серверным. Событие storage приходит
   * из соседних вкладок — заход, запущенный на другом экране, появляется
   * здесь сам, и остановить его можно с любого.
   */
  useEffect(() => {
    const sync = () => {
      const at = Date.now();
      setNow(at);

      const stored = readStored();
      if (!stored) {
        setSession(null);
        return;
      }

      if (isStale(stored, at)) {
        // Заход кончился давно, человека за экраном не было. Ни задачу
        // отмечать, ни результат показывать не за что — просто убираем.
        writeStored(null);
        claimEnd(stored.id);
        setSession(null);
        return;
      }

      setSession(stored);
    };

    sync();
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  useEffect(() => {
    if (!session) return;

    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);

    // Вернулись из другого приложения — цифра обязана быть верной сразу,
    // а не через секунду: первое, на что человек смотрит, это остаток.
    const onVisible = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [session]);

  useEffect(() => {
    if (!session || now === 0) return;
    if (!isOver(session, now)) return;

    // Момент окончания — когда время вышло, а не когда это заметили.
    // Вкладка могла спать, и от этого числа считается длительность захода.
    end(session, session.startedAt + durationMs(session), 'time');
  }, [session, now, end]);

  const start = useCallback((input: SessionStart): Session | null => {
    // Фокус бывает только один. Второй таймер поверх первого стёр бы счёт
    // первого, и «на что я сейчас смотрю» перестало бы иметь ответ.
    if (readStored()) return null;

    const next: Session = {
      id: newId(),
      kind: input.kind,
      label: input.label,
      minutes: input.minutes,
      startedAt: Date.now(),
      taskId: input.taskId,
      taskSource: input.taskSource,
      sentAtStart: input.sentAtStart,
    };

    writeStored(next);
    setFinished(null);
    setSession(next);
    setNow(Date.now());
    return next;
  }, []);

  const stop = useCallback((): Session | null => {
    // Читаем из хранилища: остановить могли с другого экрана, и состояние
    // этой вкладки могло ещё не догнать.
    const current = readStored() ?? session;
    if (!current) return null;

    end(current, Date.now(), 'stopped');
    return current;
  }, [session, end]);

  const dismiss = useCallback(() => setFinished(null), []);

  const remaining = session && now > 0 ? remainingMs(session, now) : 0;

  return {
    session,
    remaining,
    pct: session ? pctFromRemaining(remaining, session.minutes) : 0,
    over: finished?.reason === 'time',
    finished,
    start,
    stop,
    dismiss,
  };
}

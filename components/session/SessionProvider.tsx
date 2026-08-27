'use client';

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useApp } from '@/components/AppProvider';
import { FocusBar } from '@/components/session/FocusBar';
import { useLanguage } from '@/components/LanguageProvider';
import { celebrate } from '@/lib/feedback';
import { showLocalNotification } from '@/lib/push-client';
import { isRecord, runMinutes, sprintResult, type SessionEnd } from '@/lib/session';
import { useSession } from '@/hooks/useSession';
import { formatMinutes } from '@/lib/tasktime';

type SessionContextValue = ReturnType<typeof useSession>;

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Один заход на всё приложение.
 *
 * Хук хранит состояние в localStorage, но React-состояние у каждого вызова
 * своё: запусти спринт на рассылках — строка фокуса на главной о нём бы не
 * узнала до перезагрузки. Поэтому экземпляр ровно один, и он же рисует
 * строку фокуса поверх любой страницы.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const app = useApp();
  const { t, tf, msgs } = useLanguage();

  /**
   * Чем кончается заход.
   *
   * Задача отмечается только когда время вышло само: «остановил» означает
   * «прервался», а не «сделал», и зачёркивать за это нельзя.
   *
   * XP за спринт не начисляется. Рассылки внутри уже дали свои 8 XP каждая,
   * и платить второй раз значит удвоить шкалу за то же самое действие.
   */
  const onFinish = useCallback(
    (end: SessionEnd) => {
      const { session, at, reason } = end;

      if (session.kind === 'task') {
        if (reason !== 'time' || !session.taskId || !session.taskSource) return;

        void app.completeTask(session.taskId, session.taskSource);
        celebrate('add', app.profile?.sound_enabled ?? false);
        void showLocalNotification(
          t.time.sprintDone,
          tf(t.time.taskTimerDone, { title: session.label }),
        );
        return;
      }

      const minutes = runMinutes(session, at);
      const result = sprintResult({
        sentAtStart: session.sentAtStart,
        sentNow: app.quota.sent,
        minutes,
      });

      const record = isRecord(
        result.count,
        result.minutes,
        app.profile?.sprint_record ?? 0,
        app.profile?.sprint_record_minutes ?? 0,
      );

      if (record) {
        void app.updateProfile({
          sprint_record: result.count,
          sprint_record_minutes: result.minutes,
        });
      }

      celebrate(record ? 'close' : 'add', app.profile?.sound_enabled ?? false);

      void showLocalNotification(
        record ? t.time.sprintNewRecord : t.time.sprintDone,
        result.count === 0
          ? t.time.sprintZero
          : tf(t.time.sprintCount, {
              n: result.count,
              unit: msgs(result.count),
              t: formatMinutes(result.minutes, t),
            }),
      );
    },
    [app, t, tf, msgs],
  );

  const session = useSession(onFinish);

  const value = useMemo(() => session, [session]);

  /** Сколько рассылок сделано за идущий заход. */
  const sentInSession =
    session.session?.kind === 'outreach'
      ? Math.max(0, app.quota.sent - (session.session.sentAtStart ?? 0))
      : undefined;

  return (
    <SessionContext.Provider value={value}>
      {children}

      {/*
        Строка фокуса стоит поверх всего и на всех страницах: заход идёт, пока
        человек ходит между рассылками и главной, и таймер, который видно
        только на одном экране, — это таймер, про который забыли.
      */}
      {session.session && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[55] px-4 pt-[calc(8px+env(safe-area-inset-top))] md:pl-[248px] md:pr-8">
          <div className="pointer-events-auto mx-auto max-w-lg md:mx-0 md:max-w-xl">
            <FocusBar
              session={session.session}
              remaining={session.remaining}
              sentInSession={sentInSession}
              recordCount={app.profile?.sprint_record ?? 0}
              onStop={() => session.stop()}
            />
          </div>
        </div>
      )}
    </SessionContext.Provider>
  );
}

export function useFocusSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useFocusSession must be used inside <SessionProvider>');
  return ctx;
}

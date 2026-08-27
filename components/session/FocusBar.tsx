'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Send, Timer, Trophy, X } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import {
  formatClock,
  isFinalStretch,
  pctFromRemaining,
  type Session,
} from '@/lib/session';

type FocusBarProps = {
  session: Session;
  /** Остаток в миллисекундах — считает хук, здесь только рисуем. */
  remaining: number;
  /** Сколько рассылок сделано за заход. Только для спринта. */
  sentInSession?: number;
  /**
   * Рекорд, который сейчас бьётся.
   *
   * Без него момент побития показать нечем, а он и есть единственная награда
   * за спринт: XP внутри захода уже начислены за сами рассылки.
   */
  recordCount?: number;
  onStop: () => void;
  className?: string;
};

/**
 * Строка идущей сессии — то, что видно на всех экранах, пока идёт заход.
 *
 * Заметная, но не орущая. Человек в этот момент работает: мигающий красный
 * он не сможет игнорировать, а игнорировать придётся — иначе таймер станет
 * второй задачей поверх первой. Поэтому обычное состояние строки — белое на
 * стекле, ровно как остальной интерфейс, и меняется оно ровно дважды: на
 * последней минуте и в момент, когда рекорд перебит.
 *
 * Состояния не держит: остаток и счёт приходят пропами. Строка живёт на
 * каждой странице сразу, и два экземпляра с собственными счётчиками
 * разошлись бы между собой.
 */
export function FocusBar({
  session,
  remaining,
  sentInSession,
  recordCount = 0,
  onStop,
  className = '',
}: FocusBarProps) {
  const { t, tf, msgs } = useLanguage();

  const pct = pctFromRemaining(remaining, session.minutes);
  const final = isFinalStretch(remaining);
  const clock = formatClock(remaining);

  const isSprint = session.kind === 'outreach';
  const count = Math.max(0, sentInSession ?? 0);
  /*
   * Рекорд считается побитым строго по превышению.
   *
   * Равное число — ещё не рекорд: заход той же длины с тем же результатом
   * ничего нового не доказал, а «Новый рекорд» на повторении обесценивает
   * саму надпись. Плотность решает только при равном счёте в итоге захода
   * (см. isRecord), и на живой строке это считать нечестно: заход ещё идёт.
   */
  const beaten = isSprint && recordCount > 0 && count > recordCount;

  const Icon = isSprint ? Send : Timer;

  return (
    <motion.div
      // Появление означает событие: заход начался. Дальше строка просто есть.
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      /*
        Ширина ограничена намеренно. На мониторе строка во всю ширину
        разносила название и часы на метр друг от друга: чтобы прочитать
        остаток, приходилось переводить взгляд через весь экран — а смотрят
        на него мельком и часто. Полоса времени внутри при этом остаётся
        честной, потому что мерит долю, а не пиксели.
      */
      className={`glass-flat relative w-full max-w-xl overflow-hidden rounded-2xl ${className}`}
    >
      {/* Вспышка в момент побития рекорда: один раз, полсекунды, без цвета.
          Это единственное «поздравляю», которое можно себе позволить, пока
          человек работает. */}
      <AnimatePresence>
        {beaten && (
          <motion.span
            key="flash"
            aria-hidden="true"
            initial={{ opacity: 0.16 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="pointer-events-none absolute inset-0 bg-white"
          />
        )}
      </AnimatePresence>

      <div className="relative flex items-center gap-2.5 px-3 py-2 pb-2.5">
        <Icon size={16} className="shrink-0 text-white/40" />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold leading-tight">
            {isSprint ? t.time.sprintRunning : tf(t.time.focusOn, { title: session.label })}
          </p>

          {isSprint && (
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs leading-tight">
              <span className={`tabular-nums ${beaten ? 'font-bold text-white' : 'text-white/45'}`}>
                {count} {msgs(count)}
              </span>

              <AnimatePresence initial={false}>
                {beaten && (
                  <motion.span
                    key="record"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 20 }}
                    className="flex shrink-0 items-center gap-1 font-bold text-accent-var"
                  >
                    <Trophy size={12} />
                    {t.time.sprintNewRecord}
                  </motion.span>
                )}
              </AnimatePresence>
            </p>
          )}
        </div>

        {/*
          Часы. Жёлтым на последней минуте, и это не украшение: до конца
          осталось меньше, чем занимает одно сообщение, — либо дожимай, либо
          останавливай. Красный тут был бы враньём: ничего не сломалось.
        */}
        <span
          aria-label={tf(t.time.sprintLeft, { t: clock })}
          className={`shrink-0 text-base font-extrabold tabular-nums transition-colors duration-500 ${
            final ? 'text-warn' : 'text-white'
          }`}
        >
          {clock}
        </span>

        <button
          type="button"
          onClick={onStop}
          aria-label={t.time.sprintStop}
          className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X size={18} />
        </button>
      </div>

      {/* Полоса времени по нижнему краю. Тонкая намеренно: это фон, за
          которым не следят, но по которому боковым зрением видно, много ли
          осталось. */}
      <div
        className="absolute inset-x-0 bottom-0 h-[2px] bg-white/10"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <motion.div
          className="h-full"
          style={{ backgroundColor: final ? '#FFD166' : 'rgba(255,255,255,0.55)' }}
          initial={false}
          animate={{
            width: `${pct}%`,
            // Дыхание только на последней минуте и только по яркости: полоса,
            // которая пульсирует шириной, читается как ошибка расчёта.
            opacity: final ? [1, 0.5, 1] : 1,
          }}
          transition={{
            // Линейно и ровно на секунду — полоса ползёт непрерывно, а не
            // дёргается раз в тик.
            width: { duration: 1, ease: 'linear' },
            opacity: final
              ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0.3 },
          }}
        />
      </div>
    </motion.div>
  );
}

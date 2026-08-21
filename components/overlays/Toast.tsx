'use client';

import { AnimatePresence, motion } from 'framer-motion';

export type ToastTone = 'normal' | 'round' | 'record';

export type ToastData = {
  /** Уникальный номер показа. Смена id перезапускает анимацию — даже если текст тот же. */
  id: number;
  text: string;
  tone: ToastTone;
};

type ToastProps = {
  /** null — ничего не показано. Очередь и таймер (1.5 с по ТЗ §12) держит родитель. */
  toast: ToastData | null;
};

/*
 * Оформление по тону. Обычный тост не должен спорить с контентом: он
 * подтверждает рутинное действие и сразу уходит. Рекорд — редкое событие,
 * ему можно и свечение, и цвет.
 */
const TONE_CLASS: Record<ToastTone, string> = {
  normal: 'glass text-white',
  round: 'glass-flat rounded-full border-white/20 bg-white/10 text-white',
  record:
    'glass-flat rounded-full border-[rgba(255,209,102,0.45)] bg-[rgba(255,209,102,0.12)] text-warn shadow-glow-white',
};

const TONE_TEXT: Record<ToastTone, string> = {
  normal: 'text-sm font-bold',
  round: 'text-sm font-bold',
  record: 'text-sm font-extrabold',
};

/**
 * Всплывающий тост над контентом (ТЗ §12, шаг 5).
 *
 * Чистое отображение: ничего не знает ни про XP, ни про таймеры. Текст
 * приходит готовым — так один компонент обслуживает и «+8 XP · Рассылка
 * добавлена», и круглое число, и рекорд.
 */
export function Toast({ toast }: ToastProps) {
  return (
    // mode="wait" — два тоста стоят в одной точке экрана, накладываться им нельзя.
    <AnimatePresence mode="wait">
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: -28, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          // Уезжает вверх и слегка ужимается — как будто втягивается обратно.
          exit={{ opacity: 0, y: -20, scale: 0.96, transition: { duration: 0.25, ease: 'easeIn' } }}
          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
          /*
           * pointer-events-none: тост ничего не делает по тапу и не должен
           * перехватывать нажатия по таблице под ним.
           *
           * z-89 — выше оверлея закрытой квоты (88) и ниже повышения уровня
           * (90). Обычно тост и оверлей квоты не встречаются: каскад гасит
           * тост в пользу оверлея. Исключение одно — возврат щита, и оно
           * как раз совпадает с закрытием квоты по времени.
           */
          className="pointer-events-none fixed inset-x-0 top-[calc(12px+env(safe-area-inset-top))] z-[89] flex justify-center px-4"
        >
          <div
            role="status"
            aria-live="polite"
            className={`max-w-sm px-4 py-2.5 ${TONE_CLASS[toast.tone]}`}
          >
            {/* Текст рекорда длинный — на 375px он должен переноситься, а не вылезать. */}
            <p className={`text-center leading-snug ${TONE_TEXT[toast.tone]}`}>{toast.text}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

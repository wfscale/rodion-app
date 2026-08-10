'use client';

import { AnimatePresence, motion } from 'framer-motion';

type XpBadgeProps = {
  /** Меняется на новое значение — badge проигрывается заново. null = скрыт. */
  event: { id: number; amount: number } | null;
  className?: string;
};

/**
 * «+10 XP» вылетает вверх и растворяется.
 * Рендерится внутри relative-контейнера и не влияет на layout (pointer-events-none).
 */
export function XpBadge({ event, className = '' }: XpBadgeProps) {
  return (
    <div
      className={`pointer-events-none absolute z-20 select-none ${className}`}
      aria-hidden="true"
    >
      <AnimatePresence>
        {event && (
          <motion.span
            key={event.id}
            initial={{ opacity: 0, y: 6, scale: 0.8 }}
            animate={{ opacity: 1, y: -26, scale: 1 }}
            exit={{ opacity: 0, y: -44, scale: 0.9 }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            className="whitespace-nowrap text-sm font-extrabold text-success drop-shadow-[0_0_10px_rgba(100,255,140,0.5)]"
          >
            +{event.amount} XP
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Глобальный вариант — для действий вне чеклиста (рассылки, заметки, чекин).
 * Показывается по центру над нижней навигацией.
 */
export function FloatingXp({ event }: { event: { id: number; amount: number } | null }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-[70] flex justify-center">
      <AnimatePresence>
        {event && (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, y: 20, scale: 0.85 }}
            animate={{ opacity: 1, y: -10, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-full border border-[rgba(100,255,140,0.3)] bg-[rgba(100,255,140,0.12)] px-4 py-2 text-base font-extrabold text-success backdrop-blur-glass"
          >
            +{event.amount} XP
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

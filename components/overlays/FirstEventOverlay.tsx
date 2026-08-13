'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { useLanguage } from '@/components/LanguageProvider';

export type FirstEventKind = 'reply' | 'call' | 'closed';

type FirstEventOverlayProps = {
  /** null — оверлей скрыт. Смена значения перезапускает анимацию и таймер. */
  kind: FirstEventKind | null;
  /** Сколько XP начислено за событие: 80 / 250 / 1000. */
  xp: number;
  onDismiss: () => void;
};

/** Сколько живёт экран, если пользователь не тапнул. Из ТЗ §5 — 4 секунды. */
const AUTO_DISMISS_MS = 4000;

/*
 * Кривая «резкого, уверенного» входа: мгновенный старт, длинный доводящий
 * хвост (expo-out). Пружину здесь намеренно не используем — отскок читается
 * как игривость, а этот экран должен читаться как удар.
 */
const SHARP = [0.16, 1, 0.3, 1] as const;

/**
 * Полноэкранный оверлей первого события воронки (ТЗ §5).
 *
 * Показывается ровно один раз за всё время на каждый тип события — решение
 * «первое ли это» принимает родитель, компонент только рисует.
 */
export function FirstEventOverlay({ kind, xp, onDismiss }: FirstEventOverlayProps) {
  const { t } = useLanguage();

  useEffect(() => {
    if (kind === null) return;
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [kind, onDismiss]);

  // Ключи собираются из kind: replyTitle / callTitle / closedTitle и т.д.
  const copy = kind
    ? { title: t.firstEvents[`${kind}Title`], body: t.firstEvents[`${kind}Body`] }
    : null;

  // В переводах строки разделены \n — каждая строка проявляется отдельно.
  const lines = copy ? copy.body.split('\n') : [];

  return (
    <AnimatePresence>
      {kind !== null && copy && (
        <motion.div
          key={kind}
          role="dialog"
          aria-modal="true"
          aria-label={copy.title}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          // Выход — плавный fade, вдвое медленнее входа: экран «отпускает».
          exit={{ opacity: 0, transition: { duration: 0.5, ease: 'easeInOut' } }}
          transition={{ duration: 0.12, ease: 'linear' }}
          onClick={onDismiss}
          className="fixed inset-0 z-[95] flex cursor-pointer flex-col items-center justify-center bg-ink px-8 text-center"
        >
          {/* Заголовок: приходит сверху и «встаёт» — самый весомый элемент. */}
          <motion.h2
            initial={{ opacity: 0, y: -18, letterSpacing: '0.3em' }}
            animate={{ opacity: 1, y: 0, letterSpacing: '0.14em' }}
            transition={{ duration: 0.45, ease: SHARP, delay: 0.05 }}
            className="text-2xl font-extrabold uppercase leading-tight text-white sm:text-3xl"
          >
            {copy.title}
          </motion.h2>

          <div className="mt-10 flex flex-col gap-2">
            {lines.map((line, i) => (
              <motion.p
                key={`${i}-${line}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                // Построчно, по 220 мс: текст читается в темпе речи, не сразу.
                transition={{ duration: 0.4, ease: SHARP, delay: 0.5 + i * 0.22 }}
                className="text-xl font-bold leading-snug text-white sm:text-2xl"
              >
                {line}
              </motion.p>
            ))}
          </div>

          {/* XP — последним, когда текст уже прочитан. */}
          <motion.p
            initial={{ opacity: 0, scale: 0.86 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 0.5,
              ease: SHARP,
              delay: 0.5 + lines.length * 0.22 + 0.15,
            }}
            className="mt-12 text-4xl font-extrabold tracking-tight text-white drop-shadow-[0_0_28px_rgba(255,255,255,0.28)] sm:text-5xl"
          >
            +{xp} XP
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

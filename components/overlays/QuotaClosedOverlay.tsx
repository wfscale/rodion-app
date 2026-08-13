'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useLanguage } from '@/components/LanguageProvider';

type QuotaClosedOverlayProps = {
  open: boolean;
  /** XP за закрытую квоту — 100 по ТЗ §3, но число приходит снаружи. */
  xp: number;
  onContinue: () => void;
  onStop: () => void;
};

/**
 * Полупрозрачный оверлей «КВОТА ЗАКРЫТА» (ТЗ §14).
 *
 * Сам не закрывается по таймеру: это точка выбора — продолжать бонусные
 * рассылки или закончить день. Автозакрытие отняло бы выбор и обесценило
 * момент. Тап по фону тоже не закрывает — только кнопки.
 *
 * «Держится 2 секунды» из ТЗ реализовано как темп раскрытия: заголовок и XP
 * приходят сразу, вопрос и кнопки — к концу второй секунды, поэтому человек
 * успевает прочувствовать поздравление до того, как начнёт выбирать.
 */
export function QuotaClosedOverlay({ open, xp, onContinue, onStop }: QuotaClosedOverlayProps) {
  const { t } = useLanguage();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={t.quotaOverlay.title}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.35, ease: 'easeInOut' } }}
          transition={{ duration: 0.18, ease: 'linear' }}
          className="fixed inset-0 z-[88] flex flex-col items-center justify-center bg-black/75 px-8 text-center backdrop-blur-xl"
        >
          <motion.p
            initial={{ opacity: 0, y: -14, letterSpacing: '0.3em' }}
            animate={{ opacity: 1, y: 0, letterSpacing: '0.16em' }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
            className="text-xl font-extrabold uppercase leading-tight text-white sm:text-2xl"
          >
            {t.quotaOverlay.title}
          </motion.p>

          <motion.p
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 240, damping: 18, delay: 0.35 }}
            className="mt-6 text-4xl font-extrabold tracking-tight text-white drop-shadow-[0_0_24px_rgba(255,255,255,0.25)]"
          >
            +{xp} XP
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 1.1 }}
            className="mt-8 text-lg font-bold text-white"
          >
            {t.quotaOverlay.question}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 1.5 }}
            className="mt-8 flex w-full max-w-xs flex-col gap-3"
          >
            <button type="button" onClick={onContinue} className="btn-primary w-full">
              {t.quotaOverlay.continue}
            </button>
            <button type="button" onClick={onStop} className="btn-ghost w-full">
              {t.quotaOverlay.stop}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

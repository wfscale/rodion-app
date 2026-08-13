'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useLanguage } from '@/components/LanguageProvider';
import type { FeatureKey } from '@/lib/xp';

type LevelUpOverlayProps = {
  /** null — оверлей скрыт. Номер достигнутого уровня, 1..9. */
  level: number | null;
  /**
   * Что открылось на этом уровне. null — уровни 8 и 9: по ТЗ §4 они
   * открываются без анонса, показываем только номер и название.
   */
  featureKey: FeatureKey | null;
  onDismiss: () => void;
};

/**
 * Полноэкранная анимация повышения уровня (ТЗ §4).
 *
 * Таймера автозакрытия нет намеренно: экран сообщает о новом функционале,
 * его нужно успеть прочитать. Закрывается тапом в любом месте или кнопкой.
 */
export function LevelUpOverlay({ level, featureKey, onDismiss }: LevelUpOverlayProps) {
  const { t } = useLanguage();

  // Названия уровней живут только в словаре; за границей массива берём последнее.
  const name = level ? (t.levels[level - 1] ?? t.levels[t.levels.length - 1]) : '';

  // Анонс собирается из двух строк: фраза уровня + название самой фичи.
  const unlock = featureKey
    ? { phrase: t.features[`${featureKey}Unlock`], feature: t.features[featureKey] }
    : null;

  return (
    <AnimatePresence>
      {level !== null && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={`${t.levelUp.title} ${level} ${name}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.45, ease: 'easeInOut' } }}
          transition={{ duration: 0.15, ease: 'linear' }}
          onClick={onDismiss}
          className="fixed inset-0 z-[90] flex cursor-pointer flex-col items-center justify-center overflow-hidden bg-ink px-8 text-center"
        >
          {/* Расходящиеся кольца — ударная волна из центра, чистая декорация. */}
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              aria-hidden
              initial={{ scale: 0.2, opacity: 0.45 }}
              animate={{ scale: 2.8, opacity: 0 }}
              transition={{ duration: 2.4, delay: i * 0.5, ease: 'easeOut' }}
              className="pointer-events-none absolute h-56 w-56 rounded-full border border-white/30"
            />
          ))}

          <div className="relative z-10 flex w-full max-w-sm flex-col items-center">
            <motion.p
              initial={{ opacity: 0, letterSpacing: '0.4em' }}
              animate={{ opacity: 1, letterSpacing: '0.16em' }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
              className="text-xs font-bold uppercase text-white/50"
            >
              {t.levelUp.title}
            </motion.p>

            <motion.p
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 15, delay: 0.3 }}
              className="mt-4 text-5xl font-extrabold tracking-tight text-white drop-shadow-[0_0_32px_rgba(255,255,255,0.35)]"
            >
              {level}
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.55 }}
              className="mt-3 text-2xl font-extrabold text-white"
            >
              {name}
            </motion.p>

            {unlock && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.95 }}
                className="mt-10 w-full border-t border-glass-border pt-8"
              >
                <p className="text-lg font-bold leading-snug text-white">{unlock.phrase}</p>

                <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-white/40">
                  {t.levelUp.unlocked}
                </p>
                <p className="mt-2 text-xl font-extrabold text-white">{unlock.feature}</p>
              </motion.div>
            )}

            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              // Кнопка появляется последней, чтобы не увести взгляд с анонса.
              transition={{ duration: 0.4, delay: unlock ? 1.7 : 1.1 }}
              onClick={onDismiss}
              className="mt-12 min-h-[44px] rounded-full border border-glass-border px-7 text-sm font-bold text-white/70"
            >
              {t.levelUp.continue}
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

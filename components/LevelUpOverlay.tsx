'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { useLanguage } from '@/components/LanguageProvider';

type LevelUpOverlayProps = {
  level: number | null;
  onDismiss: () => void;
};

/** Полноэкранное поздравление при повышении уровня. Живёт ~3 секунды. */
export function LevelUpOverlay({ level, onDismiss }: LevelUpOverlayProps) {
  const { t } = useLanguage();

  useEffect(() => {
    if (level === null) return;
    const timer = setTimeout(onDismiss, 3200);
    return () => clearTimeout(timer);
  }, [level, onDismiss]);

  const name = level ? (t.levels[level - 1] ?? t.levels[t.levels.length - 1]) : '';

  return (
    <AnimatePresence>
      {level !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          onClick={onDismiss}
          className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-black/80 px-6 backdrop-blur-xl"
        >
          {/* Расходящиеся кольца */}
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              initial={{ scale: 0.2, opacity: 0.5 }}
              animate={{ scale: 2.6, opacity: 0 }}
              transition={{ duration: 2.2, delay: i * 0.45, ease: 'easeOut' }}
              className="absolute h-56 w-56 rounded-full border border-white/40"
            />
          ))}

          <motion.div
            initial={{ scale: 0.6, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 180, damping: 16, delay: 0.1 }}
            className="relative z-10 flex flex-col items-center text-center"
          >
            <motion.p
              initial={{ letterSpacing: '0.4em', opacity: 0 }}
              animate={{ letterSpacing: '0.14em', opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="text-xs font-bold uppercase text-white/50"
            >
              {t.levelUp.title}
            </motion.p>

            <motion.p
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 14, delay: 0.35 }}
              className="mt-4 text-5xl font-extrabold tracking-tight drop-shadow-[0_0_30px_rgba(255,255,255,0.35)]"
            >
              {level}
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="mt-3 text-2xl font-extrabold"
            >
              {name}
            </motion.p>

            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 1.2 }}
              onClick={onDismiss}
              className="mt-10 min-h-[44px] rounded-full border border-white/20 px-6 text-sm font-bold text-white/70"
            >
              {t.levelUp.continue}
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { UNLOCKS } from '@/lib/unlocks';

/** Уведомление о новой недельной разблокировке. */
export function UnlockToast({
  level,
  onDismiss,
}: {
  level: number | null;
  onDismiss: () => void;
}) {
  const { t } = useLanguage();

  // Уровни выше 5 всегда означают новую привычку из пула.
  const def = level ? (UNLOCKS[Math.min(level, UNLOCKS.length) - 1] ?? null) : null;

  return (
    <AnimatePresence>
      {level !== null && def && (
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -24 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          className="fixed inset-x-4 top-[calc(12px+env(safe-area-inset-top))] z-[80] mx-auto max-w-md"
        >
          <div className="glass flex items-start gap-3 border-[rgba(255,209,102,0.28)] bg-[rgba(255,209,102,0.07)] p-4">
            <div className="mt-0.5 shrink-0 text-warn">
              <Sparkles size={20} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-warn">
                {t.unlocks.newUnlock}
              </p>
              <p className="mt-1 text-base font-extrabold leading-snug">
                {t.unlocks[def.titleKey]}
              </p>
              <p className="mt-1 text-sm leading-snug text-muted">
                {t.unlocks[def.descKey]}
              </p>
            </div>

            <button
              type="button"
              onClick={onDismiss}
              aria-label={t.common.close}
              className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/40 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

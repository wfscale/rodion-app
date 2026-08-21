'use client';

import { motion } from 'framer-motion';
import { Clock, Pause, Shield } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { ProgressBar } from '@/components/XpBar';
import { formatTimeLeft } from '@/lib/date';
import type { BurnLevel, GuardView } from '@/lib/shield';

type BurnTimerProps = {
  guard: GuardView;
  sent: number;
  quota: number;
  /** Серия закрытых дней — её и защищает щит. */
  streak: number;
  /** Взвести щит прямо отсюда. Кнопка появляется только под вечер. */
  onArm: () => void;
};

/** Цвет времени: чем меньше осталось, тем громче строка. */
const BURN_TEXT: Record<BurnLevel, string> = {
  safe: 'text-white/55',
  warn: 'text-warn',
  danger: 'text-danger',
};

const BURN_BAR: Record<BurnLevel, string> = {
  safe: 'rgba(255,255,255,0.35)',
  warn: '#FFD166',
  danger: '#FF6B6B',
};

/**
 * Компактная строка «сколько осталось до сгорания дня» — под счётчиком
 * рассылок на главной.
 *
 * Появляется только когда день ещё не закрыт: подгонять человека, который
 * своё уже сделал, нечем. Кнопка «засейвить» показывается не весь день, а с
 * той минуты, когда решение реально принимается (шесть часов до конца) —
 * аварийный выход, доступный всегда, перестаёт быть аварийным, и квота
 * рядом с ним теряет вес.
 */
export function BurnTimer({ guard, sent, quota, streak, onArm }: BurnTimerProps) {
  const { t, tf, lang } = useLanguage();

  const left = Math.max(0, quota - sent);
  if (left === 0) return null;

  // Доля суток, которая ещё не прошла: то же число, что и в тексте, но
  // видное боковым зрением.
  const pct = Math.max(0, Math.min(100, (guard.minutesLeft / 1440) * 100));

  if (guard.today === 'pause') {
    return (
      <div className="glass flex items-center gap-3 px-4 py-3">
        <Pause size={17} className="shrink-0 text-white/40" />
        <p className="min-w-0 flex-1 truncate text-sm font-bold text-white/70">
          {tf(t.guard.paused, { n: guard.pauseDay })}
        </p>
        <span className="shrink-0 text-sm font-extrabold tabular-nums text-white/45">
          {streak}
        </span>
      </div>
    );
  }

  if (guard.today === 'shield') {
    return (
      <div className="glass border-[rgba(100,255,140,0.28)] bg-[rgba(100,255,140,0.06)] px-4 py-3">
        <div className="flex items-center gap-3">
          <Shield size={17} className="shrink-0 text-success" fill="currentColor" />
          <p className="min-w-0 flex-1 truncate text-sm font-bold text-success">
            {t.guard.armed}
          </p>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-white/45">
            {tf(t.guard.burnLeft, { n: left })}
          </span>
        </div>
      </div>
    );
  }

  const showArm = guard.ready && guard.canArm && guard.burn !== 'safe';

  return (
    <div className="glass px-4 py-3">
      <div className="flex items-center gap-3">
        <motion.span
          animate={guard.burn === 'danger' ? { opacity: [1, 0.45, 1] } : { opacity: 1 }}
          transition={
            guard.burn === 'danger'
              ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0.2 }
          }
          className={`shrink-0 ${BURN_TEXT[guard.burn]}`}
        >
          <Clock size={17} />
        </motion.span>

        <p className={`min-w-0 flex-1 truncate text-sm font-bold ${BURN_TEXT[guard.burn]}`}>
          {tf(t.guard.burn, { t: formatTimeLeft(guard.minutesLeft, lang) })}
        </p>

        <span className="shrink-0 text-sm font-semibold tabular-nums text-white/45">
          {tf(t.guard.burnLeft, { n: left })}
        </span>
      </div>

      <ProgressBar pct={pct} color={BURN_BAR[guard.burn]} height={3} className="mt-2.5" />

      {showArm && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          whileTap={{ scale: 0.97 }}
          onClick={onArm}
          className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-glass-border bg-white/[0.06] text-sm font-bold text-white/80 hover:bg-white/10"
        >
          <Shield size={15} />
          {t.guard.arm}
        </motion.button>
      )}
    </div>
  );
}

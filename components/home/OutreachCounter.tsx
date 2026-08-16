'use client';

import { motion } from 'framer-motion';
import { GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { ProgressBar } from '@/components/XpBar';
import { quotaPct } from '@/lib/quota';

type OutreachCounterProps = {
  /** Сколько рассылок отправлено сегодня. */
  sent: number;
  /** Дневная квота — растёт сама, здесь только показывается. */
  quota: number;
  /** Лучший день за всё время. */
  record: number;
  /** Сколько закрытых дней осталось до роста квоты (0 — квота на максимуме). */
  daysToGrow: number;
  /** Какой станет квота после следующего роста. */
  nextQuota: number;
  /** Овердрайв (18-й уровень): вторая, двойная планка дня. */
  showOverdrive?: boolean;
};

/**
 * Главный элемент экрана. Кольца прогресса дня больше нет: его место занял
 * счётчик рассылок, потому что рассылки — единственное действие, которое
 * меняет жизнь. Всё остальное на экране должно проигрывать этому числу
 * по размеру и яркости.
 */
export function OutreachCounter({
  sent,
  quota,
  record,
  daysToGrow,
  nextQuota,
  showOverdrive = false,
}: OutreachCounterProps) {
  const { t, tf } = useLanguage();

  const pct = quotaPct(sent, quota);
  const done = sent >= quota;
  // 80%+ — бар начинает мягко пульсировать: «ты почти там».
  const nearGoal = !done && pct >= 80;

  // Овердрайв появляется только после закрытой квоты: до неё вторая планка
  // отвлекала бы от первой.
  const overdriveTarget = quota * 2;
  const overdrivePct = quotaPct(sent, overdriveTarget);
  const overdriveDone = sent >= overdriveTarget;

  return (
    <GlassCard className="p-6">
      <p className="section-label text-center">{t.home.today}</p>

      {/*
       * key={sent} специально: при росте числа React пересоздаёт узел и
       * initial проигрывается заново — число «прыгает» вверх и меняется.
       */}
      <div
        className="mt-1 flex justify-center"
        aria-live="polite"
        aria-atomic="true"
      >
        <motion.span
          key={sent}
          initial={{ y: 22, scale: 0.86, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 20 }}
          style={
            // Белое свечение — единственный визуальный «приз» за закрытую квоту.
            done ? { textShadow: '0 0 44px rgba(255,255,255,0.55)' } : undefined
          }
          className={`block text-[96px] font-extrabold leading-none tracking-tight tabular-nums ${
            done ? 'text-white' : 'text-white/85'
          }`}
        >
          {sent}
        </motion.span>
      </div>

      <p className="mt-2 text-center text-base font-semibold text-muted">
        {tf(t.home.ofQuota, { n: quota })}
      </p>

      <motion.div
        className="mt-4 flex items-center gap-3"
        animate={nearGoal ? { opacity: [1, 0.55, 1] } : { opacity: 1 }}
        transition={
          nearGoal
            ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.2 }
        }
      >
        <ProgressBar pct={pct} height={8} className="flex-1" />
        <span className="w-11 shrink-0 text-right text-sm font-bold tabular-nums text-white/60">
          {pct}%
        </span>
      </motion.div>

      {showOverdrive && done && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mt-3"
        >
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-wide text-warn">
              {tf(t.overdrive.label, { n: overdriveTarget })}
            </span>
            <span className="text-xs tabular-nums text-white/35">
              {overdriveDone ? t.overdrive.done : `${sent} / ${overdriveTarget}`}
            </span>
          </div>
          <ProgressBar pct={overdrivePct} color="#FFD166" height={6} />
        </motion.div>
      )}

      {done && (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mt-4 text-center text-sm font-bold leading-relaxed text-white"
        >
          {t.home.quotaClosed}
        </motion.p>
      )}

      {/* Показатели квоты — мелко, под счётчиком: это контекст, а не событие. */}
      <div className="mt-5 border-t border-divider pt-4">
        <div className="flex items-center justify-center gap-5 text-sm">
          <span>
            <span className="text-white/35">{t.home.quotaCurrent}</span>{' '}
            <b className="font-extrabold tabular-nums">{quota}</b>
          </span>
          <span aria-hidden="true" className="text-white/15">
            ·
          </span>
          <span>
            <span className="text-white/35">{t.home.record}</span>{' '}
            <b className="font-extrabold tabular-nums">{record}</b>
          </span>
        </div>

        <p className="mt-2 text-center text-xs text-white/35">
          {daysToGrow > 0
            ? tf(t.home.quotaGrows, { n: daysToGrow, q: nextQuota })
            : t.home.quotaMax}
        </p>
      </div>
    </GlassCard>
  );
}

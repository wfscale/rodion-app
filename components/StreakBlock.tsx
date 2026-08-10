'use client';

import { motion } from 'framer-motion';
import { Flame } from 'lucide-react';
import { GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';

type StreakBlockProps = {
  streak: number;
  longest: number;
  threshold: number;
  /** Сегодняшний день уже засчитан в серию. */
  todayCounted: boolean;
  delay?: number;
};

/** Большая карточка серии для страницы прогресса. */
export function StreakBlock({
  streak,
  longest,
  threshold,
  todayCounted,
  delay = 0,
}: StreakBlockProps) {
  const { t, tf, days } = useLanguage();

  return (
    <GlassCard delay={delay} className="relative overflow-hidden p-5">
      {/* Тёплое свечение за огнём — единственное цветное пятно на экране */}
      {streak > 0 && (
        <div
          className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, #FF8A3D 0%, transparent 70%)' }}
          aria-hidden="true"
        />
      )}

      <div className="relative flex items-center gap-4">
        <motion.div
          animate={
            streak > 0
              ? { scale: [1, 1.09, 1], rotate: [0, -3, 3, 0] }
              : { scale: 1, rotate: 0 }
          }
          transition={{ duration: 2.6, repeat: streak > 0 ? Infinity : 0, ease: 'easeInOut' }}
          className={streak > 0 ? 'text-[#FF8A3D]' : 'text-white/20'}
        >
          <Flame size={52} strokeWidth={1.6} fill={streak > 0 ? '#FF8A3D' : 'none'} />
        </motion.div>

        <div className="min-w-0 flex-1">
          <p className="text-4xl font-extrabold leading-none tracking-tight">{streak}</p>
          <p className="mt-1 text-base font-bold">
            {days(streak)} {t.progress.streakTitle}
          </p>
        </div>

        {longest > 0 && (
          <div className="shrink-0 text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/35">
              {t.progress.longest}
            </p>
            <p className="text-lg font-extrabold">{longest}</p>
          </div>
        )}
      </div>

      <p className="relative mt-4 text-sm leading-relaxed text-muted">
        {streak === 0
          ? t.progress.streakZero
          : tf(t.progress.streakHint, { n: threshold })}
      </p>

      {streak > 0 && !todayCounted && (
        <p className="relative mt-2 text-sm font-semibold text-warn">
          {tf(t.progress.streakHint, { n: threshold })}
        </p>
      )}
    </GlassCard>
  );
}

/** Компактный индикатор серии для хедера главной. */
export function StreakPill({ streak }: { streak: number }) {
  const active = streak > 0;

  return (
    <div
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 ${
        active
          ? 'border-[rgba(255,138,61,0.35)] bg-[rgba(255,138,61,0.12)]'
          : 'border-glass-border bg-white/[0.05]'
      }`}
    >
      <motion.span
        animate={active ? { scale: [1, 1.15, 1] } : {}}
        transition={{ duration: 2.4, repeat: active ? Infinity : 0, ease: 'easeInOut' }}
        className={active ? 'text-[#FF8A3D]' : 'text-white/25'}
      >
        <Flame size={16} strokeWidth={2} fill={active ? '#FF8A3D' : 'none'} />
      </motion.span>
      <span className={`text-sm font-extrabold ${active ? 'text-white' : 'text-white/35'}`}>
        {streak}
      </span>
    </div>
  );
}

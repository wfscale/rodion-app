'use client';

import { motion } from 'framer-motion';
import { Pause, Play, RotateCcw, Timer } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CardTitle, GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { ProgressBar } from '@/components/XpBar';

const WORK_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

/**
 * Pomodoro 25/5 — разблокировка недели 3.
 *
 * Отсчёт ведётся от абсолютного времени окончания, а не тиками интервала:
 * на телефоне вкладка засыпает, и счётчик «по одной секунде» отстаёт.
 */
export function FocusTimer({ today }: { today: string }) {
  const { t } = useLanguage();

  const [mode, setMode] = useState<'work' | 'break'>('work');
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(WORK_SECONDS);
  const [completed, setCompleted] = useState(0);

  const endsAt = useRef<number | null>(null);
  const storageKey = `rodion.pomodoro.${today}`;

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      setCompleted(stored ? Number(stored) || 0 : 0);
    } catch {
      setCompleted(0);
    }
  }, [storageKey]);

  const total = mode === 'work' ? WORK_SECONDS : BREAK_SECONDS;

  const switchMode = useCallback(
    (next: 'work' | 'break') => {
      setMode(next);
      setRemaining(next === 'work' ? WORK_SECONDS : BREAK_SECONDS);
      setRunning(false);
      endsAt.current = null;

      if (mode === 'work' && next === 'break') {
        setCompleted((previous) => {
          const value = previous + 1;
          try {
            window.localStorage.setItem(storageKey, String(value));
          } catch {
            // не критично
          }
          return value;
        });
      }
    },
    [mode, storageKey],
  );

  useEffect(() => {
    if (!running) return;

    if (endsAt.current === null) endsAt.current = Date.now() + remaining * 1000;

    const tick = () => {
      const left = Math.max(0, Math.round(((endsAt.current ?? 0) - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) switchMode(mode === 'work' ? 'break' : 'work');
    };

    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [running, remaining, mode, switchMode]);

  function toggle() {
    if (running) {
      setRunning(false);
      endsAt.current = null;
    } else {
      endsAt.current = Date.now() + remaining * 1000;
      setRunning(true);
    }
  }

  function reset() {
    setRunning(false);
    endsAt.current = null;
    setRemaining(total);
  }

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <GlassCard delay={2}>
      <CardTitle
        right={
          <span className="text-xs text-white/35">
            {t.focus.done}: {completed}
          </span>
        }
      >
        <span className="inline-flex items-center gap-2">
          <Timer size={15} className="text-white/40" />
          {t.focus.title}
        </span>
      </CardTitle>

      <div className="flex items-center gap-4">
        <motion.p
          key={`${minutes}:${seconds}`}
          initial={{ opacity: 0.75 }}
          animate={{ opacity: 1 }}
          className="min-w-[112px] font-extrabold tabular-nums tracking-tight"
          style={{ fontSize: 40, lineHeight: '44px' }}
        >
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </motion.p>

        <div className="min-w-0 flex-1">
          <p className="mb-2 text-sm font-semibold text-muted">
            {mode === 'work' ? t.focus.work : t.focus.break}
          </p>
          <ProgressBar
            pct={((total - remaining) / total) * 100}
            color={mode === 'work' ? '#FFFFFF' : '#64FF8C'}
          />
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={toggle}
          className="btn-primary flex-1"
        >
          {running ? <Pause size={17} /> : <Play size={17} />}
          {running ? t.focus.pause : t.focus.start}
        </motion.button>

        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={reset}
          aria-label={t.focus.reset}
          className="btn-ghost w-14 shrink-0"
        >
          <RotateCcw size={17} />
        </motion.button>
      </div>
    </GlassCard>
  );
}

'use client';

import { motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import type { ContactStatus } from '@/lib/types';

/** По какому статусу фильтровать список после тапа по уровню. */
export type FunnelTarget = ContactStatus | 'all';

type FunnelChartProps = {
  sent: number;
  replied: number;
  calls: number;
  closed: number;
  onLevelClick: (status: FunnelTarget) => void;
  /** Подсветить уровень снаружи — например, после смены статуса контакта. */
  highlight?: ContactStatus | null;
};

/* Полосы: верхняя всегда во всю ширину, каждая следующая заметно уже. */
const MAX_WIDTH = 100;
const MIN_WIDTH = 14;
const MIN_STEP = 7;
/** Сколько уровень держится подсвеченным после изменения (§14). */
const FLASH_MS = 1000;

/**
 * Реальная ширина по доле дала бы при конверсии 4% нить в пару пикселей —
 * корень сжимает разрыв, форма воронки остаётся читаемой.
 */
function levelWidths(values: number[]): number[] {
  const top = values[0];
  let previous = MAX_WIDTH;

  return values.map((value, index) => {
    if (index === 0) return MAX_WIDTH;
    const ratio = top > 0 ? Math.min(1, value / top) : 0;
    const raw = MIN_WIDTH + (MAX_WIDTH - MIN_WIDTH) * Math.pow(ratio, 0.4);
    // Одинаковые числа на соседних уровнях всё равно должны сужаться:
    // воронка обязана визуально идти вниз.
    const width = Math.max(MIN_WIDTH, Math.min(raw, previous - MIN_STEP));
    previous = width;
    return width;
  });
}

/** Число «доезжает» до нового значения, а не подменяется мгновенно. */
function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;

    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now: number) {
      const progress = Math.min(1, (now - start) / 460);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
      else fromRef.current = value;
    });

    return () => {
      cancelAnimationFrame(frame);
      fromRef.current = value;
    };
  }, [value]);

  return <span className="tabular-nums">{display}</span>;
}

/** Конверсия от предыдущего уровня: до 10% показываем десятую долю. */
function formatRate(value: number, previous: number): string {
  if (previous <= 0) return '0%';
  const pct = (value / previous) * 100;
  return `${pct >= 10 ? Math.round(pct) : Math.round(pct * 10) / 10}%`;
}

export function FunnelChart({
  sent,
  replied,
  calls,
  closed,
  onLevelClick,
  highlight = null,
}: FunnelChartProps) {
  const { t, tf } = useLanguage();

  const values = [sent, replied, calls, closed];
  const widths = levelWidths(values);

  const [flash, setFlash] = useState<number[]>([]);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousValues = useRef(values);

  const triggerFlash = useCallback((indexes: number[]) => {
    if (indexes.length === 0) return;
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlash(indexes);
    flashTimer.current = setTimeout(() => setFlash([]), FLASH_MS);
  }, []);

  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  // Воронка живая: изменилось число — уровень вспыхнул.
  useEffect(() => {
    const next = [sent, replied, calls, closed];
    const changed = next
      .map((value, index) => (value !== previousValues.current[index] ? index : -1))
      .filter((index) => index >= 0);
    previousValues.current = next;
    triggerFlash(changed);
  }, [sent, replied, calls, closed, triggerFlash]);

  useEffect(() => {
    if (!highlight) return;
    const index =
      highlight === 'closed' ? 3 : highlight === 'call' ? 2 : highlight === 'replied' ? 1 : 0;
    triggerFlash([index]);
  }, [highlight, triggerFlash]);

  const levels: { target: FunnelTarget; label: string; value: number }[] = [
    { target: 'all', label: t.outreach.funnelSent, value: sent },
    { target: 'replied', label: t.outreach.funnelReplied, value: replied },
    { target: 'call', label: t.outreach.funnelCall, value: calls },
    { target: 'closed', label: t.outreach.funnelClosed, value: closed },
  ];

  // Чем глубже уровень, тем ярче полоса: внизу воронки то, ради чего всё.
  const tones = ['bg-white/20', 'bg-white/30', 'bg-white/45', 'bg-white/65'];

  const replyRate = sent > 0 ? replied / sent : 0;
  const hint =
    replied === 0 || sent === 0
      ? t.outreach.hintNoReplies
      : replyRate > 0.1
        ? t.outreach.hintAboveAverage
        : tf(t.outreach.hintNextReply, { n: Math.max(1, Math.round(1 / replyRate)) });

  return (
    <GlassCard>
      <div className="space-y-1">
        {levels.map((level, index) => {
          const lit = flash.includes(index);
          return (
            <button
              key={level.target}
              type="button"
              onClick={() => onLevelClick(level.target)}
              className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-1 text-left transition-colors hover:bg-white/[0.04] active:bg-white/[0.06]"
            >
              <span className="flex h-7 flex-1 items-center justify-center">
                <motion.span
                  initial={{ width: '0%' }}
                  animate={{ width: `${widths[index]}%` }}
                  transition={{ type: 'spring', stiffness: 190, damping: 26 }}
                  className={`block h-7 rounded-lg transition-colors duration-300 ${
                    lit ? 'bg-white shadow-glow-white' : tones[index]
                  } ${level.value === 0 ? 'opacity-40' : ''}`}
                />
              </span>

              <span className="w-[104px] shrink-0">
                <span className="block text-lg font-extrabold leading-none">
                  <AnimatedNumber value={level.value} />
                </span>
                <span className="mt-1 block truncate text-xs text-muted">
                  {level.label}
                  {index > 0 && (
                    <span className="ml-1 text-white/30">
                      {formatRate(level.value, values[index - 1])}
                    </span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 border-t border-divider pt-3 text-sm text-muted">{hint}</p>
    </GlassCard>
  );
}

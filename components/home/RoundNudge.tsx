'use client';

import { motion } from 'framer-motion';
import { Target } from 'lucide-react';
import { useMemo } from 'react';
import { useLanguage } from '@/components/LanguageProvider';
import { pickNudge } from '@/lib/round';

type Props = {
  sentToday: number;
  quota: number;
  /** Рассылок за всё время. */
  total: number;
};

/**
 * «Добей до ровного».
 *
 * Механика ровного числа, замеченная на себе: 22 выглядит как брошенная
 * работа, 25 — как законченная. Значит, надо не хвалить за норму, а всё
 * время показывать ближайшее ровное число. Тогда норма перевыполняется
 * каждый день — но ровно настолько, чтобы завтра снова хотелось сесть.
 *
 * Цель всегда одна. Пока квота не закрыта — это квота: два смысла дня
 * размывают первый. После квоты — ровный счёт за день, потом за всё время.
 */
export function RoundNudge({ sentToday, quota, total }: Props) {
  const { t, tf } = useLanguage();

  const nudge = useMemo(
    () => pickNudge({ sentToday, quota, total }),
    [sentToday, quota, total],
  );

  const text = (() => {
    if (nudge.kind === 'quota') return tf(t.nudge.quota, { n: nudge.remaining });
    if (nudge.remaining === 1) return tf(t.nudge.one, { target: nudge.target });
    if (nudge.kind === 'round-day') {
      return tf(t.nudge.roundDay, { have: sentToday, n: nudge.remaining, target: nudge.target });
    }
    return tf(t.nudge.roundTotal, { have: total, n: nudge.remaining, target: nudge.target });
  })();

  // Чем реже цель, тем громче она выглядит: сотня не должна выглядеть
  // как очередная пятёрка.
  const loud = nudge.weight >= 2;

  return (
    <motion.div
      key={`${nudge.kind}-${nudge.target}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={`flex items-start gap-3 rounded-2xl border p-3 ${
        loud
          ? 'border-[rgba(255,209,102,0.3)] bg-[rgba(255,209,102,0.07)]'
          : 'border-glass-border bg-white/[0.04]'
      }`}
    >
      <span className={`mt-0.5 shrink-0 ${loud ? 'text-warn' : 'text-white/45'}`}>
        <Target size={17} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold uppercase tracking-wide text-white/35">
          {t.nudge.title}
        </span>
        <span className={`mt-0.5 block text-sm font-bold leading-snug ${loud ? 'text-warn' : 'text-white'}`}>
          {text}
        </span>
        <span className="mt-1 block text-xs leading-snug text-white/30">{t.nudge.hint}</span>
      </span>

      {/* Само число — то, ради чего блок и существует. */}
      <span className="shrink-0 text-2xl font-extrabold leading-none tabular-nums text-white/70">
        +{nudge.remaining}
      </span>
    </motion.div>
  );
}

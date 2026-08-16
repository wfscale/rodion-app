'use client';

import { motion } from 'framer-motion';

type XpBarProps = {
  pct: number;
  className?: string;
  height?: number;
};

/** Тонкая полоска прогресса до следующего уровня. */
export function XpBar({ pct, className = '', height = 6 }: XpBarProps) {
  const safe = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));

  return (
    <div
      className={`w-full overflow-hidden rounded-full bg-accent-weak ${className}`}
      style={{ height }}
      role="progressbar"
      aria-valuenow={safe}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {/* Полоса опыта — единственный элемент, который красится акцентом
          всегда: это личный прогресс, и он вправе выглядеть по-своему. */}
      <motion.div
        className="bg-accent-var h-full rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${safe}%` }}
        transition={{ type: 'spring', stiffness: 110, damping: 22 }}
      />
    </div>
  );
}

/** Горизонтальный прогресс-бар общего назначения (дневная цель рассылок и т.д.). */
export function ProgressBar({
  pct,
  color = '#FFFFFF',
  height = 8,
  className = '',
}: {
  pct: number;
  color?: string;
  height?: number;
  className?: string;
}) {
  const safe = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));

  return (
    <div
      className={`w-full overflow-hidden rounded-full bg-accent-weak ${className}`}
      style={{ height }}
      role="progressbar"
      aria-valuenow={safe}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${safe}%` }}
        transition={{ type: 'spring', stiffness: 110, damping: 22 }}
      />
    </div>
  );
}

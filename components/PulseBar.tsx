'use client';

import { motion } from 'framer-motion';

type PulseBarProps = {
  /** Процент выполнения квоты, 0..100. Значения вне диапазона обрезаются. */
  pct: number;
  color?: string;
  height?: number;
  className?: string;
};

/**
 * С какого процента бар начинает пульсировать (ТЗ §14).
 * 80% — момент, когда цель уже видна и добить её стоит дешевле, чем бросить.
 */
const PULSE_FROM = 80;

/**
 * Прогресс-бар дневной квоты, который мягко пульсирует на финише.
 *
 * Отличается от ProgressBar из XpBar.tsx только этим: у общего бара пульсация
 * была бы визуальным шумом, здесь — сигнал «ты почти там». Логику порога
 * держим внутри, чтобы вызывающий код не думал о процентах дважды.
 */
export function PulseBar({
  pct,
  color = '#FFFFFF',
  height = 8,
  className = '',
}: PulseBarProps) {
  const safe = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  const pulsing = safe >= PULSE_FROM;

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
        animate={{
          width: `${safe}%`,
          // Дыхание по яркости, а не по размеру: скачущая ширина читалась бы
          // как ошибка расчёта прогресса.
          opacity: pulsing ? [1, 0.6, 1] : 1,
          boxShadow: pulsing
            ? [
                '0 0 0px rgba(255,255,255,0)',
                '0 0 14px rgba(255,255,255,0.45)',
                '0 0 0px rgba(255,255,255,0)',
              ]
            : '0 0 0px rgba(255,255,255,0)',
        }}
        transition={{
          width: { type: 'spring', stiffness: 110, damping: 22 },
          opacity: pulsing
            ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.3 },
          boxShadow: pulsing
            ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.3 },
        }}
      />
    </div>
  );
}

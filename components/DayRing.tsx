'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

type DayRingProps = {
  /** Процент заполнения, 0..100 */
  pct: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
  /** Цвет дуги. По умолчанию белый. */
  color?: string;
  className?: string;
};

/**
 * Кольцо прогресса. Дуга рисуется через strokeDashoffset и анимируется
 * пружиной — при отметке задачи кольцо «доезжает» до нового значения.
 */
export function DayRing({
  pct,
  size = 200,
  stroke = 12,
  children,
  color = '#FFFFFF',
  className = '',
}: DayRingProps) {
  const safePct = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - safePct / 100);

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ type: 'spring', stiffness: 90, damping: 20, mass: 0.6 }}
          style={{ filter: safePct > 0 ? 'drop-shadow(0 0 8px rgba(255,255,255,0.25))' : undefined }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}

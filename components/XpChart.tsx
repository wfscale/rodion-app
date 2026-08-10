'use client';

import { motion } from 'framer-motion';
import { useLanguage } from '@/components/LanguageProvider';
import { formatShortDate } from '@/lib/date';

type XpChartProps = {
  /** Семь точек: дата + заработанный за день XP. */
  data: { date: string; xp: number }[];
};

const WIDTH = 320;
const HEIGHT = 110;
const PAD_X = 6;
const PAD_Y = 12;

/** Линейный график XP за неделю. Без библиотек — обычный SVG. */
export function XpChart({ data }: XpChartProps) {
  const { lang } = useLanguage();

  const max = Math.max(...data.map((point) => point.xp), 10);
  const stepX = data.length > 1 ? (WIDTH - PAD_X * 2) / (data.length - 1) : 0;

  const points = data.map((point, i) => ({
    ...point,
    x: PAD_X + i * stepX,
    y: HEIGHT - PAD_Y - ((HEIGHT - PAD_Y * 2) * point.xp) / max,
  }));

  const line = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${PAD_X},${HEIGHT - PAD_Y} ${line} ${(PAD_X + (data.length - 1) * stepX).toFixed(1)},${HEIGHT - PAD_Y}`;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-[110px] w-full overflow-visible"
        preserveAspectRatio="none"
        role="img"
        aria-label="XP"
      >
        <defs>
          <linearGradient id="xp-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>

        {/* Базовая линия */}
        <line
          x1={PAD_X}
          y1={HEIGHT - PAD_Y}
          x2={WIDTH - PAD_X}
          y2={HEIGHT - PAD_Y}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />

        <motion.polygon
          points={area}
          fill="url(#xp-fill)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        />

        <motion.polyline
          points={line}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />

        {points.map((point, i) => (
          <motion.circle
            key={point.date}
            cx={point.x}
            cy={point.y}
            r={3}
            fill={point.xp > 0 ? '#FFFFFF' : 'rgba(255,255,255,0.25)'}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5 + i * 0.05, type: 'spring', stiffness: 400 }}
          />
        ))}
      </svg>

      <div className="mt-2 flex justify-between">
        {data.map((point) => (
          <span key={point.date} className="flex-1 text-center text-[10px] text-white/30">
            {formatShortDate(point.date, lang).replace(/\s/g, ' ')}
          </span>
        ))}
      </div>
    </div>
  );
}

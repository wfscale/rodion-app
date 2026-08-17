'use client';

import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/components/LanguageProvider';
import { niceMax, smoothPath } from '@/lib/chart';
import { formatShortDate } from '@/lib/date';

export type ChartPoint = { date: string; value: number };

const WIDTH = 320;
const HEIGHT = 158;
const PAD_LEFT = 30;
const PAD_RIGHT = 8;
const PAD_TOP = 12;
const PAD_BOTTOM = 24;

const PLOT_W = WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_H = HEIGHT - PAD_TOP - PAD_BOTTOM;

type Props = {
  data: ChartPoint[];
  /** Подпись единиц под выбранным значением. */
  unit: string;
  /** Акцентный цвет линии. */
  color?: string;
};

/**
 * График с постоянной шкалой и ходьбой по дням.
 *
 * Смотреть на график недостаточно — с ним надо разговаривать. Поэтому есть
 * выбранный день, стрелки и тап по любой точке: видно не «примерно так»,
 * а «13 августа — 12 рассылок».
 */
export function GrowthChart({ data, unit, color = '#FFFFFF' }: Props) {
  const { t, lang } = useLanguage();

  // По умолчанию выбран последний день — он же сегодняшний.
  const [selected, setSelected] = useState(() => Math.max(0, data.length - 1));

  useEffect(() => {
    setSelected(Math.max(0, data.length - 1));
  }, [data.length]);

  const max = useMemo(() => niceMax(Math.max(...data.map((p) => p.value), 0)), [data]);

  const points = useMemo(() => {
    const step = data.length > 1 ? PLOT_W / (data.length - 1) : 0;
    const baseY = PAD_TOP + PLOT_H;

    return data.map((point, i) => ({
      ...point,
      x: PAD_LEFT + (data.length > 1 ? i * step : PLOT_W / 2),
      y: baseY - (PLOT_H * Math.min(point.value, max)) / max,
    }));
  }, [data, max]);

  const baseY = PAD_TOP + PLOT_H;
  const line = smoothPath(points, PAD_TOP, baseY);
  const area = points.length > 0
    ? `${line} L ${points[points.length - 1].x.toFixed(1)} ${baseY} L ${points[0].x.toFixed(1)} ${baseY} Z`
    : '';

  const active = points[selected] ?? points[points.length - 1] ?? null;

  const total = useMemo(() => data.reduce((sum, p) => sum + p.value, 0), [data]);
  const peak = useMemo(() => Math.max(0, ...data.map((p) => p.value)), [data]);

  /**
   * Активные дни — те, в которые вообще что-то было.
   *
   * Среднее по всему окну врёт и демотивирует: 43 рассылки за 90 дней дают
   * «в среднем 0,5», хотя в рабочий день их было по десять. Считать надо по
   * дням, когда ты работал, — тогда число отвечает на вопрос «сколько я
   * делаю, когда сажусь», а не «насколько я размазан по календарю».
   */
  const activeDays = useMemo(() => data.filter((p) => p.value > 0).length, [data]);
  const average = activeDays > 0 ? Math.round((total / activeDays) * 10) / 10 : 0;

  // Подписей по оси X ровно столько, сколько влезает без наложения.
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));

  // На длинном окне подписи-числа идут не подряд, и «3 · 2 · 1» читается как
  // бессмыслица — там нужен месяц. На коротком месяц только шумит.
  const longWindow = data.length > 45;

  const move = (delta: number) =>
    setSelected((current) => Math.max(0, Math.min(data.length - 1, current + delta)));

  return (
    <div>
      {/* Выбранный день — крупно, над графиком: это главное, что тут читают. */}
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => move(-1)}
          disabled={selected <= 0}
          aria-label={t.progress.chartPrev}
          className="btn-ghost h-11 w-11 shrink-0 p-0 disabled:opacity-25"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="min-w-0 flex-1 text-center">
          <p className="text-2xl font-extrabold leading-none tabular-nums">
            {active?.value ?? 0}
            <span className="ml-1.5 text-sm font-semibold text-white/35">{unit}</span>
          </p>
          <p className="mt-1 truncate text-xs text-white/40">
            {active ? formatShortDate(active.date, lang) : '—'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => move(1)}
          disabled={selected >= data.length - 1}
          aria-label={t.progress.chartNext}
          className="btn-ghost h-11 w-11 shrink-0 p-0 disabled:opacity-25"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={`${t.progress.chartTitle}: ${unit}`}
      >
        <defs>
          <linearGradient id="growth-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Сетка и подписи шкалы слева. Значения фиксированы: 0, половина,
            максимум — больше делений на телефоне превращаются в кашу. */}
        {[0, 0.5, 1].map((ratio) => {
          const y = baseY - PLOT_H * ratio;
          return (
            <g key={ratio}>
              <line
                x1={PAD_LEFT}
                y1={y}
                x2={WIDTH - PAD_RIGHT}
                y2={y}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={1}
              />
              <text
                x={PAD_LEFT - 6}
                y={y + 3.5}
                textAnchor="end"
                className="fill-white/35"
                style={{ fontSize: 9, fontWeight: 700 }}
              >
                {Math.round(max * ratio)}
              </text>
            </g>
          );
        })}

        {area && (
          <motion.path
            d={area}
            fill="url(#growth-fill)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          />
        )}

        <motion.path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />

        {/* Вертикаль выбранного дня. */}
        {active && (
          <g>
            <line
              x1={active.x}
              y1={PAD_TOP}
              x2={active.x}
              y2={baseY}
              stroke="rgba(255,255,255,0.25)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <circle cx={active.x} cy={active.y} r={4.5} fill={color} />
            <circle cx={active.x} cy={active.y} r={8} fill={color} fillOpacity={0.18} />
          </g>
        )}

        {/* Прозрачные колонки-мишени: тап по любому месту выбирает день.
            Отдельные точки размером 3px пальцем не поймать. */}
        {points.map((point, i) => {
          const width = data.length > 1 ? PLOT_W / (data.length - 1) : PLOT_W;
          return (
            <rect
              key={point.date}
              x={point.x - width / 2}
              y={PAD_TOP}
              width={width}
              height={PLOT_H}
              fill="transparent"
              className="cursor-pointer"
              onClick={() => setSelected(i)}
            />
          );
        })}

        {points.map((point, i) =>
          i % labelEvery === 0 || i === points.length - 1 ? (
            <text
              key={`label-${point.date}`}
              x={point.x}
              y={HEIGHT - 8}
              textAnchor="middle"
              className={i === selected ? 'fill-white/70' : 'fill-white/30'}
              style={{ fontSize: 9, fontWeight: 600 }}
            >
              {/* Цифрами, а не названием месяца: название не влезает, а от
                  языка ось зависеть не должна — полная дата есть над графиком. */}
              {longWindow
                ? `${point.date.slice(8, 10)}.${point.date.slice(5, 7)}`
                : Number(point.date.slice(8, 10))}
            </text>
          ) : null,
        )}
      </svg>

      {/* Четыре числа, а не три: «в среднем» без «активных дней» рядом
          выглядит как ошибка — непонятно, на что делили. */}
      <div className="mt-3 grid grid-cols-4 gap-1 border-t border-divider pt-3">
        {[
          { label: t.common.total, value: total },
          { label: t.common.peak, value: peak },
          { label: t.progress.chartActiveDays, value: activeDays },
          { label: t.progress.chartPerActiveDay, value: average },
        ].map((cell) => (
          <div key={cell.label} className="text-center">
            <p className="text-base font-extrabold tabular-nums">{cell.value}</p>
            <p className="mt-0.5 text-[10px] leading-tight text-white/35">{cell.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

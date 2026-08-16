'use client';

import { useMemo, useState } from 'react';
import { CardTitle, GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { formatShortDate } from '@/lib/date';
import { heatmap, type HeatCell } from '@/lib/insights';
import type { OutreachContact } from '@/lib/types';

/** Оттенки уровня. Ноль — почти невидим: пустой день не должен кричать. */
const TONES = [
  'bg-white/[0.05]',
  'bg-white/20',
  'bg-white/35',
  'bg-white/55',
  'bg-white/85',
] as const;

/**
 * Тепловая карта дней.
 *
 * Колонка — неделя, строка — день недели. Яркость считается от личного
 * максимума, а не от абсолютной шкалы: карта показывает твой ритм, ей не с
 * кем тебя сравнивать.
 */
export function Heatmap({
  contacts,
  today,
  weeks,
}: {
  contacts: OutreachContact[];
  today: string;
  /** 12 недель на 8-м уровне, 52 — на 19-м. */
  weeks: number;
}) {
  const { t, lang } = useLanguage();
  const [picked, setPicked] = useState<HeatCell | null>(null);

  const grid = useMemo(() => heatmap(contacts, today, weeks), [contacts, today, weeks]);
  const empty = useMemo(
    () => grid.every((column) => column.every((cell) => cell.sent === 0)),
    [grid],
  );

  return (
    <GlassCard delay={3}>
      <CardTitle
        right={
          picked ? (
            <span className="text-xs tabular-nums text-white/60">
              {formatShortDate(picked.date, lang)} · {picked.sent}
            </span>
          ) : undefined
        }
      >
        {t.heatmap.title}
      </CardTitle>

      {empty ? (
        <p className="py-3 text-sm text-muted">{t.heatmap.empty}</p>
      ) : (
        <>
          {/* Горизонтальный скролл внутри карточки: 52 недели на телефон
              не влезают, но страница при этом ехать вбок не должна. */}
          <div className="no-scrollbar -mx-1 overflow-x-auto px-1 pb-1">
            <div className="flex gap-[3px]">
              {grid.map((column, w) => (
                <div key={w} className="flex flex-col gap-[3px]">
                  {column.map((cell) => (
                    <button
                      key={cell.date}
                      type="button"
                      onClick={() => setPicked(cell)}
                      aria-label={`${cell.date}: ${cell.sent}`}
                      className={`h-[11px] w-[11px] shrink-0 rounded-[3px] transition-transform ${TONES[cell.level]} ${
                        picked?.date === cell.date ? 'scale-125 ring-1 ring-white' : ''
                      }`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-end gap-1.5">
            <span className="text-[11px] text-white/30">{t.heatmap.less}</span>
            {TONES.map((tone, i) => (
              <span key={i} className={`h-[9px] w-[9px] rounded-[2px] ${tone}`} />
            ))}
            <span className="text-[11px] text-white/30">{t.heatmap.more}</span>
          </div>
        </>
      )}

      <p className="mt-2 text-xs leading-relaxed text-white/25">{t.heatmap.hint}</p>
    </GlassCard>
  );
}

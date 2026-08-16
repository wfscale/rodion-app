'use client';

import { Crown, TrendingDown, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import { CardTitle, GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { formatShortDate } from '@/lib/date';
import {
  deltaPct,
  hallOfFame,
  weakLink,
  weeklySeries,
  type FunnelNumbers,
} from '@/lib/insights';
import type { OutreachContact } from '@/lib/types';

/* -------------------------------------------------------------------------- */
/*  Личный разбор                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Где именно рвётся воронка.
 *
 * Одна фраза, а не список советов. Список читается как «всё плохо» и не
 * приводит ни к какому действию; одна названная причина приводит.
 */
export function MentorCard({ numbers }: { numbers: FunnelNumbers }) {
  const { t } = useLanguage();
  const link = useMemo(() => weakLink(numbers), [numbers]);

  return (
    <GlassCard delay={5}>
      <CardTitle>{t.mentor.title}</CardTitle>
      <p className="text-base font-bold leading-snug">{t.mentor[link]}</p>
    </GlassCard>
  );
}

/* -------------------------------------------------------------------------- */
/*  Динамика недель                                                            */
/* -------------------------------------------------------------------------- */

function Delta({ value }: { value: number | null }) {
  const { t, tf } = useLanguage();

  if (value === null || value === 0) {
    return <span className="text-sm font-semibold text-white/35">{t.compare.flat}</span>;
  }

  const up = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-sm font-extrabold ${
        up ? 'text-success' : 'text-danger'
      }`}
    >
      {up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
      {up ? tf(t.compare.up, { n: value }) : tf(t.compare.down, { n: value })}
    </span>
  );
}

export function WeekCompare({
  contacts,
  today,
}: {
  contacts: OutreachContact[];
  today: string;
}) {
  const { t } = useLanguage();
  const weeks = useMemo(() => weeklySeries(contacts, today, 2), [contacts, today]);

  const previous = weeks[0];
  const current = weeks[1];

  if (!previous || !current) return null;

  const rows = [
    {
      label: t.compare.sent,
      now: current.sent,
      was: previous.sent,
      delta: deltaPct(current.sent, previous.sent),
    },
    {
      label: t.compare.replied,
      now: current.replied,
      was: previous.replied,
      delta: deltaPct(current.replied, previous.replied),
    },
  ];

  return (
    <GlassCard delay={5}>
      <CardTitle>{t.compare.title}</CardTitle>

      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-3">
            <span className="w-[74px] shrink-0 text-xs text-white/40">{row.label}</span>

            <span className="min-w-0 flex-1">
              <span className="text-lg font-extrabold tabular-nums">{row.now}</span>
              <span className="ml-2 text-sm tabular-nums text-white/30">
                {t.compare.lastWeek.toLowerCase()}: {row.was}
              </span>
            </span>

            <Delta value={row.delta} />
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}

/* -------------------------------------------------------------------------- */
/*  Зал славы                                                                  */
/* -------------------------------------------------------------------------- */

export function HallOfFame({ contacts }: { contacts: OutreachContact[] }) {
  const { t, lang } = useLanguage();
  const rows = useMemo(() => hallOfFame(contacts), [contacts]);

  const max = rows[0]?.sent ?? 1;

  return (
    <GlassCard delay={6}>
      <CardTitle>{t.hall.title}</CardTitle>

      {rows.length === 0 ? (
        <p className="py-3 text-sm text-muted">{t.hall.empty}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row, i) => (
            <li key={row.date} className="flex items-center gap-3">
              <span className={`shrink-0 ${i === 0 ? 'text-warn' : 'text-white/20'}`}>
                <Crown size={15} />
              </span>

              <span className="w-[62px] shrink-0 text-sm text-white/55">
                {formatShortDate(row.date, lang)}
              </span>

              <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
                <span
                  className={`block h-full rounded-full ${i === 0 ? 'bg-warn' : 'bg-white/40'}`}
                  style={{ width: `${Math.round((row.sent / max) * 100)}%` }}
                />
              </span>

              <span className="w-10 shrink-0 text-right text-sm font-extrabold tabular-nums">
                {row.sent}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs leading-relaxed text-white/25">{t.hall.hint}</p>
    </GlassCard>
  );
}

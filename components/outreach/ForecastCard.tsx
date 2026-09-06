'use client';

import { useMemo } from 'react';
import { CardTitle, GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { FORECAST_MIN_SENT, forecast, type ForecastLine } from '@/lib/forecast';
import type { OutreachContact } from '@/lib/types';

/**
 * Цена события в рассылках.
 *
 * Крупно показано «осталось», а не средняя конверсия: среднее нечего
 * доделывать, а остаток можно закрыть сегодня. Число падает с каждой новой
 * рассылкой — это и есть довод писать ещё.
 */
export function ForecastCard({
  contacts,
  delay = 0,
}: {
  contacts: OutreachContact[];
  /** Индекс в staggered появлении карточек страницы. */
  delay?: number;
}) {
  const { t, tf } = useLanguage();

  const data = useMemo(() => forecast(contacts), [contacts]);

  return (
    <GlassCard delay={delay}>
      <CardTitle>{t.forecast.title}</CardTitle>

      {!data.enough ? (
        // Пока рассылок мало, любая конверсия — случайность. Называть её
        // ценой значит соврать в самом первом числе, которое человек увидит.
        <p className="text-sm text-muted">{tf(t.forecast.small, { n: FORECAST_MIN_SENT })}</p>
      ) : (
        <>
          <div className="space-y-3">
            <Line label={t.forecast.call} line={data.call} empty={t.forecast.noCalls} />
            <Line label={t.forecast.close} line={data.close} empty={t.forecast.noClosed} />
          </div>
        </>
      )}
    </GlassCard>
  );
}

/** Одна строка прогноза: цена события слева, остаток до следующего справа. */
function Line({
  label,
  line,
  empty,
}: {
  label: string;
  line: ForecastLine;
  empty: string;
}) {
  const { t, tf } = useLanguage();

  if (line.count === 0) {
    return (
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-sm font-bold">{label}</span>
        <span className="shrink-0 text-sm text-white/30">{empty}</span>
      </div>
    );
  }

  const ready = line.left === 0;
  const filled = Math.min(100, Math.round((line.since / line.per) * 100));

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-sm font-bold">{label}</span>
          <span className="shrink-0 text-xs tabular-nums text-white/30">
            {tf(t.forecast.every, { n: line.per })}
          </span>
        </span>

        {/* Жёлтый здесь означает то же, что и в списке касаний: пора действовать. */}
        <span
          className={`shrink-0 text-base font-extrabold tabular-nums ${
            ready ? 'text-warn' : ''
          }`}
        >
          {ready ? t.forecast.ready : tf(t.forecast.left, { n: line.left })}
        </span>
      </div>

      {/* Сколько от цены уже отработано: пусто в день события, полно — когда пора. */}
      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white/10">
        <span
          className={`block h-full rounded-full ${ready ? 'bg-warn' : 'bg-white/45'}`}
          style={{ width: `${filled}%` }}
        />
      </span>
    </div>
  );
}

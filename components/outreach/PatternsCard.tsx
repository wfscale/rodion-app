'use client';

import { useMemo } from 'react';
import { GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { Collapsible } from '@/components/ui';
import {
  compareLengths,
  comparePatterns,
  MIN_SAMPLE,
  summarize,
  type PatternRow,
  type PatternSample,
} from '@/lib/offer-patterns';

/** Полоска доли ответов: глазу нужна длина, а не только число. */
function RateBar({ pct, dim = false }: { pct: number; dim?: boolean }) {
  return (
    <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-white/10">
      <span
        className={`block h-full rounded-full ${dim ? 'bg-white/25' : 'bg-white/70'}`}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </span>
  );
}

function LiftBadge({ lift, reliable }: { lift: number; reliable: boolean }) {
  const tone =
    !reliable
      ? 'text-white/30'
      : lift > 0
        ? 'text-success'
        : lift < 0
          ? 'text-danger'
          : 'text-white/40';

  return (
    <span className={`text-sm font-extrabold tabular-nums ${tone}`}>
      {lift > 0 ? '+' : ''}
      {lift}
    </span>
  );
}

/**
 * Разбор офферов.
 *
 * Никакой нейросети: каждый признак — правило, которое видно глазами, а
 * колонка «разница» это просто доля ответов с признаком минус доля без него.
 * Признаки со слабой выборкой не прячутся, а гасятся: цифра есть, доверия
 * ещё нет, и это честнее, чем показывать её наравне с остальными.
 */
export function PatternsCard({ samples }: { samples: PatternSample[] }) {
  const { t, tf } = useLanguage();

  const { rows, lengths, summary } = useMemo(() => {
    const computed = comparePatterns(samples);
    return {
      rows: computed,
      lengths: compareLengths(samples),
      summary: summarize(samples, computed),
    };
  }, [samples]);

  const nameOf = (row: PatternRow) => t.patterns.names[row.id];

  return (
    <GlassCard delay={1}>
      <Collapsible
        storageKey="rodion.offers.patterns"
        defaultOpen
        title={t.patterns.title}
        right={
          summary.total > 0 ? (
            <span className="shrink-0 text-sm font-extrabold tabular-nums">{summary.rate}%</span>
          ) : undefined
        }
      >
        <p className="mb-3 text-sm leading-snug text-muted">{t.patterns.subtitle}</p>

        {rows.length === 0 ? (
          <p className="py-4 text-sm leading-relaxed text-muted">{t.patterns.empty}</p>
        ) : (
          <>
            <div className="mb-4 rounded-2xl border border-glass-border bg-white/[0.04] p-3">
              <p className="text-sm font-bold">
                {tf(t.patterns.summary, {
                  replied: summary.replied,
                  total: summary.total,
                  rate: summary.rate,
                })}
              </p>

              {summary.best ? (
                <p className="mt-2 text-sm text-success">
                  {tf(t.patterns.best, { name: nameOf(summary.best) })}
                </p>
              ) : (
                <p className="mt-2 text-sm text-white/40">{t.patterns.noVerdict}</p>
              )}

              {summary.worst && (
                <p className="mt-1 text-sm text-danger">
                  {tf(t.patterns.worst, { name: nameOf(summary.worst) })}
                </p>
              )}
            </div>

            {/* Таблица на телефоне не помещается в четыре колонки — поэтому
                каждая строка это карточка с двумя половинами сравнения. */}
            <ul className="space-y-2">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className={`rounded-2xl border border-glass-border p-3 ${
                    row.reliable ? 'bg-white/[0.04]' : 'bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-bold leading-snug ${
                          row.reliable ? 'text-white' : 'text-white/45'
                        }`}
                      >
                        {nameOf(row)}
                        {!row.reliable && (
                          <span className="ml-2 text-xs font-semibold text-white/25">
                            {t.patterns.unreliable}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs leading-snug text-white/30">
                        {t.patterns.hints[row.id]}
                      </p>
                    </div>
                    <LiftBadge lift={row.lift} reliable={row.reliable} />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-white/35">
                        {t.patterns.colWith} · {row.withCount}
                      </p>
                      <p className="text-base font-extrabold tabular-nums">{row.withRate}%</p>
                      <RateBar pct={row.withRate} dim={!row.reliable} />
                    </div>
                    <div>
                      <p className="text-xs text-white/35">
                        {t.patterns.colWithout} · {row.withoutCount}
                      </p>
                      <p className="text-base font-extrabold tabular-nums text-white/55">
                        {row.withoutRate}%
                      </p>
                      <RateBar pct={row.withoutRate} dim />
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <p className="mt-3 text-xs leading-relaxed text-white/25">
              {tf(t.patterns.unreliableHint, { n: MIN_SAMPLE })}
            </p>

            {lengths.length > 1 && (
              <div className="mt-5 border-t border-divider pt-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-white/35">
                  {t.patterns.lengthTitle}
                </p>
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs text-white/35">
                      <th className="pb-2 font-semibold">{t.patterns.lengthTitle}</th>
                      <th className="pb-2 text-center font-semibold">{t.patterns.colCount}</th>
                      <th className="pb-2 text-center font-semibold">{t.patterns.colReplies}</th>
                      <th className="pb-2 text-right font-semibold">{t.patterns.colRateShort}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lengths.map((row) => (
                      <tr key={row.bucket} className="border-t border-divider">
                        <td className="py-2.5 text-sm">
                          {row.bucket === 'short'
                            ? t.patterns.lengthShort
                            : row.bucket === 'medium'
                              ? t.patterns.lengthMedium
                              : t.patterns.lengthLong}
                        </td>
                        <td className="py-2.5 text-center text-sm text-white/60">{row.count}</td>
                        <td className="py-2.5 text-center text-sm text-white/60">{row.replies}</td>
                        <td className="py-2.5 text-right text-sm font-extrabold">{row.rate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Collapsible>
    </GlassCard>
  );
}

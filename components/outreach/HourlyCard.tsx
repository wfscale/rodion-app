'use client';

import { useMemo } from 'react';
import { GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { Collapsible } from '@/components/ui';
import { replyByHour } from '@/lib/insights';
import type { OutreachContact } from '@/lib/types';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Часы отклика.
 *
 * Показывает не «когда приходят ответы», а «в какое время написанное чаще
 * получает ответ» — второе можно применить завтра утром, первое нельзя
 * применить никак.
 */
export function HourlyCard({ contacts }: { contacts: OutreachContact[] }) {
  const { t, tf } = useLanguage();

  const windows = useMemo(() => replyByHour(contacts), [contacts]);

  // Лучшее окно ищем только там, где выборка не смешная.
  const best = useMemo(() => {
    const solid = windows.filter((w) => w.sent >= 3);
    if (solid.length === 0) return null;
    return solid.reduce((top, w) => (w.rate > top.rate ? w : top));
  }, [windows]);

  const maxRate = Math.max(1, ...windows.map((w) => w.rate));

  return (
    <GlassCard delay={3}>
      <Collapsible storageKey="rodion.outreach.hourly" defaultOpen title={t.hourly.title}>
        {windows.length === 0 ? (
          <p className="py-3 text-sm text-muted">{t.hourly.empty}</p>
        ) : (
          <>
            {best && (
              <p className="mb-3 text-sm font-bold text-warn">
                {tf(t.hourly.best, { from: pad(best.from), to: pad(best.to) })}
              </p>
            )}

            <ul className="space-y-2">
              {windows.map((window) => (
                <li key={window.from} className="flex items-center gap-3">
                  <span className="w-[86px] shrink-0 text-sm tabular-nums text-white/55">
                    {pad(window.from)}:00–{pad(window.to)}:00
                  </span>

                  <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
                    <span
                      className={`block h-full rounded-full ${
                        best && window.from === best.from ? 'bg-warn' : 'bg-white/45'
                      }`}
                      style={{ width: `${Math.round((window.rate / maxRate) * 100)}%` }}
                    />
                  </span>

                  <span className="w-[76px] shrink-0 text-right text-sm tabular-nums">
                    <b className="font-extrabold">{window.rate}%</b>
                    <span className="ml-1 text-white/30">/{window.sent}</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        <p className="mt-3 text-xs leading-relaxed text-white/25">{t.hourly.hint}</p>
      </Collapsible>
    </GlassCard>
  );
}

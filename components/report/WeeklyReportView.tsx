'use client';

import { GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { EmptyState, PageTitle } from '@/components/ui';
import { formatShortDate, shiftDate } from '@/lib/date';
import type { WeeklyReport } from '@/lib/types';

type WeeklyReportViewProps = {
  reports: WeeklyReport[];
};

/**
 * История еженедельных отчётов.
 *
 * Отчёт нужен не для гордости, а для сравнения: неделя рядом с неделей
 * показывает темп честнее, чем ощущение «вроде работал».
 */
export function WeeklyReportView({ reports }: WeeklyReportViewProps) {
  const { t, lang } = useLanguage();

  // Свежая неделя сверху. Копия — исходный массив трогать нельзя.
  const sorted = [...reports].sort((a, b) => b.week_start.localeCompare(a.week_start));

  return (
    <div>
      <PageTitle>{t.report.title}</PageTitle>

      {sorted.length === 0 ? (
        <GlassCard>
          <EmptyState text={t.report.empty} />
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {sorted.map((report, i) => {
            const from = formatShortDate(report.week_start, lang);
            const to = formatShortDate(shiftDate(report.week_start, 6), lang);

            const stats: { value: number; label: string }[] = [
              { value: report.sent, label: t.report.sent },
              { value: report.replied, label: t.report.replied },
              { value: report.calls, label: t.report.calls },
              { value: report.closed, label: t.report.closed },
              { value: report.xp_earned, label: t.report.xp },
            ];

            return (
              <GlassCard key={report.id} delay={i}>
                <p className="section-label">{t.report.week}</p>
                <p className="mt-1 text-lg font-extrabold">
                  {from} — {to}
                </p>

                <div className="mt-4 grid grid-cols-3 gap-3 border-t border-divider pt-4">
                  {stats.map((stat) => (
                    <div key={stat.label}>
                      <p className="text-2xl font-extrabold leading-none tabular-nums">
                        {stat.value}
                      </p>
                      <p className="mt-1 text-xs leading-snug text-white/35">{stat.label}</p>
                    </div>
                  ))}
                </div>

                {report.best_day && (
                  <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-divider pt-4">
                    <span className="text-sm text-muted">{t.report.bestDay}</span>
                    <span className="text-base font-bold tabular-nums">
                      {formatShortDate(report.best_day, lang)} · {report.best_count}
                    </span>
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { CardTitle, GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { LockedFeature } from '@/components/LockedFeature';
import { EveningCheckin } from '@/components/mode/EveningCheckin';
import { ModeBlock } from '@/components/mode/ModeBlock';
import { AccentPicker } from '@/components/progress/AccentPicker';
import { AchievementsCard } from '@/components/progress/AchievementsCard';
import { GrowthChart, type ChartPoint } from '@/components/progress/GrowthChart';
import { Heatmap } from '@/components/progress/Heatmap';
import { HallOfFame, MentorCard, WeekCompare } from '@/components/progress/InsightCards';
import { LevelLadder } from '@/components/progress/LevelLadder';
import { WeeklyReportView } from '@/components/report/WeeklyReportView';
import { ScaleDashboard } from '@/components/scale/ScaleDashboard';
import { Button, FullPageLoader, PageTitle, Segmented } from '@/components/ui';
import { XpBar } from '@/components/XpBar';
import { getLogicalDate, shiftDate } from '@/lib/date';
import { dailySeries, funnelTotals, overdueTouchCount, spanDays, xpSeries } from '@/lib/insights';
import { needsEveningCheckin } from '@/lib/mode';
import { missingWeeks, statsForWeek } from '@/lib/reports';
import { createClient } from '@/lib/supabase/client';
import type { WeeklyReport, XpTransaction } from '@/lib/types';
import { FEATURE_LEVEL, nextLevelTeaser } from '@/lib/xp';

type Metric = 'sent' | 'xp';
type Range = 7 | 14 | 30 | 90 | 'all';

/**
 * Потолок окна «за всё время».
 *
 * Год — предел, на котором график ещё остаётся кривой, а не сплошной
 * заливкой: дальше на 375px точки просто сливаются. Данные глубже года
 * никуда не деваются, их видно в тепловой карте и в отчётах.
 */
const ALL_TIME_CAP = 365;

export default function ProgressPage() {
  const { t, tf } = useLanguage();
  const app = useApp();

  const [transactions, setTransactions] = useState<XpTransaction[]>([]);
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [checkinOpen, setCheckinOpen] = useState(false);

  const [metric, setMetric] = useState<Metric>('sent');
  const [range, setRange] = useState<Range>(14);

  useEffect(() => {
    if (!app.user) return;
    const supabase = createClient();
    const since = shiftDate(app.today, -180);

    void (async () => {
      const [xpRes, reportRes] = await Promise.all([
        supabase
          .from('xp_transactions')
          .select('*')
          .eq('user_id', app.user!.id)
          .gte('created_at', `${since}T00:00:00Z`)
          .order('created_at', { ascending: false }),
        supabase
          .from('weekly_reports')
          .select('*')
          .eq('user_id', app.user!.id)
          .order('week_start', { ascending: false }),
      ]);
      setTransactions((xpRes.data as XpTransaction[]) ?? []);

      const existing = (reportRes.data as WeeklyReport[]) ?? [];
      setReports(existing);

      // Отчёт за закрытую неделю не меняется, поэтому считаем его один раз
      // и сохраняем. Крон для этого не нужен: недостающие недели
      // достраиваются при первом заходе на страницу.
      if (!app.profile) return;

      const gaps = missingWeeks({
        cycleStart: app.profile.cycle_start_date,
        today: app.today,
        existing: existing.map((r) => r.week_start),
      });

      if (gaps.length === 0) return;

      const rows = gaps.map((monday) => {
        const st = statsForWeek(app.contacts, monday);
        return {
          user_id: app.user!.id,
          week_start: monday,
          sent: st.sent,
          replied: st.replied,
          calls: st.calls,
          closed: st.closed,
          best_day: st.bestDay,
          best_count: st.bestCount,
          xp_earned: 0,
        };
      });

      const { data: created } = await supabase
        .from('weekly_reports')
        .upsert(rows as never, { onConflict: 'user_id,week_start' })
        .select('*');

      if (created) {
        setReports((previous) => {
          const merged = [...(created as WeeklyReport[]), ...previous];
          const seen = new Set<string>();
          return merged
            .filter((r) => (seen.has(r.week_start) ? false : seen.add(r.week_start)))
            .sort((a, b) => b.week_start.localeCompare(a.week_start));
        });
      }
    })();
  }, [app.user, app.today, app.profile, app.contacts]);

  /** Ряд для графика: рассылки по дате касания или XP по дате начисления. */
  const chartData = useMemo<ChartPoint[]>(() => {
    // «Всё время» — от первой рассылки до сегодня. XP считается по тому же
    // окну: две метрики на одной оси обязаны показывать один и тот же отрезок.
    const days =
      range === 'all' ? spanDays(app.contacts, app.today, ALL_TIME_CAP) : range;

    const series =
      metric === 'sent'
        ? dailySeries(app.contacts, app.today, days)
        : xpSeries(transactions, app.today, days, (date) => getLogicalDate(date));

    return series.map((point) => ({ date: point.date, value: point.sent }));
  }, [metric, range, app.contacts, app.today, transactions]);

  const funnel = useMemo(() => funnelTotals(app.contacts), [app.contacts]);

  if (app.loading || !app.profile) return <FullPageLoader />;

  const profile = app.profile;
  const level = app.levelInfo.level;
  const teaser = nextLevelTeaser(level);
  const counters = {
    porn: profile.mode_porn_days ?? 0,
    mb: profile.mode_mb_days ?? 0,
    sugar: profile.mode_sugar_days ?? 0,
  };
  const checkinDue = needsEveningCheckin(profile.mode_last_checkin, app.today);
  const hasChartData = chartData.some((point) => point.value > 0);

  const daysActive = Math.max(1, app.cycleDayNumber);

  return (
    <div className="space-y-4">
      <PageTitle>{t.progress.title}</PageTitle>

      {/* Уровень: текущий и тизер следующего. Полная лестница — ниже,
          и в ней всё равно видно только текущий блок из пяти ступеней. */}
      <GlassCard>
        <CardTitle right={<span className="text-sm font-bold">{profile.total_xp} XP</span>}>
          {t.progress.levelTitle} {level}
        </CardTitle>

        <p className="mb-3 text-2xl font-extrabold tracking-tight">{app.levelInfo.name}</p>
        <XpBar pct={app.levelInfo.progressPct} />

        <p className="mt-2 text-sm text-muted">
          {app.levelInfo.isMax
            ? t.progress.unknownAhead
            : `${t.progress.toNext}: ${app.levelInfo.xpToNext} XP`}
        </p>

        {!app.levelInfo.isMax && (
          <p className="mt-3 border-t border-divider pt-3 text-sm">
            {teaser ? (
              <>
                <span className="text-white/45">{tf(t.progress.nextTeaser, { name: '' })}</span>{' '}
                <span className="font-bold">{t.features[teaser]}</span>
                <span className="block text-white/40">{t.features[`${teaser}Desc` as const]}</span>
              </>
            ) : (
              <span className="text-white/45">{t.progress.unknownAhead}</span>
            )}
          </p>
        )}
      </GlassCard>

      {/* Квота */}
      <GlassCard delay={1}>
        <CardTitle>{t.progress.quotaTitle}</CardTitle>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: app.quota.quota, label: t.home.quotaCurrent },
            { value: app.quota.streak, label: t.progress.streakTitle },
            { value: app.quota.record, label: t.home.record },
          ].map((cell) => (
            <div key={cell.label} className="rounded-2xl bg-white/[0.04] px-2 py-3 text-center">
              <p className="text-xl font-extrabold">{cell.value}</p>
              <p className="mt-0.5 text-[11px] leading-tight text-white/40">{cell.label}</p>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* График: метрика и окно переключаются, высота шкалы — никогда. */}
      <GlassCard delay={2}>
        <CardTitle>{t.progress.chartTitle}</CardTitle>

        <div className="mb-3 space-y-2">
          <Segmented<Metric>
            value={metric}
            onChange={setMetric}
            options={[
              { value: 'sent', label: t.progress.chartSent },
              { value: 'xp', label: t.progress.chartXp },
            ]}
          />
          <Segmented<string>
            value={String(range)}
            onChange={(value) => setRange(value === 'all' ? 'all' : (Number(value) as Range))}
            options={[
              { value: '7', label: t.progress.range7 },
              { value: '14', label: t.progress.range14 },
              { value: '30', label: t.progress.range30 },
              { value: '90', label: t.progress.range90 },
              { value: 'all', label: t.progress.rangeAll },
            ]}
          />
        </div>

        {hasChartData ? (
          <GrowthChart
            data={chartData}
            unit={metric === 'sent' ? t.progress.chartSent : t.common.xp}
          />
        ) : (
          <p className="py-6 text-center text-sm text-muted">{t.progress.chartEmpty}</p>
        )}
      </GlassCard>

      {/* Лестница уровней */}
      <LevelLadder level={level} />

      {/* Режим */}
      <ModeBlock counters={counters} />

      {checkinDue && (
        <Button variant="ghost" full onClick={() => setCheckinOpen(true)}>
          {t.mode.checkinTitle}
        </Button>
      )}

      {/* Тепловая карта — 8-й уровень, разворачивается до года на 19-м. */}
      {app.can('heatmap') && (
        <Heatmap contacts={app.contacts} today={app.today} weeks={app.can('annual') ? 52 : 12} />
      )}

      {/* Витрина достижений — 10-й уровень. */}
      {app.can('achievements') && (
        <AchievementsCard
          input={{
            sent: funnel.sent,
            replied: funnel.replied,
            calls: funnel.calls,
            closed: funnel.closed,
            chain: app.chain,
            record: app.quota.record,
            quotaStreak: app.quota.streak,
          }}
        />
      )}

      {/* Динамика недель — 12-й уровень. */}
      {app.can('compare') && <WeekCompare contacts={app.contacts} today={app.today} />}

      {/* Личный разбор — 15-й уровень. */}
      {app.can('mentor') && (
        <MentorCard
          numbers={{
            ...funnel,
            overdueTouches: overdueTouchCount(app.contacts, app.today),
          }}
        />
      )}

      {/* Зал славы — 16-й уровень. */}
      {app.can('hall') && <HallOfFame contacts={app.contacts} />}

      {/* Акценты интерфейса — 17-й уровень. */}
      {app.can('themes') && <AccentPicker />}

      {/* Еженедельный отчёт — 6-й уровень */}
      {app.can('report') ? (
        <WeeklyReportView reports={reports} />
      ) : (
        <LockedFeature featureKey="report" requiredLevel={FEATURE_LEVEL.report} />
      )}

      {/* Дашборд масштаба — 7-й уровень */}
      {app.can('scale') ? (
        <ScaleDashboard
          sentTotal={app.contacts.length}
          closedTotal={funnel.closed}
          daysActive={daysActive}
          avgDeal={profile.avg_deal_amount ?? 0}
          onAvgDealChange={(value) => void app.updateProfile({ avg_deal_amount: value })}
        />
      ) : (
        <LockedFeature featureKey="scale" requiredLevel={FEATURE_LEVEL.scale} />
      )}

      {/* Апекс — 20-й уровень. Закрытого больше нет, и это стоит сказать. */}
      {app.can('apex') && (
        <GlassCard delay={8}>
          <CardTitle>{t.features.apex}</CardTitle>
          <p className="text-base font-bold leading-snug">{t.features.apexUnlock}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">{t.features.apexDesc}</p>
        </GlassCard>
      )}

      <EveningCheckin
        open={checkinOpen}
        done={!checkinDue}
        onClose={() => setCheckinOpen(false)}
        onSubmit={(held) => void app.submitModeCheckin(held)}
      />
    </div>
  );
}

'use client';

import { Lock, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { CardTitle, GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { LockedFeature } from '@/components/LockedFeature';
import { EveningCheckin } from '@/components/mode/EveningCheckin';
import { ModeBlock } from '@/components/mode/ModeBlock';
import { WeeklyReportView } from '@/components/report/WeeklyReportView';
import { ScaleDashboard } from '@/components/scale/ScaleDashboard';
import { Button, FullPageLoader, PageTitle } from '@/components/ui';
import { XpBar } from '@/components/XpBar';
import { XpChart } from '@/components/XpChart';
import { getLogicalDate, shiftDate } from '@/lib/date';
import { needsEveningCheckin } from '@/lib/mode';
import Link from 'next/link';
import { missingWeeks, statsForWeek } from '@/lib/reports';
import { createClient } from '@/lib/supabase/client';
import type { WeeklyReport, XpTransaction } from '@/lib/types';
import { FEATURE_LEVEL, nextLevelTeaser, unlocked, type FeatureKey } from '@/lib/xp';

const FEATURE_ORDER: FeatureKey[] = ['offers', 'niches', 'speed', 'project', 'report', 'scale'];

export default function ProgressPage() {
  const { t, tf } = useLanguage();
  const app = useApp();

  const [transactions, setTransactions] = useState<XpTransaction[]>([]);
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [checkinOpen, setCheckinOpen] = useState(false);

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

  const last7 = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of transactions) {
      const date = getLogicalDate(new Date(tx.created_at));
      map.set(date, (map.get(date) ?? 0) + tx.amount);
    }
    return Array.from({ length: 7 }, (_, i) => {
      const date = shiftDate(app.today, -(6 - i));
      return { date, xp: map.get(date) ?? 0 };
    });
  }, [transactions, app.today]);

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
  const hasXp = last7.some((p) => p.xp > 0);

  const daysActive = Math.max(1, app.cycleDayNumber);
  const closedTotal = app.contacts.filter((c) => c.status === 'closed').length;

  return (
    <div className="space-y-4">
      <PageTitle>{t.progress.title}</PageTitle>

      {/* Уровень: только текущий и тизер следующего. Полного списка нет. */}
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

      {/* Режим */}
      <ModeBlock counters={counters} />

      {checkinDue && (
        <Button variant="ghost" full onClick={() => setCheckinOpen(true)}>
          {t.mode.checkinTitle}
        </Button>
      )}

      {/* График XP */}
      <GlassCard delay={2}>
        <CardTitle>{t.progress.xpChart}</CardTitle>
        {hasXp ? <XpChart data={last7} /> : <p className="py-6 text-center text-sm text-muted">{t.progress.xpChartEmpty}</p>}
      </GlassCard>

      {/* Еженедельный отчёт — 6-й уровень */}
      {unlocked('report', level) ? (
        <GlassCard delay={3}>
          <CardTitle>{t.report.title}</CardTitle>
          <WeeklyReportView reports={reports} />
        </GlassCard>
      ) : (
        <LockedFeature featureKey="report" requiredLevel={FEATURE_LEVEL.report} />
      )}

      {/* Дашборд масштаба — 7-й уровень */}
      {unlocked('scale', level) ? (
        <GlassCard delay={4}>
          <CardTitle>{t.scale.title}</CardTitle>
          <ScaleDashboard
            sentTotal={app.contacts.length}
            closedTotal={closedTotal}
            daysActive={daysActive}
            avgDeal={profile.avg_deal_amount ?? 0}
            onAvgDealChange={(value) => void app.updateProfile({ avg_deal_amount: value })}
          />
        </GlassCard>
      ) : (
        <LockedFeature featureKey="scale" requiredLevel={FEATURE_LEVEL.scale} />
      )}

      {/* Что уже открыто */}
      <GlassCard delay={5}>
        <CardTitle>{t.progress.unlocksTitle}</CardTitle>
        <ul className="space-y-2">
          {FEATURE_ORDER.map((key) => {
            const open = unlocked(key, level);
            return (
              <li
                key={key}
                className={`flex items-start gap-3 rounded-2xl border p-3 ${
                  open
                    ? 'border-[rgba(255,209,102,0.25)] bg-[rgba(255,209,102,0.06)]'
                    : 'border-glass-border bg-white/[0.02]'
                }`}
              >
                {/* Раздел «Проект» — единственный с отдельной страницей,
                    поэтому на мобильном попасть в него можно только отсюда. */}
                <span className={`mt-0.5 shrink-0 ${open ? 'text-warn' : 'text-white/20'}`}>
                  {open ? <Sparkles size={17} /> : <Lock size={17} />}
                </span>
                <span className="min-w-0 flex-1">
                  {open && key === 'project' ? (
                    <Link href="/project" className="block text-sm font-bold underline decoration-white/30 underline-offset-4">
                      {t.features[key]}
                    </Link>
                  ) : (
                    <span className={`block text-sm font-bold ${open ? 'text-white' : 'text-white/35'}`}>
                      {t.features[key]}
                    </span>
                  )}
                  <span className={`mt-0.5 block text-xs leading-snug ${open ? 'text-muted' : 'text-white/25'}`}>
                    {open
                      ? t.features[`${key}Desc` as const]
                      : `${t.common.locked} ${FEATURE_LEVEL[key]}`}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </GlassCard>

      <EveningCheckin
        open={checkinOpen}
        done={!checkinDue}
        onClose={() => setCheckinOpen(false)}
        onSubmit={(held) => void app.submitModeCheckin(held)}
      />
    </div>
  );
}

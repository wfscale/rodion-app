'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Lock, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { DayRing } from '@/components/DayRing';
import { CardTitle, GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { StreakBlock } from '@/components/StreakBlock';
import { FullPageLoader, PageTitle } from '@/components/ui';
import { WeekTable } from '@/components/WeekTable';
import { XpBar } from '@/components/XpBar';
import { XpChart } from '@/components/XpChart';
import { formatShortDate, getLogicalDate, shiftDate, weekDates, weekStart } from '@/lib/date';
import { createClient } from '@/lib/supabase/client';
import type { OutreachContact, XpTransaction } from '@/lib/types';
import { UNLOCKS } from '@/lib/unlocks';
import { getLevelInfo } from '@/lib/xp';

export default function ProgressPage() {
  const { t, tf, lang } = useLanguage();
  const { profile, logs, today, loading, streak, weeks, unlockLevel, user } = useApp();

  const [transactions, setTransactions] = useState<XpTransaction[]>([]);
  const [contacts, setContacts] = useState<OutreachContact[]>([]);
  const [openWeek, setOpenWeek] = useState<number | null>(null);

  // XP-транзакции и контакты нужны только здесь — грузим их страницей.
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    const since = shiftDate(today, -180);

    void (async () => {
      const [xpRes, contactsRes] = await Promise.all([
        supabase
          .from('xp_transactions')
          .select('*')
          .eq('user_id', user.id)
          .gte('created_at', `${since}T00:00:00Z`)
          .order('created_at', { ascending: false }),
        supabase.from('outreach_contacts').select('*').eq('user_id', user.id),
      ]);

      setTransactions((xpRes.data as XpTransaction[]) ?? []);
      setContacts((contactsRes.data as OutreachContact[]) ?? []);
    })();
  }, [user, today]);

  /** XP по логическим дням — не по календарным, чтобы совпадало с чеклистом. */
  const xpByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of transactions) {
      const date = getLogicalDate(new Date(tx.created_at));
      map.set(date, (map.get(date) ?? 0) + tx.amount);
    }
    return map;
  }, [transactions]);

  const last7 = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = shiftDate(today, -(6 - i));
        return { date, xp: xpByDate.get(date) ?? 0 };
      }),
    [today, xpByDate],
  );

  const currentWeekDates = useMemo(() => weekDates(today), [today]);

  const threshold = profile?.streak_threshold ?? 70;

  const perfectDays = useMemo(() => {
    const byDate = new Map(logs.map((log) => [log.date, log.completion_pct ?? 0]));
    return currentWeekDates.filter((date) => (byDate.get(date) ?? 0) >= threshold).length;
  }, [logs, currentWeekDates, threshold]);

  /** Отчёт за текущую неделю по воронке (разблокировка недели 4). */
  const weekReport = useMemo(() => {
    const start = weekStart(today);
    const inWeek = contacts.filter((c) => c.created_at.slice(0, 10) >= start);
    const reached = (statuses: string[]) =>
      contacts.filter(
        (c) =>
          statuses.includes(c.status) &&
          (c.updated_at ?? c.created_at).slice(0, 10) >= start,
      ).length;

    return {
      sent: inWeek.length,
      replied: reached(['replied', 'call', 'closed']),
      calls: reached(['call', 'closed']),
      closed: reached(['closed']),
    };
  }, [contacts, today]);

  if (loading || !profile) return <FullPageLoader />;

  const levelInfo = getLevelInfo(profile.total_xp, t);
  const finishedWeeks = weeks.filter((w) => w.complete).reverse();
  const hasXp = last7.some((point) => point.xp > 0);

  return (
    <div className="space-y-4">
      <PageTitle>{t.progress.title}</PageTitle>

      {/* Стрик */}
      <StreakBlock
        streak={streak.current}
        longest={Math.max(streak.longest, profile.longest_streak)}
        threshold={threshold}
        todayCounted={streak.todayCounted}
      />

      {/* Уровень и XP */}
      <GlassCard delay={1}>
        <CardTitle right={<span className="text-sm font-bold">{profile.total_xp} XP</span>}>
          {t.progress.levelTitle}
        </CardTitle>

        <div className="mb-3 flex items-baseline gap-2">
          <span className="text-3xl font-extrabold tracking-tight">{levelInfo.level}</span>
          <span className="text-lg font-bold text-white/70">{levelInfo.name}</span>
        </div>

        <XpBar pct={levelInfo.progressPct} />

        <p className="mt-2 text-sm text-muted">
          {levelInfo.isMax
            ? t.home.maxLevel
            : `${t.progress.toNext}: ${levelInfo.xpToNext} XP`}
        </p>
      </GlassCard>

      {/* Неделя: кольцо + таблица */}
      <GlassCard delay={2}>
        <CardTitle>{t.progress.weekTableTitle}</CardTitle>
        <WeekTable dates={currentWeekDates} logs={logs} today={today} />
      </GlassCard>

      <GlassCard delay={3} className="flex items-center gap-5">
        <DayRing pct={(perfectDays / 7) * 100} size={104} stroke={9}>
          <span className="text-xl font-extrabold">{perfectDays}</span>
          <span className="text-xs text-white/40">/ 7</span>
        </DayRing>

        <div className="min-w-0 flex-1">
          <p className="section-label">{tf(t.progress.weekRing, { n: threshold })}</p>
          <p className="mt-1.5 text-base font-bold leading-snug">
            {perfectDays} {t.progress.perfectDays}
          </p>
        </div>
      </GlassCard>

      {/* График XP */}
      <GlassCard delay={4}>
        <CardTitle>{t.progress.xpChart}</CardTitle>
        {hasXp ? (
          <XpChart data={last7} />
        ) : (
          <p className="py-6 text-center text-sm text-muted">{t.progress.xpChartEmpty}</p>
        )}
      </GlassCard>

      {/* Еженедельный отчёт — открывается на 4-й неделе */}
      {unlockLevel >= 4 && (
        <GlassCard delay={5}>
          <CardTitle>{t.report.title}</CardTitle>
          <div className="grid grid-cols-4 gap-2">
            {[
              { value: weekReport.sent, label: t.report.sent },
              { value: weekReport.replied, label: t.report.replied },
              { value: weekReport.calls, label: t.report.calls },
              { value: weekReport.closed, label: t.report.closed },
            ].map((cell) => (
              <div key={cell.label} className="rounded-2xl bg-white/[0.04] px-2 py-3 text-center">
                <p className="text-xl font-extrabold">{cell.value}</p>
                <p className="mt-0.5 text-[11px] leading-tight text-white/40">{cell.label}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* История недель */}
      <GlassCard delay={6}>
        <CardTitle>{t.progress.historyTitle}</CardTitle>

        {finishedWeeks.length === 0 ? (
          <p className="py-4 text-sm text-muted">{t.progress.historyEmpty}</p>
        ) : (
          <div className="divide-y divide-divider">
            {finishedWeeks.map((week) => {
              const open = openWeek === week.index;
              const dates = weekDates(week.start);
              const weekXp = dates.reduce((sum, date) => sum + (xpByDate.get(date) ?? 0), 0);

              return (
                <div key={week.index}>
                  <button
                    type="button"
                    onClick={() => setOpenWeek(open ? null : week.index)}
                    className="flex min-h-[52px] w-full items-center gap-3 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold">
                        {t.progress.week} {week.index}
                      </span>
                      <span className="block text-xs text-white/35">
                        {formatShortDate(week.start, lang)} —{' '}
                        {formatShortDate(dates[6], lang)}
                      </span>
                    </span>

                    <span
                      className={`text-base font-extrabold ${
                        week.qualified ? 'text-success' : 'text-white/45'
                      }`}
                    >
                      {week.avgCompletion}%
                    </span>

                    <motion.span
                      animate={{ rotate: open ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="shrink-0 text-white/30"
                    >
                      <ChevronDown size={18} />
                    </motion.span>
                  </button>

                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="grid grid-cols-3 gap-2 pb-4 pt-1">
                          {[
                            { value: `${week.avgCompletion}%`, label: t.progress.avgCompletion },
                            { value: week.daysLogged, label: t.progress.daysTracked },
                            { value: weekXp, label: t.progress.xpEarned },
                          ].map((cell) => (
                            <div
                              key={cell.label}
                              className="rounded-2xl bg-white/[0.04] px-2 py-3 text-center"
                            >
                              <p className="text-lg font-extrabold">{cell.value}</p>
                              <p className="mt-0.5 text-[11px] leading-tight text-white/40">
                                {cell.label}
                              </p>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {/* Достижения */}
      <GlassCard delay={7}>
        <CardTitle>{t.progress.achievements}</CardTitle>

        <ul className="space-y-2">
          {UNLOCKS.map((unlock) => {
            const open = unlockLevel >= unlock.week;
            return (
              <li
                key={unlock.week}
                className={`flex items-start gap-3 rounded-2xl border p-3 transition-colors ${
                  open
                    ? 'border-[rgba(255,209,102,0.25)] bg-[rgba(255,209,102,0.06)]'
                    : 'border-glass-border bg-white/[0.02]'
                }`}
              >
                <span className={`mt-0.5 shrink-0 ${open ? 'text-warn' : 'text-white/20'}`}>
                  {open ? <Sparkles size={17} /> : <Lock size={17} />}
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm font-bold ${open ? 'text-white' : 'text-white/35'}`}
                  >
                    {t.unlocks.week} {unlock.week} · {t.unlocks[unlock.titleKey]}
                  </span>
                  <span
                    className={`mt-0.5 block text-xs leading-snug ${
                      open ? 'text-muted' : 'text-white/25'
                    }`}
                  >
                    {open
                      ? t.unlocks[unlock.descKey]
                      : tf(t.unlocks.requirement, { n: 70 })}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </GlassCard>
    </div>
  );
}

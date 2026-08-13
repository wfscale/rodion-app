'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { GlassCard, CardTitle } from '@/components/GlassCard';
import { ActivityFeed } from '@/components/home/ActivityFeed';
import { DailyTasks } from '@/components/home/DailyTasks';
import { HabitsBlock } from '@/components/home/HabitsBlock';
import { HomeHeader } from '@/components/home/HomeHeader';
import { MorningCheckin } from '@/components/home/MorningCheckin';
import { NutritionBlock } from '@/components/home/NutritionBlock';
import { OutreachCounter } from '@/components/home/OutreachCounter';
import { QuickAddOutreach } from '@/components/home/QuickAddOutreach';
import { useLanguage } from '@/components/LanguageProvider';
import type { ContactDraft } from '@/components/outreach/ContactSheet';
import { SoberMode } from '@/components/sober/SoberMode';
import { Button, FullPageLoader } from '@/components/ui';
import { useDebouncedCallback } from '@/hooks/useDebounced';
import { formatShortDate } from '@/lib/date';
import { daysUntilDeadline } from '@/lib/mode';
import { onceKey, XP } from '@/lib/xp';

export default function HomePage() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const app = useApp();

  const [adding, setAdding] = useState(false);
  const [sober, setSober] = useState(false);
  const [comment, setComment] = useState('');
  const commentTouched = useRef(false);

  useEffect(() => {
    if (commentTouched.current) return;
    setComment(app.todayLog?.day_comment ?? '');
  }, [app.todayLog?.day_comment]);

  const saveComment = useDebouncedCallback(
    (text: string) => app.saveDay({ day_comment: text }),
    500,
  );

  if (app.loading || !app.profile) return <FullPageLoader />;

  const profile = app.profile;
  const daysLeft = daysUntilDeadline(profile.deadline_date, app.today);
  const checkinDone = Boolean(
    app.todayLog?.wake_time || app.todayLog?.sleep_time || app.todayLog?.wake_quality,
  );

  async function handleQuickAdd(draft: ContactDraft) {
    setAdding(true);
    try {
      await app.addContact(draft);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-4">
      <HomeHeader
        streak={profile.quota_streak ?? 0}
        chainDays={app.chain}
        level={app.levelInfo.level}
        levelName={app.levelInfo.name}
        xpPct={app.levelInfo.progressPct}
        totalXp={profile.total_xp}
        xpToNext={app.levelInfo.xpToNext}
        isMax={app.levelInfo.isMax}
        cycleDate={formatShortDate(profile.cycle_start_date, lang)}
        cycleDay={app.cycleDayNumber}
      />

      {/* Счётчик рассылок — главный элемент экрана, всё остальное фон. */}
      <OutreachCounter
        sent={app.quota.sent}
        quota={app.quota.quota}
        record={app.quota.record}
        daysToGrow={app.quota.daysToGrow}
        nextQuota={app.quota.next}
      />

      <QuickAddOutreach today={app.today} onAdd={handleQuickAdd} busy={adding} />

      <GlassCard delay={1}>
        <CardTitle>{t.home.feedTitle}</CardTitle>
        <ActivityFeed entries={app.activity} />
      </GlassCard>

      <GlassCard delay={2}>
        <DailyTasks
          tasks={app.tasks}
          onAdd={(text) => void app.addTask(text)}
          onToggle={(id) => void app.toggleTask(id)}
          onDelete={(id) => void app.deleteTask(id)}
        />
      </GlassCard>

      {/* Трезвый режим — экстренная кнопка, должна быть под рукой. */}
      <Button variant="ghost" full onClick={() => setSober(true)}>
        {t.home.soberMode}
      </Button>

      <MorningCheckin
        log={app.todayLog ?? ({ date: app.today } as never)}
        done={checkinDone}
        delay={3}
        onSave={async (input) => {
          await app.saveDay(input);
          await app.awardXp(XP.CHECKIN, 'checkin', onceKey.checkin(app.today));
        }}
      />

      <GlassCard delay={4}>
        <HabitsBlock
          done={app.todayLog?.checklist ?? {}}
          onToggle={(id) => void app.toggleHabit(id)}
        />

        <NutritionBlock
          log={app.todayLog ?? ({ date: app.today } as never)}
          onSaveMeals={(input) => app.saveDay(input)}
          onToggleFasting={async () => {
            const next = !app.todayLog?.fasting_ok;
            await app.saveDay({ fasting_ok: next });
            if (next) await app.awardXp(XP.HABIT, 'habit', `habit:${app.today}:fasting`);
          }}
        />
      </GlassCard>

      <GlassCard delay={5}>
        <CardTitle right={<span className="text-xs text-white/25">{t.home.autosaved}</span>}>
          {t.home.notesTitle}
        </CardTitle>
        <textarea
          rows={3}
          value={comment}
          onChange={(e) => {
            commentTouched.current = true;
            setComment(e.target.value);
            saveComment(e.target.value);
          }}
          placeholder={t.home.notesPh}
          className="field"
        />
      </GlassCard>

      <SoberMode
        open={sober}
        daysLeft={daysLeft}
        onClose={() => setSober(false)}
        onOpenOutreach={() => {
          setSober(false);
          router.push('/outreach');
        }}
      />
    </div>
  );
}

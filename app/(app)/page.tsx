'use client';

import { Minimize2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { BurnTimer } from '@/components/guard/BurnTimer';
import { ShieldCard } from '@/components/guard/ShieldCard';
import { ActivityFeed } from '@/components/home/ActivityFeed';
import { DailyTasks } from '@/components/home/DailyTasks';
import { HabitsBlock } from '@/components/home/HabitsBlock';
import { HomeHeader } from '@/components/home/HomeHeader';
import { MorningCheckin } from '@/components/home/MorningCheckin';
import { OutreachCounter } from '@/components/home/OutreachCounter';
import { QuickAddOutreach } from '@/components/home/QuickAddOutreach';
import { RoundNudge } from '@/components/home/RoundNudge';
import { useLanguage } from '@/components/LanguageProvider';
import type { ContactDraft } from '@/components/outreach/ContactSheet';
import { SoberMode } from '@/components/sober/SoberMode';
import { Button, DeskColumns, FullPageLoader, useStickyState } from '@/components/ui';
import { useFocusSession } from '@/components/session/SessionProvider';
import { formatShortDate } from '@/lib/date';
import { daysUntilDeadline } from '@/lib/mode';
import { onceKey, XP } from '@/lib/xp';

export default function HomePage() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const app = useApp();
  const session = useFocusSession();

  const [adding, setAdding] = useState(false);
  const [sober, setSober] = useState(false);

  // Режим фокуса — перк 14-го уровня. Состояние переживает перезагрузку:
  // включил фокус и закрыл приложение — вернёшься в фокус.
  const [focus, setFocus] = useStickyState('rodion.home.focus', false);

  /*
   * Дневные задачи проектов правят на странице проекта, а провайдер живёт
   * в общем макете и сам по себе не перезагружается. Без этого возврат на
   * главную показывал бы вчерашний список.
   */
  const { reloadProjectTasks } = app;
  useEffect(() => {
    void reloadProjectTasks();
  }, [reloadProjectTasks]);

  if (app.loading || !app.profile) return <FullPageLoader />;

  const profile = app.profile;
  const daysLeft = daysUntilDeadline(profile.deadline_date, app.today);
  const checkinDone = Boolean(
    app.todayLog?.wake_time || app.todayLog?.sleep_time || app.todayLog?.wake_quality,
  );
  const canFocus = app.can('focus');
  const focusOn = canFocus && focus;

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
      {!focusOn && (
        <HomeHeader
          streak={profile.quota_streak ?? 0}
          guard={app.guard.today}
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
      )}


      {/*
        Две колонки на мониторе: слева всё, чем работают руками, справа фон
        дня. В одну колонку главная уезжала на два экрана вниз при том, что
        физически помещается целиком.

        В режиме фокуса правая колонка пуста — в этом и смысл фокуса, — и
        левая растягивается на всю ширину сама: пустой колонки в сетке нет.
      */}
      <DeskColumns
        main={
          <>
            {/* Счётчик рассылок — главный элемент экрана, всё остальное фон. */}
            <OutreachCounter
              sent={app.quota.sent}
              quota={app.quota.quota}
              record={app.quota.record}
              daysToGrow={app.quota.daysToGrow}
              nextQuota={app.quota.next}
              showOverdrive={app.can('overdrive')}
              paused={app.guard.today === 'pause'}
            />

            {/*
              Сколько времени у дня осталось. Стоит сразу под счётчиком и
              исчезает, как только квота закрыта: подгонять человека, который
              своё сделал, нечем — а строка, которая висит всегда, перестаёт
              читаться вообще.
            */}
            <BurnTimer
              guard={app.guard}
              sent={app.quota.sent}
              quota={app.quota.quota}
              streak={profile.quota_streak ?? 0}
              onArm={() => void app.armShield()}
            />

            {/*
              Щит и привал — здесь, а не только на странице рассылок.

              Решение «сегодня не вытяну» принимают вечером, глядя на счётчик
              дня и на остаток времени, и оба они прямо над этой карточкой.
              На странице рассылок щит лежит в боковой колонке — на телефоне
              это несколько экранов вниз, то есть ровно тогда, когда сил
              листать уже нет, его там и нет.
            */}
            <ShieldCard
              guard={app.guard}
              sent={app.quota.sent}
              quota={app.quota.quota}
              streak={app.quota.streak}
              onArm={() => void app.armShield()}
              onDisarm={() => void app.disarmShield()}
              onPause={(on) => void app.setPause(on)}
              onAuto={(value) => void app.setShieldAuto(value)}
            />

            {/* Ровное число — единственная цель, которая никогда не кончается.
                На привале молчит: пока квота не закрыта, надж говорит именно
                про неё, а это ровно то давление, ради снятия которого привал
                и существует. */}
            {!(app.guard.today === 'pause' && !app.quota.closed) && (
              <RoundNudge
                sentToday={app.quota.sent}
                quota={app.quota.quota}
                total={app.sentTotal}
              />
            )}

            <QuickAddOutreach today={app.today} onAdd={handleQuickAdd} busy={adding} />

            {focusOn && (
              <Button variant="ghost" full onClick={() => setFocus(false)}>
                <Minimize2 size={16} />
                {t.focus.off}
              </Button>
            )}
          </>
        }
        side={
          focusOn ? null : (
            <>
              {/* Компонент рисует свою карточку сам: вложенный backdrop-filter
                  в Safari на iOS схлопывается в белый прямоугольник. */}
              <ActivityFeed entries={app.activity} />

              {/* Задачи дня и дневные задачи проектов приходят одним списком:
                  работа по проекту и есть работа дня. */}
              <DailyTasks
                tasks={app.homeTasks}
                tomorrow={app.tomorrowTasks}
                onAdd={(text, forTomorrow, minutes) =>
                  void app.addTask(text, forTomorrow, minutes)
                }
                onToggle={(task) => void app.toggleHomeTask(task)}
                onDelete={(task) => void app.deleteTask(task.id)}
                onDeleteTomorrow={(id) => void app.deleteTask(id)}
                timerBusy={Boolean(session.session)}
                onStartTimer={(task) =>
                  session.start({
                    kind: 'task',
                    label: task.text,
                    minutes: task.minutes ?? 0,
                    taskId: task.id,
                    taskSource: task.source,
                  })
                }
              />

              <MorningCheckin
                log={app.todayLog ?? ({ date: app.today } as never)}
                done={checkinDone}
                delay={3}
                onSave={async (input) => {
                  await app.saveDay(input);
                  await app.awardXp(XP.CHECKIN, 'checkin', onceKey.checkin(app.today));
                }}
              />

              <HabitsBlock
                done={app.todayLog?.checklist ?? {}}
                onToggle={(id) => void app.toggleHabit(id)}
              />

              {/* Трезвый режим — экстренная кнопка, должна быть под рукой. */}
              <Button variant="ghost" full onClick={() => setSober(true)}>
                {t.home.soberMode}
              </Button>

              {canFocus && (
                <Button variant="ghost" full onClick={() => setFocus(true)}>
                  {t.focus.on}
                </Button>
              )}
            </>
          )
        }
      />

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

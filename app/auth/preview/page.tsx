'use client';

/**
 * Страница визуальной проверки: боевые компоненты с моковыми данными.
 *
 * Существует потому, что автотесты и typecheck пропустили вложенные
 * стеклянные карточки — а они в Safari превращались в белые прямоугольники.
 * Такое ловится только скриншотом, поэтому проверять вёрстку теперь есть где.
 *
 * На проде страницы нет: она отдаёт 404.
 */

import { notFound } from 'next/navigation';
import { useState } from 'react';
import { ActivityFeed } from '@/components/home/ActivityFeed';
import { DailyTasks } from '@/components/home/DailyTasks';
import { HabitsBlock } from '@/components/home/HabitsBlock';
import { BurnTimer } from '@/components/guard/BurnTimer';
import { ShieldCard } from '@/components/guard/ShieldCard';
import { HomeHeader } from '@/components/home/HomeHeader';
import { OutreachCounter } from '@/components/home/OutreachCounter';
import { QuickAddOutreach } from '@/components/home/QuickAddOutreach';
import { RoundNudge } from '@/components/home/RoundNudge';
import { ModeBlock } from '@/components/mode/ModeBlock';
import { BlueprintCard } from '@/components/outreach/BlueprintCard';
import { ContactCards } from '@/components/outreach/ContactCards';
import { ContactTable, type TableSort } from '@/components/outreach/ContactTable';
import { ConversationSheet } from '@/components/outreach/ConversationSheet';
import { DialogueCard } from '@/components/outreach/DialogueCard';
import { FollowUpList } from '@/components/outreach/FollowUpList';
import { FunnelChart } from '@/components/outreach/FunnelChart';
import { HourlyCard } from '@/components/outreach/HourlyCard';
import { NicheAnalytics } from '@/components/outreach/NicheAnalytics';
import { OutreachFilters } from '@/components/outreach/OutreachFilters';
import { PatternsCard } from '@/components/outreach/PatternsCard';
import { PrimeList } from '@/components/outreach/PrimeList';
import { AccentPicker } from '@/components/progress/AccentPicker';
import { AchievementsCard } from '@/components/progress/AchievementsCard';
import { GrowthChart } from '@/components/progress/GrowthChart';
import { Heatmap } from '@/components/progress/Heatmap';
import { HallOfFame, MentorCard, WeekCompare } from '@/components/progress/InsightCards';
import { LevelLadder } from '@/components/progress/LevelLadder';
import { ReminderList } from '@/components/reminders/ReminderList';
import { BottomNav } from '@/components/BottomNav';
import type { ChatMessage } from '@/lib/conversation';
import { EMPTY_FILTERS, nicheOptions, type OutreachFilters as Filters } from '@/lib/outreach-filter';
import type { GuardView } from '@/lib/shield';
import type { ActivityEntry, DailyTask, OutreachContact, Reminder } from '@/lib/types';

const TODAY = '2026-08-13';
const NOW = `${TODAY}T12:00`;

const contact = (over: Partial<OutreachContact>): OutreachContact =>
  ({
    id: Math.random().toString(36).slice(2),
    user_id: 'u',
    name: '@expert',
    niche: 'Английский',
    audience_size: null,
    platform: null,
    status: 'sent',
    note: null,
    status_history: [],
    telegram_handle: 'expert',
    instagram_url: 'https://instagram.com/expert',
    first_contact_date: '2026-08-10',
    comment: 'Заметил сильный контент, но нет продукта — предложил разобрать воронку',
    next_step: null,
    replied_at: null,
    last_touch_at: '2026-08-08',
    touch_count: 1,
    muted: false,
    conversation: [],
    created_at: '2026-08-10T10:00:00Z',
    updated_at: '2026-08-10T10:00:00Z',
    ...over,
  }) as OutreachContact;

/** Переписка с типичной поломкой: ход за ним, а ты молчишь. */
const CHAT: ChatMessage[] = [
  { role: 'me', text: 'Привет! Смотрел твой последний запуск — сильно сделано. Могу разобрать воронку, интересно?' },
  { role: 'them', text: 'привет, а что конкретно предлагаешь' },
  { role: 'me', text: 'Разберу путь от рилса до оплаты и покажу, где теряются заявки.' },
  { role: 'them', text: 'звучит ок, а по деньгам как?' },
];

const CONTACTS: OutreachContact[] = [
  contact({ name: '@anna_english', niche: 'Английский', status: 'replied', conversation: CHAT }),
  contact({ name: '@coach_dmitry', niche: 'Фитнес', status: 'call' }),
  contact({ name: '@maria_psy', niche: 'Психология', status: 'sent' }),
  contact({ name: '@vlad_money', niche: 'Финансы', status: 'blocked' }),
  contact({ name: '@olga_art', niche: 'Творчество', status: 'closed' }),
  // Ответ есть, исход отрицательный — строка обязана быть красной.
  contact({ name: '@igor_sales', niche: 'Продажи', status: 'replied_no' }),
];

const ACTIVITY: ActivityEntry[] = [
  { id: '1', user_id: 'u', type: 'replied', contact_name: '@anna_english', contact_niche: 'Английский', detail: null, xp_earned: 80, created_at: '2026-08-13T11:07:00Z' },
  { id: '2', user_id: 'u', type: 'sent', contact_name: '@maria_psy', contact_niche: 'Психология', detail: null, xp_earned: 8, created_at: '2026-08-13T11:05:00Z' },
  { id: '3', user_id: 'u', type: 'call', contact_name: '@coach_dmitry', contact_niche: 'Фитнес', detail: 'завтра 12:00', xp_earned: 250, created_at: '2026-08-13T10:30:00Z' },
  { id: '4', user_id: 'u', type: 'sent', contact_name: '@vlad_money', contact_niche: 'Финансы', detail: null, xp_earned: 8, created_at: '2026-08-13T10:59:00Z' },
];

const TASKS: DailyTask[] = [
  { id: 't1', user_id: 'u', date: TODAY, text: 'Написать оффер для фитнес-ниши', completed: false, created_at: '' },
  { id: 't2', user_id: 'u', date: TODAY, text: 'Ответить Дмитрию', completed: true, created_at: '' },
];

const reminder = (over: Partial<Reminder>): Reminder =>
  ({
    id: Math.random().toString(36).slice(2),
    user_id: 'u',
    title: 'Позвонить и добить оффер',
    note: null,
    due_at: `${TODAY}T09:00`,
    contact_id: null,
    done: false,
    created_at: '',
    updated_at: '',
    ...over,
  }) as Reminder;

const REMINDERS: Reminder[] = [
  reminder({ title: 'Отправить смету Анне', due_at: '2026-08-12T18:00' }),
  reminder({ title: 'Написать Дмитрию до созвона', due_at: `${TODAY}T10:00`, contact_id: CONTACTS[1].id }),
  reminder({ title: 'Собрать разбор ниши', due_at: `${TODAY}T20:00` }),
  reminder({ title: 'Прозвон по базе', due_at: '2026-08-15T11:00' }),
  reminder({ title: 'Старая задача', due_at: '2026-08-01T11:00', done: true }),
];

const OFFERS = [
  { content: 'Привет! Посмотрел твой блог, зацепило про запуск. Могу собрать воронку — интересно?', result: 'replied' },
  { content: 'Привет! Смотрел последний запуск, сильно. Вижу, где теряешь 30% выручки. Обсудим?', result: 'replied_no' },
  { content: 'Привет! Заметил, что у тебя нет продукта под холодную аудиторию. Давай покажу схему?', result: 'call' },
  { content: 'Предлагаю сотрудничество на выгодных условиях', result: 'sent' },
  { content: 'Предлагаю услуги продюсера, большой опыт работы с экспертами', result: 'sent' },
  { content: 'Здравствуйте, готов обсудить совместную работу', result: 'sent' },
];

/** Страховка серии: базовое состояние, от которого пляшут все витрины ниже. */
const guardView = (over: Partial<GuardView> = {}): GuardView => ({
  ready: true,
  charges: 3,
  regenIn: 0,
  auto: true,
  today: null,
  pauseDay: 0,
  minutesLeft: 312,
  burn: 'safe',
  canArm: true,
  ...over,
});

const CHART = Array.from({ length: 14 }, (_, i) => ({
  date: `2026-07-${String(31 - 13 + i).padStart(2, '0')}`,
  value: [0, 2, 5, 3, 8, 12, 7, 0, 4, 9, 15, 11, 6, 10][i],
}));

export default function PreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const [done, setDone] = useState<Record<string, boolean>>({ water: true, pushups: true });
  const [sort, setSort] = useState<TableSort | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <main className="md:pl-[240px]">
      <div className="pb-content mx-auto w-full max-w-lg space-y-4 px-4 pt-4 md:max-w-5xl md:px-6">
        <HomeHeader
          streak={3}
          guard="shield"
          chainDays={5}
          level={2}
          levelName="Охотник"
          xpPct={40}
          totalXp={420}
          xpToNext={380}
          isMax={false}
          cycleDate="13 авг"
          cycleDay={1}
        />

        <OutreachCounter sent={12} quota={5} record={3} daysToGrow={3} nextQuota={8} showOverdrive />

        {/* Тот же счётчик на привале: планки и процента нет, число осталось. */}
        <OutreachCounter sent={0} quota={5} record={3} daysToGrow={3} nextQuota={8} paused />

        {/* Таймер сгорания дня во всех четырёх состояниях: спокойное время,
            жёлтый вечер, красный час с аварийной кнопкой, щит и привал. */}
        <BurnTimer guard={guardView()} sent={2} quota={5} streak={7} onArm={() => undefined} />
        <BurnTimer
          guard={guardView({ minutesLeft: 214, burn: 'warn' })}
          sent={2}
          quota={5}
          streak={7}
          onArm={() => undefined}
        />
        <BurnTimer
          guard={guardView({ minutesLeft: 47, burn: 'danger' })}
          sent={2}
          quota={5}
          streak={7}
          onArm={() => undefined}
        />
        <BurnTimer
          guard={guardView({ today: 'shield', charges: 2, regenIn: 4, canArm: false })}
          sent={2}
          quota={5}
          streak={7}
          onArm={() => undefined}
        />
        <BurnTimer
          guard={guardView({ today: 'pause', pauseDay: 3, canArm: false })}
          sent={0}
          quota={5}
          streak={12}
          onArm={() => undefined}
        />

        {/* Три состояния наджа: до квоты, до ровного дня, до ровного счёта. */}
        <RoundNudge sentToday={3} quota={5} total={22} />
        <RoundNudge sentToday={7} quota={5} total={22} />
        <RoundNudge sentToday={10} quota={5} total={24} />

        <QuickAddOutreach today={TODAY} onAdd={async () => undefined} />

        <ActivityFeed entries={ACTIVITY} />

        <DailyTasks
          tasks={TASKS}
          onAdd={() => undefined}
          onToggle={() => undefined}
          onDelete={() => undefined}
        />

        <HabitsBlock done={done} onToggle={(id) => setDone((p) => ({ ...p, [id]: !p[id] }))} />

        <FunnelChart sent={247} replied={11} calls={3} closed={1} onLevelClick={() => undefined} />

        <FollowUpList
          contacts={CONTACTS}
          reminders={REMINDERS}
          today={TODAY}
          now={NOW}
          onTouch={() => undefined}
          onMute={() => undefined}
          onOpen={() => undefined}
          onCompleteReminder={() => undefined}
        />

        <OutreachFilters
          filters={filters}
          onChange={setFilters}
          niches={nicheOptions(CONTACTS)}
        />

        <NicheAnalytics contacts={CONTACTS} />

        <PrimeList contacts={CONTACTS} today={TODAY} onOpen={() => undefined} />

        <HourlyCard contacts={CONTACTS} />

        <BlueprintCard samples={OFFERS} />
        <PatternsCard samples={OFFERS} />
        <DialogueCard contacts={CONTACTS} />

        <ContactCards contacts={CONTACTS} onOpenContact={() => undefined} highlightId={null} />

        <ContactTable
          contacts={CONTACTS}
          onOpenContact={() => undefined}
          onStatusChange={() => undefined}
          onInlineAdd={() => undefined}
          highlightId={null}
          sort={sort}
          onSortChange={setSort}
        />

        {/* Карточка щита: обычный вечер, взведённый щит, пустой запас, привал. */}
        <ShieldCard
          guard={guardView({ minutesLeft: 214, burn: 'warn' })}
          sent={2}
          quota={5}
          streak={7}
          onArm={() => undefined}
          onDisarm={() => undefined}
          onPause={() => undefined}
          onAuto={() => undefined}
        />
        <ShieldCard
          guard={guardView({ today: 'shield', charges: 2, regenIn: 4, canArm: false })}
          sent={2}
          quota={5}
          streak={7}
          onArm={() => undefined}
          onDisarm={() => undefined}
          onPause={() => undefined}
          onAuto={() => undefined}
        />
        <ShieldCard
          guard={guardView({
            charges: 0,
            regenIn: 2,
            auto: false,
            minutesLeft: 47,
            burn: 'danger',
            canArm: false,
          })}
          sent={4}
          quota={5}
          streak={7}
          onArm={() => undefined}
          onDisarm={() => undefined}
          onPause={() => undefined}
          onAuto={() => undefined}
        />
        <ShieldCard
          guard={guardView({ today: 'pause', pauseDay: 3, charges: 1, regenIn: 4, canArm: false })}
          sent={0}
          quota={5}
          streak={12}
          onArm={() => undefined}
          onDisarm={() => undefined}
          onPause={() => undefined}
          onAuto={() => undefined}
        />
        <ShieldCard
          guard={guardView({ ready: false })}
          sent={0}
          quota={5}
          streak={0}
          onArm={() => undefined}
          onDisarm={() => undefined}
          onPause={() => undefined}
          onAuto={() => undefined}
        />

        <ModeBlock counters={{ porn: 16, mb: 14, sugar: 15 }} />

        {/* Прогресс */}
        <div className="glass p-4">
          <GrowthChart data={CHART} unit="рассылки" />
        </div>

        <LevelLadder level={3} />

        <Heatmap contacts={CONTACTS} today={TODAY} weeks={12} />

        <AchievementsCard
          input={{ sent: 30, replied: 4, calls: 1, closed: 0, chain: 8, record: 12, quotaStreak: 3 }}
        />

        <WeekCompare contacts={CONTACTS} today={TODAY} />

        <MentorCard numbers={{ sent: 120, replied: 18, calls: 2, closed: 0, overdueTouches: 1 }} />

        <HallOfFame contacts={CONTACTS} />

        <AccentPicker />

        {/* Напоминания */}
        <ReminderList
          reminders={REMINDERS}
          contacts={CONTACTS}
          now={NOW}
          today={TODAY}
          onToggle={() => undefined}
          onOpen={() => undefined}
        />

        {/* Шторка переписки: открывается кнопкой, потому что внутри её
            проверяют скроллом, разбором и стрелками порядка. */}
        <button type="button" onClick={() => setChatOpen(true)} className="btn-ghost w-full">
          Открыть переписку
        </button>
      </div>

      <ConversationSheet
        contact={CONTACTS[0]}
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        onSave={() => undefined}
      />

      <BottomNav />
    </main>
  );
}

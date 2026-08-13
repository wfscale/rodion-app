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
import { HomeHeader } from '@/components/home/HomeHeader';
import { OutreachCounter } from '@/components/home/OutreachCounter';
import { QuickAddOutreach } from '@/components/home/QuickAddOutreach';
import { ModeBlock } from '@/components/mode/ModeBlock';
import { ContactCards } from '@/components/outreach/ContactCards';
import { ContactTable, type TableSort } from '@/components/outreach/ContactTable';
import { FollowUpList } from '@/components/outreach/FollowUpList';
import { FunnelChart } from '@/components/outreach/FunnelChart';
import { BottomNav } from '@/components/BottomNav';
import type { ActivityEntry, DailyTask, OutreachContact } from '@/lib/types';

const TODAY = '2026-08-13';

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
    created_at: '2026-08-10T10:00:00Z',
    updated_at: '2026-08-10T10:00:00Z',
    ...over,
  }) as OutreachContact;

const CONTACTS: OutreachContact[] = [
  contact({ name: '@anna_english', niche: 'Английский', status: 'replied' }),
  contact({ name: '@coach_dmitry', niche: 'Фитнес', status: 'call' }),
  contact({ name: '@maria_psy', niche: 'Психология', status: 'sent' }),
  contact({ name: '@vlad_money', niche: 'Финансы', status: 'blocked' }),
  contact({ name: '@olga_art', niche: 'Творчество', status: 'closed' }),
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

export default function PreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const [done, setDone] = useState<Record<string, boolean>>({ water: true, pushups: true });
  const [sort, setSort] = useState<TableSort | null>(null);

  return (
    <main className="md:pl-[240px]">
      <div className="pb-content mx-auto w-full max-w-lg space-y-4 px-4 pt-4 md:max-w-5xl md:px-6">
        <HomeHeader
          streak={3}
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

        <OutreachCounter sent={3} quota={5} record={3} daysToGrow={3} nextQuota={8} />

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
          today={TODAY}
          onTouch={() => undefined}
          onMute={() => undefined}
          onOpen={() => undefined}
        />

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

        <ModeBlock counters={{ porn: 16, mb: 14, sugar: 15 }} />
      </div>

      <BottomNav />
    </main>
  );
}

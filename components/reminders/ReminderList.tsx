'use client';

import { motion } from 'framer-motion';
import { Check, RotateCcw, User } from 'lucide-react';
import { useMemo } from 'react';
import { useLanguage } from '@/components/LanguageProvider';
import { Badge, EmptyState } from '@/components/ui';
import { formatShortDate } from '@/lib/date';
import {
  groupReminders,
  reminderDate,
  reminderTime,
  urgencyOf,
  type ReminderUrgency,
} from '@/lib/reminders';
import type { OutreachContact, Reminder } from '@/lib/types';

type Props = {
  reminders: Reminder[];
  contacts: OutreachContact[];
  now: string;
  today: string;
  onToggle: (id: string) => void;
  onOpen: (reminder: Reminder) => void;
};

function Group({
  title,
  tone = 'muted',
  children,
}: {
  title: string;
  tone?: 'muted' | 'alert';
  children: React.ReactNode;
}) {
  return (
    <div>
      <p
        className={`mb-2 text-xs font-bold uppercase tracking-wide ${
          tone === 'alert' ? 'text-warn' : 'text-white/35'
        }`}
      >
        {title}
      </p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

/**
 * Строка напоминания.
 *
 * Объявлена на верхнем уровне модуля намеренно: внутри компонента-родителя
 * её тип пересоздавался бы на каждый рендер, а список перерисовывается раз
 * в полминуты вместе с часами — все строки заново проигрывали бы появление.
 */
function Row({
  reminder,
  urgency,
  contactName,
  onToggle,
  onOpen,
}: {
  reminder: Reminder;
  urgency: ReminderUrgency;
  contactName: string | null;
  onToggle: (id: string) => void;
  onOpen: (reminder: Reminder) => void;
}) {
  const { t, tf, lang } = useLanguage();

  const border =
    urgency === 'overdue'
      ? 'border-l-[#FF6B6B]'
      : urgency === 'due'
        ? 'border-l-[#FFD166]'
        : 'border-l-transparent';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className={`overflow-hidden rounded-2xl border-l-2 bg-white/[0.04] ${border}`}
    >
      <div className="flex items-start gap-2 p-3">
        <button type="button" onClick={() => onOpen(reminder)} className="min-w-0 flex-1 text-left">
          <p
            className={`truncate text-base font-bold ${
              reminder.done ? 'text-white/35 line-through' : 'text-white'
            }`}
          >
            {reminder.title}
          </p>

          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted">
            <span className="tabular-nums">
              {formatShortDate(reminderDate(reminder.due_at), lang)}{' '}
              {tf(t.reminders.at, { time: reminderTime(reminder.due_at) })}
            </span>

            {contactName && (
              <span className="inline-flex items-center gap-1 text-white/45">
                <User size={12} />
                {contactName}
              </span>
            )}
          </p>

          {reminder.note && (
            <p className="mt-1 line-clamp-2 text-sm leading-snug text-white/40">{reminder.note}</p>
          )}
        </button>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {!reminder.done && (urgency === 'due' || urgency === 'overdue') && (
            <Badge tone={urgency === 'overdue' ? 'danger' : 'warn'}>
              {urgency === 'overdue' ? t.reminders.overdueBadge : t.reminders.dueBadge}
            </Badge>
          )}

          <button
            type="button"
            onClick={() => onToggle(reminder.id)}
            aria-label={reminder.done ? t.reminders.markUndone : t.reminders.markDone}
            className={`flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${
              reminder.done
                ? 'border-glass-border bg-white/[0.05] text-white/40'
                : 'border-white bg-white text-ink'
            }`}
          >
            {reminder.done ? <RotateCcw size={16} /> : <Check size={18} strokeWidth={2.6} />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Список напоминаний, разложенный по срочности.
 *
 * Сработавшее напоминание не исчезает через секунду и не мигает — оно висит
 * в группе «Пора» весь день, пока его не закроют. Напоминание, которое можно
 * не заметить, бессмысленно.
 */
export function ReminderList({ reminders, contacts, now, today, onToggle, onOpen }: Props) {
  const { t } = useLanguage();

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const contact of contacts) map.set(contact.id, contact.name);
    return map;
  }, [contacts]);

  const groups = useMemo(() => groupReminders(reminders, now, today), [reminders, now, today]);

  if (reminders.length === 0) {
    return <EmptyState text={t.reminders.empty} />;
  }

  const render = (rows: Reminder[]) =>
    rows.map((reminder) => (
      <Row
        key={reminder.id}
        reminder={reminder}
        urgency={urgencyOf(reminder, now, today)}
        contactName={reminder.contact_id ? (nameById.get(reminder.contact_id) ?? null) : null}
        onToggle={onToggle}
        onOpen={onOpen}
      />
    ));

  return (
    <div className="space-y-5">
      {groups.active.length > 0 && (
        <Group title={t.reminders.activeTitle} tone="alert">
          {render(groups.active)}
        </Group>
      )}

      {groups.today.length > 0 && (
        <Group title={t.reminders.todayTitle}>{render(groups.today)}</Group>
      )}

      {groups.upcoming.length > 0 && (
        <Group title={t.reminders.upcomingTitle}>{render(groups.upcoming)}</Group>
      )}

      {groups.done.length > 0 && (
        <Group title={t.reminders.doneTitle}>{render(groups.done.slice(0, 20))}</Group>
      )}
    </div>
  );
}

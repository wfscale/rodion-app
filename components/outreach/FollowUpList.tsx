'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { BellOff, BellRing, Check, ExternalLink } from 'lucide-react';
import { useMemo } from 'react';
import { CardTitle, GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { statusTone, telegramUrl } from '@/components/outreach/ContactSheet';
import { Badge, EmptyState } from '@/components/ui';
import { compareUrgency, followUpState, urgencyColor, type FollowUpState } from '@/lib/followup';
import { isActive, reminderTime, urgencyOf } from '@/lib/reminders';
import type { OutreachContact, Reminder } from '@/lib/types';

type Row = {
  contact: OutreachContact;
  state: FollowUpState;
  /** Сработавшее напоминание по этому человеку, если оно есть. */
  reminder: Reminder | null;
};

/**
 * Рабочий список на день: кого пора коснуться повторно.
 *
 * Рассылку вслепую делают все. Разница начинается на втором и третьем
 * касании — поэтому список показывается выше самой таблицы: это то, с чего
 * стоит начинать день, а не то, что ищут прокруткой.
 *
 * Сюда же всплывают напоминания, привязанные к людям: «позвонить Диме в 14:00»
 * это то же самое касание, только назначенное вручную. Общие задачи остаются
 * во вкладке «Напоминания» — рабочий список дня должен состоять из людей.
 */
export function FollowUpList({
  contacts,
  reminders,
  today,
  now,
  onTouch,
  onMute,
  onOpen,
  onCompleteReminder,
}: {
  contacts: OutreachContact[];
  reminders: Reminder[];
  today: string;
  now: string;
  onTouch: (contact: OutreachContact) => void;
  onMute: (id: string, muted: boolean) => void;
  onOpen: (contact: OutreachContact) => void;
  onCompleteReminder: (id: string) => void;
}) {
  const { t, tf, days } = useLanguage();

  /** Сработавшие напоминания, разложенные по контактам. */
  const remindersByContact = useMemo(() => {
    const map = new Map<string, Reminder>();
    for (const reminder of reminders) {
      if (!reminder.contact_id || reminder.done) continue;
      if (!isActive(urgencyOf(reminder, now, today))) continue;

      // Если по человеку несколько сработавших — берём самое раннее.
      const existing = map.get(reminder.contact_id);
      if (!existing || reminder.due_at < existing.due_at) map.set(reminder.contact_id, reminder);
    }
    return map;
  }, [reminders, now, today]);

  const rows = useMemo<Row[]>(() => {
    return contacts
      .map((contact) => ({
        contact,
        state: followUpState({
          status: contact.status,
          lastTouchAt: contact.last_touch_at,
          touchCount: contact.touch_count ?? 1,
          muted: Boolean(contact.muted),
          today,
        }),
        reminder: remindersByContact.get(contact.id) ?? null,
      }))
      // Напоминание попадает в список независимо от каскада: его поставили
      // руками, значит оно важнее расписания.
      .filter(({ state, reminder }) => reminder !== null || state.urgency === 'due' || state.urgency === 'overdue')
      .sort((a, b) => {
        if (Boolean(a.reminder) !== Boolean(b.reminder)) return a.reminder ? -1 : 1;
        return compareUrgency(a.state, b.state);
      });
  }, [contacts, today, remindersByContact]);

  const reasonLabel = (state: FollowUpState) => {
    if (state.reason === 'replied') return t.followup.reasonReplied;
    if (state.reason === 'call') return t.followup.reasonCall;
    return `${tf(t.followup.silentDays, { n: state.daysSinceTouch })} ${days(state.daysSinceTouch)}`;
  };

  return (
    <GlassCard delay={1}>
      <CardTitle
        right={
          rows.length > 0 ? (
            <span className="text-sm font-extrabold text-warn">{rows.length}</span>
          ) : undefined
        }
      >
        {t.followup.title}
      </CardTitle>

      {rows.length === 0 ? (
        <EmptyState text={t.followup.empty} />
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {rows.map(({ contact, state, reminder }) => {
              const color = reminder
                ? '#FFD166'
                : (urgencyColor(state.urgency) ?? 'transparent');
              const tg = telegramUrl(contact.telegram_handle);
              const link = tg ?? contact.instagram_url;
              const overdue = state.urgency === 'overdue';

              return (
                <motion.div
                  key={contact.id}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.25 }}
                  /* Полоса слева — единственный цветной элемент: срочность
                     считывается боковым зрением, не отвлекая от списка. */
                  style={{ borderLeftColor: color }}
                  className="overflow-hidden rounded-2xl border-l-2 bg-white/[0.04] p-3"
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => onOpen(contact)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-base font-extrabold">{contact.name}</p>
                      <p className="mt-0.5 truncate text-sm text-muted">
                        {[
                          contact.niche,
                          reasonLabel(state),
                          tf(t.followup.touchNumber, { n: state.nextTouchNumber }),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </button>

                    {reminder ? (
                      <Badge tone="warn">
                        {t.followup.reminderTag}{' '}
                        {tf(t.followup.reminderAt, { time: reminderTime(reminder.due_at) })}
                      </Badge>
                    ) : (
                      <Badge tone={overdue ? 'danger' : 'warn'}>
                        {overdue
                          ? tf(t.followup.overdue, { n: Math.abs(state.daysUntil) })
                          : t.followup.due}
                      </Badge>
                    )}
                  </div>

                  {/* Текст назначенного напоминания важнее любых подписей —
                      человек писал его себе сам. */}
                  {reminder && (
                    <p className="mt-2 flex items-start gap-2 rounded-xl bg-[rgba(255,209,102,0.08)] px-2.5 py-2 text-sm leading-snug text-warn">
                      <BellRing size={14} className="mt-0.5 shrink-0" />
                      <span className="min-w-0 flex-1">{reminder.title}</span>
                    </p>
                  )}

                  <div className="mt-3 flex items-center gap-2">
                    {link && (
                      <a
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-ghost min-h-[44px] flex-1 text-sm font-semibold"
                      >
                        <ExternalLink size={15} />
                        {t.common.open}
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        onTouch(contact);
                        // Коснулся — назначенное напоминание закрывается вместе
                        // с касанием, иначе оно висит до конца дня без смысла.
                        if (reminder) onCompleteReminder(reminder.id);
                      }}
                      className="btn-primary min-h-[44px] flex-1 text-sm"
                    >
                      <Check size={15} />
                      {t.followup.touch}
                    </button>

                    <button
                      type="button"
                      onClick={() => onMute(contact.id, true)}
                      aria-label={t.followup.mute}
                      className="btn-ghost w-12 shrink-0"
                    >
                      <BellOff size={15} />
                    </button>
                  </div>

                  <span className="sr-only">{t.statuses[contact.status]}</span>
                  <span className="sr-only">{statusTone(contact.status)}</span>
                </motion.div>
              );
            })}
          </AnimatePresence>

          <p className="pt-1 text-xs leading-relaxed text-white/25">{t.followup.hint}</p>
        </div>
      )}
    </GlassCard>
  );
}

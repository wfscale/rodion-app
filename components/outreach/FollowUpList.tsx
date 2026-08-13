'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { BellOff, Check, ExternalLink } from 'lucide-react';
import { useMemo } from 'react';
import { CardTitle, GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { statusTone, telegramUrl } from '@/components/outreach/ContactSheet';
import { Badge, EmptyState } from '@/components/ui';
import { compareUrgency, followUpState, urgencyColor, type FollowUpState } from '@/lib/followup';
import type { OutreachContact } from '@/lib/types';

type Row = { contact: OutreachContact; state: FollowUpState };

/**
 * Рабочий список на день: кого пора коснуться повторно.
 *
 * Рассылку вслепую делают все. Разница начинается на втором и третьем
 * касании — поэтому список показывается выше самой таблицы: это то, с чего
 * стоит начинать день, а не то, что ищут прокруткой.
 */
export function FollowUpList({
  contacts,
  today,
  onTouch,
  onMute,
  onOpen,
}: {
  contacts: OutreachContact[];
  today: string;
  onTouch: (contact: OutreachContact) => void;
  onMute: (id: string, muted: boolean) => void;
  onOpen: (contact: OutreachContact) => void;
}) {
  const { t, tf, days } = useLanguage();

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
      }))
      .filter(({ state }) => state.urgency === 'due' || state.urgency === 'overdue')
      .sort((a, b) => compareUrgency(a.state, b.state));
  }, [contacts, today]);

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
            {rows.map(({ contact, state }) => {
              const color = urgencyColor(state.urgency) ?? 'transparent';
              const tg = telegramUrl(contact.telegram_handle);
              const link = tg ?? contact.instagram_url;

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
                          tf(t.followup.silentDays, { n: state.daysSinceTouch }) +
                            ' ' +
                            days(state.daysSinceTouch),
                          tf(t.followup.touchNumber, { n: state.nextTouchNumber }),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </button>

                    <Badge tone={state.urgency === 'overdue' ? 'danger' : 'warn'}>
                      {state.urgency === 'overdue'
                        ? tf(t.followup.overdue, { n: Math.abs(state.daysUntil) })
                        : t.followup.due}
                    </Badge>
                  </div>

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
                      onClick={() => onTouch(contact)}
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

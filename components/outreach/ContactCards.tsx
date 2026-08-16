'use client';

import { motion } from 'framer-motion';
import { ExternalLink, Send } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { statusTone, telegramUrl } from '@/components/outreach/ContactSheet';
import { Badge, EmptyState } from '@/components/ui';
import { daysBetween, getLogicalDate } from '@/lib/date';
import { followUpState, needsTouch } from '@/lib/followup';
import { NEGATIVE_STATUSES, normalizeStatus, type OutreachContact } from '@/lib/types';

/**
 * Дней с касания не хранится в базе — считается каждый раз при рендере,
 * поэтому число само меняется на следующий день без всякой синхронизации.
 */
export function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  const diff = daysBetween(getLogicalDate(), iso.slice(0, 10));
  return diff > 0 ? diff : 0;
}

type ContactCardsProps = {
  contacts: OutreachContact[];
  onOpenContact: (contact: OutreachContact) => void;
  /** Только что добавленный контакт подсвечивается на секунду. */
  highlightId?: string | null;
};

/** Мобильный режим: та же таблица, но каждая строка — вертикальная карточка. */
export function ContactCards({
  contacts,
  onOpenContact,
  highlightId = null,
}: ContactCardsProps) {
  const { t, tf, days } = useLanguage();

  if (contacts.length === 0) {
    return <EmptyState text={t.outreach.empty} />;
  }

  return (
    <div className="space-y-2">
      {contacts.map((contact) => {
        const tg = telegramUrl(contact.telegram_handle);
        const ig = contact.instagram_url ?? '';
        const n = daysSince(contact.first_contact_date);
        const fresh = contact.id === highlightId;

        // Ровно те же два сигнала, что и в таблице: красный — дверь закрылась,
        // жёлтый — сегодня пора коснуться.
        const negative = NEGATIVE_STATUSES.includes(normalizeStatus(contact.status));
        const due =
          !negative &&
          needsTouch(
            followUpState({
              status: contact.status,
              lastTouchAt: contact.last_touch_at,
              touchCount: contact.touch_count ?? 1,
              muted: Boolean(contact.muted),
              today: getLogicalDate(),
            }),
          );

        return (
          <motion.div
            key={contact.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpenContact(contact)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenContact(contact);
              }
            }}
            initial={fresh ? { opacity: 0, y: -14 } : false}
            animate={
              fresh
                ? {
                    opacity: 1,
                    y: 0,
                    boxShadow: [
                      '0 0 24px rgba(255,255,255,0.22)',
                      '0 0 0px rgba(255,255,255,0)',
                    ],
                  }
                : { opacity: 1, y: 0 }
            }
            transition={{
              duration: 0.3,
              ease: [0.22, 1, 0.36, 1],
              boxShadow: { duration: 1, ease: 'linear' },
            }}
            className={`glass cursor-pointer border-l-2 p-4 active:scale-[0.99] ${
              negative
                ? 'border-l-[#FF6B6B] bg-[rgba(255,107,107,0.07)]'
                : due
                  ? 'border-l-[#FFD166]'
                  : 'border-l-transparent'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-extrabold">{contact.name}</p>
                {contact.niche && (
                  <p className="mt-0.5 truncate text-sm text-muted">{contact.niche}</p>
                )}
              </div>
              <Badge tone={statusTone(contact.status)}>{t.statuses[contact.status]}</Badge>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs text-white/30">
                {n === 0 ? t.outreach.today : tf(t.outreach.daysAgo, { n: `${n} ${days(n)}` })}
              </span>

              <div className="flex items-center gap-1">
                {tg && (
                  <a
                    href={tg}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={t.outreach.colTelegram}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <Send size={18} />
                  </a>
                )}
                {ig && (
                  <a
                    href={ig}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={t.outreach.colInstagram}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <ExternalLink size={18} />
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

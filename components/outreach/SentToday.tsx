'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ExternalLink, Send } from 'lucide-react';
import { CardTitle, GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { statusTone, telegramUrl } from '@/components/outreach/ContactSheet';
import { Badge } from '@/components/ui';
import { normalizeStatus, type ContactStatus, type OutreachContact } from '@/lib/types';

type SentTodayProps = {
  contacts: OutreachContact[];
  onOpen: (contact: OutreachContact) => void;
  onStatus: (contact: OutreachContact, status: ContactStatus) => void;
  delay?: number;
};

/**
 * Написанные сегодня — мост между базой и списком экспертов.
 *
 * Нажал «Написал» — и человек мгновенно исчезал из базы в общий список.
 * Дальше начиналось лишнее: он-то никуда не делся, в телеграм к нему надо
 * зайти прямо сейчас, ответ придёт через десять минут, а его карточка уже
 * где-то на другой вкладке среди трёхсот других.
 *
 * Поэтому написанные за сегодня остаются здесь же, под базой, со ссылками
 * и статусом под рукой. Завтра они уходят в общий список сами — след дня
 * не должен копиться.
 */
export function SentToday({ contacts, onOpen, onStatus, delay = 0 }: SentTodayProps) {
  const { t, tf } = useLanguage();

  if (contacts.length === 0) return null;

  return (
    <GlassCard delay={delay}>
      <CardTitle
        right={
          <span className="shrink-0 text-xs tabular-nums text-white/35">
            {tf(t.leads.sentTodayCount, { n: contacts.length })}
          </span>
        }
      >
        {t.leads.sentToday}
      </CardTitle>

      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {contacts.map((contact) => {
            const status = normalizeStatus(contact.status);
            const tg = telegramUrl(contact.telegram_handle);
            const ig = contact.instagram_url ?? '';

            return (
              <motion.li
                key={contact.id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="rounded-2xl bg-white/[0.04] p-3">
                  <div className="flex items-start gap-2">
                    {/* Имя открывает карточку: всё остальное про человека —
                        комментарий, история, напоминание — живёт там. */}
                    <button
                      type="button"
                      onClick={() => onOpen(contact)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-bold">{contact.name}</p>
                      {contact.niche && (
                        <p className="truncate text-xs text-white/35">{contact.niche}</p>
                      )}
                    </button>
                    <Badge tone={statusTone(status)}>{t.statuses[status]}</Badge>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    {/*
                      Ссылки — то, ради чего этот список и существует.
                      Написал, через минуту надо вернуться в диалог: без них
                      это уход на страницу контактов, поиск по трёмстам
                      строкам и возврат обратно к базе.
                    */}
                    {tg && (
                      <a
                        href={tg}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={t.leads.openTelegram}
                        className="btn-ghost h-11 w-11 shrink-0 px-0"
                      >
                        <Send size={15} />
                      </a>
                    )}
                    {ig && (
                      <a
                        href={ig}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={t.leads.openProfile}
                        className="btn-ghost h-11 w-11 shrink-0 px-0"
                      >
                        <ExternalLink size={15} />
                      </a>
                    )}

                    {/* Два ближайших исхода. Остальные — в карточке: делать
                        восемь кнопок в строке значит не сделать ни одной. */}
                    <div className="ml-auto flex min-w-0 gap-2">
                      <QuickStatus
                        label={t.statuses.read}
                        on={status === 'read'}
                        onClick={() => onStatus(contact, status === 'read' ? 'sent' : 'read')}
                      />
                      <QuickStatus
                        label={t.statuses.replied}
                        on={status === 'replied'}
                        onClick={() =>
                          onStatus(contact, status === 'replied' ? 'sent' : 'replied')
                        }
                      />
                    </div>
                  </div>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </GlassCard>
  );
}

/** Переключатель статуса: повторное нажатие возвращает «Отправлено». */
function QuickStatus({
  label,
  on,
  onClick,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`min-h-[44px] shrink-0 whitespace-nowrap rounded-full border px-3 text-xs font-bold transition-colors ${
        on
          ? 'border-white bg-white text-ink'
          : 'border-glass-border bg-white/[0.05] text-white/55 hover:bg-white/10'
      }`}
    >
      {label}
    </button>
  );
}

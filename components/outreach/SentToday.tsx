'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ExternalLink, Send } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CardTitle, GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { statusTone, telegramUrl } from '@/components/outreach/ContactSheet';
import { Badge } from '@/components/ui';
import { normalizeStatus, type ContactStatus, type OutreachContact } from '@/lib/types';

/**
 * Сколько строк открыто по умолчанию — и по сколько добавляется.
 *
 * Свежих три: статус ставят тем, кому написали только что. Всё остальное
 * за день — уже история дня, и разворачивают её отдельно.
 */
const PAGE = 3;
const STEP = 10;

/**
 * Статусы, которые ставятся одним тапом прямо из строки.
 *
 * Ровно три, и это не произвол: после отправки происходит одно из трёх —
 * прочитал молча, ответил, отказал. Созвон и закрытие ставятся в карточке:
 * это события, ради которых открыть карточку не жалко, а лишняя кнопка в
 * строке стоит внимания на каждом из двадцати человек.
 */
const QUICK = ['read', 'replied', 'replied_no'] as const satisfies readonly ContactStatus[];

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
 * где-то среди трёхсот других.
 *
 * Поэтому написанные за сегодня остаются здесь же, под базой: ссылки и три
 * статуса в один тап. Завтра они уходят в общий список сами — след дня не
 * должен копиться.
 */
export function SentToday({ contacts, onOpen, onStatus, delay = 0 }: SentTodayProps) {
  const { t, tf } = useLanguage();

  const [limit, setLimit] = useState(PAGE);
  const shown = useMemo(() => contacts.slice(0, limit), [contacts, limit]);
  const rest = contacts.length - shown.length;

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
          {shown.map((contact) => {
            const status = normalizeStatus(contact.status);
            const tg = telegramUrl(contact.telegram_handle);
            const ig = contact.instagram_url ?? '';
            // Созвон, закрытие, блок — редкие исходы, кнопок под них нет.
            // Показываем бейджем, иначе строка врала бы о состоянии.
            const beyond = !(QUICK as readonly ContactStatus[]).includes(status) && status !== 'sent';

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
                  <div className="flex items-center gap-2">
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

                    {beyond && <Badge tone={statusTone(status)}>{t.statuses[status]}</Badge>}

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
                  </div>

                  {/*
                    Три статуса равными долями во всю ширину.

                    Равными — потому что попадать по ним надо не глядя: рука
                    запоминает позицию, а не подпись. Повторное нажатие
                    возвращает «Отправлено»: промах не должен требовать
                    захода в карточку.
                  */}
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {QUICK.map((key) => {
                      const on = status === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => onStatus(contact, on ? 'sent' : key)}
                          aria-pressed={on}
                          className={`min-h-[44px] min-w-0 rounded-full border px-2 text-xs font-bold transition-colors ${
                            on
                              ? key === 'replied_no'
                                ? 'border-[rgba(255,107,107,0.5)] bg-[rgba(255,107,107,0.16)] text-danger'
                                : 'border-white bg-white text-ink'
                              : 'border-glass-border bg-white/[0.05] text-white/55 hover:bg-white/10'
                          }`}
                        >
                          {/* Короткая подпись, а не имя статуса: «Ответил —
                              отказ» на 375px обрезалось в «Ответил —…», и
                              единственная кнопка с плохой новостью читалась
                              как соседняя с хорошей. */}
                          <span className="block truncate">{t.leads.quick[key]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>

        {rest > 0 && (
          <li>
            <button
              type="button"
              onClick={() => setLimit((n) => n + STEP)}
              className="btn-ghost w-full text-sm font-bold"
            >
              <ChevronDown size={16} />
              {tf(t.leads.more, { n: Math.min(STEP, rest) })}
            </button>
          </li>
        )}

        {limit > PAGE && (
          <li>
            <button
              type="button"
              onClick={() => setLimit(PAGE)}
              className="min-h-[44px] w-full text-sm font-semibold text-white/35 transition-colors hover:text-white"
            >
              {t.leads.collapse}
            </button>
          </li>
        )}
      </ul>
    </GlassCard>
  );
}

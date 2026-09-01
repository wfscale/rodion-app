'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, ChevronUp, Copy, ExternalLink, PenLine, Send, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CardTitle, GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { copyText } from '@/lib/clipboard';
import { offerForSend, parseTelegram } from '@/lib/leads';
import type { OutreachContact, Snippet } from '@/lib/types';

type LeadListProps = {
  leads: OutreachContact[];
  /** Заготовка: копируется прямо из строки. */
  offer: Snippet | null;
  onPatch: (id: string, patch: Partial<OutreachContact>) => void;
  /** Второй аргумент — текст, который реально ушёл этому человеку. */
  onSent: (lead: OutreachContact, offerText: string | null) => void;
  onDrop: (id: string) => void;
  onUseOffer: () => void;
  /** Свой текст под человека открывается со 2-го уровня. */
  canOwnOffer: boolean;
  delay?: number;
};

/**
 * По сколько строк базы показывать за раз.
 *
 * Собранная база — это сотни строк, и они выталкивали всё остальное вниз
 * на несколько экранов: чтобы поставить статус написанному, приходилось
 * пролистать всю базу целиком. Работают всегда с верхом списка — обработал,
 * строка исчезла, следующая поднялась, — поэтому показывать больше десятка
 * незачем.
 */
const PAGE = 10;

/**
 * База: люди, найденные, но ещё не написанные.
 *
 * Строка собрана по порядку реальных действий: открыть профиль, записать
 * найденный телеграм, взять текст, отметить, что написал. Каждое лишнее
 * движение здесь умножается на двадцать, поэтому ссылки открываются в новой
 * вкладке — возвращаться «назад» и терять место в списке нельзя.
 */
export function LeadList({
  leads,
  offer,
  onPatch,
  onSent,
  onDrop,
  onUseOffer,
  canOwnOffer,
  delay = 0,
}: LeadListProps) {
  const { t, tf } = useLanguage();

  const [limit, setLimit] = useState(PAGE);
  const shown = useMemo(() => leads.slice(0, limit), [leads, limit]);
  const rest = leads.length - shown.length;

  return (
    <GlassCard delay={delay}>
      <CardTitle
        right={
          leads.length > 0 ? (
            <span className="shrink-0 text-xs tabular-nums text-white/35">
              {tf(t.leads.count, { n: leads.length })}
            </span>
          ) : undefined
        }
      >
        {t.leads.listTitle}
      </CardTitle>

      {leads.length === 0 ? (
        <div className="px-2 pb-2 pt-1 text-center">
          <p className="text-sm leading-relaxed text-muted">{t.leads.empty}</p>
          <p className="mt-2 text-xs leading-relaxed text-white/25">{t.leads.emptyHint}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {shown.map((lead) => (
              <motion.li
                key={lead.id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <LeadRow
                  lead={lead}
                  offer={offer}
                  onPatch={onPatch}
                  onSent={onSent}
                  onDrop={onDrop}
                  onUseOffer={onUseOffer}
                  canOwnOffer={canOwnOffer}
                />
              </motion.li>
            ))}
          </AnimatePresence>

          {/* Показать ещё — внутри списка, а не под карточкой: так видно,
              что за кнопкой продолжение той же базы. */}
          {rest > 0 && (
            <li>
              <button
                type="button"
                onClick={() => setLimit((n) => n + PAGE)}
                className="btn-ghost w-full text-sm font-bold"
              >
                <ChevronDown size={16} />
                {tf(t.leads.more, { n: Math.min(PAGE, rest) })}
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
      )}
    </GlassCard>
  );
}

/**
 * Строка базы.
 *
 * Поля правятся по месту и сохраняются на потере фокуса: открывать шторку
 * ради одного ника телеграма — это два лишних движения на каждого человека
 * из двадцати.
 */
function LeadRow({
  lead,
  offer,
  onPatch,
  onSent,
  onDrop,
  onUseOffer,
  canOwnOffer,
}: {
  lead: OutreachContact;
  offer: Snippet | null;
  onPatch: (id: string, patch: Partial<OutreachContact>) => void;
  onSent: (lead: OutreachContact, offerText: string | null) => void;
  onDrop: (id: string) => void;
  onUseOffer: () => void;
  canOwnOffer: boolean;
}) {
  const { t } = useLanguage();

  const [telegram, setTelegram] = useState(parseTelegram(lead.telegram_handle ?? ''));
  const [audience, setAudience] = useState(lead.audience_size ?? '');
  const [copied, setCopied] = useState(false);

  /*
   * Свой текст под этого человека.
   *
   * Открывается пустым и подхватывает заготовку: обычно правят одну-две
   * строки под то, что увидели в профиле, а не пишут с нуля. Пока поле
   * закрыто, оно не занимает места — открывают его на одном человеке из
   * пяти, и держать его развёрнутым на всех значило бы растянуть базу
   * впятеро.
   */
  const [ownOpen, setOwnOpen] = useState(false);
  const [own, setOwn] = useState(lead.offer_text ?? '');
  const [ownCopied, setOwnCopied] = useState(false);
  const ownRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!ownOpen) return;
    const box = ownRef.current;
    if (!box) return;
    box.focus();
    box.setSelectionRange(box.value.length, box.value.length);
  }, [ownOpen]);

  function openOwn() {
    if (!own.trim() && offer) setOwn(offer.content);
    setOwnOpen(true);
  }

  function saveOwn() {
    const value = own.trim() || null;
    if (value !== (lead.offer_text ?? null)) onPatch(lead.id, { offer_text: value });
  }

  async function copyOffer() {
    if (!offer) return;
    const ok = await copyText(offer.content);
    if (!ok) return;
    onUseOffer();
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  async function copyOwn() {
    const value = own.trim();
    if (!value) return;
    const ok = await copyText(value);
    if (!ok) return;
    saveOwn();
    setOwnCopied(true);
    setTimeout(() => setOwnCopied(false), 1200);
  }

  const tg = parseTelegram(telegram);
  const tgLink = tg ? `https://t.me/${tg}` : null;

  /* Что уходит в запись при «Написал»: свой текст, если он есть, иначе
     заготовка. Без этого ответ невозможно связать с формулировкой. */
  const sentOffer = offerForSend(own, offer?.content);

  return (
    <div className="rounded-2xl bg-white/[0.04] p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold">{lead.name}</p>
          {lead.niche && <p className="truncate text-sm text-white/40">{lead.niche}</p>}
        </div>

        {lead.instagram_url && (
          <a
            href={lead.instagram_url}
            target="_blank"
            rel="noreferrer"
            aria-label={t.leads.openProfile}
            className="btn-ghost h-11 w-11 shrink-0 px-0"
          >
            <ExternalLink size={16} />
          </a>
        )}
      </div>

      <div className="mt-2 flex gap-2">
        {/*
          Собаку рисует интерфейс, а не пальцы.

          Ник берут из шапки инстаграма и приносят как придётся: «@ivanov»,
          «t.me/ivanov», просто словом. Дописывать собаку руками — лишнее
          движение на каждом человеке, а хранить её в базе незачем: в ссылку
          уходит голый ник.
        */}
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-semibold text-white/30">
            @
          </span>
          <input
            value={telegram}
            onChange={(e) => setTelegram(parseTelegram(e.target.value))}
            onBlur={() => {
              const value = tg || null;
              if (value !== (lead.telegram_handle ?? null)) {
                onPatch(lead.id, { telegram_handle: value });
              }
            }}
            placeholder={t.leads.telegramPh}
            aria-label={t.leads.telegram}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="field w-full pl-[26px]"
          />
        </div>

        {tgLink && (
          <a
            href={tgLink}
            target="_blank"
            rel="noreferrer"
            aria-label={t.leads.openTelegram}
            className="btn-ghost h-11 w-11 shrink-0 px-0"
          >
            <Send size={15} />
          </a>
        )}

        <input
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          onBlur={() => {
            const value = audience.trim() || null;
            if (value !== (lead.audience_size ?? null)) {
              onPatch(lead.id, { audience_size: value });
            }
          }}
          placeholder={t.leads.audiencePh}
          aria-label={t.leads.audience}
          autoCapitalize="none"
          spellCheck={false}
          className="field w-[84px] shrink-0 text-center"
        />
      </div>

      {/* Свой оффер — раскрывается прямо в строке, без шторки: шторка
          закрыла бы профиль, а текст правят, глядя именно в него. */}
      <AnimatePresence initial={false}>
        {canOwnOffer && ownOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            {/* Отступ внутренний, а не mt-: высоту «auto» framer берёт из
                размеров ребёнка, и внешние margin в неё не попадают. */}
            <div className="pt-2">
              <textarea
                ref={ownRef}
                rows={5}
                value={own}
                onChange={(e) => setOwn(e.target.value)}
                onBlur={saveOwn}
                placeholder={t.leads.ownPh}
                aria-label={t.leads.own}
                className="field text-sm leading-relaxed"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => void copyOwn()}
                  disabled={!own.trim()}
                  className={`btn-ghost min-h-[44px] min-w-0 flex-1 px-3 text-sm ${
                    ownCopied ? 'border-[rgba(100,255,140,0.4)] text-success' : ''
                  }`}
                >
                  {ownCopied ? <Check size={15} strokeWidth={2.6} /> : <Copy size={15} />}
                  <span className="truncate">
                    {ownCopied ? t.leads.copied : t.leads.ownCopy}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    saveOwn();
                    setOwnOpen(false);
                  }}
                  aria-label={t.leads.ownClose}
                  /* Не крестик: ровно под ним стоит крестик «убрать из базы»,
                     и два одинаковых глифа друг над другом — это выброшенный
                     по ошибке лид. Свернуть и удалить обязаны выглядеть
                     по-разному. */
                  className="btn-ghost min-h-[44px] w-12 shrink-0 px-0 text-white/50"
                >
                  <ChevronUp size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-2 flex gap-2">
        {/*
          Оффер копируется прямо отсюда: панель с текстом стоит сбоку, и за
          ним пришлось бы листать туда и обратно на каждом человеке.
        */}
        {offer && !ownOpen && (
          <button
            type="button"
            onClick={() => void copyOffer()}
            aria-label={t.leads.copy}
            title={offer.title}
            className={`btn-ghost min-h-[44px] w-12 shrink-0 px-0 ${
              copied ? 'border-[rgba(100,255,140,0.4)] text-success' : ''
            }`}
          >
            {copied ? <Check size={16} strokeWidth={2.6} /> : <Copy size={16} />}
          </button>
        )}

        {/* Свой текст. Точка на кнопке — признак, что он уже написан: иначе
            непонятно, ушла человеку заготовка или что-то своё. */}
        {canOwnOffer && !ownOpen && (
          <button
            type="button"
            onClick={openOwn}
            aria-label={t.leads.own}
            title={t.leads.ownHint}
            className={`btn-ghost relative min-h-[44px] w-12 shrink-0 px-0 ${
              own.trim() ? 'border-[rgba(255,255,255,0.28)] text-white' : 'text-white/50'
            }`}
          >
            <PenLine size={16} />
            {own.trim() && (
              <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-white" />
            )}
          </button>
        )}

        {/* «Написал» — главное действие строки, поэтому оно белое и широкое. */}
        <button
          type="button"
          onClick={() => {
            saveOwn();
            onSent(lead, sentOffer);
          }}
          className="btn-primary min-h-[44px] min-w-0 flex-1 px-3 text-sm"
        >
          <Check size={16} className="shrink-0" />
          <span className="truncate">{t.leads.sent}</span>
        </button>

        {/* На 375px кнопки в ряд не помещаются, и главная — «Написал» —
            обрезалась. Отсев без лички второстепенен: на узком экране он
            остаётся крестиком, подпись возвращается там, где есть место. */}
        <button
          type="button"
          onClick={() => onDrop(lead.id)}
          title={t.leads.dropHint}
          aria-label={t.leads.drop}
          className="btn-ghost min-h-[44px] w-12 shrink-0 px-0 text-sm text-white/50 sm:w-auto sm:px-3"
        >
          <X size={15} className="shrink-0" />
          <span className="hidden truncate sm:inline">{t.leads.drop}</span>
        </button>
      </div>
    </div>
  );
}

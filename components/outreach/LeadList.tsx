'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, ExternalLink, Send, X } from 'lucide-react';
import { useState } from 'react';
import { CardTitle, GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { telegramUrl } from '@/components/outreach/ContactSheet';
import { copyText } from '@/lib/clipboard';
import type { OutreachContact, Snippet } from '@/lib/types';

type LeadListProps = {
  leads: OutreachContact[];
  /** Выбранный оффер: копируется прямо из строки. */
  offer: Snippet | null;
  onPatch: (id: string, patch: Partial<OutreachContact>) => void;
  onSent: (lead: OutreachContact) => void;
  onDrop: (id: string) => void;
  onUseOffer: () => void;
  delay?: number;
};

/**
 * Список базы: люди, найденные, но ещё не написанные.
 *
 * Строка собрана по порядку реальных действий: открыть профиль, записать
 * найденный телеграм, отметить, что написал. Каждое лишнее движение здесь
 * умножается на двадцать, поэтому ссылки открываются в новой вкладке —
 * возвращаться в приложение через «назад» и терять место в списке нельзя.
 */
export function LeadList({
  leads,
  offer,
  onPatch,
  onSent,
  onDrop,
  onUseOffer,
  delay = 0,
}: LeadListProps) {
  const { t, tf } = useLanguage();

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
            {leads.map((lead) => (
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
                />
              </motion.li>
            ))}
          </AnimatePresence>
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
}: {
  lead: OutreachContact;
  offer: Snippet | null;
  onPatch: (id: string, patch: Partial<OutreachContact>) => void;
  onSent: (lead: OutreachContact) => void;
  onDrop: (id: string) => void;
  onUseOffer: () => void;
}) {
  const { t } = useLanguage();

  const [telegram, setTelegram] = useState(lead.telegram_handle ?? '');
  const [audience, setAudience] = useState(lead.audience_size ?? '');
  const [copied, setCopied] = useState(false);

  async function copyOffer() {
    if (!offer) return;
    const ok = await copyText(offer.content);
    if (!ok) return;
    onUseOffer();
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  const tg = telegram.trim().replace(/^@+/, '');
  const tgLink = telegramUrl(tg);

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
        <input
          value={telegram}
          onChange={(e) => setTelegram(e.target.value)}
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
          className="field min-w-0 flex-1"
        />

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

      <div className="mt-2 flex gap-2">
        {/*
          Оффер копируется прямо отсюда.

          Панель с текстом стоит сбоку и на телефоне уезжает под список — за
          ним пришлось бы листать туда и обратно на каждом человеке из
          двадцати. Кнопка в строке убирает эту дорогу целиком.
        */}
        {offer && (
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

        {/* «Написал» — главное действие строки, поэтому оно белое и широкое.
            «Нет лички» рядом: половина базы отсеивается именно так, и прятать
            это в меню значит платить лишним тапом за каждого второго. */}
        <button
          type="button"
          onClick={() => onSent(lead)}
          className="btn-primary min-h-[44px] min-w-0 flex-1 px-3 text-sm"
        >
          <Check size={16} className="shrink-0" />
          <span className="truncate">{t.leads.sent}</span>
        </button>

        {/* На 375px три кнопки в ряд не помещаются, и главная — «Написал» —
            обрезалась до «Напис…». Отсев без лички второстепенен: на узком
            экране он остаётся крестиком, подпись возвращается там, где есть
            место. */}
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

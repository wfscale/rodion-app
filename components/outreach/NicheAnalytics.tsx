'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { PulseBar } from '@/components/PulseBar';
import { Collapsible } from '@/components/ui';
import { nicheFunnel, nicheTrusted, NICHE_MIN_SENT, type NicheRow } from '@/lib/insights';
import type { OutreachContact } from '@/lib/types';

type NicheAnalyticsProps = {
  contacts: OutreachContact[];
  /**
   * Тап по нише фильтрует список экспертов: разбор без перехода к людям
   * заканчивается ничем. Наружу уходит ключ группировки (нижний регистр) —
   * фильтр сравнивает именно с ним, а не с написанием.
   */
  onPickNiche?: (nicheKey: string) => void;
};

/**
 * Разбор по нишам.
 *
 * Ниша — свободный текст, поэтому группируем по ключу в нижнем регистре,
 * а показываем то написание, которое встретилось первым. Иначе «Фитнес» и
 * «фитнес» жили бы двумя строками и делили статистику пополам.
 *
 * Свёрнутая строка отвечает на «куда писать»: закрытия и сколько написано.
 * Развёрнутая — на «почему»: вся воронка ниши от ответа до закрытия. Одного
 * процента ответов было мало — ниша, где охотно отвечают и не доходят до
 * созвона, и ниша, где отвечают редко, но закрывается каждый второй, по нему
 * выглядят одинаково, а решения по ним противоположные.
 */
export function NicheAnalytics({ contacts, onPickNiche }: NicheAnalyticsProps) {
  const { t } = useLanguage();

  const rows = useMemo(() => nicheFunnel(contacts), [contacts]);
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <GlassCard>
      <Collapsible
        storageKey="rodion.outreach.niches"
        defaultOpen
        title={t.offers.analytics}
        right={
          rows.length > 0 ? (
            <span className="shrink-0 text-sm font-extrabold tabular-nums text-white/50">
              {rows.length}
            </span>
          ) : undefined
        }
      >
        {rows.length === 0 ? (
          <p className="py-3 text-sm text-muted">{t.offers.analyticsEmpty}</p>
        ) : (
          <ul className="space-y-1">
            {rows.map((row) => (
              <NicheItem
                key={row.key}
                row={row}
                open={openKey === row.key}
                onToggle={() => setOpenKey((k) => (k === row.key ? null : row.key))}
                onPick={onPickNiche ? () => onPickNiche(row.key) : undefined}
              />
            ))}
          </ul>
        )}
      </Collapsible>
    </GlassCard>
  );
}

function NicheItem({
  row,
  open,
  onToggle,
  onPick,
}: {
  row: NicheRow;
  open: boolean;
  onToggle: () => void;
  onPick?: () => void;
}) {
  const { t, tf } = useLanguage();
  const trusted = nicheTrusted(row);

  return (
    <li className="border-t border-divider first:border-t-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-[44px] w-full items-center gap-2 py-1.5 text-left"
      >
        <ChevronDown
          size={14}
          className={`shrink-0 text-white/30 transition-transform ${open ? 'rotate-180' : ''}`}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{row.label}</span>

        {/*
          В свёрнутой строке — отклик, а не закрытия.

          Закрытий у молодой воронки нет почти нигде, и колонка из нулей не
          помогает выбрать нишу вообще никак. Отклик — единственное число,
          которое шевелится каждый день. Закрытия при этом важнее, поэтому
          там, где они есть, рядом встаёт зелёная метка: её видно раньше
          процента, и ниша с деньгами не теряется среди говорливых.
        */}
        <span className="shrink-0 text-xs tabular-nums text-white/30">{row.sent}</span>
        {row.closed > 0 && (
          <span className="shrink-0 rounded-full bg-[rgba(100,255,140,0.14)] px-1.5 text-xs font-extrabold tabular-nums text-success">
            {row.closed}
          </span>
        )}
        <span
          className={`w-11 shrink-0 text-right text-sm font-extrabold tabular-nums ${
            trusted ? '' : 'text-white/30'
          }`}
        >
          {row.replyRate}%
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-2.5 pb-3 pl-6 pr-1 pt-1">
              <Step label={t.outreach.funnelSent} value={row.sent} pct={100} total={row.sent} />
              <Step
                label={t.outreach.funnelReplied}
                value={row.replied}
                pct={row.replyRate}
                total={row.sent}
              />
              <Step label={t.outreach.funnelCall} value={row.calls} pct={row.callRate} total={row.sent} />
              <Step
                label={t.outreach.funnelClosed}
                value={row.closed}
                pct={row.closeRate}
                total={row.sent}
                accent
              />

              {/*
                Порог доверия. Сто процентов закрытий на одном человеке —
                число, ради которого разворачивают работу и теряют месяц.
              */}
              {!trusted && (
                <p className="text-xs leading-relaxed text-white/30">
                  {tf(t.niche.thin, { n: NICHE_MIN_SENT })}
                </p>
              )}

              {onPick && (
                <button
                  type="button"
                  onClick={onPick}
                  className="btn-ghost min-h-[44px] w-full text-xs font-bold"
                >
                  {t.niche.show}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

/** Ступень воронки ниши: число, доля и полоса под ними. */
function Step({
  label,
  value,
  pct,
  total,
  accent = false,
}: {
  label: string;
  value: number;
  pct: number;
  total: number;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="truncate text-xs text-white/45">{label}</span>
        <span className="shrink-0 text-xs tabular-nums text-white/35">
          <span className={`font-extrabold ${accent && value > 0 ? 'text-success' : 'text-white'}`}>
            {value}
          </span>
          {total > 0 && <span> · {pct}%</span>}
        </span>
      </div>
      <PulseBar pct={pct} color={accent ? '#64FF8C' : '#FFFFFF'} />
    </div>
  );
}

'use client';

import { useMemo } from 'react';
import { GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { Collapsible } from '@/components/ui';
import { REPLIED_STATUSES, SENT_STATUSES, type OutreachContact } from '@/lib/types';

/**
 * Разбор по нишам.
 *
 * Ниша — свободный текст, поэтому группируем по ключу в нижнем регистре,
 * а показываем то написание, которое встретилось первым. Иначе «Фитнес» и
 * «фитнес» жили бы двумя строками и делили статистику пополам.
 */
export function NicheAnalytics({ contacts }: { contacts: OutreachContact[] }) {
  const { t } = useLanguage();

  const rows = useMemo(() => {
    const map = new Map<string, { label: string; sent: number; replied: number }>();

    for (const contact of contacts) {
      const label = (contact.niche ?? '').trim();
      if (!label) continue;
      const key = label.toLowerCase();
      const row = map.get(key) ?? { label, sent: 0, replied: 0 };
      if (SENT_STATUSES.includes(contact.status)) row.sent += 1;
      if (REPLIED_STATUSES.includes(contact.status)) row.replied += 1;
      map.set(key, row);
    }

    return Array.from(map.values())
      .filter((row) => row.sent > 0)
      .map((row) => ({ ...row, rate: Math.round((row.replied / row.sent) * 100) }))
      .sort((a, b) => b.rate - a.rate || b.sent - a.sent);
  }, [contacts]);

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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-white/35">
                  <th className="pb-2 font-semibold">{t.offers.colNiche}</th>
                  <th className="pb-2 text-center font-semibold">{t.offers.colSent}</th>
                  <th className="pb-2 text-center font-semibold">{t.offers.colReplied}</th>
                  <th className="pb-2 text-right font-semibold">{t.offers.colRate}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="border-t border-divider">
                    <td className="max-w-[140px] truncate py-2.5 text-sm">{row.label}</td>
                    <td className="py-2.5 text-center text-sm text-white/60">{row.sent}</td>
                    <td className="py-2.5 text-center text-sm text-white/60">{row.replied}</td>
                    <td className="py-2.5 text-right text-sm font-extrabold">{row.rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Collapsible>
    </GlassCard>
  );
}

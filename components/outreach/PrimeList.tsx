'use client';

import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { statusTone } from '@/components/outreach/ContactSheet';
import { Badge, Collapsible } from '@/components/ui';
import { primeList } from '@/lib/insights';
import type { OutreachContact } from '@/lib/types';

/**
 * Кто ближе всего к сделке.
 *
 * Не замена списку касаний, а другой вопрос: тот отвечает «кому пора
 * написать по расписанию», этот — «с кого начать, если сил хватит на
 * троих». Поэтому здесь всего несколько строк и они отсортированы по весу,
 * а не по срокам.
 */
export function PrimeList({
  contacts,
  today,
  onOpen,
}: {
  contacts: OutreachContact[];
  today: string;
  onOpen: (contact: OutreachContact) => void;
}) {
  const { t } = useLanguage();
  const rows = useMemo(() => primeList(contacts, today), [contacts, today]);

  const max = rows[0]?.score ?? 1;

  return (
    <GlassCard delay={2}>
      <Collapsible
        storageKey="rodion.outreach.prime"
        defaultOpen
        title={t.prime.title}
        right={
          rows.length > 0 ? (
            <span className="shrink-0 text-sm font-extrabold tabular-nums text-white/50">
              {rows.length}
            </span>
          ) : undefined
        }
      >
        {rows.length === 0 ? (
          <p className="py-3 text-sm text-muted">{t.prime.empty}</p>
        ) : (
          <ul className="space-y-1.5">
            {rows.map(({ contact, score }, index) => (
              <li key={contact.id}>
                <button
                  type="button"
                  onClick={() => onOpen(contact)}
                  className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl bg-white/[0.04] px-3 text-left transition-colors hover:bg-white/[0.08]"
                >
                  <span className="w-5 shrink-0 text-sm font-extrabold tabular-nums text-white/25">
                    {index + 1}
                  </span>

                  <span className="min-w-0 flex-1 py-2">
                    <span className="block truncate text-sm font-bold">{contact.name}</span>
                    {contact.niche && (
                      <span className="mt-0.5 block truncate text-xs text-white/35">
                        {contact.niche}
                      </span>
                    )}
                    <motion.span
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round((score / max) * 100)}%` }}
                      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                      className="mt-1.5 block h-1 rounded-full bg-white/45"
                    />
                  </span>

                  <Badge tone={statusTone(contact.status)}>{t.statuses[contact.status]}</Badge>
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-xs leading-relaxed text-white/25">{t.prime.hint}</p>
      </Collapsible>
    </GlassCard>
  );
}

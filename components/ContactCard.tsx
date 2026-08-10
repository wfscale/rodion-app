'use client';

import { motion } from 'framer-motion';
import { useLanguage } from '@/components/LanguageProvider';
import { Badge } from '@/components/ui';
import { formatDateTime } from '@/lib/date';
import type { ContactStatus, OutreachContact } from '@/lib/types';

/** Цветовой тон бейджа по позиции в воронке. */
export function statusTone(
  status: ContactStatus,
): 'neutral' | 'success' | 'danger' | 'warn' {
  if (status === 'closed') return 'success';
  if (status === 'call' || status === 'replied') return 'warn';
  if (status === 'refused' || status === 'ignored') return 'danger';
  return 'neutral';
}

export function ContactCard({
  contact,
  onOpen,
  index = 0,
}: {
  contact: OutreachContact;
  onOpen: () => void;
  index?: number;
}) {
  const { t, lang } = useLanguage();

  const meta = [
    contact.niche ? t.niches[contact.niche] : null,
    contact.audience_size,
    contact.platform ? t.platforms[contact.platform] : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileTap={{ scale: 0.985 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index, 8) * 0.035 }}
      className="glass w-full p-4 text-left"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-extrabold">{contact.name}</p>
          {meta && <p className="mt-0.5 truncate text-sm text-muted">{meta}</p>}
        </div>

        <Badge tone={statusTone(contact.status)}>{t.statuses[contact.status]}</Badge>
      </div>

      {contact.note && (
        <p className="mt-2 line-clamp-1 text-sm text-white/40">
          {contact.note.slice(0, 60)}
          {contact.note.length > 60 ? '…' : ''}
        </p>
      )}

      <p className="mt-2 text-xs text-white/25">
        {formatDateTime(contact.updated_at ?? contact.created_at, lang)}
      </p>
    </motion.button>
  );
}

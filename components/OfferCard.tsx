'use client';

import { motion } from 'framer-motion';
import { useLanguage } from '@/components/LanguageProvider';
import { statusTone } from '@/components/outreach/ContactSheet';
import { Badge } from '@/components/ui';
import { formatDateTime } from '@/lib/date';
import { normalizeStatus, type Offer } from '@/lib/types';


export function OfferCard({
  offer,
  onOpen,
  index = 0,
}: {
  offer: Offer;
  onOpen: () => void;
  index?: number;
}) {
  const { t, lang } = useLanguage();
  // Результат зеркалит статус контакта и мог остаться в старой шкале.
  const result = normalizeStatus(offer.result);

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
          <p className="truncate text-base font-extrabold">{offer.title}</p>
          {offer.niche && (
            <p className="mt-0.5 text-sm text-muted">{offer.niche}</p>
          )}
        </div>

        <Badge tone={statusTone(result)}>{t.statuses[result]}</Badge>
      </div>

      <p className="mt-2 line-clamp-2 text-sm leading-snug text-white/45">
        {offer.content.slice(0, 80)}
        {offer.content.length > 80 ? '…' : ''}
      </p>

      <p className="mt-2 text-xs text-white/25">
        {formatDateTime(offer.updated_at ?? offer.created_at, lang)}
      </p>
    </motion.button>
  );
}

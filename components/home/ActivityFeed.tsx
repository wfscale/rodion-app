'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { GlassCard, CardTitle } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { LOUD_ACTIVITY, type ActivityEntry } from '@/lib/types';

/** Сколько событий держим на экране — дальше лента превращается в шум. */
const MAX_ROWS = 20;

type ActivityFeedProps = {
  /** События за сегодня. Порядок не важен — сортируем сами. */
  entries: ActivityEntry[];
};

/** «17:43» из timestamptz. */
function timeOf(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Живая лента событий за сегодня.
 *
 * Главный источник положительного закрепления: человек видит, что день
 * двигается. Поэтому события воронки («ответил», «созвон», «закрыт»,
 * «рекорд») выделены жирнее и ярче — обычная рассылка на их фоне
 * намеренно тусклая.
 */
export function ActivityFeed({ entries }: ActivityFeedProps) {
  const { t } = useLanguage();

  const rows = [...entries]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, MAX_ROWS);

  return (
    <GlassCard className="p-4">
      <CardTitle>{t.home.feedTitle}</CardTitle>

      {rows.length === 0 ? (
        <p className="py-5 text-center text-sm leading-relaxed text-muted">
          {t.home.feedEmpty}
        </p>
      ) : (
        <ul className="-my-0.5">
          {/*
           * initial={false} — при первой отрисовке страницы лента просто
           * есть; анимация slide-in должна означать «прямо сейчас
           * произошло событие», иначе она обесценивается.
           */}
          <AnimatePresence initial={false}>
            {rows.map((entry) => {
              const loud = LOUD_ACTIVITY.includes(entry.type);

              return (
                <motion.li
                  key={entry.id}
                  layout
                  initial={{ opacity: 0, x: -24, height: 0 }}
                  animate={{ opacity: 1, x: 0, height: 'auto' }}
                  exit={{ opacity: 0, x: 24, height: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="flex items-baseline gap-2.5 py-1.5">
                    <span
                      className={`shrink-0 text-xs tabular-nums ${
                        loud ? 'text-white/55' : 'text-white/30'
                      }`}
                    >
                      {timeOf(entry.created_at)}
                    </span>

                    <span
                      className={`min-w-0 flex-1 text-sm leading-snug ${
                        loud ? 'font-bold text-white' : 'text-white/55'
                      }`}
                    >
                      {t.activity[entry.type]}
                      {entry.contact_name && (
                        <>
                          {' → '}
                          {entry.contact_name}
                        </>
                      )}
                      {entry.detail && <span className="font-normal"> {entry.detail}</span>}
                      {entry.contact_niche && (
                        <span
                          className={`font-normal ${loud ? 'text-white/50' : 'text-white/30'}`}
                        >
                          {' '}
                          ({entry.contact_niche})
                        </span>
                      )}
                    </span>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </GlassCard>
  );
}

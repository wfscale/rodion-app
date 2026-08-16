'use client';

import { motion } from 'framer-motion';
import { Medal } from 'lucide-react';
import { useMemo } from 'react';
import { CardTitle, GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { achievements, type AchievementInput } from '@/lib/insights';

/**
 * Витрина достижений.
 *
 * В отличие от уровней здесь туман не нужен: достижение это не следующая
 * ступень, а полка. Видеть незакрытую ячейку полезно — она сама говорит,
 * чего не хватает, и не пугает, потому что не обязательна.
 */
export function AchievementsCard({ input }: { input: AchievementInput }) {
  const { t } = useLanguage();
  const rows = useMemo(() => achievements(input), [input]);
  const done = rows.filter((row) => row.done).length;

  return (
    <GlassCard delay={4}>
      <CardTitle
        right={
          <span className="text-xs font-bold tabular-nums text-white/40">
            {done} / {rows.length}
          </span>
        }
      >
        {t.achievements.title}
      </CardTitle>

      <ul className="grid grid-cols-2 gap-2">
        {rows.map((row, i) => (
          <motion.li
            key={row.id}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, delay: Math.min(i, 10) * 0.03 }}
            className={`rounded-2xl border p-3 ${
              row.done
                ? 'border-[rgba(255,209,102,0.3)] bg-[rgba(255,209,102,0.07)]'
                : 'border-glass-border bg-white/[0.02]'
            }`}
          >
            <div className="flex items-start gap-2">
              <span className={`mt-0.5 shrink-0 ${row.done ? 'text-warn' : 'text-white/20'}`}>
                <Medal size={15} />
              </span>
              <p
                className={`min-w-0 flex-1 text-xs font-bold leading-snug ${
                  row.done ? 'text-white' : 'text-white/40'
                }`}
              >
                {t.achievements.names[row.id]}
              </p>
            </div>

            <p className="mt-2 text-sm font-extrabold tabular-nums">
              <span className={row.done ? 'text-warn' : 'text-white/60'}>
                {Math.min(row.value, row.target)}
              </span>
              <span className="text-white/25"> / {row.target}</span>
            </p>

            <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-white/10">
              <motion.span
                initial={{ width: 0 }}
                animate={{ width: `${row.pct}%` }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className={`block h-full rounded-full ${row.done ? 'bg-warn' : 'bg-white/40'}`}
              />
            </span>
          </motion.li>
        ))}
      </ul>

      <p className="mt-3 text-xs leading-relaxed text-white/25">{t.achievements.hint}</p>
    </GlassCard>
  );
}

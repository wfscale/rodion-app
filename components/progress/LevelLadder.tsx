'use client';

import { motion } from 'framer-motion';
import { Check, Lock, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { CardTitle, GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { levelLadder, levelName, type LadderRow } from '@/lib/xp';

function stateStyles(state: LadderRow['state']) {
  switch (state) {
    case 'done':
      return {
        wrap: 'border-glass-border bg-white/[0.03]',
        title: 'text-white/55',
        desc: 'text-white/25',
        icon: 'text-success',
      };
    case 'current':
      return {
        wrap: 'border-white/40 bg-white/[0.10]',
        title: 'text-white',
        desc: 'text-white/55',
        icon: 'text-white',
      };
    case 'next':
      return {
        wrap: 'border-[rgba(255,209,102,0.35)] bg-[rgba(255,209,102,0.07)]',
        title: 'text-white',
        desc: 'text-white/50',
        icon: 'text-warn',
      };
    default:
      return {
        wrap: 'border-glass-border bg-white/[0.02]',
        title: 'text-white/40',
        desc: 'text-white/25',
        icon: 'text-white/20',
      };
  }
}

/**
 * Лестница уровней.
 *
 * Единственное правило: сколько всего уровней — не сообщается нигде. Ни
 * счётчика «7 / 20», ни строк-заглушек под последней ступенью, ни фразы
 * «за туманом ещё столько-то». Видно пройденное, текущее и две-три ступени
 * впереди — ровно та дистанция, которую хочется закрыть.
 *
 * Любое число, намекающее на длину пути, возвращает мозг к вопросу «сколько
 * ещё осталось», а это единственный вопрос, после которого бросают.
 */
export function LevelLadder({ level }: { level: number }) {
  const { t } = useLanguage();

  const rows = useMemo(() => levelLadder(level), [level]);

  return (
    <GlassCard delay={4}>
      <CardTitle>{t.progress.ladderTitle}</CardTitle>

      <ul className="space-y-2">
        {rows.map((row) => {
          const styles = stateStyles(row.state);
          const isProject = row.feature === 'project' && row.state === 'done';

          return (
            <motion.li
              key={row.level}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: Math.min(row.level, 12) * 0.02 }}
              className={`flex items-start gap-3 rounded-2xl border p-3 ${styles.wrap}`}
            >
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current text-xs font-extrabold tabular-nums ${styles.icon}`}
              >
                {row.state === 'done' ? <Check size={14} strokeWidth={3} /> : row.level}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className={`text-sm font-extrabold ${styles.title}`}>
                    {levelName(row.level, t)}
                  </span>
                  {row.state === 'current' && (
                    <span className="text-[11px] font-bold uppercase tracking-wide text-white/40">
                      {t.progress.ladderCurrent}
                    </span>
                  )}
                  {row.state === 'next' && (
                    <span className="text-[11px] font-bold uppercase tracking-wide text-warn">
                      {t.progress.ladderNext}
                    </span>
                  )}
                </span>

                {row.feature && (
                  <span className="mt-0.5 block">
                    {/* «Проект» — единственный раздел с отдельной страницей;
                        на телефоне попасть в него можно только отсюда. */}
                    {isProject ? (
                      <Link
                        href="/project"
                        className={`text-sm font-bold underline decoration-white/30 underline-offset-4 ${styles.title}`}
                      >
                        {t.features[row.feature]}
                      </Link>
                    ) : (
                      <span className={`text-sm font-bold ${styles.title}`}>
                        {t.features[row.feature]}
                      </span>
                    )}
                    <span className={`mt-0.5 block text-xs leading-snug ${styles.desc}`}>
                      {t.features[`${row.feature}Desc` as const]}
                    </span>
                  </span>
                )}
              </span>

              <span className={`shrink-0 ${styles.icon}`}>
                {row.state === 'done' ? (
                  <Sparkles size={16} />
                ) : row.state === 'current' ? null : (
                  <Lock size={15} />
                )}
              </span>
            </motion.li>
          );
        })}
      </ul>
    </GlassCard>
  );
}

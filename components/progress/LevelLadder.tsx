'use client';

import { motion } from 'framer-motion';
import { Check, HelpCircle, Lock, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { CardTitle, GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import {
  hiddenAhead,
  levelLadder,
  levelName,
  MAX_LEVEL,
  revealCeiling,
  type LadderRow,
} from '@/lib/xp';

/** Сколько строк тумана рисовать под открытой частью лестницы. */
const FOG_ROWS = 3;

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
 * Главное правило: полного списка не видно никогда. Открыт текущий блок из
 * пяти ступеней, дальше туман. Взял последнюю ступень блока — проявились
 * следующие пять. Двадцать строк сразу это список дел, от которого мозг
 * устаёт заранее; пять — это дистанция, которую видно целиком.
 */
export function LevelLadder({ level }: { level: number }) {
  const { t, tf } = useLanguage();

  const rows = useMemo(() => levelLadder(level), [level]);
  const hidden = hiddenAhead(level);
  const ceiling = revealCeiling(level);

  return (
    <GlassCard delay={4}>
      <CardTitle
        right={
          <span className="text-xs font-bold tabular-nums text-white/35">
            {Math.min(level, MAX_LEVEL)} / {MAX_LEVEL}
          </span>
        }
      >
        {t.progress.ladderTitle}
      </CardTitle>

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

        {/* Туман: строки без названий. Видно, что дорога продолжается, но не
            видно куда — именно это и заставляет идти дальше. */}
        {hidden > 0 &&
          Array.from({ length: Math.min(FOG_ROWS, hidden) }, (_, i) => (
            <li
              key={`fog-${i}`}
              style={{ opacity: 0.5 - i * 0.14 }}
              className="flex items-center gap-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.015] p-3"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/25">
                <HelpCircle size={14} />
              </span>
              <span className="text-sm font-extrabold tracking-widest text-white/20">
                {t.progress.ladderMystery}
              </span>
            </li>
          ))}
      </ul>

      <p className="mt-3 text-xs leading-relaxed text-white/30">
        {hidden > 0 ? (
          <>
            {tf(t.progress.ladderHidden, { n: hidden })}
            {' · '}
            {tf(t.progress.ladderHiddenHint, { n: ceiling })}
          </>
        ) : (
          t.progress.ladderNothingHidden
        )}
      </p>
    </GlassCard>
  );
}

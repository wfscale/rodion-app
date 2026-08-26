'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';
import {
  daysLeft,
  goalProgress,
  GOAL_SOON_DAYS,
  GOAL_URGENT_DAYS,
  outreachesToGoal,
  remaining,
  requiredPace,
} from '@/lib/goals';
import { formatNumber } from '@/lib/project';
import type { Goal } from '@/lib/types';

type GoalStripProps = {
  goal: Goal;
  /** Сколько рублей приносит одна рассылка. null — считать не из чего. */
  rublesPer: number | null;
  today: string;
};

/**
 * Цель перед глазами.
 *
 * Полоса намеренно узкая: на главной есть элемент, который обязан быть
 * главным, и это счётчик рассылок. Цель отвечает на другой вопрос — «зачем»
 * — и спорить с ним за внимание не должна. Но исчезать тоже не должна:
 * цель, которую не видно каждый день, ничем не отличается от незаписанной.
 *
 * Все три числа подобраны так, чтобы ни одно не было упрёком. Дни — просто
 * факт. Прогресс — то, что уже сделано. Третья строка — темп и рассылки,
 * то есть ровно то, что можно перебить сегодня.
 */
export function GoalStrip({ goal, rublesPer, today }: GoalStripProps) {
  const { t, tf, days, msgs } = useLanguage();

  const left = daysLeft(goal.deadline, today);
  const pct = goalProgress(goal);
  const pace = requiredPace(goal, today);
  const toGo = outreachesToGoal(goal, rublesPer);
  const overdue = left < 0;

  // Цвет только у срока и только когда он действительно близко: если
  // подсвечивать всегда, подсветка перестаёт что-либо значить.
  const tone = overdue
    ? 'text-danger'
    : left <= GOAL_URGENT_DAYS
      ? 'text-danger'
      : left <= GOAL_SOON_DAYS
        ? 'text-warn'
        : 'text-white';

  return (
    <Link href="/progress" className="glass block px-4 py-3 transition-colors hover:bg-white/[0.09]">
      {/* max-w: на мониторе полоса растягивалась во всю ширину, и числа по
          краям расходились на метр друг от друга — читать их приходилось
          в два приёма. */}
      <div className="flex max-w-2xl items-center gap-3.5">
        <div className="shrink-0 text-center">
          <motion.p
            // key: смена числа проигрывает появление заново — день ушёл,
            // и это единственное событие, которое здесь стоит отметить.
            key={left}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`text-3xl font-extrabold leading-none tabular-nums ${tone}`}
          >
            {Math.abs(left)}
          </motion.p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wide text-white/35">
            {overdue ? t.goals.overdue.replace(' {n}', '') : days(Math.abs(left))}
          </p>
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{goal.title}</p>

          {goal.target_amount ? (
            <>
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/12">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: 'spring', stiffness: 110, damping: 22 }}
                  className="h-full rounded-full bg-white/75"
                />
              </div>

              {/*
                Две колонки, а не одна строка через точки: на 375px строка
                обрезалась ровно на числе рассылок, то есть на единственном,
                ради чего полоса и нужна. Слева — где ты, справа — во что
                это обходится в том, что зависит только от тебя.
              */}
              <div className="mt-1.5 flex items-baseline justify-between gap-2 text-xs">
                <span className="min-w-0 truncate tabular-nums text-white/40">
                  {formatNumber(goal.current_amount)}{' '}
                  {tf(t.goals.of, { n: formatNumber(goal.target_amount) })}
                </span>

                <span className="shrink-0 font-semibold tabular-nums text-white/55">
                  {toGo !== null && toGo > 0
                    ? tf(t.goals.toGoal, { n: toGo, unit: msgs(toGo) })
                    : remaining(goal) > 0
                      ? tf(t.goals.pace, { n: formatNumber(pace) })
                      : ''}
                </span>
              </div>
            </>
          ) : (
            goal.note && <p className="mt-1 truncate text-xs text-white/40">{goal.note}</p>
          )}
        </div>
      </div>
    </Link>
  );
}

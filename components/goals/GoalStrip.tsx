'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';
import {
  daysLeft,
  goalProgress,
  goalState,
  GOAL_SOON_DAYS,
  GOAL_URGENT_DAYS,
  stepProgress,
  stepsOf,
  timeProgress,
} from '@/lib/goals';
import { formatNumber } from '@/lib/project';
import type { Goal } from '@/lib/types';

type GoalStripProps = {
  goal: Goal;
  today: string;
};

/**
 * Цель перед глазами.
 *
 * Полоса узкая намеренно: на главной есть элемент, который обязан быть
 * главным, и это счётчик рассылок. Цель отвечает на другой вопрос — «зачем»
 * — и спорить с ним за внимание не должна. Но и исчезать не должна: цель,
 * которую не видно каждый день, ничем не отличается от незаписанной.
 *
 * Ни одного прогноза здесь нет. Только факты: сколько дней осталось, сколько
 * собрано и сколько срока прошло. Засечка на полосе показывает время — если
 * заливка её обгоняет, ты впереди, и это видно за полсекунды без единого
 * допущения о том, как придут деньги.
 */
export function GoalStrip({ goal, today }: GoalStripProps) {
  const { t, tf, days } = useLanguage();

  const left = daysLeft(goal.deadline, today);
  const overdue = left < 0;
  const pct = goalProgress(goal);
  const time = timeProgress(goal, today);
  const state = goalState(goal, today);
  const steps = stepProgress(stepsOf(goal));

  // Цвет только у срока и только когда он действительно близко: подсветка,
  // которая горит всегда, ничего не значит.
  const tone = overdue || left <= GOAL_URGENT_DAYS
    ? 'text-danger'
    : left <= GOAL_SOON_DAYS
      ? 'text-warn'
      : 'text-white';

  const stateTone =
    state === 'ahead' ? 'text-success' : state === 'behind' ? 'text-warn' : 'text-white/35';

  return (
    <Link
      href="/progress"
      className="glass block px-4 py-3 transition-colors hover:bg-white/[0.09]"
    >
      {/* max-w: на мониторе полоса растягивалась во всю ширину, и числа по
          краям расходились на метр друг от друга. */}
      <div className="flex max-w-2xl items-center gap-3.5">
        <div className="shrink-0 text-center">
          <motion.p
            // key: смена числа проигрывает появление заново — день ушёл, и
            // это единственное событие, которое здесь стоит отметить.
            key={left}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`text-3xl font-extrabold leading-none tabular-nums ${tone}`}
          >
            {Math.abs(left)}
          </motion.p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wide text-white/35">
            {days(Math.abs(left))}
          </p>
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{goal.title}</p>

          {goal.target_amount ? (
            <>
              <div className="relative mt-2">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/12">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ type: 'spring', stiffness: 110, damping: 22 }}
                    className="h-full rounded-full bg-white/75"
                  />
                </div>

                {/* Засечка времени. Стоит вне полосы, чтобы читаться и на
                    залитой части, и на пустой. */}
                <span
                  aria-hidden="true"
                  style={{ left: `${time}%` }}
                  className="absolute -top-1 h-[14px] w-px -translate-x-1/2 bg-white/55"
                />
              </div>

              <div className="mt-2 flex items-baseline justify-between gap-2 text-xs">
                <span className="min-w-0 truncate tabular-nums text-white/40">
                  {formatNumber(goal.current_amount)}{' '}
                  {tf(t.goals.of, { n: formatNumber(goal.target_amount) })}
                </span>
                <span className={`shrink-0 font-semibold ${stateTone}`}>
                  {overdue
                    ? tf(t.goals.overdue, { n: `${-left} ${days(-left)}` })
                    : state === 'fresh'
                      ? tf(t.goals.pctTime, { n: time })
                      : t.goals[state === 'done' ? 'doneLabel' : state]}
                </span>
              </div>
            </>
          ) : steps.total > 0 ? (
            <p className="mt-1 truncate text-xs tabular-nums text-white/40">
              {t.goals.steps} · {tf(t.goals.stepsProgress, { done: steps.done, total: steps.total })}
            </p>
          ) : (
            goal.note && <p className="mt-1 truncate text-xs text-white/40">{goal.note}</p>
          )}
        </div>
      </div>
    </Link>
  );
}

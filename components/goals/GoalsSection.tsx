'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, Eye, Pencil, Plus, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { CardTitle, GlassCard } from '@/components/GlassCard';
import { GoalSheet } from '@/components/goals/GoalSheet';
import { useLanguage } from '@/components/LanguageProvider';
import { Button } from '@/components/ui';
import { formatDateSmart } from '@/lib/date';
import {
  daysLeft,
  goalProgress,
  goalState,
  GOAL_SOON_DAYS,
  GOAL_URGENT_DAYS,
  outreachesPerDay,
  outreachesToGoal,
  projectedDate,
  remaining,
  requiredPace,
  slackDays,
  type GoalState,
} from '@/lib/goals';
import { formatNumber } from '@/lib/project';
import type { Goal } from '@/lib/types';
import type { GoalDraft } from '@/hooks/useGoals';

type GoalsSectionProps = {
  goals: Goal[];
  ready: boolean;
  today: string;
  rublesPer: number | null;
  onSave: (draft: GoalDraft, id: string | null) => void;
  onAddAmount: (id: string, amount: number) => void;
  onPin: (id: string) => void;
  onDone: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
  delay?: number;
};

/** Раздел целей на странице прогресса: здесь их заводят и здесь на них смотрят. */
export function GoalsSection({
  goals,
  ready,
  today,
  rublesPer,
  onSave,
  onAddAmount,
  onPin,
  onDone,
  onDelete,
  delay = 0,
}: GoalsSectionProps) {
  const { t } = useLanguage();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);

  if (!ready) {
    return (
      <GlassCard delay={delay}>
        <CardTitle>{t.goals.title}</CardTitle>
        <p className="text-sm leading-relaxed text-muted">{t.goals.notReady}</p>
      </GlassCard>
    );
  }

  return (
    <GlassCard delay={delay}>
      <CardTitle>{t.goals.title}</CardTitle>

      {goals.length === 0 ? (
        <div className="px-2 pb-3 pt-1 text-center">
          <p className="text-sm leading-relaxed text-muted">{t.goals.empty}</p>
          <p className="mt-2 text-xs leading-relaxed text-white/25">{t.goals.emptyHint}</p>
        </div>
      ) : (
        <ul className="mb-3 space-y-2">
          <AnimatePresence initial={false}>
            {goals.map((goal) => (
              <motion.li
                key={goal.id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <GoalRow
                  goal={goal}
                  today={today}
                  rublesPer={rublesPer}
                  onAddAmount={onAddAmount}
                  onPin={onPin}
                  onDone={onDone}
                  onEdit={() => {
                    setEditing(goal);
                    setSheetOpen(true);
                  }}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <Button
        variant="ghost"
        full
        onClick={() => {
          setEditing(null);
          setSheetOpen(true);
        }}
      >
        <Plus size={16} />
        {t.goals.add}
      </Button>

      <GoalSheet
        open={sheetOpen}
        goal={editing}
        today={today}
        onClose={() => {
          setSheetOpen(false);
          setEditing(null);
        }}
        onSave={onSave}
        onDelete={onDelete}
      />
    </GlassCard>
  );
}

/* -------------------------------------------------------------------------- */

/** Цвет строки состояния. Зелёный — только за опережение и за достигнутое. */
const STATE_TONE: Record<GoalState, string> = {
  done: 'text-success',
  ahead: 'text-success',
  ontrack: 'text-white/45',
  fresh: 'text-white/30',
  behind: 'text-warn',
  overdue: 'text-danger',
};

function GoalRow({
  goal,
  today,
  rublesPer,
  onAddAmount,
  onPin,
  onDone,
  onEdit,
}: {
  goal: Goal;
  today: string;
  rublesPer: number | null;
  onAddAmount: (id: string, amount: number) => void;
  onPin: (id: string) => void;
  onDone: (id: string, done: boolean) => void;
  onEdit: () => void;
}) {
  const { t, tf, lang, days, msgs } = useLanguage();

  const [amount, setAmount] = useState('');

  const left = daysLeft(goal.deadline, today);
  const pct = goalProgress(goal);
  const state = goalState(goal, today);
  const left_ = remaining(goal);
  const toGo = outreachesToGoal(goal, rublesPer);
  const perDay = outreachesPerDay(goal, rublesPer, today);
  const slack = slackDays(goal, today);
  const projected = projectedDate(goal, today);

  const dayTone = goal.done
    ? 'text-success'
    : left < 0
      ? 'text-danger'
      : left <= GOAL_URGENT_DAYS
        ? 'text-danger'
        : left <= GOAL_SOON_DAYS
          ? 'text-warn'
          : 'text-white';

  /** Одна строка про темп — та, что сейчас имеет смысл. */
  const status = (() => {
    if (goal.done) return t.goals.doneLabel;
    if (state === 'fresh') return t.goals.fresh;
    if (state === 'ahead' && slack !== null) {
      return tf(t.goals.ahead, { n: `${slack} ${days(slack)}` });
    }
    if (state === 'behind' && projected) {
      return tf(t.goals.behind, { date: formatDateSmart(projected, today, lang) });
    }
    if (state === 'overdue') return tf(t.goals.overdue, { n: `${-left} ${days(-left)}` });
    return t.goals.ontrack;
  })();

  return (
    <div className={`rounded-2xl bg-white/[0.04] p-3 ${goal.done ? 'opacity-55' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className={`text-base font-bold leading-snug ${goal.done ? 'line-through' : ''}`}>
            {goal.title}
          </p>
          {goal.note && <p className="mt-0.5 text-sm leading-snug text-white/40">{goal.note}</p>}
        </div>

        {!goal.done && (
          <div className="shrink-0 text-right">
            <p className={`text-xl font-extrabold leading-none tabular-nums ${dayTone}`}>
              {Math.abs(left)}
            </p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wide text-white/30">
              {days(Math.abs(left))}
            </p>
          </div>
        )}
      </div>

      {goal.target_amount ? (
        <>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/12">
            <motion.div
              initial={false}
              animate={{ width: `${pct}%` }}
              transition={{ type: 'spring', stiffness: 110, damping: 22 }}
              className={`h-full rounded-full ${goal.done ? 'bg-success' : 'bg-white/75'}`}
            />
          </div>

          <p className="mt-1.5 text-sm tabular-nums text-white/55">
            {formatNumber(goal.current_amount)}{' '}
            <span className="text-white/30">
              {tf(t.goals.of, { n: formatNumber(goal.target_amount) })}
            </span>
          </p>

          {/* Темп и рассылки: числа, которые можно перебить сегодня. Остаток
              перебить нельзя — его можно только не успеть. */}
          {!goal.done && left_ > 0 && (
            <p className="mt-1 text-xs leading-relaxed text-white/40">
              {tf(t.goals.pace, { n: formatNumber(requiredPace(goal, today)) })}
              {toGo !== null && toGo > 0 && ` · ${tf(t.goals.toGoal, { n: toGo, unit: msgs(toGo) })}`}
              {perDay !== null &&
                perDay > 0 &&
                ` · ${tf(t.goals.paceOutreach, { n: perDay, unit: msgs(perDay) })}`}
            </p>
          )}

          {!goal.done && left_ > 0 && toGo === null && (
            <p className="mt-1 text-xs leading-relaxed text-white/25">{t.goals.noMath}</p>
          )}
        </>
      ) : null}

      <p className={`mt-2 text-xs font-semibold ${STATE_TONE[state]}`}>{status}</p>

      {/* Пополнение — прямо в строке: деньги приходят в момент, когда открыть
          отдельную форму меньше всего хочется. */}
      {!goal.done && goal.target_amount && (
        <form
          className="mt-2.5 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const value = Number(amount);
            if (!value) return;
            onAddAmount(goal.id, value);
            setAmount('');
          }}
        >
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
            placeholder={t.goals.addAmount}
            aria-label={t.goals.addAmount}
            inputMode="numeric"
            autoComplete="off"
            className="field min-w-0 flex-1"
          />
          <button
            type="submit"
            aria-label={t.goals.addAmount}
            disabled={!amount}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-ink disabled:opacity-30"
          >
            <Plus size={20} strokeWidth={2.6} />
          </button>
        </form>
      )}

      <div className="mt-2.5 flex gap-2">
        <button
          type="button"
          onClick={() => onDone(goal.id, !goal.done)}
          className={`min-h-[44px] min-w-0 flex-1 rounded-2xl px-3 text-sm font-bold ${
            goal.done
              ? 'btn-ghost'
              : 'bg-white text-ink'
          } flex items-center justify-center gap-2`}
        >
          {goal.done ? <RotateCcw size={15} /> : <Check size={16} strokeWidth={2.6} />}
          <span className="truncate">{goal.done ? t.goals.reopen : t.goals.markDone}</span>
        </button>

        {!goal.done && (
          <button
            type="button"
            onClick={() => onPin(goal.id)}
            aria-label={t.goals.pin}
            title={goal.pinned ? t.goals.pinned : t.goals.pin}
            className={`btn-ghost min-h-[44px] w-12 shrink-0 px-0 ${
              goal.pinned ? 'border-white text-white' : 'text-white/35'
            }`}
          >
            <Eye size={16} />
          </button>
        )}

        <button
          type="button"
          onClick={onEdit}
          aria-label={t.common.edit}
          className="btn-ghost min-h-[44px] w-12 shrink-0 px-0 text-white/35"
        >
          <Pencil size={15} />
        </button>
      </div>
    </div>
  );
}

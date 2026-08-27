'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, Eye, Pencil, Plus, RotateCcw, X } from 'lucide-react';
import { useState } from 'react';
import { CardTitle, GlassCard } from '@/components/GlassCard';
import { GoalSheet } from '@/components/goals/GoalSheet';
import { useLanguage } from '@/components/LanguageProvider';
import { Button } from '@/components/ui';
import {
  daysLeft,
  goalProgress,
  goalState,
  GOAL_SOON_DAYS,
  GOAL_URGENT_DAYS,
  newStepId,
  stepProgress,
  stepsOf,
  timeProgress,
  type GoalState,
} from '@/lib/goals';
import { formatNumber } from '@/lib/project';
import type { Goal, GoalStep } from '@/lib/types';
import type { GoalDraft } from '@/hooks/useGoals';

type GoalsSectionProps = {
  goals: Goal[];
  ready: boolean;
  today: string;
  onSave: (draft: GoalDraft, id: string | null) => void;
  onAddAmount: (id: string, amount: number) => void;
  onSteps: (id: string, steps: GoalStep[]) => void;
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
  onSave,
  onAddAmount,
  onSteps,
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

  /*
   * Шторка стоит СНАРУЖИ карточки, а не внутри неё.
   *
   * GlassCard — это motion.div, и framer-motion оставляет на нём transform.
   * Элемент с transform создаёт содержащий блок для position: fixed, и
   * шторка внутри него позиционируется относительно карточки, а не экрана:
   * уезжает вбок и обрезается по её высоте. Ровно это и было видно.
   */
  return (
    <>
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
                  onAddAmount={onAddAmount}
                  onSteps={onSteps}
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

    </GlassCard>

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
    </>
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
  onAddAmount,
  onSteps,
  onPin,
  onDone,
  onEdit,
}: {
  goal: Goal;
  today: string;
  onAddAmount: (id: string, amount: number) => void;
  onSteps: (id: string, steps: GoalStep[]) => void;
  onPin: (id: string) => void;
  onDone: (id: string, done: boolean) => void;
  onEdit: () => void;
}) {
  const { t, tf, days } = useLanguage();

  const [amount, setAmount] = useState('');
  const [stepText, setStepText] = useState('');

  const left = daysLeft(goal.deadline, today);
  const pct = goalProgress(goal);
  const time = timeProgress(goal, today);
  const state = goalState(goal, today);
  const steps = stepsOf(goal);
  const stepStats = stepProgress(steps);

  const dayTone = goal.done
    ? 'text-success'
    : left < 0 || left <= GOAL_URGENT_DAYS
      ? 'text-danger'
      : left <= GOAL_SOON_DAYS
        ? 'text-warn'
        : 'text-white';

  /** Одна строка про состояние — та, что сейчас имеет смысл. */
  const status = (() => {
    if (goal.done) return t.goals.doneLabel;
    if (state === 'overdue') return tf(t.goals.overdue, { n: `${-left} ${days(-left)}` });
    if (state === 'fresh') return t.goals.fresh;
    if (state === 'ahead') return t.goals.ahead;
    if (state === 'behind') return t.goals.behind;
    return t.goals.ontrack;
  })();

  function toggleStep(id: string) {
    onSteps(
      goal.id,
      steps.map((step) => (step.id === id ? { ...step, done: !step.done } : step)),
    );
  }

  function addStep() {
    const title = stepText.trim();
    if (!title) return;
    onSteps(goal.id, [...steps, { id: newStepId(), title, done: false }]);
    setStepText('');
  }

  function removeStep(id: string) {
    onSteps(
      goal.id,
      steps.filter((step) => step.id !== id),
    );
  }

  return (
    <div className={`rounded-2xl bg-white/[0.04] p-3.5 ${goal.done ? 'opacity-55' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className={`text-base font-bold leading-snug ${goal.done ? 'line-through' : ''}`}>
            {goal.title}
          </p>
          {goal.note && <p className="mt-0.5 text-sm leading-snug text-white/40">{goal.note}</p>}
        </div>

        {!goal.done && (
          <div className="shrink-0 text-right">
            <p className={`text-2xl font-extrabold leading-none tabular-nums ${dayTone}`}>
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
          {/*
            Полоса с засечкой времени. Две доли рядом — «41% собрано» против
            «30% срока» — отвечают на «успеваю ли я» без единого допущения о
            том, как придут деньги. Прогноз здесь врал бы: один эксперт может
            дать два миллиона, а десять — ноль.
          */}
          <div className="relative mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/12">
              <motion.div
                initial={false}
                animate={{ width: `${pct}%` }}
                transition={{ type: 'spring', stiffness: 110, damping: 22 }}
                className={`h-full rounded-full ${goal.done ? 'bg-success' : 'bg-white/75'}`}
              />
            </div>
            {!goal.done && (
              <span
                aria-hidden="true"
                style={{ left: `${time}%` }}
                className="absolute -top-1 h-[14px] w-px -translate-x-1/2 bg-white/55"
              />
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
            <span className="tabular-nums text-white/55">
              {formatNumber(goal.current_amount)}{' '}
              <span className="text-white/30">
                {tf(t.goals.of, { n: formatNumber(goal.target_amount) })}
              </span>
            </span>
            <span className="text-xs tabular-nums text-white/30">
              {tf(t.goals.pctDone, { n: pct })} · {tf(t.goals.pctTime, { n: time })}
            </span>
          </div>
        </>
      ) : null}

      <p className={`mt-2 text-xs font-semibold ${STATE_TONE[state]}`}>{status}</p>

      {/* Пополнение прямо в строке: деньги приходят в момент, когда открыть
          отдельную форму меньше всего хочется. */}
      {!goal.done && goal.target_amount && (
        <form
          className="mt-3 flex gap-2"
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

      {/*
        Шаги. Сумма зависит не только от него — она ждёт чужого решения.
        Шаги зависят только от него, и поэтому это единственная часть пути,
        которую честно показывать как прогресс.
      */}
      {!goal.done && (
        <div className="mt-3 border-t border-divider pt-3">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <p className="section-label">{t.goals.steps}</p>
            {stepStats.total > 0 && (
              <span className="text-xs tabular-nums text-white/35">
                {tf(t.goals.stepsProgress, { done: stepStats.done, total: stepStats.total })}
              </span>
            )}
          </div>

          {steps.length === 0 ? (
            <p className="mb-2 text-xs leading-relaxed text-white/25">{t.goals.stepsEmpty}</p>
          ) : (
            <ul className="mb-2 space-y-0.5">
              {steps.map((step) => (
                <li key={step.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleStep(step.id)}
                    aria-pressed={step.done}
                    className="flex min-h-[40px] min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1 text-left"
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border ${
                        step.done ? 'border-white bg-white text-ink' : 'border-white/25'
                      }`}
                    >
                      {step.done && <Check size={13} strokeWidth={3} />}
                    </span>
                    <span
                      className={`min-w-0 flex-1 text-sm leading-snug ${
                        step.done ? 'text-white/35 line-through' : 'text-white/75'
                      }`}
                    >
                      {step.title}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => removeStep(step.id)}
                    aria-label={t.common.delete}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/20 transition-colors hover:bg-white/10 hover:text-danger"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addStep();
            }}
          >
            <input
              value={stepText}
              onChange={(e) => setStepText(e.target.value)}
              placeholder={t.goals.stepPh}
              aria-label={t.goals.addStep}
              autoComplete="off"
              className="field min-w-0 flex-1"
            />
            <button
              type="submit"
              aria-label={t.goals.addStep}
              disabled={!stepText.trim()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white disabled:opacity-30"
            >
              <Plus size={18} strokeWidth={2.6} />
            </button>
          </form>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onDone(goal.id, !goal.done)}
          className={`flex min-h-[44px] min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-3 text-sm font-bold ${
            goal.done ? 'btn-ghost' : 'bg-white text-ink'
          }`}
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

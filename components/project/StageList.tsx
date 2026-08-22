'use client';

import { motion } from 'framer-motion';
import { CalendarRange } from 'lucide-react';
import { CardTitle, GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { AddRow, CheckMark, RemoveButton, StrikeText } from '@/components/project/parts';
import { Badge, Button } from '@/components/ui';
import { ProgressBar } from '@/components/XpBar';
import { formatShortDate } from '@/lib/date';
import {
  currentStage,
  dueState,
  GATE_ID,
  isPipelineId,
  stageHint,
  stageProgress,
  stageTitle,
  type DueState,
} from '@/lib/pipeline';
import type { ProjectStage } from '@/lib/types';

type StageListProps = {
  stages: ProjectStage[];
  today: string;
  /** Даты можно разложить только между известными границами проекта. */
  canSpread: boolean;
  onToggle: (stageId: string) => void;
  onAdd: (title: string) => void;
  onRemove: (stageId: string) => void;
  onSpread: () => void;
};

/**
 * Воронка продюсирования: семь шагов, один и тот же путь у каждого запуска.
 *
 * Подсказка показывается только у текущего этапа. Семь подсказок разом — это
 * стена текста, в которой не видно, где ты стоишь; а нужна она ровно там, где
 * ты стоишь сейчас.
 */
export function StageList({
  stages,
  today,
  canSpread,
  onToggle,
  onAdd,
  onRemove,
  onSpread,
}: StageListProps) {
  const { t, tf } = useLanguage();

  const progress = stageProgress(stages);
  const current = currentStage(stages);

  return (
    <GlassCard>
      <CardTitle
        right={
          <span className="shrink-0 text-xs font-bold tabular-nums text-white/40">
            {tf(t.project.progress, { done: progress.done, total: progress.total })}
          </span>
        }
      >
        {t.project.stages}
      </CardTitle>

      <ProgressBar pct={progress.pct} height={6} />

      <div className="mt-3 space-y-0.5">
        {stages.map((stage) => (
          <StageRow
            key={stage.id}
            stage={stage}
            today={today}
            isCurrent={current?.id === stage.id}
            onToggle={() => onToggle(stage.id)}
            onRemove={() => onRemove(stage.id)}
          />
        ))}
      </div>

      {/* Без даты старта и даты запуска раскладывать не между чем — кнопки нет. */}
      {canSpread && (
        <Button variant="ghost" full className="mt-3" onClick={onSpread}>
          <CalendarRange size={16} />
          {t.project.stageSetDue}
        </Button>
      )}

      <AddRow placeholder={t.project.stagePh} addLabel={t.project.addStage} onAdd={onAdd} />
    </GlassCard>
  );
}

/* -------------------------------------------------------------------------- */
/*  Шаг воронки                                                                */
/* -------------------------------------------------------------------------- */

function StageRow({
  stage,
  today,
  isCurrent,
  onToggle,
  onRemove,
}: {
  stage: ProjectStage;
  today: string;
  isCurrent: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const { t, tf, lang } = useLanguage();

  const state = dueState(stage, today);
  const hint = stageHint(stage, t);
  const isGate = stage.id === GATE_ID;
  // Каркас воронки удалить нельзя: путь общий, иначе два запуска снова
  // перестанут сравниваться. Свой этап — добавил сам, сам и убрал.
  const isCustom = !isPipelineId(stage.id);

  return (
    <div className={`rounded-2xl ${isCurrent ? 'bg-white/[0.05]' : ''}`}>
      <div className="flex items-start gap-1">
        <motion.button
          type="button"
          onClick={onToggle}
          whileTap={{ scale: 0.98 }}
          aria-pressed={stage.done}
          className="flex min-h-[48px] min-w-0 flex-1 items-start gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-white/[0.03]"
        >
          <span className="mt-0.5">
            <CheckMark done={stage.done} />
          </span>

          <span className="min-w-0 flex-1 py-0.5">
            <StrikeText done={stage.done}>{stageTitle(stage, t)}</StrikeText>

            {isGate && (
              <span className="mt-1.5 block">
                <Badge>{t.project.gate}</Badge>
              </span>
            )}

            {/* Подсказка нужна там, где стоишь. Про точку решения — тем более:
                «не сложилось» проще принять до того, как это случилось. */}
            {isCurrent && (
              <span className="mt-1.5 block space-y-1">
                {hint && <span className="block text-xs leading-snug text-white/35">{hint}</span>}
                {isGate && (
                  <span className="block text-xs leading-snug text-white/35">
                    {t.project.gateHint}
                  </span>
                )}
              </span>
            )}
          </span>

          <span className={`mt-1.5 shrink-0 text-xs font-semibold ${dueTone(state)}`}>
            {dueLabel(stage, state, isCurrent, t, tf, lang)}
          </span>
        </motion.button>

        {isCustom && <RemoveButton label={t.common.delete} onClick={onRemove} />}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Дата этапа                                                                 */
/* -------------------------------------------------------------------------- */

function dueTone(state: DueState): string {
  if (state === 'overdue') return 'text-danger';
  if (state === 'today' || state === 'soon') return 'text-warn';
  return 'text-white/35';
}

/**
 * Просроченному этапу дата не нужна: важен факт, а не число.
 *
 * «Без даты» показывается только у текущего шага — семь одинаковых подписей
 * в столбик были бы шумом, а на текущем это прямая наводка на «поставить дату».
 */
function dueLabel(
  stage: ProjectStage,
  state: DueState,
  isCurrent: boolean,
  t: ReturnType<typeof useLanguage>['t'],
  tf: ReturnType<typeof useLanguage>['tf'],
  lang: ReturnType<typeof useLanguage>['lang'],
): string {
  if (state === 'overdue') return t.project.stageOverdue;
  if (stage.due) return tf(t.project.stageDue, { date: formatShortDate(stage.due, lang) });
  return isCurrent ? t.project.stageNoDue : '';
}

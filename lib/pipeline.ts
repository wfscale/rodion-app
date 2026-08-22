import { daysBetween, shiftDate } from '@/lib/date';
import type { Dict } from '@/lib/i18n';
import type { ProjectStage } from '@/lib/types';

/**
 * Воронка продюсирования — один и тот же путь у каждого запуска.
 *
 * Раньше проект был списком произвольных галочек. На третьем эксперте эти
 * списки расходились так, что сравнить два запуска было нельзя: непонятно,
 * где именно в прошлый раз всё встало и что из этого повторять.
 *
 * Путь один: созвон → анкета знакомства → договор → кастдевы → MVP →
 * прогрев → продажи. Свои этапы добавлять можно, но каркас общий.
 */

export const PIPELINE_IDS = [
  'call',
  'survey',
  'contract',
  'custdev',
  'mvp',
  'warmup',
  'sales',
] as const;

export type PipelineId = (typeof PIPELINE_IDS)[number];

/**
 * Точка решения: после анкеты видно, есть ли отклик у аудитории.
 *
 * Отдельная пометка нужна, чтобы «не сложилось» здесь читалось как штатный
 * исход, а не как провал. Половина подходов честно умирает на этом шаге, и
 * приложение обязано это говорить вслух — иначе каждый такой случай
 * ощущается личным поражением.
 */
export const GATE_ID: PipelineId = 'survey';

/** Шаг, с которого проект перестаёт быть потенциальным: подписан договор. */
export const COMMITTED_ID: PipelineId = 'contract';

/**
 * Вес этапа в общем сроке.
 *
 * Кастдевы и прогрев занимают месяцы, созвон — час. Равномерная раскладка
 * дат по этапам дала бы заведомо ложный план, а ложный план бросают целиком
 * после первой же просрочки.
 */
const WEIGHT: Record<PipelineId, number> = {
  call: 1,
  survey: 2,
  contract: 1,
  custdev: 4,
  mvp: 3,
  warmup: 4,
  sales: 2,
};

const PIPELINE_SET = new Set<string>(PIPELINE_IDS);

/** Шаг ли это общего каркаса, или этап добавлен вручную. */
export function isPipelineId(id: string): id is PipelineId {
  return PIPELINE_SET.has(id);
}

/** Название этапа: у каркасных — из словаря, у своих — сохранённое. */
export function stageTitle(stage: ProjectStage, t: Dict): string {
  return isPipelineId(stage.id) ? t.pipeline[stage.id] : stage.title;
}

/** Подсказка к этапу. У добавленных вручную её нет. */
export function stageHint(stage: ProjectStage, t: Dict): string | null {
  if (!isPipelineId(stage.id)) return null;
  return t.pipeline[`${stage.id}Hint` as const];
}

/** Стартовый набор этапов для нового проекта. */
export function defaultStages(t: Dict): ProjectStage[] {
  return PIPELINE_IDS.map((id) => ({
    id,
    title: t.pipeline[id],
    done: false,
    due: null,
  }));
}

export type StageProgress = { done: number; total: number; pct: number };

export function stageProgress(stages: ProjectStage[]): StageProgress {
  const total = stages.length;
  const done = stages.filter((stage) => stage.done).length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

/**
 * Текущий этап — первый невыполненный.
 *
 * Именно первый, а не последний отмеченный: галочки ставят не по порядку,
 * и «сейчас» должно означать ближайшее незакрытое дело, а не самое дальнее
 * из тронутых.
 */
export function currentStage(stages: ProjectStage[]): ProjectStage | null {
  return stages.find((stage) => !stage.done) ?? null;
}

/** Проект ещё не дошёл до договора — это подход, а не работа. */
export function isPotential(stages: ProjectStage[]): boolean {
  const index = stages.findIndex((stage) => stage.id === COMMITTED_ID);
  if (index === -1) return false;
  return !stages[index].done;
}

export type DueState = 'none' | 'ahead' | 'soon' | 'today' | 'overdue';

/** Насколько горит дата этапа. Выполненный этап не горит никогда. */
export function dueState(stage: ProjectStage, today: string): DueState {
  if (stage.done || !stage.due) return 'none';
  const diff = daysBetween(stage.due, today);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff <= 3) return 'soon';
  return 'ahead';
}

/**
 * Разложить примерные даты этапов между стартом и запуском.
 *
 * Пропорционально весу, а не поровну. Даты именно примерные: жёсткий срок
 * на кастдевах, которые зависят от чужого расписания, — это гарантированно
 * просроченная задача и повод бросить план целиком.
 *
 * Уже выполненные этапы дат не получают: ставить срок на сделанное незачем.
 */
export function spreadDues(
  stages: ProjectStage[],
  startedAt: string,
  launchDate: string,
): ProjectStage[] {
  const span = daysBetween(launchDate, startedAt);
  if (span <= 0) return stages;

  const weights = stages.map((stage) => (isPipelineId(stage.id) ? WEIGHT[stage.id] : 2));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total === 0) return stages;

  let passed = 0;
  return stages.map((stage, index) => {
    passed += weights[index];
    if (stage.done) return stage;
    const offset = Math.max(1, Math.round((passed / total) * span));
    return { ...stage, due: shiftDate(startedAt, offset) };
  });
}

/**
 * Сколько дней осталось до даты. Отрицательное — просрочено на столько же.
 * null — даты нет.
 */
export function daysToDeadline(deadline: string | null, today: string): number | null {
  if (!deadline) return null;
  return daysBetween(deadline, today);
}

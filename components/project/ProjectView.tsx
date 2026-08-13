'use client';

import { motion } from 'framer-motion';
import { Check, Circle, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { Badge, Button, EmptyState, Field, Label, PageTitle, Segmented, TextArea } from '@/components/ui';
import { formatShortDate } from '@/lib/date';
import type { Project, ProjectStage } from '@/lib/types';

/**
 * Черновик проекта: то, что уходит наверх на сохранение.
 * id есть только у редактирования — без него это создание.
 */
export type ProjectDraft = {
  id?: string;
  expert_name: string;
  niche: string | null;
  status: Project['status'];
  stages: ProjectStage[];
  launch_date: string | null;
  deal_amount: number;
  note: string | null;
};

type ProjectViewProps = {
  projects: Project[];
  onSave: (draft: ProjectDraft) => void;
  onToggleStage: (projectId: string, stageId: string) => void;
  onDelete: (id: string) => void;
};

/* -------------------------------------------------------------------------- */
/*  Раздел целиком                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Раздел «Проект» — то, ради чего делались рассылки: закрытый эксперт,
 * который теперь ведётся не в голове, а по этапам и дедлайну.
 */
export function ProjectView({ projects, onSave, onToggleStage, onDelete }: ProjectViewProps) {
  const { t } = useLanguage();

  // null — шторка закрыта, undefined-id внутри черновика — создание нового.
  const [editing, setEditing] = useState<ProjectDraft | null>(null);

  return (
    <div>
      <PageTitle
        right={
          projects.length > 0 ? (
            <Button variant="ghost" onClick={() => setEditing(emptyDraft())}>
              <Plus size={16} />
              {t.project.add}
            </Button>
          ) : undefined
        }
      >
        {t.project.title}
      </PageTitle>

      {projects.length === 0 ? (
        <GlassCard>
          <EmptyState text={t.project.empty} />
          <Button full onClick={() => setEditing(emptyDraft())}>
            {t.project.add}
          </Button>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {projects.map((project, i) => (
            <ProjectCard
              key={project.id}
              project={project}
              delay={i}
              onSave={onSave}
              onToggleStage={onToggleStage}
              onDelete={onDelete}
              onEdit={() => setEditing(toDraft(project))}
            />
          ))}
        </div>
      )}

      <ProjectSheet
        draft={editing}
        onClose={() => setEditing(null)}
        onSave={(draft) => {
          onSave(draft);
          setEditing(null);
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Карточка проекта                                                           */
/* -------------------------------------------------------------------------- */

function ProjectCard({
  project,
  delay,
  onSave,
  onToggleStage,
  onDelete,
  onEdit,
}: {
  project: Project;
  delay: number;
  onSave: (draft: ProjectDraft) => void;
  onToggleStage: (projectId: string, stageId: string) => void;
  onDelete: (id: string) => void;
  onEdit: () => void;
}) {
  const { t, lang } = useLanguage();

  const [stageTitle, setStageTitle] = useState('');
  const [confirming, setConfirming] = useState(false);

  const stages = project.stages ?? [];
  const doneCount = stages.filter((stage) => stage.done).length;

  function addStage() {
    const title = stageTitle.trim();
    if (!title) return;
    // Этапы правятся тем же onSave: отдельного канала для них нет намеренно —
    // проект всегда сохраняется целиком, рассинхрона быть не может.
    onSave({
      ...toDraft(project),
      stages: [...stages, { id: newStageId(), title, done: false }],
    });
    setStageTitle('');
  }

  function removeStage(stageId: string) {
    onSave({
      ...toDraft(project),
      stages: stages.filter((stage) => stage.id !== stageId),
    });
  }

  return (
    <GlassCard delay={delay}>
      {/* Шапка: кто, какая ниша, на какой стадии запуск */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-extrabold leading-snug">{project.expert_name}</h2>
          {project.niche && <p className="mt-0.5 text-sm text-muted">{project.niche}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Badge tone={statusTone(project.status)}>{statusLabel(project.status, t)}</Badge>
          <button
            type="button"
            onClick={onEdit}
            aria-label={t.common.edit}
            className="flex h-11 w-11 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Pencil size={16} />
          </button>
        </div>
      </div>

      {/* Этапы — чеклист с вычёркиванием */}
      <div className="mt-4">
        <Label>
          {t.project.stages}
          {stages.length > 0 ? ` · ${doneCount}/${stages.length}` : ''}
        </Label>

        <div className="space-y-0.5">
          {stages.map((stage) => (
            <StageRow
              key={stage.id}
              stage={stage}
              onToggle={() => onToggleStage(project.id, stage.id)}
              onRemove={() => removeStage(stage.id)}
              removeLabel={t.common.delete}
            />
          ))}
        </div>

        {/* Добавление этапа — инлайн, без шторок и лишних шагов */}
        <div className="mt-2 flex items-center gap-2">
          <input
            value={stageTitle}
            onChange={(e) => setStageTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addStage();
              }
            }}
            placeholder={t.project.stagePh}
            className="field flex-1"
          />
          <button
            type="button"
            onClick={addStage}
            disabled={!stageTitle.trim()}
            aria-label={t.common.add}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-ink transition-opacity disabled:opacity-30"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      {/* Дедлайн и сумма сделки */}
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-divider pt-4">
        <div>
          <p className="text-xs text-white/35">{t.project.launchDate}</p>
          <p className="mt-1 text-base font-bold">
            {project.launch_date ? formatShortDate(project.launch_date, lang) : t.common.none}
          </p>
        </div>
        <div>
          <p className="text-xs text-white/35">{t.project.dealAmount}</p>
          <p className="mt-1 text-base font-bold tabular-nums">
            {project.deal_amount ? formatNumber(project.deal_amount) : t.common.none}
          </p>
        </div>
      </div>

      {project.note && (
        <div className="mt-4 border-t border-divider pt-4">
          <p className="text-xs text-white/35">{t.project.note}</p>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-white/75">
            {project.note}
          </p>
        </div>
      )}

      {/* Удаление проекта — только с подтверждением */}
      <div className="mt-4 border-t border-divider pt-4">
        {confirming ? (
          <div className="space-y-3">
            <p className="text-sm text-danger">{t.common.confirmDelete}</p>
            <div className="flex gap-2">
              <Button variant="danger" className="flex-1" onClick={() => onDelete(project.id)}>
                {t.common.delete}
              </Button>
              <Button variant="ghost" className="flex-1" onClick={() => setConfirming(false)}>
                {t.common.cancel}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="danger" full onClick={() => setConfirming(true)}>
            <Trash2 size={16} />
            {t.common.delete}
          </Button>
        )}
      </div>
    </GlassCard>
  );
}

/* -------------------------------------------------------------------------- */
/*  Этап проекта                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Строка этапа. Приём тот же, что в ChecklistItem: линия прочерчивается
 * слева направо за 300 мс, а после анимации заменяется настоящим
 * line-through — иначе этап в две строки зачёркивался бы неправильно.
 */
function StageRow({
  stage,
  onToggle,
  onRemove,
  removeLabel,
}: {
  stage: ProjectStage;
  onToggle: () => void;
  onRemove: () => void;
  removeLabel: string;
}) {
  const [strikeSettled, setStrikeSettled] = useState(stage.done);
  const previousDone = useRef(stage.done);

  useEffect(() => {
    if (previousDone.current === stage.done) return;
    if (!stage.done) setStrikeSettled(false);
    previousDone.current = stage.done;
  }, [stage.done]);

  return (
    <div className="flex items-center gap-1">
      <motion.button
        type="button"
        onClick={onToggle}
        whileTap={{ scale: 0.97 }}
        aria-pressed={stage.done}
        className="flex min-h-[48px] flex-1 items-center gap-3 rounded-xl px-1 text-left transition-colors hover:bg-white/[0.03]"
      >
        <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
          <motion.span
            initial={false}
            animate={{ opacity: stage.done ? 0 : 1, scale: stage.done ? 0.6 : 1 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 flex items-center justify-center text-white/35"
          >
            <Circle size={22} strokeWidth={1.5} />
          </motion.span>
          <motion.span
            initial={false}
            animate={{ opacity: stage.done ? 1 : 0, scale: stage.done ? 1 : 0.5 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            className="absolute inset-0 flex items-center justify-center text-white"
          >
            <Check size={22} strokeWidth={2.5} />
          </motion.span>
        </span>

        <span className="relative min-w-0 flex-1 py-1">
          <motion.span
            initial={false}
            animate={{ opacity: stage.done ? 0.4 : 1 }}
            transition={{ duration: 0.3 }}
            className={`block text-base leading-snug ${
              strikeSettled && stage.done ? 'line-through decoration-white/70' : ''
            }`}
          >
            {stage.title}
          </motion.span>

          {!strikeSettled && (
            <motion.span
              aria-hidden="true"
              initial={false}
              animate={{ scaleX: stage.done ? 1 : 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              onAnimationComplete={() => {
                if (stage.done) setStrikeSettled(true);
              }}
              style={{ originX: 0 }}
              className="absolute left-0 right-0 top-1/2 h-[1.5px] -translate-y-1/2 rounded-full bg-white/70"
            />
          )}
        </span>
      </motion.button>

      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/25 transition-colors hover:bg-white/10 hover:text-danger"
      >
        <X size={16} />
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Форма создания и правки                                                    */
/* -------------------------------------------------------------------------- */

function ProjectSheet({
  draft,
  onClose,
  onSave,
}: {
  draft: ProjectDraft | null;
  onClose: () => void;
  onSave: (draft: ProjectDraft) => void;
}) {
  const { t } = useLanguage();

  const [name, setName] = useState('');
  const [niche, setNiche] = useState('');
  const [status, setStatus] = useState<Project['status']>('prep');
  const [launchDate, setLaunchDate] = useState('');
  // Сумма живёт строкой: пустое поле — это не ноль, а «ещё не ввёл».
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!draft) return;
    setName(draft.expert_name);
    setNiche(draft.niche ?? '');
    setStatus(draft.status);
    setLaunchDate(draft.launch_date ?? '');
    setAmount(draft.deal_amount ? String(draft.deal_amount) : '');
    setNote(draft.note ?? '');
    setError(false);
  }, [draft]);

  function submit() {
    if (!draft) return;
    if (!name.trim()) {
      setError(true);
      return;
    }
    onSave({
      ...draft,
      expert_name: name.trim(),
      niche: niche.trim() || null,
      status,
      launch_date: launchDate || null,
      deal_amount: Number(amount.replace(/\D/g, '')) || 0,
      note: note.trim() || null,
    });
  }

  return (
    <BottomSheet
      open={draft !== null}
      onClose={onClose}
      title={draft?.id ? t.common.edit : t.project.add}
      footer={
        <Button full onClick={submit}>
          {t.common.save}
        </Button>
      }
    >
      <div className="space-y-4">
        <Field
          label={t.project.expertName}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(false);
          }}
          error={error ? t.common.required : undefined}
        />

        <Field
          label={t.project.niche}
          hint={t.common.optional}
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
        />

        <div>
          <Label>{t.project.status}</Label>
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              { value: 'prep', label: t.project.statusPrep },
              { value: 'launch', label: t.project.statusLaunch },
              { value: 'done', label: t.project.statusDone },
            ]}
          />
        </div>

        <Field
          label={t.project.launchDate}
          type="date"
          value={launchDate}
          onChange={(e) => setLaunchDate(e.target.value)}
        />

        <Field
          label={t.project.dealAmount}
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
        />

        <TextArea
          label={t.project.note}
          rows={4}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </BottomSheet>
  );
}

/* -------------------------------------------------------------------------- */
/*  Мелочи                                                                     */
/* -------------------------------------------------------------------------- */

function emptyDraft(): ProjectDraft {
  return {
    expert_name: '',
    niche: null,
    status: 'prep',
    stages: [],
    launch_date: null,
    deal_amount: 0,
    note: null,
  };
}

function toDraft(project: Project): ProjectDraft {
  return {
    id: project.id,
    expert_name: project.expert_name,
    niche: project.niche,
    status: project.status,
    stages: project.stages ?? [],
    launch_date: project.launch_date,
    deal_amount: project.deal_amount,
    note: project.note,
  };
}

function statusLabel(status: Project['status'], t: ReturnType<typeof useLanguage>['t']): string {
  if (status === 'launch') return t.project.statusLaunch;
  if (status === 'done') return t.project.statusDone;
  return t.project.statusPrep;
}

function statusTone(status: Project['status']): 'neutral' | 'warn' | 'success' {
  if (status === 'launch') return 'warn';
  if (status === 'done') return 'success';
  return 'neutral';
}

/** id этапа генерируется на клиенте: сервер о новом этапе ещё не знает. */
function newStageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `stage-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

/** 1 200 000 — разряды разделены неразрывным пробелом, чтобы не рвались. */
function formatNumber(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
}

'use client';

import { ChevronLeft, ExternalLink, Pencil, Send, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CardTitle, GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { AssetsCard } from '@/components/project/AssetsCard';
import { ProjectSheet } from '@/components/project/ProjectSheet';
import { statusLabel, statusTone, toDraft, type ProjectDraft } from '@/components/project/shared';
import { externalHref, formatNumber, stagesOf } from '@/lib/project';
import { StageList } from '@/components/project/StageList';
import { TasksCard } from '@/components/project/TasksCard';
import { Badge, Button, DeskColumns, Segmented, TextArea } from '@/components/ui';
import { formatShortDate } from '@/lib/date';
import {
  PROJECT_STATUSES,
  type Project,
  type ProjectStatus,
  type ProjectTask,
  type TaskScope,
} from '@/lib/types';

type ProjectDetailProps = {
  project: Project;
  tasks: ProjectTask[];
  tasksReady: boolean;
  today: string;
  onPatch: (patch: Partial<Project>) => void;
  onToggleStage: (stageId: string) => void;
  onAddStage: (title: string) => void;
  onRemoveStage: (stageId: string) => void;
  onSpreadDues: () => void;
  onAddTask: (text: string, scope: TaskScope) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onDelete: () => void;
};

/**
 * Страница одного запуска.
 *
 * Слева — то, ради чего сюда заходят: с кем работаешь и где стоишь по
 * воронке. Справа — обслуживающее: задачи, замеры, исход, заметки. На
 * телефоне колонки схлопываются в один столбец в этом же порядке.
 */
export function ProjectDetail({
  project,
  tasks,
  tasksReady,
  today,
  onPatch,
  onToggleStage,
  onAddStage,
  onRemoveStage,
  onSpreadDues,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onDelete,
}: ProjectDetailProps) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState<ProjectDraft | null>(null);

  const stages = stagesOf(project);

  return (
    <div>
      <Link
        href="/project"
        className="-ml-2 mb-2 inline-flex min-h-[44px] items-center gap-1 rounded-2xl pl-1 pr-3 text-sm font-semibold text-white/50 transition-colors hover:text-white"
      >
        <ChevronLeft size={18} />
        {t.project.back}
      </Link>

      <DeskColumns
        main={
          <>
            <HeaderCard project={project} onEdit={() => setEditing(toDraft(project))} />

            <StageList
              stages={stages}
              today={today}
              // Раскладывать даты можно только между известными границами.
              canSpread={Boolean(project.started_at && project.launch_date)}
              onToggle={onToggleStage}
              onAdd={onAddStage}
              onRemove={onRemoveStage}
              onSpread={onSpreadDues}
            />
          </>
        }
        side={
          <>
            <TasksCard
              tasks={tasks}
              today={today}
              ready={tasksReady}
              onAdd={onAddTask}
              onToggle={onToggleTask}
              onDelete={onDeleteTask}
            />

            <AssetsCard
              start={project.assets_start}
              now={project.assets_now}
              onSave={(assets_start, assets_now) => onPatch({ assets_start, assets_now })}
            />

            <NotesCard note={project.note} onSave={(note) => onPatch({ note })} />

            <OutcomeCard
              status={project.status}
              onChange={(status) => onPatch({ status })}
              onDelete={onDelete}
            />
          </>
        }
      />

      <ProjectSheet
        draft={editing}
        title={t.project.edit}
        onClose={() => setEditing(null)}
        onSave={(draft) => {
          onPatch(draft);
          setEditing(null);
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Шапка эксперта                                                             */
/* -------------------------------------------------------------------------- */

function HeaderCard({ project, onEdit }: { project: Project; onEdit: () => void }) {
  const { t, lang } = useLanguage();

  const rows: { label: string; value: string }[] = [
    {
      label: t.project.dealAmount,
      value: project.deal_amount ? formatNumber(project.deal_amount) : t.common.none,
    },
    {
      label: t.project.startedAt,
      value: project.started_at ? formatShortDate(project.started_at, lang) : t.common.none,
    },
    {
      label: t.project.launchDate,
      value: project.launch_date ? formatShortDate(project.launch_date, lang) : t.common.none,
    },
  ];

  return (
    <GlassCard>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-xl font-extrabold leading-tight">{project.expert_name}</h1>
          {project.niche && <p className="mt-1 break-words text-sm text-muted">{project.niche}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Badge tone={statusTone(project.status)}>{statusLabel(project.status, t)}</Badge>
          <button
            type="button"
            onClick={onEdit}
            aria-label={t.project.edit}
            className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Pencil size={16} />
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-2 border-t border-divider pt-4">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3">
            <span className="text-xs text-white/35">{row.label}</span>
            <span className="text-base font-bold tabular-nums">{row.value}</span>
          </div>
        ))}
      </div>

      {/* Ссылки — единственный способ за секунду вспомнить, с кем работаешь. */}
      {(project.instagram_url || project.telegram_url) && (
        <div className="mt-4 flex gap-2">
          {project.instagram_url && (
            <a
              href={externalHref(project.instagram_url)}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost min-w-0 flex-1"
            >
              <ExternalLink size={16} />
              <span className="truncate">{t.project.instagram}</span>
            </a>
          )}
          {project.telegram_url && (
            <a
              href={externalHref(project.telegram_url)}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost min-w-0 flex-1"
            >
              <Send size={16} />
              <span className="truncate">{t.project.telegram}</span>
            </a>
          )}
        </div>
      )}
    </GlassCard>
  );
}

/* -------------------------------------------------------------------------- */
/*  Заметки                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Заметки сохраняются при потере фокуса.
 *
 * Кнопка «Сохранить» под текстовым полем — лишний шаг, на котором мысль и
 * теряется; поэтому подтверждение сохранения показывается постфактум.
 */
function NotesCard({ note, onSave }: { note: string | null; onSave: (note: string | null) => void }) {
  const { t } = useLanguage();

  const [text, setText] = useState(note ?? '');
  const [saved, setSaved] = useState(false);

  // Заметку могли поменять снаружи — например, откатом после ошибки записи.
  useEffect(() => {
    setText(note ?? '');
  }, [note]);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(timer);
  }, [saved]);

  function commit() {
    const next = text.trim() || null;
    if (next === (note ?? null)) return;
    onSave(next);
    setSaved(true);
  }

  return (
    <GlassCard>
      <CardTitle
        right={saved ? <span className="text-xs text-white/35">{t.common.saved}</span> : undefined}
      >
        {t.project.note}
      </CardTitle>

      <TextArea
        rows={4}
        placeholder={t.project.notePh}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
      />
    </GlassCard>
  );
}

/* -------------------------------------------------------------------------- */
/*  Исход                                                                      */
/* -------------------------------------------------------------------------- */

function OutcomeCard({
  status,
  onChange,
  onDelete,
}: {
  status: ProjectStatus;
  onChange: (status: ProjectStatus) => void;
  onDelete: () => void;
}) {
  const { t } = useLanguage();
  const [confirming, setConfirming] = useState(false);

  return (
    <GlassCard>
      <CardTitle>{t.project.status}</CardTitle>

      <Segmented
        value={status}
        onChange={onChange}
        options={PROJECT_STATUSES.map((value) => ({ value, label: statusLabel(value, t) }))}
      />

      {status === 'lost' && (
        <p className="mt-3 text-xs leading-snug text-white/35">{t.project.lostHint}</p>
      )}

      {/* Удаление — крайний случай: «не сложилось» сохраняет историю подхода,
          а стёртый проект делает вид, что работы не было вовсе. */}
      <div className="mt-4 border-t border-divider pt-4">
        {confirming ? (
          <div className="space-y-3">
            <p className="text-sm text-danger">{t.common.confirmDelete}</p>
            <div className="flex gap-2">
              <Button variant="danger" className="flex-1" onClick={onDelete}>
                {t.common.delete}
              </Button>
              <Button variant="ghost" className="flex-1" onClick={() => setConfirming(false)}>
                {t.common.cancel}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" full onClick={() => setConfirming(true)}>
            <Trash2 size={16} />
            {t.common.delete}
          </Button>
        )}
      </div>
    </GlassCard>
  );
}

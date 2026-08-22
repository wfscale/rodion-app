'use client';

import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { CardTitle, GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { CheckMark, AddRow, RemoveButton, StrikeText } from '@/components/project/parts';
import { Label } from '@/components/ui';
import { formatShortDate } from '@/lib/date';
import type { ProjectTask, TaskScope } from '@/lib/types';

type TasksCardProps = {
  tasks: ProjectTask[];
  today: string;
  /** false — таблицы project_tasks ещё нет (не прогнали миграцию v8). */
  ready: boolean;
  onAdd: (text: string, scope: TaskScope) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
};

/**
 * Работа по проекту разложена на два горизонта.
 *
 * Дневная задача поднимается в «Задачи дня» на главной — там, где человек и
 * смотрит, что делать прямо сейчас. Недельная остаётся внутри проекта: если
 * поднять и её, список дня перестанет быть списком дня.
 */
export function TasksCard({ tasks, today, ready, onAdd, onToggle, onDelete }: TasksCardProps) {
  const { t } = useLanguage();

  const day = useMemo(
    () =>
      tasks.filter((task) => {
        if (task.scope !== 'day') return false;
        const date = task.date ?? today;
        // Незакрытая вчерашняя задача остаётся на виду: исчезнуть молча она
        // не может — иначе список дня чистит сам себя за счёт работы.
        return date === today || (!task.done && date < today);
      }),
    [tasks, today],
  );

  const week = useMemo(() => tasks.filter((task) => task.scope === 'week'), [tasks]);

  return (
    <GlassCard>
      <CardTitle>{t.project.tasks}</CardTitle>

      {ready ? (
        <div className="space-y-5">
          <TaskGroup
            title={t.project.taskDay}
            caption={t.project.tasksToday}
            placeholder={t.project.taskDayPh}
            tasks={day}
            today={today}
            onAdd={(text) => onAdd(text, 'day')}
            onToggle={onToggle}
            onDelete={onDelete}
          />

          <TaskGroup
            title={t.project.taskWeek}
            placeholder={t.project.taskWeekPh}
            tasks={week}
            today={today}
            onAdd={(text) => onAdd(text, 'week')}
            onToggle={onToggle}
            onDelete={onDelete}
          />
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-muted">{t.project.notReady}</p>
      )}
    </GlassCard>
  );
}

/* -------------------------------------------------------------------------- */
/*  Один список                                                                */
/* -------------------------------------------------------------------------- */

function TaskGroup({
  title,
  caption,
  placeholder,
  tasks,
  today,
  onAdd,
  onToggle,
  onDelete,
}: {
  title: string;
  caption?: string;
  placeholder: string;
  tasks: ProjectTask[];
  today: string;
  onAdd: (text: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { t, lang } = useLanguage();

  return (
    <div>
      <Label>{title}</Label>

      {tasks.length === 0 ? (
        <p className="px-1 text-sm text-white/30">{t.project.tasksEmpty}</p>
      ) : (
        <div className="space-y-0.5">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center gap-1">
              <motion.button
                type="button"
                onClick={() => onToggle(task.id)}
                whileTap={{ scale: 0.98 }}
                aria-pressed={task.done}
                className="flex min-h-[48px] min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 text-left transition-colors hover:bg-white/[0.03]"
              >
                <CheckMark done={task.done} />
                <span className="min-w-0 flex-1 py-1">
                  <StrikeText done={task.done}>{task.text}</StrikeText>
                </span>

                {/* Дата — только у долга с прошлых дней: у сегодняшних она
                    ничего не добавляет, а у просроченных объясняет, откуда
                    задача взялась. */}
                {task.date && task.date !== today && (
                  <span className="shrink-0 text-xs font-semibold text-warn">
                    {formatShortDate(task.date, lang)}
                  </span>
                )}
              </motion.button>

              <RemoveButton label={t.common.delete} onClick={() => onDelete(task.id)} />
            </div>
          ))}
        </div>
      )}

      <AddRow placeholder={placeholder} addLabel={t.common.add} onAdd={onAdd} />

      {caption && <p className="mt-1.5 px-1 text-xs text-white/30">{caption}</p>}
    </div>
  );
}

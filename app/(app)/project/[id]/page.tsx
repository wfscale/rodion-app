'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { useLanguage } from '@/components/LanguageProvider';
import { LockedFeature } from '@/components/LockedFeature';
import { ProjectDetail } from '@/components/project/ProjectDetail';
import { SaveError } from '@/components/project/parts';
import { newStageId } from '@/components/project/shared';
import { stagesOf } from '@/lib/project';
import { EmptyState, FullPageLoader, PageTitle } from '@/components/ui';
import { spreadDues } from '@/lib/pipeline';
import { createClient } from '@/lib/supabase/client';
import type { Project, ProjectStage, ProjectTask, TaskScope } from '@/lib/types';
import { FEATURE_LEVEL, unlocked } from '@/lib/xp';

/**
 * Один запуск целиком: воронка, задачи, замеры, исход.
 *
 * Данные пишутся оптимистично — экран отвечает сразу, а неудачная запись
 * откатывается обратно и говорит об этом вслух. Молча показывать
 * несохранённое хуже, чем задержка.
 */
export default function ProjectDetailPage() {
  const { t } = useLanguage();
  const app = useApp();
  const router = useRouter();
  const params = useParams();
  const supabase = useMemo(() => createClient(), []);

  const id = typeof params?.id === 'string' ? params.id : '';

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  // false — таблицы project_tasks ещё нет (не прогнали миграцию v8).
  const [tasksReady, setTasksReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!app.user || !id) return;

    // user_id в фильтре, хотя RLS и так не отдаст чужую строку: политика —
    // последний рубеж, а не единственный, и запрос должен быть верным сам
    // по себе. Так же сделано на странице списка.
    const [projectRes, tasksRes] = await Promise.all([
      supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .eq('user_id', app.user.id)
        .maybeSingle(),
      supabase
        .from('project_tasks')
        .select('*')
        .eq('project_id', id)
        .eq('user_id', app.user.id)
        .order('created_at', { ascending: true }),
    ]);

    if (projectRes.error) setError(projectRes.error.message);
    setProject((projectRes.data as Project) ?? null);

    // Без миграции раздел задач молчит, а всё остальное на странице работает.
    if (tasksRes.error) {
      setTasksReady(false);
      setTasks([]);
    } else {
      setTasksReady(true);
      setTasks((tasksRes.data as ProjectTask[]) ?? []);
    }

    setLoading(false);
  }, [supabase, app.user, id]);

  useEffect(() => {
    void load();
  }, [load]);

  /* ------------------------------------------------------------------ */
  /*  Проект                                                             */
  /* ------------------------------------------------------------------ */

  const patchProject = useCallback(
    async (patch: Partial<Project>) => {
      if (!project) return;

      const previous = project;
      setProject({ ...project, ...patch });

      const { error: saveError } = await supabase
        .from('projects')
        .update(patch as never)
        .eq('id', project.id);

      // Откат: показывать сохранённым то, что не сохранилось, — это враньё.
      if (saveError) {
        setProject(previous);
        setError(saveError.message);
      }
    },
    [supabase, project],
  );

  function patchStages(stages: ProjectStage[]) {
    void patchProject({ stages });
  }

  function toggleStage(stageId: string) {
    if (!project) return;
    patchStages(
      stagesOf(project).map((stage) =>
        stage.id === stageId ? { ...stage, done: !stage.done } : stage,
      ),
    );
  }

  function addStage(title: string) {
    if (!project) return;
    patchStages([...stagesOf(project), { id: newStageId(), title, done: false, due: null }]);
  }

  function removeStage(stageId: string) {
    if (!project) return;
    patchStages(stagesOf(project).filter((stage) => stage.id !== stageId));
  }

  function setDues() {
    if (!project?.started_at || !project.launch_date) return;
    patchStages(spreadDues(stagesOf(project), project.started_at, project.launch_date));
  }

  async function removeProject() {
    if (!project) return;
    const { error: deleteError } = await supabase.from('projects').delete().eq('id', project.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    router.replace('/project');
  }

  /* ------------------------------------------------------------------ */
  /*  Задачи                                                             */
  /* ------------------------------------------------------------------ */

  async function addTask(text: string, scope: TaskScope) {
    if (!app.user || !project) return;

    const { data, error: insertError } = await supabase
      .from('project_tasks')
      .insert({
        user_id: app.user.id,
        project_id: project.id,
        text,
        scope,
        // Дневная задача привязана ко дню, недельная живёт без даты.
        date: scope === 'day' ? app.today : null,
        done: false,
      } as never)
      .select('*')
      .single();

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setTasks((previous) => [...previous, data as ProjectTask]);
  }

  async function toggleTask(taskId: string) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;

    const done = !task.done;
    setTasks((previous) =>
      previous.map((item) => (item.id === taskId ? { ...item, done } : item)),
    );

    const { error: saveError } = await supabase
      .from('project_tasks')
      .update({ done } as never)
      .eq('id', taskId);

    if (saveError) {
      setTasks((previous) =>
        previous.map((item) => (item.id === taskId ? { ...item, done: task.done } : item)),
      );
      setError(saveError.message);
    }
  }

  async function deleteTask(taskId: string) {
    const removed = tasks.find((item) => item.id === taskId);
    if (!removed) return;

    setTasks((previous) => previous.filter((item) => item.id !== taskId));

    const { error: deleteError } = await supabase
      .from('project_tasks')
      .delete()
      .eq('id', taskId);

    if (deleteError) {
      setTasks((previous) => [...previous, removed]);
      setError(deleteError.message);
    }
  }

  /* ------------------------------------------------------------------ */

  if (app.loading || !app.profile) return <FullPageLoader />;

  if (!unlocked('project', app.levelInfo.level)) {
    return (
      <div className="space-y-4">
        <PageTitle>{t.project.title}</PageTitle>
        <LockedFeature featureKey="project" requiredLevel={FEATURE_LEVEL.project} />
      </div>
    );
  }

  if (loading) return <FullPageLoader />;

  // Проект удалили с другого устройства или ссылка чужая — не белый экран.
  if (!project) {
    return (
      <div>
        <PageTitle>{t.project.title}</PageTitle>
        <EmptyState text={t.project.empty} />
        <Link href="/project" className="btn-ghost mx-auto flex w-fit">
          {t.project.back}
        </Link>
      </div>
    );
  }

  return (
    <>
      <SaveError message={error} closeLabel={t.common.close} onClose={() => setError(null)} />

      <ProjectDetail
        project={project}
        tasks={tasks}
        tasksReady={tasksReady}
        today={app.today}
        onPatch={(patch) => void patchProject(patch)}
        onToggleStage={toggleStage}
        onAddStage={addStage}
        onRemoveStage={removeStage}
        onSpreadDues={setDues}
        onAddTask={(text, scope) => void addTask(text, scope)}
        onToggleTask={(taskId) => void toggleTask(taskId)}
        onDeleteTask={(taskId) => void deleteTask(taskId)}
        onDelete={() => void removeProject()}
      />
    </>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { useLanguage } from '@/components/LanguageProvider';
import { LockedFeature } from '@/components/LockedFeature';
import { ProjectView, type ProjectDraft } from '@/components/project/ProjectView';
import { FullPageLoader, PageTitle } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import type { Project } from '@/lib/types';
import { FEATURE_LEVEL, unlocked } from '@/lib/xp';

/** Раздел «Проект» — открывается на 5-м уровне, после первого закрытого эксперта. */
export default function ProjectPage() {
  const { t } = useLanguage();
  const app = useApp();
  const supabase = useMemo(() => createClient(), []);

  const [projects, setProjects] = useState<Project[]>([]);

  const load = useCallback(async () => {
    if (!app.user) return;
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', app.user.id)
      .order('created_at', { ascending: false });
    setProjects((data as Project[]) ?? []);
  }, [supabase, app.user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(draft: ProjectDraft) {
    if (!app.user) return;

    if (draft.id) {
      setProjects((previous) =>
        previous.map((p) => (p.id === draft.id ? { ...p, ...draft } as Project : p)),
      );
      await supabase.from('projects').update({
        expert_name: draft.expert_name,
        niche: draft.niche,
        status: draft.status,
        stages: draft.stages,
        launch_date: draft.launch_date,
        deal_amount: draft.deal_amount,
        note: draft.note,
      } as never).eq('id', draft.id);
    } else {
      const { data } = await supabase
        .from('projects')
        .insert({ user_id: app.user.id, ...draft } as never)
        .select('*')
        .single();
      if (data) setProjects((previous) => [data as Project, ...previous]);
    }
  }

  async function toggleStage(projectId: string, stageId: string) {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;

    const stages = (project.stages ?? []).map((s) =>
      s.id === stageId ? { ...s, done: !s.done } : s,
    );

    setProjects((previous) => previous.map((p) => (p.id === projectId ? { ...p, stages } : p)));
    await supabase.from('projects').update({ stages } as never).eq('id', projectId);
  }

  async function remove(id: string) {
    setProjects((previous) => previous.filter((p) => p.id !== id));
    await supabase.from('projects').delete().eq('id', id);
  }

  if (app.loading || !app.profile) return <FullPageLoader />;

  return (
    <div className="space-y-4">
      <PageTitle>{t.project.title}</PageTitle>

      {unlocked('project', app.levelInfo.level) ? (
        <ProjectView
          projects={projects}
          onSave={(draft) => void save(draft)}
          onToggleStage={(pid, sid) => void toggleStage(pid, sid)}
          onDelete={(id) => void remove(id)}
        />
      ) : (
        <LockedFeature featureKey="project" requiredLevel={FEATURE_LEVEL.project} />
      )}
    </div>
  );
}

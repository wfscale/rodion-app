'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { useLanguage } from '@/components/LanguageProvider';
import { LockedFeature } from '@/components/LockedFeature';
import { ProjectList } from '@/components/project/ProjectList';
import { SaveError } from '@/components/project/parts';
import type { ProjectDraft } from '@/components/project/shared';
import { FullPageLoader, PageTitle } from '@/components/ui';
import { defaultStages } from '@/lib/pipeline';
import { createClient } from '@/lib/supabase/client';
import type { Project } from '@/lib/types';
import { FEATURE_LEVEL, unlocked } from '@/lib/xp';

/** Раздел «Проект» — открывается на 5-м уровне, после первого закрытого эксперта. */
export default function ProjectPage() {
  const { t } = useLanguage();
  const app = useApp();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!app.user) return;
    const { data, error: loadError } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', app.user.id)
      .order('created_at', { ascending: false });

    if (loadError) setError(loadError.message);
    setProjects((data as Project[]) ?? []);
    setLoading(false);
  }, [supabase, app.user]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Новый проект сразу открывается: заводят его не ради строчки в списке, а
   * чтобы начать вести — и вести дальше уже некуда, кроме как внутрь.
   */
  async function create(draft: ProjectDraft) {
    if (!app.user) return;

    const { data, error: insertError } = await supabase
      .from('projects')
      .insert({
        user_id: app.user.id,
        ...draft,
        status: 'active',
        stages: defaultStages(t),
      } as never)
      .select('*')
      .single();

    if (insertError) {
      setError(insertError.message);
      return;
    }

    const project = data as Project;
    setProjects((previous) => [project, ...previous]);
    router.push(`/project/${project.id}`);
  }

  if (app.loading || !app.profile) return <FullPageLoader />;

  // Заголовок рисует ProjectList — вместе с кнопкой «новый проект» в его
  // правом углу. Второй такой же здесь давал два слова «Проект» подряд.
  if (!unlocked('project', app.levelInfo.level)) {
    return (
      <div className="space-y-4">
        <PageTitle>{t.project.title}</PageTitle>
        <LockedFeature featureKey="project" requiredLevel={FEATURE_LEVEL.project} />
      </div>
    );
  }

  if (loading) return <FullPageLoader />;

  return (
    <>
      <SaveError message={error} closeLabel={t.common.close} onClose={() => setError(null)} />
      <ProjectList
        projects={projects}
        today={app.today}
        onCreate={(draft) => void create(draft)}
      />
    </>
  );
}

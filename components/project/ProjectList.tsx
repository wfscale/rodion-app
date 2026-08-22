'use client';

import { ChevronRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { ProjectSheet } from '@/components/project/ProjectSheet';
import { emptyDraft, type ProjectDraft } from '@/components/project/shared';
import { stagesOf } from '@/lib/project';
import { Button, Collapsible, EmptyState, PageTitle } from '@/components/ui';
import { ProgressBar } from '@/components/XpBar';
import { formatShortDate } from '@/lib/date';
import { currentStage, daysToDeadline, stageProgress, stageTitle } from '@/lib/pipeline';
import type { Project } from '@/lib/types';

type ProjectListProps = {
  projects: Project[];
  today: string;
  onCreate: (draft: ProjectDraft) => void;
};

/**
 * Список запусков.
 *
 * Карточка отвечает на три вопроса, ради которых сюда и заходят: с кем
 * работаешь, где стоишь по воронке и сколько осталось до запуска. Всё
 * остальное — внутри проекта.
 */
/**
 * Сетка списка, а не колонки CSS.
 *
 * Проекты отсортированы по тому, что горит раньше, и читаться они обязаны
 * слева направо: в перетекающих колонках второй по срочности запуск оказался
 * бы под первым, а третий — наверху соседней колонки, то есть выше него.
 * Карточки здесь одного размера, ради чего колонки и заводились.
 */
const GRID = 'grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3';

export function ProjectList({ projects, today, onCreate }: ProjectListProps) {
  const { t, tf } = useLanguage();
  const [draft, setDraft] = useState<ProjectDraft | null>(null);

  const groups = useMemo(() => {
    // Ближайший дедлайн — сверху. Проект без даты запуска ничем не горит и
    // уходит вниз: он не срочный, он просто не размеченный.
    const byDeadline = (a: Project, b: Project) => {
      if (!a.launch_date) return b.launch_date ? 1 : 0;
      if (!b.launch_date) return -1;
      return a.launch_date.localeCompare(b.launch_date);
    };

    return {
      active: projects.filter((p) => p.status === 'active').sort(byDeadline),
      done: projects.filter((p) => p.status === 'done').sort(byDeadline).reverse(),
      lost: projects.filter((p) => p.status === 'lost'),
    };
  }, [projects]);

  return (
    <div>
      <PageTitle
        right={
          projects.length > 0 ? (
            <Button variant="ghost" onClick={() => setDraft(emptyDraft(today))}>
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
          <Button full onClick={() => setDraft(emptyDraft(today))}>
            {t.project.add}
          </Button>
        </GlassCard>
      ) : (
        <div className="space-y-6">
          <div className={GRID}>
            {groups.active.map((project, i) => (
              <ProjectCard key={project.id} project={project} today={today} delay={i} />
            ))}
          </div>

          {groups.done.length > 0 && (
            <div>
              <p className="section-label mb-3">{t.project.listDone}</p>
              <div className={GRID}>
                {groups.done.map((project) => (
                  <ProjectCard key={project.id} project={project} today={today} />
                ))}
              </div>
            </div>
          )}

          {/* Не сложилось — свёрнуто по умолчанию: это история, а не работа,
              и открывать её каждый раз незачем. */}
          {groups.lost.length > 0 && (
            <Collapsible
              title={tf(t.project.lostCount, { n: groups.lost.length })}
              storageKey="project.lost"
              defaultOpen={false}
            >
              <p className="mb-3 text-xs leading-snug text-white/30">{t.project.lostHint}</p>
              <div className={GRID}>
                {groups.lost.map((project) => (
                  <ProjectCard key={project.id} project={project} today={today} />
                ))}
              </div>
            </Collapsible>
          )}
        </div>
      )}

      <ProjectSheet
        draft={draft}
        title={t.project.add}
        onClose={() => setDraft(null)}
        onSave={(next) => {
          onCreate(next);
          setDraft(null);
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Карточка в списке                                                          */
/* -------------------------------------------------------------------------- */

function ProjectCard({
  project,
  today,
  delay = 0,
}: {
  project: Project;
  today: string;
  delay?: number;
}) {
  const { t, tf } = useLanguage();

  const stages = stagesOf(project);
  const progress = stageProgress(stages);
  const current = currentStage(stages);

  return (
    <Link href={`/project/${project.id}`} className="block h-full">
      <GlassCard delay={delay} className="h-full transition-colors hover:bg-white/[0.09]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-extrabold leading-snug">
              {project.expert_name}
            </h2>
            {project.niche && <p className="mt-0.5 truncate text-sm text-muted">{project.niche}</p>}
          </div>
          <ChevronRight size={18} className="mt-1 shrink-0 text-white/25" />
        </div>

        <div className="mt-3">
          <div className="flex items-baseline justify-between gap-3">
            {/*
              «Сейчас» — только у идущего проекта. На запущенном эта строка
              противоречила бы группе, в которой он лежит, а на несложившемся
              врала бы: там ничего не происходит. У несложившегося важно другое —
              на каком шаге всё встало, и это же и показываем.
            */}
            <p className="min-w-0 truncate text-sm">
              {!current ? (
                <span className="text-white/45">{t.common.done}</span>
              ) : project.status === 'active' ? (
                <>
                  <span className="text-white/35">{t.project.stageCurrent} · </span>
                  {stageTitle(current, t)}
                </>
              ) : project.status === 'lost' ? (
                <span className="text-white/45">{stageTitle(current, t)}</span>
              ) : (
                <span className="text-white/45">{t.project.statusDone}</span>
              )}
            </p>
            <span className="shrink-0 text-xs font-bold tabular-nums text-white/40">
              {tf(t.project.progress, { done: progress.done, total: progress.total })}
            </span>
          </div>

          <ProgressBar pct={progress.pct} height={6} className="mt-2" />
        </div>

        <Deadline project={project} today={today} />
      </GlassCard>
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/*  Срок                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Строка срока.
 *
 * У запущенного проекта обратный отсчёт бессмыслен — там уже есть дата, и она
 * факт, а не давление. Считается только то, что ещё идёт.
 */
function Deadline({ project, today }: { project: Project; today: string }) {
  const { t, tf, days, lang } = useLanguage();

  if (project.status !== 'active') {
    if (!project.launch_date) return null;
    return (
      <p className="mt-3 text-xs text-white/35">
        {`${t.project.launchDate} · ${formatShortDate(project.launch_date, lang)}`}
      </p>
    );
  }

  const left = daysToDeadline(project.launch_date, today);

  if (left === null) {
    return <p className="mt-3 text-xs text-white/30">{t.project.noDeadline}</p>;
  }

  if (left < 0) {
    return (
      <p className="mt-3 text-xs font-semibold text-danger">
        {tf(t.project.overdue, { n: -left, unit: days(-left) })}
      </p>
    );
  }

  if (left === 0) {
    return <p className="mt-3 text-xs font-semibold text-warn">{t.common.today}</p>;
  }

  return (
    <p className={`mt-3 text-xs font-semibold ${left <= 3 ? 'text-warn' : 'text-white/40'}`}>
      {tf(t.project.daysLeft, { n: left, unit: days(left) })}
    </p>
  );
}

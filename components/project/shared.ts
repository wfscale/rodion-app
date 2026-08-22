import type { Dict } from '@/lib/i18n';
import type { Project, ProjectStatus } from '@/lib/types';

/**
 * Экранные помощники раздела «Проект».
 *
 * Всё, что считается без DOM, живёт в lib/project.ts и покрыто verify.ts.
 * Здесь остаётся то, что бесполезно без экрана: черновик шторки и подписи.
 */

/**
 * Черновик шапки проекта — то, что правится в шторке.
 *
 * Этапов, исхода и заметок здесь нет намеренно: у каждого из них свой
 * контрол на странице проекта, и второй путь правки через форму означал бы
 * два источника правды на одно поле.
 */
export type ProjectDraft = {
  expert_name: string;
  niche: string | null;
  started_at: string | null;
  launch_date: string | null;
  deal_amount: number;
  instagram_url: string | null;
  telegram_url: string | null;
};

/** Новый проект начинается сегодня: дата старта — не то, что хочется вводить руками. */
export function emptyDraft(today: string): ProjectDraft {
  return {
    expert_name: '',
    niche: null,
    started_at: today,
    launch_date: null,
    deal_amount: 0,
    instagram_url: null,
    telegram_url: null,
  };
}

export function toDraft(project: Project): ProjectDraft {
  return {
    expert_name: project.expert_name,
    niche: project.niche,
    started_at: project.started_at,
    launch_date: project.launch_date,
    deal_amount: project.deal_amount,
    instagram_url: project.instagram_url,
    telegram_url: project.telegram_url,
  };
}

export function statusLabel(status: ProjectStatus, t: Dict): string {
  if (status === 'done') return t.project.statusDone;
  if (status === 'lost') return t.project.statusLost;
  return t.project.statusActive;
}

/**
 * Цветом отмечается только запуск.
 *
 * «Не сложилось» красным было бы приговором, хотя это штатный исход половины
 * подходов. Слово в бейдже говорит всё само, и красить его незачем.
 */
export function statusTone(status: ProjectStatus): 'neutral' | 'success' {
  return status === 'done' ? 'success' : 'neutral';
}

/** id этапа генерируется на клиенте: сервер о новом этапе ещё не знает. */
export function newStageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `stage-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

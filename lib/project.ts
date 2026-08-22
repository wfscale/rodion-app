import { ASSET_KEYS, type Project, type ProjectAssets } from '@/lib/types';

/**
 * Чистые вычисления вокруг проекта.
 *
 * Живут в lib/, а не рядом с компонентами, по общему правилу: всё, что
 * считается без DOM, обязано быть покрыто verify.ts. Экранные помощники
 * (черновик шторки, подписи статусов) остались в components/project/shared.ts —
 * они бесполезны без экрана.
 */

/** Этапы приходят из jsonb — там может лежать что угодно, включая null. */
export function stagesOf(project: Pick<Project, 'stages'>) {
  return Array.isArray(project.stages) ? project.stages : [];
}

export function assetsOf(assets: ProjectAssets | null | undefined): ProjectAssets {
  return assets ?? {};
}

/** Замеряли ли активы вообще: хоть одно поле заполнено. */
export function hasAssets(assets: ProjectAssets | null | undefined): boolean {
  const values = assetsOf(assets);
  return ASSET_KEYS.some((key) => typeof values[key] === 'number');
}

/**
 * Ссылка на площадку, как её набрали руками.
 *
 * «instagram.com/name» без протокола браузер считает относительным путём и
 * уводит внутрь приложения. Дописываем https, иначе ссылка молча ломается.
 */
export function externalHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/** 1 200 000 — разряды разделены неразрывным пробелом, чтобы не рвались. */
export function formatNumber(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
}

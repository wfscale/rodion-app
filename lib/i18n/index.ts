import { ru, type Dict } from './ru';
import { en } from './en';
import type { Language } from '@/lib/types';

export const dictionaries: Record<Language, Dict> = { ru, en };
export type { Dict };

export function getDict(lang: Language): Dict {
  return dictionaries[lang] ?? ru;
}

/** Подставляет {n} и другие плейсхолдеры в строку перевода. */
export function interpolate(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

/**
 * Склонение существительного после числа.
 * ru: 1 день / 2 дня / 5 дней. en: 1 day / 2 days.
 */
export function plural(
  n: number,
  lang: Language,
  forms: { one: string; few: string; many: string },
): string {
  if (lang === 'en') return n === 1 ? forms.one : forms.many;

  const mod10 = Math.abs(n) % 10;
  const mod100 = Math.abs(n) % 100;

  if (mod100 >= 11 && mod100 <= 14) return forms.many;
  if (mod10 === 1) return forms.one;
  if (mod10 >= 2 && mod10 <= 4) return forms.few;
  return forms.many;
}

/** «3 дня» / «3 days» — для стрика. */
export function pluralDays(n: number, lang: Language, d: Dict): string {
  return plural(n, lang, {
    one: d.common.day,
    few: d.common.days2,
    many: d.common.days5,
  });
}

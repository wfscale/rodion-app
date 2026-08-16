/**
 * Акцентный цвет интерфейса — перк 17-го уровня.
 *
 * Хранится в localStorage, а не в профиле: это оформление одного устройства,
 * а не данные. Применяется одной CSS-переменной, поэтому все элементы,
 * которые её читают, перекрашиваются разом и без перерисовки React.
 */

export const ACCENTS = {
  mono: '#FFFFFF',
  gold: '#FFD166',
  ice: '#7FD8FF',
  ember: '#FF8A5B',
} as const;

export type AccentKey = keyof typeof ACCENTS;

export const ACCENT_KEYS = Object.keys(ACCENTS) as AccentKey[];

const STORAGE_KEY = 'rodion.accent';

export function isAccent(value: string | null): value is AccentKey {
  return value !== null && value in ACCENTS;
}

export function readAccent(): AccentKey {
  if (typeof window === 'undefined') return 'mono';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isAccent(stored) ? stored : 'mono';
  } catch {
    return 'mono';
  }
}

/** Красит интерфейс и запоминает выбор. */
export function applyAccent(key: AccentKey): void {
  if (typeof document === 'undefined') return;

  document.documentElement.style.setProperty('--accent', ACCENTS[key]);
  try {
    window.localStorage.setItem(STORAGE_KEY, key);
  } catch {
    // приватный режим — цвет доживёт до перезагрузки
  }
}

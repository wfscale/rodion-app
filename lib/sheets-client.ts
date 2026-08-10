'use client';

/**
 * Фоновая синхронизация с Google Sheets.
 *
 * Вызывается после изменения данных и работает по принципу «выстрелил и забыл»:
 * если интеграция не подключена или сеть отвалилась, приложение не должно
 * ни падать, ни показывать ошибку — Supabase остаётся источником правды.
 */

/** Флаг ставит страница настроек после успешного подключения. */
export const SHEETS_FLAG = 'rodion.sheets.connected';

let timer: ReturnType<typeof setTimeout> | null = null;

export function isSheetsConnected(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SHEETS_FLAG) === '1';
  } catch {
    return false;
  }
}

export function setSheetsConnected(connected: boolean) {
  try {
    if (connected) window.localStorage.setItem(SHEETS_FLAG, '1');
    else window.localStorage.removeItem(SHEETS_FLAG);
  } catch {
    // приватный режим — просто не кэшируем флаг
  }
}

/** Отложенная синхронизация: пачка правок подряд даёт один запрос. */
export function syncSheets(delay = 4000) {
  if (!isSheetsConnected()) return;

  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    void fetch('/api/google/sync', { method: 'POST' }).catch(() => {
      // молча: синхронизация вторична по отношению к данным в Supabase
    });
  }, delay);
}

/** Немедленная синхронизация — кнопка «Синхронизировать сейчас». */
export async function syncSheetsNow(): Promise<{ ok: boolean; message: string }> {
  try {
    const response = await fetch('/api/google/sync', { method: 'POST' });
    const payload = (await response.json()) as { error?: string; syncedAt?: string };

    if (!response.ok) return { ok: false, message: payload.error ?? 'sync failed' };
    return { ok: true, message: payload.syncedAt ?? '' };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'network error' };
  }
}

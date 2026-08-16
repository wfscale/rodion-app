import { daysBetween } from '@/lib/date';
import { compareUrgency, followUpState, needsTouch } from '@/lib/followup';
import { CONTACT_STATUSES, normalizeStatus, type ContactStatus, type OutreachContact } from '@/lib/types';

/**
 * Поиск и фильтры по списку рассылок.
 *
 * Держится отдельно от React намеренно: это самая простая на вид и самая
 * коварная часть страницы. Один неверный `&&` — и половина людей исчезает
 * без объяснений. Здесь всё покрывается тестами.
 */

export type SortMode = 'new' | 'old' | 'name' | 'status' | 'touch';

export type OutreachFilters = {
  /** Пусто = все статусы. */
  statuses: ContactStatus[];
  /** Пусто = все ниши. Ключи в нижнем регистре. */
  niches: string[];
  needsTouch: boolean;
  cold: boolean;
  muted: boolean;
  hasTelegram: boolean;
  hasInstagram: boolean;
  hasOffer: boolean;
  noNiche: boolean;
  /** Сколько последних дней касания показывать. 0 = всё время. */
  period: number;
  sort: SortMode;
};

export const EMPTY_FILTERS: OutreachFilters = {
  statuses: [],
  niches: [],
  needsTouch: false,
  cold: false,
  muted: false,
  hasTelegram: false,
  hasInstagram: false,
  hasOffer: false,
  noNiche: false,
  period: 0,
  sort: 'new',
};

/** Сколько фильтров сейчас реально что-то ограничивает. */
export function activeFilterCount(filters: OutreachFilters): number {
  let n = 0;
  if (filters.statuses.length > 0) n += 1;
  if (filters.niches.length > 0) n += 1;
  if (filters.needsTouch) n += 1;
  if (filters.cold) n += 1;
  if (filters.muted) n += 1;
  if (filters.hasTelegram) n += 1;
  if (filters.hasInstagram) n += 1;
  if (filters.hasOffer) n += 1;
  if (filters.noNiche) n += 1;
  if (filters.period > 0) n += 1;
  return n;
}

/** Нормализованный ключ ниши: сравниваем без регистра и лишних пробелов. */
export function nicheKey(niche: string | null | undefined): string {
  return (niche ?? '').trim().toLowerCase();
}

/** Все ниши в списке с числом контактов, от частых к редким. */
export function nicheOptions(
  contacts: OutreachContact[],
): { key: string; label: string; count: number }[] {
  const map = new Map<string, { label: string; count: number }>();

  for (const contact of contacts) {
    const label = (contact.niche ?? '').trim();
    if (!label) continue;
    const key = label.toLowerCase();
    const row = map.get(key) ?? { label, count: 0 };
    row.count += 1;
    map.set(key, row);
  }

  return Array.from(map.entries())
    .map(([key, row]) => ({ key, ...row }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * Совпадение со строкой поиска.
 *
 * Ищем сразу по всем текстовым полям: имя, телеграм, инстаграм, ниша, текст
 * оффера и следующий шаг. Ведущая «@» в запросе отбрасывается — её пишут по
 * привычке, и без этого поиск по хендлу молча ничего не находит.
 */
export function matchesQuery(contact: OutreachContact, rawQuery: string): boolean {
  const needle = rawQuery.trim().toLowerCase();
  if (!needle) return true;

  const bare = needle.replace(/^@+/, '');
  const handle = (contact.telegram_handle ?? '').toLowerCase().replace(/^@+/, '');

  const haystack = [
    contact.name,
    contact.niche,
    contact.instagram_url,
    contact.comment,
    contact.next_step,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(needle) || haystack.includes(bare) || (bare.length > 0 && handle.includes(bare));
}

/** Проходит ли контакт по всем включённым фильтрам. */
export function matchesFilters(
  contact: OutreachContact,
  filters: OutreachFilters,
  today: string,
): boolean {
  const status = normalizeStatus(contact.status);

  if (filters.statuses.length > 0 && !filters.statuses.includes(status)) return false;

  const key = nicheKey(contact.niche);
  if (filters.niches.length > 0 && !filters.niches.includes(key)) return false;
  if (filters.noNiche && key !== '') return false;

  if (filters.hasTelegram && !(contact.telegram_handle ?? '').trim()) return false;
  if (filters.hasInstagram && !(contact.instagram_url ?? '').trim()) return false;
  if (filters.hasOffer && !(contact.comment ?? '').trim()) return false;

  // «Заглушённые» только добавляет ограничение, но никогда никого не прячет
  // молча: выключенный фильтр показывает всех, включая заглушённых.
  if (filters.muted && !contact.muted) return false;

  if (filters.period > 0) {
    const date = (contact.first_contact_date ?? '').slice(0, 10);
    if (!date) return false;
    if (daysBetween(today, date) > filters.period) return false;
  }

  if (filters.needsTouch || filters.cold) {
    const state = followUpState({
      status,
      lastTouchAt: contact.last_touch_at,
      touchCount: contact.touch_count ?? 1,
      muted: Boolean(contact.muted),
      today,
    });

    if (filters.needsTouch && !needsTouch(state)) return false;
    if (filters.cold && state.urgency !== 'cold') return false;
  }

  return true;
}

function statusRank(status: ContactStatus): number {
  const index = CONTACT_STATUSES.indexOf(status);
  return index < 0 ? CONTACT_STATUSES.length : index;
}

/** Сортировка списка. Стабильна: одинаковые элементы не прыгают между рендерами. */
export function sortContacts(
  contacts: OutreachContact[],
  mode: SortMode,
  today: string,
): OutreachContact[] {
  const rows = [...contacts];

  const stateOf = (contact: OutreachContact) =>
    followUpState({
      status: normalizeStatus(contact.status),
      lastTouchAt: contact.last_touch_at,
      touchCount: contact.touch_count ?? 1,
      muted: Boolean(contact.muted),
      today,
    });

  switch (mode) {
    case 'name':
      return rows.sort((a, b) => a.name.localeCompare(b.name));
    case 'status':
      return rows.sort(
        (a, b) =>
          statusRank(normalizeStatus(a.status)) - statusRank(normalizeStatus(b.status)) ||
          a.name.localeCompare(b.name),
      );
    case 'touch':
      return rows.sort(
        (a, b) => compareUrgency(stateOf(a), stateOf(b)) || a.name.localeCompare(b.name),
      );
    case 'old':
      return rows.sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));
    case 'new':
    default:
      return rows.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  }
}

/** Поиск + фильтры + сортировка одной функцией. */
export function applyOutreachFilters(input: {
  contacts: OutreachContact[];
  query: string;
  filters: OutreachFilters;
  today: string;
}): OutreachContact[] {
  const { contacts, query, filters, today } = input;
  const matched = contacts.filter(
    (contact) => matchesQuery(contact, query) && matchesFilters(contact, filters, today),
  );
  return sortContacts(matched, filters.sort, today);
}

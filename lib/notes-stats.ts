import { daysBetween, getLogicalDate, shiftDate } from '@/lib/date';
import type { Note, NoteTag } from '@/lib/types';

/**
 * Геймификация заметок.
 *
 * Заметки — единственный раздел, которым легко перестать пользоваться:
 * записал мысль, она провалилась в список и больше никогда не всплыла.
 * Отсюда три механики: цепочка дней (её жалко рвать), счётчики (видно, что
 * накоплено) и воскрешение старой записи (то, ради чего вообще пишут).
 *
 * XP здесь символический и один раз в сутки: заметка это не результат, и
 * набивать ей уровень вместо рассылок не должно быть выгодно.
 */

/** Логическая дата создания заметки — тот же день, что и у всего остального. */
export function noteDate(note: Pick<Note, 'created_at'>): string {
  return getLogicalDate(new Date(note.created_at));
}

/** Есть ли уже заметка за сегодня. */
export function hasNoteToday(notes: Note[], today: string): boolean {
  return notes.some((note) => noteDate(note) === today);
}

/**
 * Цепочка дней подряд с хотя бы одной заметкой.
 *
 * Сегодняшний день, если он пустой, цепочку не рвёт — она просто не включает
 * сегодня. Иначе счётчик обнулялся бы каждое утро и перестал что-либо значить.
 */
export function noteStreak(notes: Note[], today: string): number {
  const days = new Set(notes.map(noteDate));

  let cursor = days.has(today) ? today : shiftDate(today, -1);
  let streak = 0;

  while (days.has(cursor)) {
    streak += 1;
    cursor = shiftDate(cursor, -1);
  }

  return streak;
}

/** Сколько заметок каждого типа. */
export function countByTag(notes: Note[]): Record<NoteTag, number> {
  const counts = { idea: 0, goal: 0, insight: 0, thought: 0 } as Record<NoteTag, number>;
  for (const note of notes) {
    if (note.tag in counts) counts[note.tag] += 1;
  }
  return counts;
}

/** Насколько заметка должна быть старой, чтобы её стоило показать заново. */
export const RESURFACE_MIN_AGE = 7;

/**
 * Стабильный псевдослучайный индекс по строке.
 *
 * Нужен, чтобы «мысль из прошлого» не менялась при каждом рендере: в течение
 * дня она одна и та же, а завтра сама сменится.
 */
function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export type Resurfaced = { note: Note; daysAgo: number };

/** Старая запись, которую стоит перечитать сегодня. */
export function resurface(notes: Note[], today: string): Resurfaced | null {
  const candidates = notes
    .filter((note) => daysBetween(today, noteDate(note)) >= RESURFACE_MIN_AGE)
    .sort((a, b) => a.id.localeCompare(b.id));

  if (candidates.length === 0) return null;

  const note = candidates[hash(today) % candidates.length];
  return { note, daysAgo: daysBetween(today, noteDate(note)) };
}

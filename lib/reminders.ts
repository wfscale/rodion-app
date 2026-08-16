import { format } from 'date-fns';
import type { Reminder } from '@/lib/types';

/**
 * Напоминания.
 *
 * Время хранится строкой 'YYYY-MM-DDTHH:mm' без таймзоны — намеренно.
 * Напоминание «позвонить в 14:00» должно сработать в 14:00 по тем часам,
 * на которые человек смотрит, а не по UTC и не по часовому поясу сервера.
 * Строки в этом формате сравниваются лексикографически ровно как даты,
 * поэтому вся логика ниже обходится без Date вообще.
 */

export type ReminderUrgency = 'overdue' | 'due' | 'today' | 'upcoming' | 'done';

/** Текущий момент в том же формате, в котором хранится due_at. */
export function nowLocal(now: Date = new Date()): string {
  return format(now, "yyyy-MM-dd'T'HH:mm");
}

/** Дата напоминания без времени. */
export function reminderDate(dueAt: string): string {
  return (dueAt ?? '').slice(0, 10);
}

/** Время напоминания без даты. */
export function reminderTime(dueAt: string): string {
  return (dueAt ?? '').slice(11, 16);
}

/** Собрать due_at из полей формы. Пустое время означает «утром». */
export function composeDueAt(date: string, time: string): string {
  return `${date}T${(time || '09:00').slice(0, 5)}`;
}

/**
 * Состояние напоминания.
 *
 * 'due' — время пришло сегодня; такое напоминание висит весь день, а не
 * мигает секунду. 'overdue' — время пришло вчера или раньше и его так и не
 * закрыли: это уже долг, и выглядеть он должен иначе.
 */
export function urgencyOf(
  reminder: Pick<Reminder, 'due_at' | 'done'>,
  now: string,
  today: string = now.slice(0, 10),
): ReminderUrgency {
  if (reminder.done) return 'done';

  const date = reminderDate(reminder.due_at);

  if (date < today) return 'overdue';
  if (reminder.due_at <= now) return 'due';
  if (date === today) return 'today';
  return 'upcoming';
}

/** Пора ли показывать напоминание как активное. */
export function isActive(urgency: ReminderUrgency): boolean {
  return urgency === 'due' || urgency === 'overdue';
}

const RANK: Record<ReminderUrgency, number> = {
  overdue: 0,
  due: 1,
  today: 2,
  upcoming: 3,
  done: 4,
};

/** Порядок списка: сначала долги, потом сегодняшнее, потом будущее. */
export function compareReminders(
  a: Reminder,
  b: Reminder,
  now: string,
  today: string = now.slice(0, 10),
): number {
  const byRank = RANK[urgencyOf(a, now, today)] - RANK[urgencyOf(b, now, today)];
  if (byRank !== 0) return byRank;
  return a.due_at.localeCompare(b.due_at);
}

export type ReminderGroups = {
  /** Пора: сработавшие сегодня и просроченные. */
  active: Reminder[];
  /** Сегодня, но время ещё не пришло. */
  today: Reminder[];
  /** Дальше по календарю. */
  upcoming: Reminder[];
  /** Закрытые. */
  done: Reminder[];
};

export function groupReminders(
  list: Reminder[],
  now: string,
  today: string = now.slice(0, 10),
): ReminderGroups {
  const groups: ReminderGroups = { active: [], today: [], upcoming: [], done: [] };

  for (const reminder of list) {
    const urgency = urgencyOf(reminder, now, today);
    if (urgency === 'done') groups.done.push(reminder);
    else if (isActive(urgency)) groups.active.push(reminder);
    else if (urgency === 'today') groups.today.push(reminder);
    else groups.upcoming.push(reminder);
  }

  const sort = (rows: Reminder[]) => rows.sort((a, b) => compareReminders(a, b, now, today));
  sort(groups.active);
  sort(groups.today);
  sort(groups.upcoming);
  groups.done.sort((a, b) => b.due_at.localeCompare(a.due_at));

  return groups;
}

/**
 * Напоминания, привязанные к контакту, — для блока касаний на странице
 * рассылок. Общие задачи туда не попадают: рабочий список дня должен
 * состоять из людей, иначе он превращается в свалку.
 */
export function forContacts(list: Reminder[]): Reminder[] {
  return list.filter((reminder) => reminder.contact_id !== null && !reminder.done);
}

/** Общие напоминания — только вкладка «Напоминания». */
export function standalone(list: Reminder[]): Reminder[] {
  return list.filter((reminder) => reminder.contact_id === null);
}

/** Сколько напоминаний требуют внимания прямо сейчас. */
export function activeCount(list: Reminder[], now: string): number {
  const today = now.slice(0, 10);
  return list.filter((reminder) => isActive(urgencyOf(reminder, now, today))).length;
}

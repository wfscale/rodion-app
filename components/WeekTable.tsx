'use client';

import { Check, Minus, X } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import type { Dict } from '@/lib/i18n';
import type { DailyLog } from '@/lib/types';

type HabitRow = {
  key: keyof Dict['progress']['habits'];
  /** Выполнена ли привычка в этот день. */
  test: (log: DailyLog) => boolean;
};

const ROWS: HabitRow[] = [
  { key: 'shower', test: (log) => Boolean(log.checklist?.cold_shower) },
  { key: 'walk', test: (log) => Boolean(log.checklist?.walk) },
  { key: 'outreach', test: (log) => Boolean(log.checklist?.outreach) },
  { key: 'noSugar', test: (log) => Boolean(log.checklist?.no_sugar) },
  {
    key: 'discipline',
    test: (log) => Boolean(log.checklist?.no_porn) && Boolean(log.checklist?.no_mb),
  },
  { key: 'sleep', test: (log) => Boolean(log.checklist?.sleep_early) },
  { key: 'full', test: (log) => (log.completion_pct ?? 0) >= 100 },
];

const DAY_LABELS = {
  ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  en: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
} as const;

type WeekTableProps = {
  /** Семь ISO-дат недели: Пн..Вс. */
  dates: string[];
  logs: DailyLog[];
  today: string;
};

/** Трекер привычек: строки — привычки, столбцы — дни недели. */
export function WeekTable({ dates, logs, today }: WeekTableProps) {
  const { t, lang } = useLanguage();
  const byDate = new Map(logs.map((log) => [log.date, log]));

  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="w-[38%] px-1 pb-2 text-left" />
            {dates.map((date, i) => {
              const isToday = date === today;
              return (
                <th
                  key={date}
                  className={`px-0.5 pb-2 text-center text-xs font-bold ${
                    isToday ? 'text-white' : 'text-white/30'
                  }`}
                >
                  {DAY_LABELS[lang][i]}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {ROWS.map((row) => (
            <tr key={row.key} className="border-t border-divider">
              <td className="py-2 pr-2 text-sm leading-tight text-white/65">
                {t.progress.habits[row.key]}
              </td>

              {dates.map((date) => {
                const log = byDate.get(date);
                const future = date > today;
                const ok = log ? row.test(log) : false;

                return (
                  <td key={date} className="px-0.5 py-2 text-center align-middle">
                    <span className="inline-flex h-6 w-6 items-center justify-center">
                      {future ? (
                        <Minus size={13} className="text-white/15" />
                      ) : ok ? (
                        <Check size={16} strokeWidth={3} className="text-success" />
                      ) : (
                        <X size={14} strokeWidth={2.5} className="text-white/20" />
                      )}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

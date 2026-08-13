'use client';

import { Check } from 'lucide-react';
import { GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import type { Dict } from '@/lib/i18n';

/**
 * Шесть базовых привычек. id пишутся в jsonb-поле checklist — менять их
 * нельзя, от них зависят все прошлые записи дня.
 */
export const HABITS: { id: string; labelKey: keyof Dict['habits'] }[] = [
  { id: 'water', labelKey: 'water' },
  { id: 'pushups', labelKey: 'pushups' },
  { id: 'cold_shower', labelKey: 'coldShower' },
  { id: 'walk', labelKey: 'walk' },
  { id: 'd3', labelKey: 'd3' },
  { id: 'no_reels', labelKey: 'noReels' },
];

type HabitsBlockProps = {
  /** Отметки за сегодня: id привычки → выполнена. */
  done: Record<string, boolean>;
  onToggle: (id: string) => void;
};

/**
 * Привычки — намеренно скромный блок внизу экрана.
 *
 * Ни анимаций, ни вылетающих XP, ни смайликов: тап — чекбокс заполнился,
 * и всё. Это принципиально. Раньше человек делал холодный душ, получал
 * 83% дня и чувствовал себя молодцом, не сделав ни одной рассылки.
 * Блок не должен соревноваться со счётчиком рассылок за внимание.
 */
export function HabitsBlock({ done, onToggle }: HabitsBlockProps) {
  const { t } = useLanguage();

  return (
    <div>
      <p className="mb-2 px-1 text-xs italic text-white/30">{t.home.habitsTitle}</p>

      <GlassCard className="p-2">
        <ul>
          {HABITS.map((habit) => {
            const checked = Boolean(done[habit.id]);

            return (
              <li key={habit.id}>
                <button
                  type="button"
                  onClick={() => onToggle(habit.id)}
                  aria-pressed={checked}
                  className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-2 text-left"
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border ${
                      checked ? 'border-white bg-white text-ink' : 'border-white/25'
                    }`}
                  >
                    {checked && <Check size={14} strokeWidth={3} />}
                  </span>

                  <span className="min-w-0 flex-1 text-sm leading-snug text-white/70">
                    {t.habits[habit.labelKey]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </GlassCard>
    </div>
  );
}

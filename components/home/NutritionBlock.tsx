'use client';

import { Utensils } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ChecklistItem } from '@/components/ChecklistItem';
import { useLanguage } from '@/components/LanguageProvider';
import { Label } from '@/components/ui';
import { useDebouncedCallback } from '@/hooks/useDebounced';
import { toTimeInput } from '@/lib/date';
import type { DailyLog } from '@/lib/types';
import { XP } from '@/lib/xp';

type NutritionBlockProps = {
  log: DailyLog;
  onSaveMeals: (
    input: Partial<
      Pick<DailyLog, 'meal_1_time' | 'meal_1_note' | 'meal_2_time' | 'meal_2_note'>
    >,
  ) => Promise<void>;
  onToggleFasting: () => Promise<void>;
};

/** Секция питания внутри чеклиста: два приёма пищи + окно голодания. */
export function NutritionBlock({ log, onSaveMeals, onToggleFasting }: NutritionBlockProps) {
  const { t } = useLanguage();

  const [meal1Time, setMeal1Time] = useState(toTimeInput(log.meal_1_time));
  const [meal1Note, setMeal1Note] = useState(log.meal_1_note ?? '');
  const [meal2Time, setMeal2Time] = useState(toTimeInput(log.meal_2_time));
  const [meal2Note, setMeal2Note] = useState(log.meal_2_note ?? '');

  useEffect(() => {
    setMeal1Time(toTimeInput(log.meal_1_time));
    setMeal1Note(log.meal_1_note ?? '');
    setMeal2Time(toTimeInput(log.meal_2_time));
    setMeal2Note(log.meal_2_note ?? '');
  }, [log.meal_1_time, log.meal_1_note, log.meal_2_time, log.meal_2_note]);

  const save = useDebouncedCallback(
    (patch: Parameters<typeof onSaveMeals>[0]) => onSaveMeals(patch),
    600,
  );

  return (
    <div className="mt-5 border-t border-divider pt-4">
      <div className="mb-3 flex items-center gap-2">
        <Utensils size={15} className="text-white/35" />
        <p className="section-label">{t.home.nutritionTitle}</p>
      </div>

      <div className="space-y-3">
        {/* Первый приём */}
        <div>
          <Label>{t.home.meal1}</Label>
          <div className="flex gap-2">
            <input
              type="time"
              value={meal1Time}
              onChange={(e) => {
                setMeal1Time(e.target.value);
                save({ meal_1_time: e.target.value || null });
              }}
              className="field w-[112px] shrink-0"
              aria-label={t.home.meal1}
            />
            <input
              type="text"
              value={meal1Note}
              onChange={(e) => {
                setMeal1Note(e.target.value);
                save({ meal_1_note: e.target.value || null });
              }}
              placeholder={t.home.mealNotePh}
              className="field min-w-0 flex-1"
            />
          </div>
        </div>

        {/* Второй приём */}
        <div>
          <Label>{t.home.meal2}</Label>
          <div className="flex gap-2">
            <input
              type="time"
              value={meal2Time}
              onChange={(e) => {
                setMeal2Time(e.target.value);
                save({ meal_2_time: e.target.value || null });
              }}
              className="field w-[112px] shrink-0"
              aria-label={t.home.meal2}
            />
            <input
              type="text"
              value={meal2Note}
              onChange={(e) => {
                setMeal2Note(e.target.value);
                save({ meal_2_note: e.target.value || null });
              }}
              placeholder={t.home.mealNotePh}
              className="field min-w-0 flex-1"
            />
          </div>
        </div>
      </div>

      <div className="mt-2">
        <ChecklistItem
          title={t.home.fasting}
          done={Boolean(log.fasting_ok)}
          onToggle={() => void onToggleFasting()}
          xp={XP.FASTING}
        />
      </div>
    </div>
  );
}

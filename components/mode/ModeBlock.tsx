'use client';

import { GlassCard, CardTitle } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { Badge } from '@/components/ui';
import { MODE_KEYS, isModeActive, modeStageKey, type ModeCounters } from '@/lib/mode';

type ModeBlockProps = {
  counters: ModeCounters;
};

/**
 * Три счётчика воздержания: порно, мастурбация, сладкое.
 *
 * Кнопок сброса здесь нет и быть не должно. Счётчик двигает только вечерний
 * чекин: «да» — плюс день, «нет» — ноль. Кнопка под рукой превращала бы срыв
 * в один безболезненный тап, и цифра перестала бы что-либо значить.
 */
export function ModeBlock({ counters }: ModeBlockProps) {
  const { t, days } = useLanguage();

  const active = isModeActive(counters);

  return (
    <div>
      {/* Бейдж живёт над карточкой — это статус всего блока, а не строки */}
      {active && (
        <div className="mb-2 flex">
          <Badge tone="active">{t.mode.active}</Badge>
        </div>
      )}

      <GlassCard>
        <CardTitle>{t.mode.title}</CardTitle>

        <div className="divide-y divide-divider">
          {MODE_KEYS.map((key) => {
            const value = counters[key];
            return (
              <div key={key} className="flex items-start gap-4 py-3 first:pt-0 last:pb-0">
                <div className="w-[64px] shrink-0 text-right">
                  <span className="block text-3xl font-extrabold leading-none tabular-nums">
                    {value}
                  </span>
                  <span className="mt-1 block text-xs text-white/30">{days(value)}</span>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold leading-snug">{t.mode[key]}</p>
                  <p className="mt-1 text-sm leading-snug text-muted">
                    {t.mode.stages[modeStageKey(value)]}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}

'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { GlassCard, CardTitle } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { Badge, Button } from '@/components/ui';
import {
  MODE_KEYS,
  isModeActive,
  modeStageKey,
  type ModeCounters,
  type ModeKey,
} from '@/lib/mode';

type ModeBlockProps = {
  counters: ModeCounters;
  /** Отметить срыв: счётчик этого пункта уходит в ноль, остальные растут дальше. */
  onBreak: (key: ModeKey) => void;
};

/**
 * Шесть счётчиков воздержания.
 *
 * Сетка 2×3, а не список из шести строк. Строка со стадией и числом занимает
 * ~68px, шесть таких — 400px сплошного текста, и блок фона начинает
 * перевешивать всё остальное на экране. В плитке остаётся то, ради чего сюда
 * смотрят: число и что именно держится.
 *
 * Тап по плитке отмечает срыв, но только через подтверждение: серия в сорок
 * дней не должна умирать от одного случайного касания.
 */
export function ModeBlock({ counters, onBreak }: ModeBlockProps) {
  const { t, days } = useLanguage();

  const [pending, setPending] = useState<ModeKey | null>(null);

  const active = isModeActive(counters);

  /*
   * Стадия одна на весь блок и считается по самому слабому счётчику.
   *
   * Пока держатся все шесть, они растут синхронно — шесть одинаковых фраз под
   * шестью числами были бы просто шумом. А режим в целом ровно там, где его
   * отстающий пункт: по нему же считается и бейдж.
   */
  const weakest = Math.min(...MODE_KEYS.map((key) => counters[key]));

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

        <div className="grid grid-cols-2 gap-2">
          {MODE_KEYS.map((key) => {
            const value = counters[key];
            const selected = pending === key;

            return (
              <motion.button
                key={key}
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => setPending(selected ? null : key)}
                aria-pressed={selected}
                className={`flex min-h-[76px] flex-col justify-between rounded-2xl border p-3 text-left transition-colors ${
                  selected
                    ? 'border-[rgba(255,107,107,0.45)] bg-[rgba(255,107,107,0.08)]'
                    : 'border-glass-border bg-white/[0.05] hover:bg-white/[0.08]'
                }`}
              >
                <span className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-extrabold leading-none tabular-nums">
                    {value}
                  </span>
                  <span className="text-xs text-white/30">{days(value)}</span>
                </span>

                <span className="mt-2 block text-sm font-bold leading-snug">{t.mode[key]}</span>
              </motion.button>
            );
          })}
        </div>

        <p className="mt-3 text-sm leading-snug text-muted">
          {t.mode.stages[modeStageKey(weakest)]}
        </p>

        {/* Подтверждение занимает место подписи: она объясняет тап, а тап уже
            сделан — держать обе строки значило бы двигать карточку вниз. */}
        <AnimatePresence initial={false} mode="wait">
          {pending ? (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="mt-3"
            >
              {/* Название пункта повторяется текстом: подсветки плитки мало,
                  когда цена ошибки — потерянная серия. */}
              <p className="text-sm font-bold">{t.mode[pending]}</p>
              <p className="mt-0.5 text-sm text-danger">{t.mode.brokeConfirm}</p>

              <div className="mt-2 flex gap-2">
                <Button
                  variant="danger"
                  className="flex-1"
                  onClick={() => {
                    onBreak(pending);
                    setPending(null);
                  }}
                >
                  {t.mode.broke}
                </Button>
                <Button variant="ghost" className="flex-1" onClick={() => setPending(null)}>
                  {t.common.cancel}
                </Button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </GlassCard>
    </div>
  );
}

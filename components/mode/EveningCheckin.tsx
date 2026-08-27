'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { useLanguage } from '@/components/LanguageProvider';
import { Button } from '@/components/ui';
import { MODE_KEYS, type ModeKey } from '@/lib/mode';

type EveningCheckinProps = {
  open: boolean;
  onClose: () => void;
  /** Только сорванные пункты. Пустой массив — всё держится. */
  onSubmit: (broken: ModeKey[]) => void;
};

/**
 * «Что сорвалось?» — единственный вопрос, который приложение имеет право
 * задать про режим.
 *
 * Раньше спрашивали по каждому пункту «держался? да / нет», и ответить надо
 * было по всем: пропустил вечер — счётчики замерли. Теперь дни идут сами,
 * а форма собирает только срывы. Ничего не отметил и закрыл — значит всё
 * держится, и это не «пропуск», а полноценный ответ.
 */
export function EveningCheckin({ open, onClose, onSubmit }: EveningCheckinProps) {
  const { t } = useLanguage();

  const [broken, setBroken] = useState<ModeKey[]>([]);

  // Каждое открытие — чистая форма: вчерашние срывы к сегодняшнему вечеру
  // отношения не имеют.
  useEffect(() => {
    if (open) setBroken([]);
  }, [open]);

  function toggle(key: ModeKey) {
    setBroken((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function submit() {
    onSubmit(broken);
    onClose();
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t.mode.checkinTitle}
      footer={
        // Кнопка активна всегда: пустой список — это ответ «всё держится»,
        // а не незаполненная форма.
        <Button full onClick={submit}>
          {t.common.done}
        </Button>
      }
    >
      <p className="text-sm leading-relaxed text-muted">{t.mode.checkinHint}</p>

      <div className="mt-2 divide-y divide-divider">
        {MODE_KEYS.map((key) => {
          const marked = broken.includes(key);

          return (
            <motion.button
              key={key}
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => toggle(key)}
              aria-pressed={marked}
              className="flex min-h-[56px] w-full items-center justify-between gap-3 py-2 text-left"
            >
              <span
                className={`min-w-0 flex-1 text-base font-semibold transition-colors ${
                  marked ? 'text-danger' : ''
                }`}
              >
                {t.mode[key]}
              </span>

              {/* Метка со словом, а не пустой кружок: галочка в списке срывов
                  читается как «сделано», то есть наоборот. */}
              <span
                className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-bold transition-colors ${
                  marked
                    ? 'border-[rgba(255,107,107,0.45)] bg-[rgba(255,107,107,0.14)] text-danger'
                    : 'border-glass-border text-white/35'
                }`}
              >
                {t.mode.brokeShort}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Итог строкой — чтобы закрыть форму пустой было решением, а не
          сомнением «а сохранилось ли вообще что-нибудь». */}
      <AnimatePresence initial={false} mode="wait">
        <motion.p
          key={broken.length === 0 ? 'held' : 'broke'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={`mt-4 text-sm ${broken.length === 0 ? 'text-white/35' : 'text-muted'}`}
        >
          {broken.length === 0 ? t.mode.heldAll : t.mode.reset}
        </motion.p>
      </AnimatePresence>
    </BottomSheet>
  );
}

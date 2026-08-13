'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { useLanguage } from '@/components/LanguageProvider';
import { Button } from '@/components/ui';
import { MODE_KEYS, type ModeKey } from '@/lib/mode';

type EveningCheckinProps = {
  open: boolean;
  /** Чекин за сегодня уже пройден — форму показывать нельзя. */
  done: boolean;
  onClose: () => void;
  onSubmit: (held: { porn: boolean; mb: boolean; sugar: boolean }) => void;
};

type Answers = Record<ModeKey, boolean | null>;

const EMPTY: Answers = { porn: null, mb: null, sugar: null };

/**
 * Вечерний чекин — единственная точка, где двигаются счётчики режима.
 *
 * Отвечать нужно по всем трём пунктам: частичный ответ оставил бы счётчик
 * в подвешенном состоянии, а «пропустил» и «сорвался» — разные вещи.
 */
export function EveningCheckin({ open, done, onClose, onSubmit }: EveningCheckinProps) {
  const { t } = useLanguage();

  const [answers, setAnswers] = useState<Answers>(EMPTY);

  // Каждое открытие — чистая форма: вчерашние ответы к сегодняшнему вечеру
  // отношения не имеют.
  useEffect(() => {
    if (open) setAnswers(EMPTY);
  }, [open]);

  const complete = MODE_KEYS.every((key) => answers[key] !== null);

  function submit() {
    if (!complete) return;
    onSubmit({
      porn: answers.porn === true,
      mb: answers.mb === true,
      sugar: answers.sugar === true,
    });
    onClose();
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t.mode.checkinTitle}
      footer={
        done ? undefined : (
          <Button full onClick={submit} disabled={!complete}>
            {t.common.done}
          </Button>
        )
      }
    >
      {done ? (
        <p className="py-6 text-center text-base text-muted">{t.mode.doneToday}</p>
      ) : (
        <div className="space-y-4">
          {MODE_KEYS.map((key) => {
            const answer = answers[key];
            return (
              <div key={key} className="border-b border-divider pb-4 last:border-b-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 flex-1 text-base font-semibold">{t.mode[key]}</span>

                  <div className="flex shrink-0 gap-2">
                    {[true, false].map((value) => {
                      const selected = answer === value;
                      return (
                        <motion.button
                          key={String(value)}
                          type="button"
                          whileTap={{ scale: 0.94 }}
                          onClick={() => setAnswers((prev) => ({ ...prev, [key]: value }))}
                          aria-pressed={selected}
                          className={`min-h-[44px] min-w-[64px] rounded-full border px-4 text-sm font-bold transition-colors ${
                            selected
                              ? 'border-white bg-white text-ink'
                              : 'border-glass-border bg-white/[0.05] text-white/55 hover:bg-white/10'
                          }`}
                        >
                          {value ? t.mode.yes : t.mode.no}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Срыв не прячем и не смягчаем — но и не наказываем текстом */}
                {answer === false && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mt-2 text-sm text-muted"
                  >
                    {t.mode.reset}
                  </motion.p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </BottomSheet>
  );
}

'use client';

import { motion } from 'framer-motion';
import { Timer, Trophy } from 'lucide-react';
import { useState } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { useLanguage } from '@/components/LanguageProvider';
import { SPRINT_OPTIONS } from '@/lib/session';
// Длительность форматирует тот же код, что и время задач: «1 ч 30 мин» в
// рекорде и в бюджете дня обязаны выглядеть одинаково.
import { formatMinutes } from '@/lib/tasktime';

type SprintPickerProps = {
  /** Рекорд: сколько рассылок за один заход. 0 — рекорда ещё нет. */
  recordCount: number;
  /** За сколько минут он поставлен. Без длительности число ничего не значит. */
  recordMinutes: number;
  onStart: (minutes: number) => void;
  /** Заход уже идёт — второй запускать нечем. */
  running?: boolean;
  className?: string;
};

/**
 * Кнопка «Спринт» и выбор длительности.
 *
 * Кнопка маленькая намеренно: на странице рассылок главное — сама рассылка,
 * а таймер это инструмент, за которым приходят сами. Кнопка размером с
 * действие оттягивала бы на себя то внимание, ради которого сюда зашли.
 *
 * Внутри — ровно один экран и один жест: тапнул по длительности, заход
 * пошёл. Отдельной кнопки «Запустить» нет: между решением и стартом не
 * должно быть ни одного лишнего шага, иначе в плохой день до него не
 * доходят.
 */
export function SprintPicker({
  recordCount,
  recordMinutes,
  onStart,
  running = false,
  className = '',
}: SprintPickerProps) {
  const { t, tf } = useLanguage();
  const [open, setOpen] = useState(false);

  function pick(minutes: number) {
    setOpen(false);
    onStart(minutes);
  }

  return (
    <>
      <motion.button
        type="button"
        whileTap={{ scale: 0.96 }}
        onClick={() => setOpen(true)}
        disabled={running}
        aria-label={t.time.sprintStart}
        className={`btn-ghost h-11 shrink-0 px-3 text-sm font-semibold ${className}`}
      >
        <Timer size={16} className="text-white/60" />
        {t.time.sprint}
      </motion.button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={t.time.sprintPick}>
        <p className="text-sm leading-snug text-muted">{t.time.sprintHint}</p>

        {/*
          Рекорд стоит выше кнопок, а не ниже: это последнее, что человек
          видит перед выбором длительности, и именно он делает выбор
          осмысленным — под рекорд в двенадцать за сорок пять минут берут
          сорок пять минут, а не пятнадцать.

          Если рекорда нет, здесь пусто. Заглушка «рекорда пока нет» ничего
          не сообщает и портит первый заход тем, что он якобы уже отстаёт.
        */}
        {recordCount > 0 && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white/[0.05] px-3 py-2.5">
            <Trophy size={14} className="shrink-0 text-white/40" />
            <p className="truncate text-sm font-semibold text-white/75">
              {tf(t.time.sprintRecord, {
                n: recordCount,
                t: formatMinutes(recordMinutes, t),
              })}
            </p>
          </div>
        )}

        <div className="mt-4 grid grid-cols-5 gap-2">
          {SPRINT_OPTIONS.map((minutes) => (
            <motion.button
              key={minutes}
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => pick(minutes)}
              className="flex min-h-[60px] flex-col items-center justify-center rounded-2xl border border-glass-border bg-white/[0.05] transition-colors hover:bg-white/10"
            >
              <span className="text-lg font-extrabold leading-none tabular-nums">{minutes}</span>
              <span className="mt-1 text-[10px] leading-none text-white/40">{t.time.minutes}</span>
            </motion.button>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}

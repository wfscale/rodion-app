'use client';

import { motion } from 'framer-motion';
import { Check, Circle, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { XpBadge } from '@/components/XpBadge';

type ChecklistItemProps = {
  title: string;
  done: boolean;
  onToggle: () => void;
  /** Сколько XP даёт задача — показывается в вылетающем badge. */
  xp?: number;
  /** Красная точка слева — задачи блока дисциплины. */
  discipline?: boolean;
  /** Кастомные задачи можно удалить, фиксированные — нет. */
  onDelete?: () => void;
  deleteLabel?: string;
};

/**
 * Строка чеклиста — главный UX-момент приложения.
 *
 * При отметке одновременно происходит:
 *   1. линия перечёркивает текст слева направо за 300 мс;
 *   2. текст уходит в opacity 0.4;
 *   3. кружок слева превращается в галочку;
 *   4. вылетает «+N XP».
 *
 * Нюанс: нарисованная линия корректна только для одной строки текста.
 * Поэтому после окончания анимации она заменяется на настоящий line-through —
 * длинные задачи, переносящиеся на две строки, зачёркиваются правильно.
 */
export function ChecklistItem({
  title,
  done,
  onToggle,
  xp = 10,
  discipline = false,
  onDelete,
  deleteLabel,
}: ChecklistItemProps) {
  const [strikeSettled, setStrikeSettled] = useState(done);
  const [xpEvent, setXpEvent] = useState<{ id: number; amount: number } | null>(null);
  const previousDone = useRef(done);

  useEffect(() => {
    if (previousDone.current === done) return;

    if (done) {
      // XP начисляется только при отметке, не при снятии.
      const id = Date.now();
      setXpEvent({ id, amount: xp });
      const timer = setTimeout(() => setXpEvent(null), 800);
      previousDone.current = done;
      return () => clearTimeout(timer);
    }

    setStrikeSettled(false);
    previousDone.current = done;
  }, [done, xp]);

  return (
    <div className="relative">
      <XpBadge event={xpEvent} className="left-11 top-1" />

      <div className="flex items-center gap-1">
        <motion.button
          type="button"
          onClick={onToggle}
          whileTap={{ scale: 0.96 }}
          aria-pressed={done}
          className="flex min-h-[48px] flex-1 items-center gap-3 rounded-xl px-1 text-left transition-colors hover:bg-white/[0.03]"
        >
          {/* Красная точка — маркер блока «быстрый дофамин» */}
          {discipline && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger"
              aria-hidden="true"
            />
          )}

          {/* Кружок → галочка */}
          <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
            <motion.span
              initial={false}
              animate={{ opacity: done ? 0 : 1, scale: done ? 0.6 : 1 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 flex items-center justify-center text-white/35"
            >
              <Circle size={22} strokeWidth={1.5} />
            </motion.span>
            <motion.span
              initial={false}
              animate={{ opacity: done ? 1 : 0, scale: done ? 1 : 0.5 }}
              transition={{ type: 'spring', stiffness: 500, damping: 22 }}
              className="absolute inset-0 flex items-center justify-center text-white"
            >
              <Check size={22} strokeWidth={2.5} />
            </motion.span>
          </span>

          {/* Текст + рисуемая линия */}
          <span className="relative min-w-0 flex-1 py-1">
            <motion.span
              initial={false}
              animate={{ opacity: done ? 0.4 : 1 }}
              transition={{ duration: 0.3 }}
              className={`block text-base leading-snug ${
                strikeSettled && done ? 'line-through decoration-white/70' : ''
              }`}
            >
              {title}
            </motion.span>

            {!strikeSettled && (
              <motion.span
                aria-hidden="true"
                initial={false}
                animate={{ scaleX: done ? 1 : 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                onAnimationComplete={() => {
                  if (done) setStrikeSettled(true);
                }}
                style={{ originX: 0 }}
                className="absolute left-0 right-0 top-1/2 h-[1.5px] -translate-y-1/2 rounded-full bg-white/70"
              />
            )}
          </span>
        </motion.button>

        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            aria-label={deleteLabel}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/25 transition-colors hover:bg-white/10 hover:text-danger"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

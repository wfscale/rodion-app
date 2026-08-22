'use client';

import { motion } from 'framer-motion';
import { Check, Circle, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

/* -------------------------------------------------------------------------- */
/*  Отметка                                                                    */
/* -------------------------------------------------------------------------- */

/** Кружок, превращающийся в галочку. Тот же жест, что в чеклисте дня. */
export function CheckMark({ done }: { done: boolean }) {
  return (
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
  );
}

/**
 * Текст, который перечёркивается при отметке.
 *
 * Линия рисуется слева направо за 300 мс, а после анимации заменяется
 * настоящим line-through: нарисованная линия верна только для одной строки,
 * и длинная задача в два ряда зачёркивалась бы неправильно.
 */
export function StrikeText({ done, children }: { done: boolean; children: ReactNode }) {
  const [settled, setSettled] = useState(done);
  const previousDone = useRef(done);

  useEffect(() => {
    if (previousDone.current === done) return;
    if (!done) setSettled(false);
    previousDone.current = done;
  }, [done]);

  return (
    <span className="relative block">
      <motion.span
        initial={false}
        animate={{ opacity: done ? 0.4 : 1 }}
        transition={{ duration: 0.3 }}
        className={`block break-words text-base leading-snug ${
          settled && done ? 'line-through decoration-white/70' : ''
        }`}
      >
        {children}
      </motion.span>

      {!settled && (
        <motion.span
          aria-hidden="true"
          initial={false}
          animate={{ scaleX: done ? 1 : 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          onAnimationComplete={() => {
            if (done) setSettled(true);
          }}
          style={{ originX: 0 }}
          className="absolute left-0 right-0 top-1/2 h-[1.5px] -translate-y-1/2 rounded-full bg-white/70"
        />
      )}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Добавление строки                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Поле «написал — добавил». Одинаково работает для своих этапов и для задач:
 * Enter и кнопка делают одно и то же, шторок на пути нет.
 */
export function AddRow({
  placeholder,
  addLabel,
  onAdd,
}: {
  placeholder: string;
  addLabel: string;
  onAdd: (text: string) => void;
}) {
  const [text, setText] = useState('');

  function submit() {
    const value = text.trim();
    if (!value) return;
    onAdd(value);
    setText('');
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        className="field min-w-0 flex-1"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!text.trim()}
        aria-label={addLabel}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-ink transition-opacity disabled:opacity-30"
      >
        <Plus size={20} />
      </button>
    </div>
  );
}

/** Крестик «убрать строку». Отдельная кнопка на 44px — иначе в неё не попасть. */
export function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/25 transition-colors hover:bg-white/10 hover:text-danger"
    >
      <X size={16} />
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Ошибка записи                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Полоса поверх раздела. Ошибка сохранения не теряется молча: данные — смысл
 * приложения, и «вроде сохранилось» здесь хуже, чем честное «не сохранилось».
 */
export function SaveError({
  message,
  closeLabel,
  onClose,
}: {
  message: string | null;
  closeLabel: string;
  onClose: () => void;
}) {
  if (!message) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-glass border border-[rgba(255,107,107,0.3)] bg-[rgba(255,107,107,0.08)] p-3">
      <p className="min-w-0 flex-1 text-sm leading-snug text-danger">{message}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/40 transition-colors hover:text-white"
      >
        <X size={18} />
      </button>
    </div>
  );
}

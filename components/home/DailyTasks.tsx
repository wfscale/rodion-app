'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, Circle, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { GlassCard, CardTitle } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import type { DailyTask } from '@/lib/types';

type DailyTasksProps = {
  tasks: DailyTask[];
  onAdd: (text: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
};

/**
 * Задачи дня — обычный органайзер под счётчиком рассылок.
 *
 * XP тут не начисляется намеренно: если бы список задач давал опыт, его
 * можно было бы «выполнить» вместо рассылок. Поэтому — никаких «+XP»,
 * только вычёркивание.
 */
export function DailyTasks({ tasks, onAdd, onToggle, onDelete }: DailyTasksProps) {
  const { t } = useLanguage();

  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    onAdd(trimmed);
    // Поле остаётся открытым: задачи обычно вносят пачкой.
    setText('');
    inputRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLFormElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      setText('');
      setAdding(false);
    }
  }

  return (
    <GlassCard className="p-4">
      <CardTitle>{t.home.tasksTitle}</CardTitle>

      {tasks.length > 0 && (
        <ul className="mb-1">
          <AnimatePresence initial={false}>
            {tasks.map((task) => (
              <motion.li
                key={task.id}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <TaskRow
                  task={task}
                  onToggle={() => onToggle(task.id)}
                  onDelete={() => onDelete(task.id)}
                  deleteLabel={t.common.delete}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {adding ? (
        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="flex gap-2">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => {
              // Пустое поле схлопываем — иначе висит открытым весь день.
              if (!text.trim()) setAdding(false);
            }}
            placeholder={t.home.taskPh}
            aria-label={t.home.taskPh}
            autoComplete="off"
            enterKeyHint="done"
            className="field"
          />
          <button
            type="submit"
            aria-label={t.common.add}
            disabled={text.trim().length === 0}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-ink disabled:opacity-30"
          >
            <Plus size={20} strokeWidth={2.6} />
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex min-h-[44px] w-full items-center rounded-xl px-1 text-left text-sm font-semibold text-white/40 transition-colors hover:text-white/70"
        >
          {t.home.addTask}
        </button>
      )}
    </GlassCard>
  );
}

/**
 * Строка задачи. Приём вычёркивания повторяет ChecklistItem: линия рисуется
 * слева направо за 300 мс, после чего заменяется настоящим line-through —
 * нарисованная линия верна только для одной строки текста, а задача может
 * перенестись на две.
 */
function TaskRow({
  task,
  onToggle,
  onDelete,
  deleteLabel,
}: {
  task: DailyTask;
  onToggle: () => void;
  onDelete: () => void;
  deleteLabel: string;
}) {
  const done = task.completed;
  const [strikeSettled, setStrikeSettled] = useState(done);

  // Сняли отметку — линию нужно снова рисовать, а не показывать готовой.
  useEffect(() => {
    if (!done) setStrikeSettled(false);
  }, [done]);

  return (
    <div className="flex items-center gap-1">
      <motion.button
        type="button"
        onClick={onToggle}
        whileTap={{ scale: 0.98 }}
        aria-pressed={done}
        className="flex min-h-[44px] flex-1 items-center gap-3 rounded-xl px-1 text-left transition-colors hover:bg-white/[0.03]"
      >
        <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
          <motion.span
            initial={false}
            animate={{ opacity: done ? 0 : 1, scale: done ? 0.6 : 1 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 flex items-center justify-center text-white/35"
          >
            <Circle size={20} strokeWidth={1.5} />
          </motion.span>
          <motion.span
            initial={false}
            animate={{ opacity: done ? 1 : 0, scale: done ? 1 : 0.5 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            className="absolute inset-0 flex items-center justify-center text-white"
          >
            <Check size={20} strokeWidth={2.5} />
          </motion.span>
        </span>

        <span className="relative min-w-0 flex-1 py-1">
          <motion.span
            initial={false}
            animate={{ opacity: done ? 0.4 : 1 }}
            transition={{ duration: 0.3 }}
            className={`block text-sm leading-snug ${
              strikeSettled && done ? 'line-through decoration-white/70' : ''
            }`}
          >
            {task.text}
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

      <button
        type="button"
        onClick={onDelete}
        aria-label={deleteLabel}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/25 transition-colors hover:bg-white/10 hover:text-danger"
      >
        <X size={16} />
      </button>
    </div>
  );
}

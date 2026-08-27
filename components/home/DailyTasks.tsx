'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, Circle, Play, Plus, X } from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { GlassCard, CardTitle } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import type { HomeTask } from '@/components/AppProvider';
import { formatMinutes, hasEstimate, parseMinutes, taskBudget } from '@/lib/tasktime';
import type { DailyTask } from '@/lib/types';

type DailyTasksProps = {
  tasks: HomeTask[];
  /** Отложенные на завтра: утром станут задачами дня сами. */
  tomorrow: DailyTask[];
  onAdd: (text: string, forTomorrow: boolean, minutes: number | null) => void;
  onToggle: (task: HomeTask) => void;
  onDelete: (task: HomeTask) => void;
  onDeleteTomorrow: (id: string) => void;
  /** Запустить таймер на отведённое задаче время. */
  onStartTimer: (task: HomeTask) => void;
  /** Заход уже идёт — второй запускать нечем. */
  timerBusy: boolean;
};

/**
 * Задачи дня — обычный органайзер под счётчиком рассылок.
 *
 * XP тут не начисляется намеренно: если бы список задач давал опыт, его
 * можно было бы «выполнить» вместо рассылок. Поэтому — никаких «+XP»,
 * только вычёркивание.
 *
 * Дневные задачи проектов попадают в этот же список: работа по проекту и
 * есть работа дня, и держать её в отдельном месте значит про неё забыть.
 * Отличается она только подписью с именем эксперта и тем, что удалить её
 * отсюда нельзя — пункт плана запуска не должен смахиваться одним движением
 * с рабочего экрана.
 *
 * У задачи есть необязательная оценка времени, и снизу список складывается
 * в бюджет дня. Необязательная — ключевое: задачи вносят пачкой, и второе
 * обязательное поле превратило бы запись в анкету.
 */
export function DailyTasks({
  tasks,
  tomorrow,
  onAdd,
  onToggle,
  onDelete,
  onDeleteTomorrow,
  onStartTimer,
  timerBusy,
}: DailyTasksProps) {
  const { t, tf } = useLanguage();

  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  /** Что набрано в поле времени. Разбирается только в момент добавления. */
  const [estimate, setEstimate] = useState('');
  /*
   * Куда пишем: на сегодня или на завтра.
   *
   * Переключатель, а не отдельная кнопка «на завтра»: мысли приходят
   * вечером пачкой и вперемешку — что-то надо сделать сейчас, что-то утром.
   * Выбор остаётся между задачами, поэтому пачку можно вносить не
   * переключаясь.
   */
  const [forTomorrow, setForTomorrow] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const budget = useMemo(() => taskBudget(tasks), [tasks]);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    // Время разбирается здесь, а не на каждое нажатие клавиши: пока человек
    // печатает «1 ч», строка успевает побывать невалидной.
    onAdd(trimmed, forTomorrow, parseMinutes(estimate));
    // Поля остаются открытыми: задачи обычно вносят пачкой.
    setText('');
    setEstimate('');
    inputRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLFormElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      setText('');
      setEstimate('');
      setAdding(false);
    }
  }

  function handleBlur(e: FocusEvent<HTMLFormElement>) {
    // Пустую форму схлопываем — иначе висит открытой весь день. Но только
    // когда фокус ушёл из неё целиком: переход из текста в поле времени —
    // тоже blur, и без этой проверки форма закрывалась бы ровно в тот
    // момент, когда к ней тянутся.
    if (text.trim()) return;
    if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return;

    setEstimate('');
    setAdding(false);
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
                  onStartTimer={onStartTimer}
                  timerBusy={timerBusy}
                  time={hasEstimate(task.minutes) ? formatMinutes(task.minutes, t) : null}
                  onToggle={() => onToggle(task)}
                  onDelete={() => onDelete(task)}
                  deleteLabel={t.common.delete}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {/* Бюджет дня. Пока ни одна задача не оценена, суммировать нечего —
          строка не появляется вообще, чтобы не приучать пропускать её
          глазами. Как только оценка есть, рядом идёт число неоценённых:
          без него «3 ч» читается как весь день целиком. */}
      {budget.total > 0 && (
        <div className="mb-1 space-y-0.5 px-1">
          <p className="text-xs leading-snug text-white/40">
            {tf(t.time.budgetAll, { t: formatMinutes(budget.total, t) })}
            {budget.untimed > 0 && (
              <span className="text-white/25">
                {' · '}
                {t.time.noEstimate}: {budget.untimed}
              </span>
            )}
          </p>

          {budget.done > 0 && (
            <p className="text-xs leading-snug text-white/55">
              {tf(t.time.budgetDone, { t: formatMinutes(budget.done, t) })}
              {budget.left > 0 && ` · ${tf(t.time.budgetLeft, { t: formatMinutes(budget.left, t) })}`}
            </p>
          )}
        </div>
      )}

      {adding ? (
        <form
          onSubmit={handleSubmit}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="space-y-2"
        >
          <div className="flex gap-1 rounded-2xl bg-white/[0.05] p-1">
            {[
              { value: false, label: t.home.forToday },
              { value: true, label: t.home.forTomorrow },
            ].map((option) => (
              <button
                key={String(option.value)}
                type="button"
                onClick={() => setForTomorrow(option.value)}
                aria-pressed={forTomorrow === option.value}
                className={`min-h-[36px] flex-1 rounded-xl text-sm font-bold transition-colors ${
                  forTomorrow === option.value ? 'bg-white text-ink' : 'text-white/50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            {/* Текст и время — одна коробка, разделённая волоском: время это
                часть задачи, а не второе поле анкеты. Отдельным полем оно
                съедало бы ширину, которой на 375px и так нет.
                Повторяет .field вручную — на <div> его :focus не сработает,
                а подсветка нужна всей коробке. */}
            <div className="flex min-h-[44px] min-w-0 flex-1 items-center rounded-[14px] border border-white/10 bg-white/[0.05] transition-colors focus-within:border-white/30 focus-within:bg-white/[0.08]">
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={forTomorrow ? t.home.taskTomorrowPh : t.home.taskPh}
                aria-label={forTomorrow ? t.home.taskTomorrowPh : t.home.taskPh}
                autoComplete="off"
                enterKeyHint="done"
                className="min-w-0 flex-1 bg-transparent py-2.5 pl-3.5 pr-2 text-white outline-none placeholder:text-white/30"
              />
              <span aria-hidden="true" className="h-6 w-px shrink-0 bg-white/10" />
              {/* Enter в тексте добавляет задачу и с пустым временем — пустое
                  поле не тормозит того, кто вносит пачку. */}
              <input
                value={estimate}
                onChange={(e) => setEstimate(e.target.value)}
                placeholder={t.time.estimatePh}
                aria-label={t.time.estimate}
                inputMode="numeric"
                autoComplete="off"
                enterKeyHint="done"
                className="w-[52px] shrink-0 bg-transparent px-1 py-2.5 text-center text-white outline-none placeholder:text-white/30"
              />
            </div>
            <button
              type="submit"
              aria-label={t.common.add}
              disabled={text.trim().length === 0}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-ink disabled:opacity-30"
            >
              <Plus size={20} strokeWidth={2.6} />
            </button>
          </div>
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

      {/* Отложенное видно в тот же вечер, когда записал: иначе непонятно,
          сохранилось оно вообще или нет. Отмечать его нельзя — оно ещё не
          наступило; можно только убрать, если передумал. Время показываем
          по той же причине: набранную оценку надо увидеть сохранённой. */}
      {tomorrow.length > 0 && (
        <div className="mt-3 border-t border-divider pt-3">
          <p className="section-label mb-2">{t.home.tomorrowTitle}</p>

          <ul className="space-y-0.5">
            {tomorrow.map((task) => (
              <li key={task.id} className="flex items-center gap-1">
                <span className="min-h-[36px] min-w-0 flex-1 py-1.5 text-sm leading-snug text-white/55">
                  {task.text}
                </span>
                {hasEstimate(task.minutes) && (
                  <span className="shrink-0 text-xs tabular-nums text-white/30">
                    {formatMinutes(task.minutes, t)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onDeleteTomorrow(task.id)}
                  aria-label={t.common.delete}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/25 transition-colors hover:bg-white/10 hover:text-danger"
                >
                  <X size={15} />
                </button>
              </li>
            ))}
          </ul>

          <p className="mt-2 text-xs text-white/25">{t.home.tomorrowHint}</p>
        </div>
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
  time,
  onToggle,
  onDelete,
  onStartTimer,
  timerBusy,
  deleteLabel,
}: {
  task: HomeTask;
  /** Готовая подпись времени или null, если задачу не оценивали. */
  time: string | null;
  onToggle: () => void;
  onDelete: () => void;
  onStartTimer: (task: HomeTask) => void;
  timerBusy: boolean;
  deleteLabel: string;
}) {
  const { t } = useLanguage();
  const done = task.completed;
  const fromProject = task.source === 'project';
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

          {/* Имя эксперта — единственное отличие задачи проекта. Значка или
              цвета не хватило бы: важно не «откуда она», а «по кому». */}
          {fromProject && task.project && (
            <motion.span
              initial={false}
              animate={{ opacity: done ? 0.3 : 1 }}
              transition={{ duration: 0.3 }}
              className="mt-0.5 block truncate text-xs text-white/35"
            >
              {task.project}
            </motion.span>
          )}

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

        {/* Время вынесено из-под линии вычёркивания: у выполненной задачи оно
            перестаёт быть планом и становится потраченным — зачёркивать его
            значит сказать «не считается». */}
        {time && (
          <motion.span
            initial={false}
            animate={{ opacity: done ? 0.35 : 1 }}
            transition={{ duration: 0.3 }}
            className="shrink-0 text-xs tabular-nums text-white/35"
          >
            {time}
          </motion.span>
        )}
      </motion.button>

      {/*
        Таймер прямо на задаче: время у неё уже стоит, и спрашивать
        длительность второй раз незачем. По истечении задача зачёркивается
        сама, но закрыть её руками можно в любой момент — обратное означало
        бы, что закончить раньше срока нельзя.
      */}
      {!done && task.minutes && !timerBusy && (
        <button
          type="button"
          onClick={() => onStartTimer(task)}
          aria-label={t.time.taskTimer}
          title={t.time.taskTimer}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/25 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Play size={14} fill="currentColor" />
        </button>
      )}

      {/* Задачу проекта удаляют там же, где заводят — на его странице.
          Место кнопки всё равно занято пустотой: без него строка проекта
          шире соседних на 44px, и подписи времени идут лесенкой. */}
      {fromProject ? (
        <span aria-hidden="true" className="h-11 w-11 shrink-0" />
      ) : (
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
  );
}

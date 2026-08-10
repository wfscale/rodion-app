'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Plus, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useApp } from '@/components/AppProvider';
import { ChecklistItem } from '@/components/ChecklistItem';
import { DayRing } from '@/components/DayRing';
import { GlassCard, CardTitle } from '@/components/GlassCard';
import { MorningCheckin } from '@/components/home/MorningCheckin';
import { NutritionBlock } from '@/components/home/NutritionBlock';
import { useLanguage } from '@/components/LanguageProvider';
import { StreakPill } from '@/components/StreakBlock';
import { FullPageLoader } from '@/components/ui';
import { XpBar } from '@/components/XpBar';
import { useDaily } from '@/hooks/useDaily';
import { useDebouncedCallback } from '@/hooks/useDebounced';
import { formatLongDate } from '@/lib/date';
import { CORE_TASKS, DISCIPLINE_TASKS, taskLabel } from '@/lib/tasks';
import { getLevelInfo, XP } from '@/lib/xp';

export default function HomePage() {
  const { t, lang } = useLanguage();
  const { profile, loading, streak } = useApp();
  const daily = useDaily();

  const [adding, setAdding] = useState(false);
  const [newTask, setNewTask] = useState('');
  const [comment, setComment] = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);
  const commentTouched = useRef(false);

  // Заметку дня подтягиваем из базы, но не затираем то, что печатают прямо сейчас.
  useEffect(() => {
    if (commentTouched.current) return;
    setComment(daily.log.day_comment ?? '');
  }, [daily.log.day_comment]);

  const saveComment = useDebouncedCallback(
    (text: string) => daily.saveDayComment(text),
    500,
  );

  if (loading || !profile) return <FullPageLoader />;

  const levelInfo = getLevelInfo(profile.total_xp, t);
  const disciplineAllDone = DISCIPLINE_TASKS.every((task) => daily.checklist[task.id]);

  async function addTask() {
    const title = newTask.trim();
    if (!title) return;
    setNewTask('');
    await daily.addCustomTask(title);
    addInputRef.current?.focus();
  }

  function onTaskKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      void addTask();
    }
    if (e.key === 'Escape') {
      setNewTask('');
      setAdding(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------- */}
      {/*  Хедер                                                         */}
      {/* ------------------------------------------------------------- */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex items-start justify-between gap-3"
      >
        <div className="min-w-0">
          <p className="text-sm text-muted">{t.home.greeting}</p>
          <h1 className="truncate text-2xl font-extrabold tracking-tight">
            {profile.username || t.settings.profile}
          </h1>
          <p className="mt-1 text-sm font-semibold text-white/60">
            {t.home.level} {levelInfo.level} · {levelInfo.name}
          </p>
        </div>

        <StreakPill streak={streak.current} />
      </motion.header>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <XpBar pct={levelInfo.progressPct} />
        <p className="mt-1.5 text-xs text-white/35">
          {profile.total_xp} XP
          {!levelInfo.isMax && ` · ${t.home.toNextLevel}: ${levelInfo.xpToNext}`}
        </p>
      </motion.div>

      {/* ------------------------------------------------------------- */}
      {/*  Кольцо дня                                                    */}
      {/* ------------------------------------------------------------- */}
      <GlassCard delay={1} className="flex flex-col items-center py-7">
        <p className="section-label mb-4">{t.home.dayOnFire}</p>

        <DayRing pct={daily.counts.pct} size={200} stroke={12}>
          <span className="text-5xl font-extrabold tracking-tight">
            {daily.counts.pct}
            <span className="text-2xl">%</span>
          </span>
          <span className="mt-1 text-sm font-semibold text-muted">
            {daily.counts.done} / {daily.counts.total} {t.home.tasksDone}
          </span>
        </DayRing>

        {/* Без capitalize: он поднял бы регистр каждого слова — «10 Августа, Понедельник». */}
        <p className="mt-4 text-sm text-white/40">{formatLongDate(daily.today, lang)}</p>
      </GlassCard>

      {/* ------------------------------------------------------------- */}
      {/*  Утренний чекин                                                */}
      {/* ------------------------------------------------------------- */}
      <MorningCheckin
        log={daily.log}
        done={daily.checkinDone}
        onSave={daily.saveCheckin}
        delay={2}
      />

      {/* ------------------------------------------------------------- */}
      {/*  Чеклист дня                                                   */}
      {/* ------------------------------------------------------------- */}
      <GlassCard delay={3}>
        <CardTitle
          right={
            <span className="text-sm font-bold text-white/40">
              {daily.counts.done}/{daily.counts.total}
            </span>
          }
        >
          {t.home.checklistTitle}
        </CardTitle>

        <div className="space-y-0.5">
          {CORE_TASKS.map((task) => (
            <ChecklistItem
              key={task.id}
              title={taskLabel(task, t, daily.dailyGoal)}
              done={Boolean(daily.checklist[task.id])}
              onToggle={() => void daily.toggleTask(task.id)}
              xp={XP.TASK}
            />
          ))}

          {/* Привычки, открытые недельной прогрессией */}
          {daily.habits.map((task) => (
            <ChecklistItem
              key={task.id}
              title={taskLabel(task, t, daily.dailyGoal)}
              done={Boolean(daily.checklist[task.id])}
              onToggle={() => void daily.toggleTask(task.id)}
              xp={XP.TASK}
            />
          ))}

          {/* Кастомные задачи — их можно удалить */}
          {daily.customTasks.map((task) => (
            <ChecklistItem
              key={task.id}
              title={task.title}
              done={Boolean(daily.checklist[task.id])}
              onToggle={() => void daily.toggleTask(task.id)}
              onDelete={() => void daily.removeCustomTask(task.id)}
              deleteLabel={t.common.delete}
              xp={XP.TASK}
            />
          ))}
        </div>

        {/* Добавление своей задачи */}
        <AnimatePresence initial={false} mode="wait">
          {adding ? (
            <motion.div
              key="input"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden pt-2"
            >
              <input
                ref={addInputRef}
                autoFocus
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={onTaskKeyDown}
                onBlur={() => {
                  if (!newTask.trim()) setAdding(false);
                }}
                placeholder={t.home.addTaskPh}
                className="field"
              />
            </motion.div>
          ) : (
            <motion.button
              key="button"
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setAdding(true)}
              className="mt-2 flex min-h-[44px] w-full items-center gap-2 rounded-xl px-1 text-sm font-semibold text-white/40 transition-colors hover:text-white"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-white/25">
                <Plus size={14} />
              </span>
              {t.home.addTask}
            </motion.button>
          )}
        </AnimatePresence>

        {/* Питание */}
        <NutritionBlock
          log={daily.log}
          onSaveMeals={daily.saveMeals}
          onToggleFasting={daily.toggleFasting}
        />
      </GlassCard>

      {/* ------------------------------------------------------------- */}
      {/*  Дисциплина                                                    */}
      {/* ------------------------------------------------------------- */}
      <GlassCard delay={4} glow={disciplineAllDone}>
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck
            size={15}
            className={disciplineAllDone ? 'text-success' : 'text-white/35'}
          />
          <p
            className={`section-label ${disciplineAllDone ? 'text-[rgba(100,255,140,0.7)]' : ''}`}
          >
            {t.home.disciplineTitle}
          </p>
        </div>

        <div className="space-y-0.5">
          {DISCIPLINE_TASKS.map((task) => (
            <ChecklistItem
              key={task.id}
              title={taskLabel(task, t, daily.dailyGoal)}
              done={Boolean(daily.checklist[task.id])}
              onToggle={() => void daily.toggleTask(task.id)}
              xp={XP.TASK}
              discipline
            />
          ))}
        </div>
      </GlassCard>

      {/* ------------------------------------------------------------- */}
      {/*  Заметка дня                                                   */}
      {/* ------------------------------------------------------------- */}
      <GlassCard delay={5}>
        <CardTitle
          right={<span className="text-xs text-white/25">{t.home.autosaved}</span>}
        >
          {t.home.notesTitle}
        </CardTitle>

        <textarea
          rows={3}
          value={comment}
          onChange={(e) => {
            commentTouched.current = true;
            setComment(e.target.value);
            saveComment(e.target.value);
          }}
          placeholder={t.home.notesPh}
          className="field"
        />
      </GlassCard>
    </div>
  );
}

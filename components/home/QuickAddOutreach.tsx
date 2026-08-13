'use client';

import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useLanguage } from '@/components/LanguageProvider';

type QuickAddOutreachProps = {
  /** Добавляет контакт со статусом «Написал». Ниша — свободный текст. */
  onAdd: (name: string, niche: string) => Promise<void> | void;
  /** Идёт запись — блокируем повторную отправку. */
  busy?: boolean;
};

/**
 * Кнопка «+ РАССЫЛКА» — самый заметный элемент экрана.
 *
 * Форма разворачивается ИНЛАЙН, прямо на месте кнопки: ни bottom sheet,
 * ни модалки. Шторка съедает секунду на открытие и закрытие и сбивает
 * ритм — а цель ровно одна: добавить рассылку за три секунды и сразу
 * начать следующую. Поэтому после отправки форма не закрывается, а
 * очищается и возвращает фокус в первое поле.
 */
export function QuickAddOutreach({ onAdd, busy = false }: QuickAddOutreachProps) {
  const { t } = useLanguage();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [niche, setNiche] = useState('');

  const nameRef = useRef<HTMLInputElement>(null);
  const nicheRef = useRef<HTMLInputElement>(null);

  // Развернули — сразу пишем имя, без лишнего тапа по полю.
  useEffect(() => {
    if (open) nameRef.current?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    setName('');
    setNiche('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;

    await onAdd(trimmed, niche.trim());

    // Форма остаётся открытой: следующая рассылка добавляется подряд.
    setName('');
    setNiche('');
    nameRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLFormElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  }

  if (!open) {
    return (
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        whileTap={{ scale: 0.98 }}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex min-h-[60px] w-full items-center justify-center rounded-2xl bg-white text-lg font-extrabold tracking-wide text-ink shadow-glow-white"
      >
        {t.home.addOutreach}
      </motion.button>
    );
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="glass overflow-hidden p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm font-extrabold tracking-wide">{t.home.addOutreach}</span>
        <button
          type="button"
          onClick={close}
          aria-label={t.common.close}
          className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/35 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X size={18} />
        </button>
      </div>

      <div className="grid gap-2.5">
        <input
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            // Enter в имени не отправляет, а переводит в нишу — ввод идёт цепочкой.
            if (e.key === 'Enter') {
              e.preventDefault();
              nicheRef.current?.focus();
            }
          }}
          placeholder={t.home.namePh}
          aria-label={t.home.namePh}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="next"
          className="field"
        />

        {/* Ниша — свободный текст. Никаких select ни здесь, ни где-либо ещё. */}
        <input
          ref={nicheRef}
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          placeholder={t.home.nichePh}
          aria-label={t.home.nichePh}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="done"
          className="field"
        />
      </div>

      <motion.button
        type="submit"
        whileTap={{ scale: 0.98 }}
        disabled={busy || name.trim().length === 0}
        className="mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-white text-base font-extrabold text-ink disabled:opacity-40"
      >
        {busy ? (
          // Свой спиннер, а не общий: тот белый и на белой кнопке невидим.
          <span
            role="status"
            aria-label={t.common.loading}
            className="h-5 w-5 animate-spin rounded-full border-2 border-black/20 border-t-ink"
          />
        ) : (
          t.home.addDone
        )}
      </motion.button>
    </motion.form>
  );
}

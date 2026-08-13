'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useLanguage } from '@/components/LanguageProvider';
import { instagramUrlFrom, normalizeHandle, type ContactDraft } from '@/components/outreach/ContactSheet';
import { Button, Label } from '@/components/ui';
import { CONTACT_STATUSES, type ContactStatus } from '@/lib/types';

type QuickAddOutreachProps = {
  today: string;
  onAdd: (draft: ContactDraft) => Promise<void> | void;
  busy?: boolean;
};

/**
 * Добавление рассылки прямо с главной.
 *
 * Форма разворачивается инлайн, а не шторкой: главный экран должен позволять
 * завести эксперта не уходя с него. Поля те же, что в карточке на странице
 * рассылок, чтобы не заполнять одно и то же дважды.
 */
export function QuickAddOutreach({ today, onAdd, busy = false }: QuickAddOutreachProps) {
  const { t, tf } = useLanguage();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [telegram, setTelegram] = useState('');
  const [instagram, setInstagram] = useState('');
  const [niche, setNiche] = useState('');
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState<ContactStatus>('sent');
  const [date, setDate] = useState(today);

  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) nameRef.current?.focus();
  }, [open]);

  useEffect(() => {
    setDate(today);
  }, [today]);

  function reset() {
    setName('');
    setTelegram('');
    setInstagram('');
    setNiche('');
    setComment('');
    setStatus('sent');
    setDate(today);
  }

  async function submit() {
    if (!name.trim()) {
      nameRef.current?.focus();
      return;
    }

    await onAdd({
      name: name.trim(),
      niche: niche.trim(),
      telegram_handle: normalizeHandle(telegram),
      instagram_url: instagram.trim() ? instagramUrlFrom(normalizeHandle(instagram)) : '',
      comment: comment.trim(),
      status,
      first_contact_date: date,
      next_step: '',
    });

    // Форма остаётся открытой: рассылки делаются подряд.
    reset();
    nameRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    // Enter отправляет из любого однострочного поля, кроме textarea.
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
      e.preventDefault();
      void submit();
    }
  }

  return (
    <AnimatePresence initial={false} mode="wait">
      {!open ? (
        <motion.button
          key="button"
          type="button"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setOpen(true)}
          className="btn-primary w-full text-lg font-extrabold tracking-wide"
          style={{ minHeight: 60 }}
        >
          {t.home.addOutreach}
        </motion.button>
      ) : (
        <motion.div
          key="form"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          onKeyDown={onKeyDown}
          className="glass overflow-hidden p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-base font-extrabold tracking-wide">{t.home.addOutreach}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t.common.close}
              className="flex h-11 w-11 items-center justify-center rounded-full text-white/40 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          <div className="space-y-3">
            <label className="block">
              <Label hint={t.common.required}>{t.outreach.fieldName}</Label>
              <input
                ref={nameRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.home.namePh}
                className="field"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <Label>{t.outreach.fieldTelegram}</Label>
                <input
                  value={telegram}
                  onChange={(e) => setTelegram(e.target.value)}
                  placeholder="@"
                  autoCapitalize="none"
                  className="field"
                />
              </label>

              <label className="block">
                <Label>{t.outreach.fieldInstagram}</Label>
                <input
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  autoCapitalize="none"
                  className="field"
                />
              </label>
            </div>

            {instagram.trim() && (
              <p className="-mt-1 text-xs text-white/30">
                {tf(t.outreach.igHint, { handle: normalizeHandle(instagram) })}
              </p>
            )}

            <label className="block">
              <Label>{t.outreach.fieldNiche}</Label>
              <input
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder={t.home.nichePh}
                className="field"
              />
            </label>

            <label className="block">
              <Label>{t.outreach.fieldComment}</Label>
              <textarea
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="field"
              />
              {/* Текст уходит в библиотеку офферов сам — вручную ничего сохранять не нужно. */}
            </label>

            <div>
              <Label>{t.outreach.fieldStatus}</Label>
              <div className="flex flex-wrap gap-2">
                {CONTACT_STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    aria-pressed={status === s}
                    className={`min-h-[44px] rounded-full border px-3 text-sm font-bold transition-colors ${
                      status === s
                        ? 'border-white bg-white text-ink'
                        : 'border-glass-border bg-white/[0.05] text-white/55'
                    }`}
                  >
                    {t.statuses[s]}
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <Label>{t.outreach.fieldDate}</Label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="field"
              />
            </label>

            <Button full onClick={submit} disabled={busy || !name.trim()}>
              {busy ? t.common.saving : t.outreach.submit}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

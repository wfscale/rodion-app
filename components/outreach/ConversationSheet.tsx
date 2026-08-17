'use client';

import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, ClipboardPaste, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { useLanguage } from '@/components/LanguageProvider';
import { Button, Label } from '@/components/ui';
import {
  assignRoles,
  authorsOf,
  chatIssues,
  chatMetrics,
  chatScore,
  MAX_MESSAGES,
  parseChat,
  type ChatMessage,
} from '@/lib/conversation';
import type { OutreachContact } from '@/lib/types';

type Props = {
  contact: OutreachContact | null;
  open: boolean;
  onClose: () => void;
  onSave: (contactId: string, messages: ChatMessage[]) => void | Promise<void>;
};

/**
 * Переписка с экспертом: ввод и разбор.
 *
 * Два способа заполнить, потому что жизнь предлагает оба: скинуть весь
 * экспорт из Telegram разом или добавлять реплики по одной, когда разговор
 * идёт прямо сейчас. Порядок сообщений — единственное, что здесь важно:
 * без него любой разбор диалога бессмыслен, поэтому есть стрелки.
 */
export function ConversationSheet({ contact, open, onClose, onSave }: Props) {
  const { t, tf } = useLanguage();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [paste, setPaste] = useState('');
  const [pasteMode, setPasteMode] = useState(false);
  const [busy, setBusy] = useState(false);

  // Пересобираем состояние только на открытии: правки в шторке не должны
  // затираться при каждом обновлении контакта у родителя.
  const contactId = contact?.id ?? null;
  useEffect(() => {
    if (!open) return;
    setMessages(contact?.conversation ?? []);
    setDraft('');
    setPaste('');
    setPasteMode(false);
    setBusy(false);
    // contact намеренно не в зависимостях — см. комментарий выше.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contactId]);

  const metrics = useMemo(() => chatMetrics(messages), [messages]);
  const issues = useMemo(() => chatIssues(metrics), [metrics]);
  const score = useMemo(() => chatScore(metrics), [metrics]);

  /** Кто есть кто во вставленном экспорте — спрашиваем, а не угадываем. */
  const pastedBlocks = useMemo(() => (pasteMode ? parseChat(paste) : []), [pasteMode, paste]);
  const pastedAuthors = useMemo(() => authorsOf(pastedBlocks), [pastedBlocks]);

  function append(role: ChatMessage['role']) {
    const text = draft.trim();
    if (!text || messages.length >= MAX_MESSAGES) return;
    setMessages((current) => [...current, { role, text }]);
    setDraft('');
  }

  function move(index: number, delta: number) {
    setMessages((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function applyPaste(me: string) {
    setMessages((current) =>
      [...current, ...assignRoles(pastedBlocks, me)].slice(0, MAX_MESSAGES),
    );
    setPaste('');
    setPasteMode(false);
  }

  async function submit() {
    if (!contactId) return;
    setBusy(true);
    try {
      await onSave(contactId, messages);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={contact ? tf(t.chat.title, { name: contact.name }) : t.chat.titlePlain}
      footer={
        <Button full onClick={() => void submit()} disabled={busy || !contactId}>
          {busy ? t.common.saving : t.common.save}
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Разбор — сверху: ради него переписку сюда и складывают. */}
        {messages.length > 0 && (
          <div className="rounded-2xl border border-glass-border bg-white/[0.04] p-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-wide text-white/35">
                {t.chat.scoreTitle}
              </span>
              <span
                className={`text-2xl font-extrabold leading-none tabular-nums ${
                  score >= 80 ? 'text-success' : score >= 50 ? 'text-warn' : 'text-danger'
                }`}
              >
                {score}
              </span>
            </div>

            <p className="mt-2 text-xs leading-snug text-white/40">
              {tf(t.chat.balance, {
                mine: metrics.mine,
                theirs: metrics.theirs,
                my: metrics.myLength,
                their: metrics.theirLength,
              })}
            </p>

            {issues.length > 0 ? (
              <ul className="mt-3 space-y-2 border-t border-divider pt-3">
                {issues.map((id) => (
                  <li key={id}>
                    <p className="text-sm font-bold leading-snug text-danger">
                      {t.chat.issues[id]}
                    </p>
                    <p className="mt-0.5 text-xs leading-snug text-white/45">
                      {t.chat.fixes[id]}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 border-t border-divider pt-3 text-sm font-bold text-success">
                {t.chat.clean}
              </p>
            )}
          </div>
        )}

        {/* Сама переписка. Мои реплики справа — так же, как в мессенджере,
            иначе порядок ролей приходится читать, а не видеть. */}
        {messages.length === 0 ? (
          <p className="py-2 text-sm leading-relaxed text-muted">{t.chat.empty}</p>
        ) : (
          <ul className="space-y-2">
            {messages.map((message, i) => (
              <li
                key={`${i}-${message.text.slice(0, 12)}`}
                className={`flex ${message.role === 'me' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[86%] rounded-2xl border p-2.5 ${
                    message.role === 'me'
                      ? 'border-white/25 bg-white/[0.10]'
                      : 'border-glass-border bg-white/[0.04]'
                  }`}
                >
                  <p className="text-[11px] font-bold uppercase tracking-wide text-white/35">
                    {message.role === 'me' ? t.chat.roleMe : t.chat.roleThem}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-snug">
                    {message.text}
                  </p>

                  <div className="mt-1.5 flex justify-end gap-0.5">
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      aria-label={t.chat.moveUp}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-white/35 disabled:opacity-20"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === messages.length - 1}
                      aria-label={t.chat.moveDown}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-white/35 disabled:opacity-20"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setMessages((c) => c.filter((_, n) => n !== i))}
                      aria-label={t.common.delete}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-danger/60"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Ввод по одной реплике: кто сказал — тем и добавляется. */}
        <div className="border-t border-divider pt-4">
          <Label hint={tf(t.chat.limit, { n: MAX_MESSAGES })}>{t.chat.addTitle}</Label>
          <textarea
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t.chat.draftPh}
            className="field resize-none"
          />
          <div className="mt-2 flex gap-2">
            {(['me', 'them'] as const).map((role) => (
              <motion.button
                key={role}
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => append(role)}
                disabled={!draft.trim() || messages.length >= MAX_MESSAGES}
                className={`min-h-[44px] flex-1 rounded-2xl border text-sm font-bold transition-colors disabled:opacity-30 ${
                  role === 'me'
                    ? 'border-white bg-white text-ink'
                    : 'border-glass-border bg-white/[0.06] text-white'
                }`}
              >
                {role === 'me' ? t.chat.addMe : t.chat.addThem}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Массовая вставка: экспорт из Telegram разбирается по заголовкам
            «Имя, [дата]». Кто из авторов ты — выбираешь сам: угадывание
            здесь молча испортило бы весь разбор. */}
        <div className="border-t border-divider pt-4">
          {!pasteMode ? (
            <button
              type="button"
              onClick={() => setPasteMode(true)}
              className="btn-ghost w-full text-sm font-bold"
            >
              <ClipboardPaste size={16} />
              {t.chat.pasteOpen}
            </button>
          ) : (
            <>
              <Label hint={t.chat.pasteHint}>{t.chat.pasteTitle}</Label>
              <textarea
                rows={5}
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder={t.chat.pastePh}
                className="field resize-none"
              />

              {paste.trim() && pastedAuthors.length === 0 && (
                <p className="mt-2 text-sm leading-snug text-warn">{t.chat.pasteNoAuthors}</p>
              )}

              {pastedAuthors.length > 0 && (
                <div className="mt-3">
                  <p className="mb-2 text-sm font-semibold text-white/70">
                    {tf(t.chat.pasteFound, { n: pastedBlocks.length })}
                  </p>
                  <p className="mb-2 text-xs text-white/40">{t.chat.pasteWhoAmI}</p>
                  <div className="flex flex-wrap gap-2">
                    {pastedAuthors.map((author) => (
                      <button
                        key={author}
                        type="button"
                        onClick={() => applyPaste(author)}
                        className="min-h-[44px] max-w-full truncate rounded-full border border-glass-border bg-white/[0.06] px-4 text-sm font-bold hover:bg-white/10"
                      >
                        {author}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setPasteMode(false);
                  setPaste('');
                }}
                className="mt-3 min-h-[44px] w-full text-sm font-semibold text-white/35 hover:text-white"
              >
                {t.common.cancel}
              </button>
            </>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}

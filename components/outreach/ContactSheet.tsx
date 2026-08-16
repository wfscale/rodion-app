'use client';

import { motion } from 'framer-motion';
import { BellPlus, BookmarkPlus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { useLanguage } from '@/components/LanguageProvider';
import { Badge, Button, Field, Label, TextArea } from '@/components/ui';
import { formatDateTime, getLogicalDate } from '@/lib/date';
import {
  CONTACT_STATUSES,
  NEGATIVE_STATUSES,
  normalizeStatus,
  type ContactStatus,
  type OutreachContact,
} from '@/lib/types';

/* -------------------------------------------------------------------------- */
/*  Черновик и хелперы контакта                                                */
/* -------------------------------------------------------------------------- */

/**
 * Ровно то, что уходит наверх при сохранении: голые строки, без id и user_id.
 * Карточка — владелец формата, поэтому мелкие хелперы (хендлы, ссылки, тон
 * бейджа) живут здесь же: таблица и список карточек берут их отсюда.
 */
export type ContactDraft = {
  name: string;
  niche: string;
  telegram_handle: string;
  instagram_url: string;
  comment: string;
  status: ContactStatus;
  first_contact_date: string;
  next_step: string;
};

/** Пустой черновик: дата касания — сегодня, статус по умолчанию «Отправлено». */
export function emptyDraft(status: ContactStatus = 'sent'): ContactDraft {
  return {
    name: '',
    niche: '',
    telegram_handle: '',
    instagram_url: '',
    comment: '',
    status,
    first_contact_date: getLogicalDate(),
    next_step: '',
  };
}

/** Хендл без @ и лишних пробелов — в таком виде он и хранится. */
export function normalizeHandle(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/^@+/, '');
}

/** Ссылка на Telegram или null, если хендл пустой. */
export function telegramUrl(handle: string | null | undefined): string | null {
  const clean = normalizeHandle(handle);
  return clean ? `https://t.me/${clean}` : null;
}

/** Из никнейма делаем ссылку — в базе хранится именно она, не хендл. */
export function instagramUrlFrom(handle: string): string {
  const clean = normalizeHandle(handle);
  return clean ? `https://instagram.com/${clean}` : '';
}

/** Обратная операция: в поле ввода пользователь правит никнейм, а не URL. */
export function instagramHandleFrom(url: string | null | undefined): string {
  if (!url) return '';
  return url
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/^instagram\.com\//i, '')
    .replace(/[/?#].*$/, '')
    .replace(/^@+/, '');
}

/**
 * Цветовой тон бейджа по позиции в воронке.
 *
 * Красный означает ровно одно: дверь закрылась. «Ответил — отказ» и
 * «Заблокировал» — единственные такие исходы, и их видно с другого конца
 * списка, чтобы не тратить на них ни одного лишнего взгляда.
 */
export function statusTone(
  status: ContactStatus,
): 'neutral' | 'success' | 'danger' | 'warn' {
  if (status === 'closed') return 'success';
  if (status === 'call' || status === 'replied') return 'warn';
  if (NEGATIVE_STATUSES.includes(status)) return 'danger';
  return 'neutral';
}

function toDraft(contact: OutreachContact | null): ContactDraft {
  if (!contact) return emptyDraft();
  return {
    name: contact.name ?? '',
    niche: contact.niche ?? '',
    telegram_handle: normalizeHandle(contact.telegram_handle),
    instagram_url: contact.instagram_url ?? '',
    comment: contact.comment ?? '',
    status: normalizeStatus(contact.status),
    first_contact_date: (contact.first_contact_date ?? getLogicalDate()).slice(0, 10),
    next_step: contact.next_step ?? '',
  };
}

/* -------------------------------------------------------------------------- */
/*  Шторка полной карточки                                                     */
/* -------------------------------------------------------------------------- */

type ContactSheetProps = {
  /** null — режим создания: форма пустая, дата = сегодня. */
  contact: OutreachContact | null;
  open: boolean;
  onClose: () => void;
  onSave: (draft: ContactDraft) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onSaveToOffers: (contact: OutreachContact) => void | Promise<void>;
  /** Поставить напоминание по этому человеку. */
  onAddReminder?: (contact: OutreachContact) => void;
  /** Библиотека офферов открывается со 2-го уровня. */
  canSaveToOffers?: boolean;
  /** «Следующий шаг» открывается с 4-го уровня. */
  showNextStep?: boolean;
};

export function ContactSheet({
  contact,
  open,
  onClose,
  onSave,
  onDelete,
  onSaveToOffers,
  onAddReminder,
  canSaveToOffers = false,
  showNextStep = false,
}: ContactSheetProps) {
  const { t, tf, lang } = useLanguage();

  const [draft, setDraft] = useState<ContactDraft>(() => toDraft(contact));
  const [igHandle, setIgHandle] = useState(() => instagramHandleFrom(contact?.instagram_url));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [savedToOffers, setSavedToOffers] = useState(false);

  /**
   * Пока шторка закрывается, contact у родителя уже может стать null —
   * держим снимок, иначе история и кнопка удаления мигают на прощание.
   */
  const [snapshot, setSnapshot] = useState<OutreachContact | null>(contact);

  // Свежий contact для эффекта ниже: пересобирать форму нужно на смене
  // контакта, а не на каждом новом объекте от родителя — иначе ввод затрётся.
  const contactRef = useRef(contact);
  contactRef.current = contact;
  const contactId = contact?.id ?? null;

  useEffect(() => {
    if (!open) return;
    const current = contactRef.current;
    setSnapshot(current);
    setDraft(toDraft(current));
    setIgHandle(instagramHandleFrom(current?.instagram_url));
    setError(null);
    setBusy(false);
    setConfirming(false);
    setSavedToOffers(false);
  }, [open, contactId]);

  function patch(part: Partial<ContactDraft>) {
    setDraft((current) => ({ ...current, ...part }));
  }

  async function submit() {
    const name = draft.name.trim();
    if (!name) {
      setError(t.common.required);
      return;
    }

    setBusy(true);
    try {
      await onSave({
        ...draft,
        name,
        niche: draft.niche.trim(),
        telegram_handle: normalizeHandle(draft.telegram_handle),
        instagram_url: instagramUrlFrom(igHandle),
        comment: draft.comment.trim(),
        next_step: draft.next_step.trim(),
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const history = [...(snapshot?.status_history ?? [])].reverse();

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={snapshot ? t.outreach.detailTitle : t.outreach.addTitle}
      footer={
        <Button full onClick={() => void submit()} disabled={busy}>
          {busy ? (
            // Спиннер тёмный: кнопка белая, светлый на ней не виден.
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-black/20 border-t-black" />
          ) : (
            t.outreach.submit
          )}
        </Button>
      }
    >
      <div className="space-y-4">
        <Field
          label={t.outreach.fieldName}
          hint={t.common.required}
          value={draft.name}
          onChange={(e) => {
            patch({ name: e.target.value });
            setError(null);
          }}
          placeholder={t.outreach.quickName}
          error={error ?? undefined}
          autoCapitalize="words"
        />

        <Field
          label={t.outreach.fieldTelegram}
          hint={t.common.optional}
          value={draft.telegram_handle}
          onChange={(e) => patch({ telegram_handle: e.target.value })}
          placeholder="@"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />

        <div>
          <Field
            label={t.outreach.fieldInstagram}
            hint={t.common.optional}
            value={igHandle}
            onChange={(e) => setIgHandle(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          {/* Ссылка собирается на клиенте — показываем её сразу при вводе. */}
          {normalizeHandle(igHandle) && (
            <p className="mt-1.5 text-xs text-white/35">
              {tf(t.outreach.igHint, { handle: normalizeHandle(igHandle) })}
            </p>
          )}
        </div>

        <Field
          label={t.outreach.fieldNiche}
          value={draft.niche}
          onChange={(e) => patch({ niche: e.target.value })}
          placeholder={t.outreach.quickNiche}
        />

        <TextArea
          label={t.outreach.fieldComment}
          rows={4}
          value={draft.comment}
          onChange={(e) => patch({ comment: e.target.value })}
        />

        <div>
          <Label>{t.outreach.fieldStatus}</Label>
          <div className="flex flex-wrap gap-2">
            {CONTACT_STATUSES.map((status) => {
              const active = draft.status === status;
              return (
                <motion.button
                  key={status}
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={() => patch({ status })}
                  aria-pressed={active}
                  className={`min-h-[44px] rounded-full border px-4 text-sm font-bold transition-colors ${
                    active
                      ? 'border-white bg-white text-ink'
                      : 'border-glass-border bg-white/[0.05] text-white/55 hover:bg-white/10'
                  }`}
                >
                  {t.statuses[status]}
                </motion.button>
              );
            })}
          </div>
        </div>

        <Field
          type="date"
          label={t.outreach.fieldDate}
          value={draft.first_contact_date}
          onChange={(e) => patch({ first_contact_date: e.target.value })}
          className="[&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:invert"
        />

        {showNextStep && (
          <Field
            label={t.outreach.fieldNextStep}
            value={draft.next_step}
            onChange={(e) => patch({ next_step: e.target.value })}
          />
        )}

        {snapshot && onAddReminder && (
          <Button variant="ghost" full onClick={() => onAddReminder(snapshot)}>
            <BellPlus size={16} />
            {t.outreach.addReminder}
          </Button>
        )}

        {canSaveToOffers && snapshot && (
          <Button
            variant="ghost"
            full
            onClick={() => {
              void onSaveToOffers(snapshot);
              setSavedToOffers(true);
            }}
            disabled={savedToOffers}
          >
            <BookmarkPlus size={16} />
            {savedToOffers ? t.outreach.savedToOffers : t.outreach.saveToOffers}
          </Button>
        )}

        {snapshot && (
          <div>
            <Label>{t.outreach.history}</Label>
            {history.length === 0 ? (
              <p className="text-sm text-muted">{t.outreach.noHistory}</p>
            ) : (
              <ol className="relative space-y-3 border-l border-divider pl-4">
                {history.map((entry, i) => {
                  // В истории могут лежать статусы старой шкалы — приводим.
                  const status = normalizeStatus(entry.status);
                  return (
                    <li key={`${entry.at}-${i}`} className="relative">
                      <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-white/40" />
                      <div className="flex items-center gap-2">
                        <Badge tone={statusTone(status)}>{t.statuses[status]}</Badge>
                        <span className="text-xs text-white/30">
                          {formatDateTime(entry.at, lang)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        )}

        {snapshot && (
          <div className="border-t border-divider pt-4">
            {confirming ? (
              <div className="space-y-3">
                <p className="text-sm text-danger">{t.common.confirmDelete}</p>
                <div className="flex gap-2">
                  <Button
                    variant="danger"
                    className="flex-1"
                    onClick={() => {
                      void onDelete(snapshot.id);
                      onClose();
                    }}
                  >
                    {t.common.delete}
                  </Button>
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={() => setConfirming(false)}
                  >
                    {t.common.cancel}
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="danger" full onClick={() => setConfirming(true)}>
                <Trash2 size={16} />
                {t.common.delete}
              </Button>
            )}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

'use client';

import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReminderDraft } from '@/components/AppProvider';
import { BottomSheet } from '@/components/BottomSheet';
import { useLanguage } from '@/components/LanguageProvider';
import { Button, Field, Label, Select, TextArea } from '@/components/ui';
import { getLogicalDate } from '@/lib/date';
import { composeDueAt, reminderDate, reminderTime } from '@/lib/reminders';
import type { OutreachContact, Reminder } from '@/lib/types';

type Props = {
  open: boolean;
  /** null — режим создания. */
  reminder: Reminder | null;
  contacts: OutreachContact[];
  /** Предзаполнить привязку — когда напоминание ставят из карточки эксперта. */
  presetContactId?: string | null;
  onClose: () => void;
  onSave: (draft: ReminderDraft, id: string | null) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
};

/** Ближайшее «круглое» время — следующий час. Ставить напоминание на 14:37 никто не хочет. */
function defaultTime(): string {
  const next = new Date();
  next.setHours(next.getHours() + 1, 0, 0, 0);
  return `${String(next.getHours()).padStart(2, '0')}:00`;
}

export function ReminderSheet({
  open,
  reminder,
  contacts,
  presetContactId = null,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const { t } = useLanguage();

  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(getLogicalDate());
  const [time, setTime] = useState(defaultTime);
  const [contactId, setContactId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Пока шторка закрывается, reminder у родителя уже null — держим снимок.
  const [snapshot, setSnapshot] = useState<Reminder | null>(reminder);

  useEffect(() => {
    if (!open) return;

    setSnapshot(reminder);
    setTitle(reminder?.title ?? '');
    setNote(reminder?.note ?? '');
    setDate(reminder ? reminderDate(reminder.due_at) : getLogicalDate());
    setTime(reminder ? reminderTime(reminder.due_at) : defaultTime());
    setContactId(reminder?.contact_id ?? presetContactId ?? '');
    setBusy(false);
    setError(null);
    setConfirming(false);
  }, [open, reminder, presetContactId]);

  async function submit() {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError(t.common.required);
      return;
    }
    if (!date) {
      setError(t.common.required);
      return;
    }

    setBusy(true);
    try {
      await onSave(
        {
          title: cleanTitle,
          note: note.trim(),
          due_at: composeDueAt(date, time),
          contact_id: contactId || null,
        },
        snapshot?.id ?? null,
      );
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={snapshot ? t.reminders.edit : t.reminders.add}
      footer={
        <Button full onClick={() => void submit()} disabled={busy}>
          {busy ? t.common.saving : t.reminders.save}
        </Button>
      }
    >
      <div className="space-y-4">
        <Field
          label={t.reminders.titleLabel}
          hint={t.common.required}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError(null);
          }}
          placeholder={t.reminders.titlePh}
          error={error ?? undefined}
        />

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <Label>{t.reminders.dateLabel}</Label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="field [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:invert"
            />
          </label>

          <label className="block">
            <Label>{t.reminders.timeLabel}</Label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="field"
            />
          </label>
        </div>

        <TextArea
          label={t.reminders.noteLabel}
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t.reminders.notePh}
        />

        <div>
          <Select
            label={t.reminders.contactLabel}
            value={contactId}
            onChange={setContactId}
            options={[
              { value: '', label: t.reminders.noContact },
              ...contacts.map((contact) => ({ value: contact.id, label: contact.name })),
            ]}
          />
          <p className="mt-1.5 text-xs leading-snug text-white/30">{t.reminders.contactHint}</p>
        </div>

        {snapshot && onDelete && (
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
                  <Button variant="ghost" className="flex-1" onClick={() => setConfirming(false)}>
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

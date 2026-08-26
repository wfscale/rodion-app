'use client';

import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { useLanguage } from '@/components/LanguageProvider';
import { Button, Field, Label, TextArea } from '@/components/ui';
import type { GoalDraft } from '@/hooks/useGoals';
import type { Goal } from '@/lib/types';

type GoalSheetProps = {
  open: boolean;
  goal: Goal | null;
  today: string;
  onClose: () => void;
  onSave: (draft: GoalDraft, id: string | null) => void;
  onDelete: (id: string) => void;
};

/** Форма цели: название, срок, сумма и что для этого нужно. */
export function GoalSheet({ open, goal, today, onClose, onSave, onDelete }: GoalSheetProps) {
  const { t } = useLanguage();

  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [deadline, setDeadline] = useState(today);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(goal?.title ?? '');
    setNote(goal?.note ?? '');
    setAmount(goal?.target_amount ? String(goal.target_amount) : '');
    setDeadline(goal?.deadline ?? today);
    setConfirmDelete(false);
  }, [open, goal, today]);

  const valid = title.trim().length > 0 && Boolean(deadline);

  return (
    <BottomSheet open={open} onClose={onClose} title={goal ? t.goals.edit : t.goals.add}>
      <div className="space-y-4">
        <Field
          label={t.goals.name}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t.goals.namePh}
          autoComplete="off"
        />

        <label className="block">
          <Label>{t.goals.deadline}</Label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="field"
          />
        </label>

        {/* Сумма необязательна: «закрыть эксперта» и «сделать запуск» —
            такие же цели, и выдумывать для них цифру значит получить
            выдуманную цифру. */}
        <Field
          label={t.goals.amount}
          hint={t.goals.amountHint}
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
          placeholder={t.goals.amountPh}
          inputMode="numeric"
          autoComplete="off"
        />

        <TextArea
          label={t.goals.note}
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t.goals.notePh}
        />

        <Button
          full
          disabled={!valid}
          onClick={() => {
            onSave(
              {
                title,
                note,
                target_amount: amount ? Number(amount) : null,
                deadline,
              },
              goal?.id ?? null,
            );
            onClose();
          }}
        >
          {t.common.save}
        </Button>

        {goal &&
          (confirmDelete ? (
            <div className="space-y-3 rounded-2xl border border-[rgba(255,107,107,0.25)] bg-[rgba(255,107,107,0.06)] p-3">
              <p className="text-sm leading-relaxed text-danger">{t.goals.removeConfirm}</p>
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  className="flex-1"
                  onClick={() => {
                    onDelete(goal.id);
                    onClose();
                  }}
                >
                  {t.common.delete}
                </Button>
                <Button variant="ghost" className="flex-1" onClick={() => setConfirmDelete(false)}>
                  {t.common.cancel}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="danger" full onClick={() => setConfirmDelete(true)}>
              <Trash2 size={16} />
              {t.goals.remove}
            </Button>
          ))}
      </div>
    </BottomSheet>
  );
}

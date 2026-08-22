'use client';

import { useEffect, useState } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { useLanguage } from '@/components/LanguageProvider';
import type { ProjectDraft } from '@/components/project/shared';
import { Button, Field } from '@/components/ui';

type ProjectSheetProps = {
  /** null — шторка закрыта. */
  draft: ProjectDraft | null;
  title: string;
  onClose: () => void;
  onSave: (draft: ProjectDraft) => void;
};

/**
 * Шапка проекта: кто, за сколько и в какие сроки.
 *
 * Одна и та же форма заводит новый проект и правит существующий — иначе поля
 * в двух формах неизбежно разъезжаются.
 */
export function ProjectSheet({ draft, title, onClose, onSave }: ProjectSheetProps) {
  const { t } = useLanguage();

  const [name, setName] = useState('');
  const [niche, setNiche] = useState('');
  // Сумма живёт строкой: пустое поле — это не ноль, а «ещё не ввёл».
  const [amount, setAmount] = useState('');
  const [startedAt, setStartedAt] = useState('');
  const [launchDate, setLaunchDate] = useState('');
  const [instagram, setInstagram] = useState('');
  const [telegram, setTelegram] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!draft) return;
    setName(draft.expert_name);
    setNiche(draft.niche ?? '');
    setAmount(draft.deal_amount ? String(draft.deal_amount) : '');
    setStartedAt(draft.started_at ?? '');
    setLaunchDate(draft.launch_date ?? '');
    setInstagram(draft.instagram_url ?? '');
    setTelegram(draft.telegram_url ?? '');
    setError(false);
  }, [draft]);

  function submit() {
    if (!name.trim()) {
      setError(true);
      return;
    }
    onSave({
      expert_name: name.trim(),
      niche: niche.trim() || null,
      started_at: startedAt || null,
      launch_date: launchDate || null,
      deal_amount: Number(amount.replace(/\D/g, '')) || 0,
      instagram_url: instagram.trim() || null,
      telegram_url: telegram.trim() || null,
    });
  }

  return (
    <BottomSheet
      open={draft !== null}
      onClose={onClose}
      title={title}
      footer={
        <Button full onClick={submit}>
          {t.common.save}
        </Button>
      }
    >
      <div className="space-y-4">
        <Field
          label={t.project.expertName}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(false);
          }}
          error={error ? t.common.required : undefined}
        />

        <Field
          label={t.project.niche}
          hint={t.common.optional}
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
        />

        <Field
          label={t.project.dealAmount}
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
        />

        {/* Две границы проекта рядом: между ними и раскладываются даты этапов. */}
        <div className="grid grid-cols-2 gap-3">
          <Field
            label={t.project.startedAt}
            type="date"
            value={startedAt}
            onChange={(e) => setStartedAt(e.target.value)}
          />
          <Field
            label={t.project.launchDate}
            type="date"
            value={launchDate}
            onChange={(e) => setLaunchDate(e.target.value)}
          />
        </div>

        <Field
          label={t.project.instagram}
          hint={t.common.optional}
          placeholder={t.project.linkPh}
          inputMode="url"
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
        />

        <Field
          label={t.project.telegram}
          hint={t.common.optional}
          placeholder={t.project.linkPh}
          inputMode="url"
          value={telegram}
          onChange={(e) => setTelegram(e.target.value)}
        />
      </div>
    </BottomSheet>
  );
}

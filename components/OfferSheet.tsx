'use client';

import { Check, Copy, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { useLanguage } from '@/components/LanguageProvider';
import { Button, Field, Label, Select, TextArea } from '@/components/ui';
import {
  normalizeStatus,
  OFFER_RESULTS,
  type Offer,
  type OfferResult,
  type OutreachContact,
} from '@/lib/types';

/** Копирование с фолбэком: Clipboard API недоступен вне HTTPS. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // падаем в фолбэк ниже
  }

  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export type OfferDraft = {
  title: string;
  niche: string | null;
  content: string;
  result: OfferResult;
  note: string | null;
  contact_id: string | null;
};

/**
 * Одна шторка на создание и редактирование оффера.
 * offer === null + open === true — режим создания.
 */
export function OfferSheet({
  open,
  offer,
  contacts,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  offer: Offer | null;
  contacts: OutreachContact[];
  onClose: () => void;
  onSave: (draft: OfferDraft, id: string | null) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const { t } = useLanguage();

  const [title, setTitle] = useState('');
  const [niche, setNiche] = useState('');
  const [content, setContent] = useState('');
  const [result, setResult] = useState<OfferResult>('not_sent');
  const [note, setNote] = useState('');
  const [contactId, setContactId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setTitle(offer?.title ?? '');
    setNiche(offer?.niche ?? '');
    setContent(offer?.content ?? '');
    // В базе может лежать статус старой шкалы — приводим к текущей.
    setResult(offer ? normalizeStatus(offer.result) : 'not_sent');
    setNote(offer?.note ?? '');
    setContactId(offer?.contact_id ?? '');
    setConfirming(false);
    setCopied(false);
    setError(null);
  }, [open, offer]);

  async function submit() {
    if (!title.trim() || !content.trim()) {
      setError(t.offers.offerTitle);
      return;
    }

    setBusy(true);
    try {
      await onSave(
        {
          title: title.trim(),
          niche: niche.trim() || null,
          content: content.trim(),
          result,
          note: note.trim() || null,
          contact_id: contactId || null,
        },
        offer?.id ?? null,
      );
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    const ok = await copyText(content);
    if (!ok) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={offer ? t.offers.detailTitle : t.offers.addTitle}
      footer={
        <Button full onClick={submit} disabled={busy}>
          {busy ? t.common.saving : t.offers.submit}
        </Button>
      }
    >
      <div className="space-y-4">
        <Field
          label={t.offers.offerTitle}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError(null);
          }}
          placeholder={t.offers.offerTitlePh}
          error={error ?? undefined}
        />

        {/* У оффера, привязанного к рассылке, результат не выбирается руками:
            он и есть статус контакта. Иначе два источника правды разъедутся. */}
        {offer?.contact_id ? (
          <div>
            <Label hint={t.offers.resultAuto}>{t.offers.result}</Label>
            <p className="field flex items-center text-white/70">{t.statuses[result]}</p>
          </div>
        ) : (
          <Select
            label={t.offers.result}
            value={result}
            onChange={(value) => setResult(value as OfferResult)}
            options={OFFER_RESULTS.map((r) => ({ value: r, label: t.statuses[r] }))}
          />
        )}

        {/* Ниша — свободный текст: select по всему приложению запрещён спецификацией. */}
        <Field
          label={t.outreach.fieldNiche}
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          placeholder={t.outreach.quickNiche}
        />

        <div>
          <TextArea
            label={t.offers.content}
            rows={8}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t.offers.contentPh}
          />
          <Button variant="ghost" className="mt-2" onClick={handleCopy}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? t.common.copied : t.common.copy}
          </Button>
        </div>

        <TextArea
          label={t.offers.note}
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t.offers.notePh}
        />

        <Select
          label={t.offers.linkContact}
          value={contactId}
          onChange={setContactId}
          options={[
            { value: '', label: t.offers.noContact },
            ...contacts.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />

        {offer && onDelete && (
          <div className="border-t border-divider pt-4">
            {confirming ? (
              <div className="space-y-3">
                <p className="text-sm text-danger">{t.common.confirmDelete}</p>
                <div className="flex gap-2">
                  <Button
                    variant="danger"
                    className="flex-1"
                    onClick={() => {
                      void onDelete(offer.id);
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

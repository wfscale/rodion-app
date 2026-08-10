'use client';

import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { useLanguage } from '@/components/LanguageProvider';
import { statusTone } from '@/components/ContactCard';
import { Badge, Button, Field, Label, Select, TextArea } from '@/components/ui';
import { formatDateTime } from '@/lib/date';
import {
  AUDIENCE_SIZES,
  CONTACT_STATUSES,
  NICHES,
  PLATFORMS,
  type AudienceSize,
  type ContactStatus,
  type Niche,
  type OutreachContact,
  type Platform,
} from '@/lib/types';

/* -------------------------------------------------------------------------- */
/*  Добавление новой цели                                                      */
/* -------------------------------------------------------------------------- */

export function AddContactSheet({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: {
    name: string;
    niche: Niche;
    audience_size: AudienceSize;
    platform: Platform;
    note: string | null;
  }) => Promise<void>;
}) {
  const { t } = useLanguage();

  const [name, setName] = useState('');
  const [niche, setNiche] = useState<Niche>('psychology');
  const [audience, setAudience] = useState<AudienceSize>('10-50k');
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setMessage('');
      setError(null);
    }
  }, [open]);

  async function submit() {
    if (!name.trim()) {
      setError(t.outreach.name);
      return;
    }

    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(),
        niche,
        audience_size: audience,
        platform,
        note: message.trim() || null,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t.outreach.addTitle}
      footer={
        <Button full onClick={submit} disabled={busy}>
          {busy ? t.common.saving : t.outreach.submit}
        </Button>
      }
    >
      <div className="space-y-4">
        <Field
          label={t.outreach.name}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          placeholder={t.outreach.namePh}
          error={error ?? undefined}
          autoCapitalize="none"
        />

        <Select
          label={t.outreach.niche}
          value={niche}
          onChange={(value) => setNiche(value as Niche)}
          options={NICHES.map((n) => ({ value: n, label: t.niches[n] }))}
        />

        <Select
          label={t.outreach.audience}
          value={audience}
          onChange={(value) => setAudience(value as AudienceSize)}
          options={AUDIENCE_SIZES.map((a) => ({ value: a, label: a }))}
        />

        <Select
          label={t.outreach.platform}
          value={platform}
          onChange={(value) => setPlatform(value as Platform)}
          options={PLATFORMS.map((p) => ({ value: p, label: t.platforms[p] }))}
        />

        <TextArea
          label={t.outreach.firstMessage}
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t.outreach.firstMessagePh}
        />
      </div>
    </BottomSheet>
  );
}

/* -------------------------------------------------------------------------- */
/*  Детали цели                                                                */
/* -------------------------------------------------------------------------- */

export function ContactSheet({
  contact,
  onClose,
  onStatus,
  onSaveNote,
  onDelete,
}: {
  contact: OutreachContact | null;
  onClose: () => void;
  onStatus: (contact: OutreachContact, status: ContactStatus) => Promise<void>;
  onSaveNote: (id: string, note: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { t, lang } = useLanguage();

  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [saved, setSaved] = useState(false);

  // Во время анимации закрытия contact уже null — держим последнее значение,
  // иначе шторка «схлопывается» пустой.
  const [cached, setCached] = useState<OutreachContact | null>(contact);

  useEffect(() => {
    if (!contact) return;
    setCached(contact);
    setNote(contact.note ?? '');
    setConfirming(false);
    setSaved(false);
  }, [contact]);

  const data = contact ?? cached;
  if (!data) return null;

  const meta = [
    data.niche ? t.niches[data.niche] : null,
    data.audience_size,
    data.platform ? t.platforms[data.platform] : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const history = [...(data.status_history ?? [])].reverse();

  async function saveNote() {
    if (!data) return;
    await onSaveNote(data.id, note);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  }

  return (
    <BottomSheet open={contact !== null} onClose={onClose} title={data.name}>
      <div className="space-y-5">
        {meta && <p className="-mt-2 text-sm text-muted">{meta}</p>}

        {/* Статусы воронки */}
        <div>
          <Label>{t.outreach.statusLabel}</Label>
          <div className="flex flex-wrap gap-2">
            {CONTACT_STATUSES.map((status) => {
              const active = data.status === status;
              return (
                <motion.button
                  key={status}
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={() => void onStatus(data, status)}
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

        {/* Заметка */}
        <div>
          <TextArea
            label={t.outreach.note}
            rows={6}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t.outreach.notePh}
          />
          <Button variant="ghost" className="mt-2" onClick={saveNote}>
            {saved ? t.common.saved : t.common.save}
          </Button>
        </div>

        {/* История статусов */}
        <div>
          <Label>{t.outreach.history}</Label>
          {history.length === 0 ? (
            <p className="text-sm text-muted">{t.outreach.noHistory}</p>
          ) : (
            <ol className="relative space-y-3 border-l border-divider pl-4">
              {history.map((entry, i) => (
                <li key={`${entry.at}-${i}`} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-white/40" />
                  <div className="flex items-center gap-2">
                    <Badge tone={statusTone(entry.status)}>{t.statuses[entry.status]}</Badge>
                    <span className="text-xs text-white/30">
                      {formatDateTime(entry.at, lang)}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Удаление */}
        <div className="border-t border-divider pt-4">
          {confirming ? (
            <div className="space-y-3">
              <p className="text-sm text-danger">{t.common.confirmDelete}</p>
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  className="flex-1"
                  onClick={() => {
                    void onDelete(data.id);
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
      </div>
    </BottomSheet>
  );
}

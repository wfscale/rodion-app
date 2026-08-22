'use client';

import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { useLanguage } from '@/components/LanguageProvider';
import { Button, Field, TextArea } from '@/components/ui';
import type { SnippetDraft } from '@/hooks/useSnippets';
import type { Snippet } from '@/lib/types';

type SnippetSheetProps = {
  open: boolean;
  /** null — заводим новую. */
  snippet: Snippet | null;
  onClose: () => void;
  onSave: (draft: SnippetDraft, id: string | null) => void;
  onDelete: (id: string) => void;
};

const EMPTY: SnippetDraft = { title: '', content: '' };

/** Шторка заготовки: имя и текст, больше ничего. */
export function SnippetSheet({ open, snippet, onClose, onSave, onDelete }: SnippetSheetProps) {
  const { t } = useLanguage();

  const [draft, setDraft] = useState<SnippetDraft>(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(snippet ? { title: snippet.title, content: snippet.content } : EMPTY);
    setConfirmDelete(false);
  }, [open, snippet]);

  const valid = draft.title.trim().length > 0 && draft.content.trim().length > 0;

  return (
    <BottomSheet open={open} onClose={onClose} title={snippet ? snippet.title : t.snippets.add}>
      <div className="space-y-4">
        <Field
          label={t.snippets.name}
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          placeholder={t.snippets.namePh}
          autoComplete="off"
        />

        <TextArea
          label={t.snippets.text}
          rows={7}
          value={draft.content}
          onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
          placeholder={t.snippets.textPh}
        />

        <Button
          full
          disabled={!valid}
          onClick={() => {
            onSave(draft, snippet?.id ?? null);
            onClose();
          }}
        >
          {t.common.save}
        </Button>

        {snippet &&
          (confirmDelete ? (
            <div className="space-y-3 rounded-2xl border border-[rgba(255,107,107,0.25)] bg-[rgba(255,107,107,0.06)] p-3">
              <p className="text-sm leading-relaxed text-danger">{t.snippets.deleteConfirm}</p>
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  className="flex-1"
                  onClick={() => {
                    onDelete(snippet.id);
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
              {t.common.delete}
            </Button>
          ))}
      </div>
    </BottomSheet>
  );
}

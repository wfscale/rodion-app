'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { useLanguage } from '@/components/LanguageProvider';
import { AudioPlayer } from '@/components/notes/AudioPlayer';
import { Badge, Button, Segmented } from '@/components/ui';
import { formatDateTime } from '@/lib/date';
import { NOTE_TAGS, type Note, type NoteTag } from '@/lib/types';

/** Просмотр и редактирование заметки. */
export function NoteSheet({
  note,
  onClose,
  onSave,
  onTrash,
  audioUrl,
}: {
  note: Note | null;
  onClose: () => void;
  onSave: (id: string, patch: { content: string; tag: NoteTag }) => Promise<void>;
  onTrash: (id: string) => Promise<void>;
  /** Подписать ссылку на запись. Без него плеер не показывается. */
  audioUrl?: (path: string) => Promise<string | null>;
}) {
  const { t, lang } = useLanguage();

  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState('');
  const [tag, setTag] = useState<NoteTag>('thought');
  const [busy, setBusy] = useState(false);

  // Во время анимации закрытия note уже null — держим последнее значение.
  const [cached, setCached] = useState<Note | null>(note);

  useEffect(() => {
    if (!note) return;
    setCached(note);
    setContent(note.content);
    setTag(note.tag);
    setEditing(false);
  }, [note]);

  const data = note ?? cached;
  if (!data) return null;

  const edited = data.updated_at && data.updated_at !== data.created_at;

  async function save() {
    // У голосовой заметки текста может не быть вовсе: мысль записана голосом,
    // и требовать описание значит мешать её сохранить.
    if (!data || (!content.trim() && !data.audio_path)) return;
    setBusy(true);
    try {
      await onSave(data.id, { content: content.trim(), tag });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      open={note !== null}
      onClose={onClose}
      title={t.tags[data.tag]}
      footer={
        editing ? (
          <div className="flex gap-2">
            <Button className="flex-1" onClick={save} disabled={busy}>
              {busy ? t.common.saving : t.common.save}
            </Button>
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => {
                setContent(data.content);
                setTag(data.tag);
                setEditing(false);
              }}
            >
              {t.common.cancel}
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => setEditing(true)}>
              <Pencil size={16} />
              {t.common.edit}
            </Button>
            <Button
              variant="danger"
              className="w-14 shrink-0"
              aria-label={t.common.delete}
              onClick={() => {
                void onTrash(data.id);
                onClose();
              }}
            >
              <Trash2 size={16} />
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-4">
        {/* Плеер стоит над текстом и виден в обоих режимах: правя расшифровку,
            приходится переслушивать — а ради этого голосовые и заводились. */}
        {data.audio_path && audioUrl && (
          <AudioPlayer path={data.audio_path} duration={data.audio_duration} resolve={audioUrl} />
        )}

        {editing ? (
          <>
            <textarea
              autoFocus
              rows={10}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t.voice.addNotePh}
              className="field"
            />

            <Segmented<NoteTag>
              value={tag}
              onChange={setTag}
              options={NOTE_TAGS.map((noteTag) => ({
                value: noteTag,
                label: t.tags[noteTag],
              }))}
            />
          </>
        ) : (
          <>
            {data.content.trim() ? (
              <p className="whitespace-pre-wrap text-base leading-relaxed">{data.content}</p>
            ) : (
              <p className="text-base italic leading-relaxed text-white/30">{t.voice.untitled}</p>
            )}

            <div className="flex items-center gap-2 border-t border-divider pt-3">
              <Badge>{t.tags[data.tag]}</Badge>
              <span className="text-xs text-white/30">
                {formatDateTime(data.created_at, lang)}
                {edited && ` · ${t.notes.edited} ${formatDateTime(data.updated_at, lang)}`}
              </span>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  );
}

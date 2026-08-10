'use client';

import { motion } from 'framer-motion';
import { FileText, Search, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { NoteCard, TrashedNoteCard } from '@/components/NoteCard';
import { NoteSheet } from '@/components/NoteSheet';
import { Button, EmptyState, PageTitle, Segmented, Spinner } from '@/components/ui';
import { useNotes } from '@/hooks/useNotes';
import { NOTE_TAGS, type Note, type NoteTag } from '@/lib/types';

export default function NotesPage() {
  const { t } = useLanguage();
  const notes = useNotes();

  const [draft, setDraft] = useState('');
  const [tag, setTag] = useState<NoteTag>('thought');
  const [query, setQuery] = useState('');
  const [openNote, setOpenNote] = useState<Note | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [saving, setSaving] = useState(false);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return notes.notes;
    return notes.notes.filter((note) => note.content.toLowerCase().includes(needle));
  }, [notes.notes, query]);

  async function save() {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await notes.addNote(draft, tag);
      setDraft('');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageTitle
        right={
          <button
            type="button"
            onClick={() => setShowTrash((value) => !value)}
            aria-label={t.notes.trash}
            className={`flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${
              showTrash
                ? 'border-white bg-white text-ink'
                : 'border-glass-border bg-white/[0.05] text-white/50'
            }`}
          >
            {showTrash ? <X size={18} /> : <Trash2 size={18} />}
          </button>
        }
      >
        {showTrash ? t.notes.trash : t.notes.title}
      </PageTitle>

      {showTrash ? (
        /* -------------------------- Корзина -------------------------- */
        <>
          <p className="text-sm text-muted">{t.notes.trashHint}</p>

          {notes.trashed.length === 0 ? (
            <EmptyState icon={<Trash2 size={34} />} text={t.notes.trashEmpty} />
          ) : (
            <div className="space-y-2">
              {notes.trashed.map((note) => (
                <TrashedNoteCard
                  key={note.id}
                  note={note}
                  onRestore={() => void notes.restoreNote(note.id)}
                  onDeleteForever={() => void notes.deleteForever(note.id)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        /* ------------------------- Заметки --------------------------- */
        <>
          {/* Быстрое добавление */}
          <GlassCard>
            <textarea
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t.notes.placeholder}
              className="field"
            />

            <div className="mt-3">
              <Segmented<NoteTag>
                value={tag}
                onChange={setTag}
                options={NOTE_TAGS.map((noteTag) => ({
                  value: noteTag,
                  label: t.tags[noteTag],
                }))}
              />
            </div>

            <motion.div
              initial={false}
              animate={{ opacity: draft.trim() ? 1 : 0.45 }}
              className="mt-3"
            >
              <Button full onClick={save} disabled={!draft.trim() || saving}>
                {saving ? t.common.saving : t.notes.save}
              </Button>
            </motion.div>
          </GlassCard>

          {/* Поиск */}
          <label className="relative block">
            <Search
              size={17}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.notes.searchPh}
              className="field pl-11"
            />
          </label>

          {/* Список */}
          {notes.loading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<FileText size={34} />}
              text={query.trim() ? t.notes.emptySearch : t.notes.empty}
            />
          ) : (
            <div className="space-y-2">
              {visible.map((note, i) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  index={i}
                  onOpen={() => setOpenNote(note)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <NoteSheet
        note={openNote}
        onClose={() => setOpenNote(null)}
        onSave={async (id, patch) => {
          await notes.updateNote(id, patch);
          setOpenNote((current) => (current ? { ...current, ...patch } : current));
        }}
        onTrash={notes.trashNote}
      />
    </div>
  );
}

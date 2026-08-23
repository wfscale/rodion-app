'use client';

import { motion } from 'framer-motion';
import { Bell, History, Lightbulb, Mic, Plus, Search, Sparkles, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { NoteCard, TrashedNoteCard } from '@/components/NoteCard';
import { NoteSheet } from '@/components/NoteSheet';
import { VoiceRecorder } from '@/components/notes/VoiceRecorder';
import { ReminderList } from '@/components/reminders/ReminderList';
import { ReminderSheet } from '@/components/reminders/ReminderSheet';
import { SnippetsCard } from '@/components/snippets/SnippetsCard';
import { SnippetSheet } from '@/components/snippets/SnippetSheet';
import {
  Button,
  DeskColumns,
  DeskGrid,
  EmptyState,
  PageTitle,
  Segmented,
  Spinner,
} from '@/components/ui';
import { useNotes } from '@/hooks/useNotes';
import { useSnippets } from '@/hooks/useSnippets';
import { countByTag, hasNoteToday, resurface } from '@/lib/notes-stats';
import { standalone } from '@/lib/reminders';
import type { Recording } from '@/hooks/useVoiceRecorder';
import { NOTE_TAGS, type Note, type NoteTag, type Reminder, type Snippet } from '@/lib/types';
import { onceKey, XP } from '@/lib/xp';

type TagFilter = NoteTag | 'all';

/** Цвет метки. Единственное место в приложении, где цвет несёт смысл сам по себе. */
const TAG_TONE: Record<NoteTag, string> = {
  idea: 'border-[rgba(255,209,102,0.35)] bg-[rgba(255,209,102,0.10)] text-warn',
  goal: 'border-[rgba(100,255,140,0.35)] bg-[rgba(100,255,140,0.10)] text-success',
  insight: 'border-[rgba(127,216,255,0.35)] bg-[rgba(127,216,255,0.10)] text-[#7FD8FF]',
  thought: 'border-glass-border bg-white/[0.06] text-white/60',
};

export default function NotesPage() {
  const { t, tf, days } = useLanguage();
  const app = useApp();
  const notes = useNotes();
  const snippets = useSnippets();

  const [draft, setDraft] = useState('');
  const [tag, setTag] = useState<NoteTag>('thought');
  const [tagFilter, setTagFilter] = useState<TagFilter>('all');
  const [voiceOnly, setVoiceOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [openNote, setOpenNote] = useState<Note | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [saving, setSaving] = useState(false);

  const [snippetOpen, setSnippetOpen] = useState(false);
  const [openSnippet, setOpenSnippet] = useState<Snippet | null>(null);

  const [reminderOpen, setReminderOpen] = useState(false);
  const [openReminder, setOpenReminder] = useState<Reminder | null>(null);

  /**
   * Цепочки дней здесь намеренно нет.
   *
   * Мысль приходит не по расписанию: требовать «одну в день» — значит
   * заставлять писать пустое, чтобы не рвать полоску, а потом бросить
   * раздел совсем. Считается только то, что накопилось, — это не давит.
   */
  const stats = useMemo(
    () => ({
      count: notes.notes.length,
      byTag: countByTag(notes.notes),
    }),
    [notes.notes],
  );

  const fromPast = useMemo(() => resurface(notes.notes, app.today), [notes.notes, app.today]);

  const voiceCount = useMemo(
    () => notes.notes.filter((note) => note.audio_path).length,
    [notes.notes],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return notes.notes.filter((note) => {
      if (voiceOnly && !note.audio_path) return false;
      if (tagFilter !== 'all' && note.tag !== tagFilter) return false;
      if (needle && !note.content.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [notes.notes, query, tagFilter, voiceOnly]);

  const generalReminders = useMemo(() => standalone(app.reminders), [app.reminders]);

  async function save() {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      const firstToday = !hasNoteToday(notes.notes, app.today);
      await notes.addNote(draft, tag);
      setDraft('');
      // Первая мысль за день — символические XP, один раз в сутки.
      if (firstToday) {
        await app.awardXp(XP.NOTE_FIRST, 'note', onceKey.note(app.today));
      }
    } finally {
      setSaving(false);
    }
  }

  /**
   * Сохранить запись.
   *
   * Расшифровка сразу становится текстом заметки: искать по заметкам надо и
   * по сказанному вслух, иначе через месяц в списке лежат сорок безымянных
   * записей. Метка — «мысль»: выбирать её в момент записи некогда, а сменить
   * потом можно одним тапом.
   */
  async function saveVoice(recording: Recording): Promise<boolean> {
    const firstToday = !hasNoteToday(notes.notes, app.today);

    await notes.addNote(recording.transcript, 'thought', {
      blob: recording.blob,
      mime: recording.mime,
      seconds: recording.seconds,
    });

    if (firstToday) {
      await app.awardXp(XP.NOTE_FIRST, 'note', onceKey.note(app.today));
    }
    return true;
  }

  /* ------------------------------------------------------------------ */

  const notesColumn = (
    <>
      {/*
        Запись голоса — самый верх раздела и один тап от нажатия до начала.
        Мысль живёт секунд десять: любой экран между ней и микрофоном
        означает, что она не запишется вообще. Метка, описание и правка
        делаются потом, по готовой заметке.
      */}
      <VoiceRecorder onSave={saveVoice} />

      {/* Полоса состояния: сколько накопилось. Заметки перестают быть
          свалкой, когда видно, что они складываются во что-то. */}
      <div className="grid grid-cols-3 gap-2">
        {[
          {
            icon: <History size={15} />,
            value: stats.count,
            label: t.notes.statCount,
            lit: false,
          },
          {
            icon: <Lightbulb size={15} />,
            value: stats.byTag.idea,
            label: t.notes.statIdeas,
            lit: stats.byTag.idea > 0,
          },
          {
            icon: <Sparkles size={15} />,
            value: stats.byTag.insight,
            label: t.notes.statInsights,
            lit: stats.byTag.insight > 0,
          },
        ].map((cell) => (
          <div
            key={cell.label}
            className={`rounded-2xl border px-2 py-3 text-center ${
              cell.lit
                ? 'border-[rgba(255,209,102,0.3)] bg-[rgba(255,209,102,0.07)]'
                : 'border-glass-border bg-white/[0.03]'
            }`}
          >
            <span
              className={`mx-auto mb-1 flex h-5 w-5 items-center justify-center ${
                cell.lit ? 'text-warn' : 'text-white/30'
              }`}
            >
              {cell.icon}
            </span>
            <p className="text-xl font-extrabold tabular-nums">{cell.value}</p>
            <p className="mt-0.5 text-[11px] leading-tight text-white/40">{cell.label}</p>
          </div>
        ))}
      </div>

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
            options={NOTE_TAGS.map((noteTag) => ({ value: noteTag, label: t.tags[noteTag] }))}
          />
        </div>

        <motion.div initial={false} animate={{ opacity: draft.trim() ? 1 : 0.45 }} className="mt-3">
          <Button full onClick={save} disabled={!draft.trim() || saving}>
            {saving ? t.common.saving : t.notes.save}
          </Button>
        </motion.div>
      </GlassCard>

      {/* Мысль из прошлого — то, ради чего заметки вообще пишут. */}
      {fromPast && (
        <motion.button
          type="button"
          onClick={() => setOpenNote(fromPast.note)}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full rounded-glass border border-dashed border-white/15 bg-white/[0.03] p-4 text-left"
        >
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-white/35">
            <History size={13} />
            {t.notes.resurfaceTitle}
            <span className="font-semibold normal-case tracking-normal text-white/25">
              · {tf(t.notes.resurfaceAgo, { n: `${fromPast.daysAgo} ${days(fromPast.daysAgo)}` })}
            </span>
          </p>
          <p className="mt-2 whitespace-pre-wrap text-base leading-snug">
            {fromPast.note.content.slice(0, 200)}
            {fromPast.note.content.length > 200 ? '…' : ''}
          </p>
          <p className="mt-2 text-xs text-white/25">{t.notes.resurfaceHint}</p>
        </motion.button>
      )}

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

      {/* Фильтр по меткам — они же цветные, поэтому список читается глазом. */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <button
          type="button"
          onClick={() => setTagFilter('all')}
          aria-pressed={tagFilter === 'all'}
          className={`min-h-[44px] shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors ${
            tagFilter === 'all'
              ? 'border-white bg-white text-ink'
              : 'border-glass-border bg-white/[0.05] text-white/55'
          }`}
        >
          {t.notes.filterAll}
          <span className={tagFilter === 'all' ? 'ml-1.5 text-black/45' : 'ml-1.5 text-white/30'}>
            {stats.count}
          </span>
        </button>

        {/* Голосовые надо уметь найти отдельно: их переслушивают ради
            интонации, а не ищут по словам, и в общем списке они теряются
            между текстовыми. Чип появляется, только когда записи есть. */}
        {voiceCount > 0 && (
          <button
            type="button"
            onClick={() => setVoiceOnly((value) => !value)}
            aria-pressed={voiceOnly}
            className={`flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors ${
              voiceOnly
                ? 'border-white bg-white text-ink'
                : 'border-glass-border bg-white/[0.05] text-white/55'
            }`}
          >
            <Mic size={14} />
            {t.voice.filter}
            <span className={voiceOnly ? 'text-black/45' : 'text-white/30'}>{voiceCount}</span>
          </button>
        )}

        {NOTE_TAGS.map((noteTag) => {
          const active = tagFilter === noteTag;
          return (
            <button
              key={noteTag}
              type="button"
              onClick={() => setTagFilter(active ? 'all' : noteTag)}
              aria-pressed={active}
              className={`min-h-[44px] shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors ${
                active ? 'border-white bg-white text-ink' : TAG_TONE[noteTag]
              }`}
            >
              {t.tags[noteTag]}
              <span className={active ? 'ml-1.5 text-black/45' : 'ml-1.5 opacity-60'}>
                {stats.byTag[noteTag]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Список */}
      {notes.loading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Sparkles size={34} />}
          text={
            query.trim() || tagFilter !== 'all' || voiceOnly
              ? t.notes.emptySearch
              : t.notes.empty
          }
        />
      ) : (
        // Столбик, а не сетка: колонку страницы уже делит DeskColumns, и
        // вторая сетка внутри неё нарезала бы заметки на узкие огрызки.
        <div className="space-y-2">
          {visible.map((note, i) => (
            <NoteCard
              key={note.id}
              note={note}
              index={i}
              onOpen={() => setOpenNote(note)}
              audioUrl={notes.audioUrl}
            />
          ))}
        </div>
      )}
    </>
  );

  const remindersColumn = (
    <>
      {app.remindersReady ? (
        <>
          {/* Заголовок появился вместе с колонкой: раньше раздел называла
              вкладка, а теперь оба списка на экране одновременно. */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <h2 className="text-sm font-bold tracking-wide">{t.notes.tabReminders}</h2>
            {app.remindersDue > 0 && (
              <span className="shrink-0 rounded-full bg-warn px-2 py-0.5 text-xs font-extrabold tabular-nums text-ink">
                {app.remindersDue}
              </span>
            )}
          </div>

          <Button
            full
            onClick={() => {
              setOpenReminder(null);
              setReminderOpen(true);
            }}
          >
            <Plus size={18} />
            {t.reminders.add}
          </Button>

          <ReminderList
            reminders={generalReminders}
            contacts={app.contacts}
            now={app.now}
            today={app.today}
            onToggle={(id) => void app.toggleReminder(id)}
            onOpen={(reminder) => {
              setOpenReminder(reminder);
              setReminderOpen(true);
            }}
            onDelete={(id) => void app.deleteReminder(id)}
          />
        </>
      ) : (
        <EmptyState icon={<Bell size={34} />} text={t.reminders.needsMigration} />
      )}
    </>
  );

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
            <DeskGrid className="gap-3 [&>*]:mb-3">
              {notes.trashed.map((note) => (
                <TrashedNoteCard
                  key={note.id}
                  note={note}
                  onRestore={() => void notes.restoreNote(note.id)}
                  onDeleteForever={() => void notes.deleteForever(note.id)}
                />
              ))}
            </DeskGrid>
          )}
        </>
      ) : (
        /*
          Вкладок больше нет: заготовки, заметки и напоминания видны сразу.
          Переключение между ними стоило тапа каждый раз, когда нужно было
          свериться с одним, находясь в другом, — а это половина заходов сюда.

          Заготовки стоят первыми. Это единственный список на странице, к
          которому возвращаются каждый день: заметки просят что-то написать,
          ничего не обещая взамен, и потому не открывались месяцами.
          Напоминания, привязанные к людям, сюда не попадают — они живут в
          блоке касаний на рассылках.
        */
        <DeskColumns
          main={
            <>
              <SnippetsCard
                snippets={snippets.snippets}
                ready={snippets.ready}
                onUse={(id) => void snippets.use(id)}
                onEdit={(snippet) => {
                  setOpenSnippet(snippet);
                  setSnippetOpen(true);
                }}
                onAdd={() => {
                  setOpenSnippet(null);
                  setSnippetOpen(true);
                }}
              />

              {notesColumn}
            </>
          }
          side={remindersColumn}
        />
      )}

      <NoteSheet
        note={openNote}
        onClose={() => setOpenNote(null)}
        onSave={async (id, patch) => {
          await notes.updateNote(id, patch);
          setOpenNote((current) => (current ? { ...current, ...patch } : current));
        }}
        onTrash={notes.trashNote}
        audioUrl={notes.audioUrl}
      />

      <SnippetSheet
        open={snippetOpen}
        snippet={openSnippet}
        onClose={() => {
          setSnippetOpen(false);
          setOpenSnippet(null);
        }}
        onSave={(draft, id) => void snippets.save(draft, id)}
        onDelete={(id) => void snippets.remove(id)}
      />

      <ReminderSheet
        open={reminderOpen}
        reminder={openReminder}
        contacts={app.contacts}
        onClose={() => {
          setReminderOpen(false);
          setOpenReminder(null);
        }}
        onSave={async (reminderDraft, id) => {
          if (id) {
            await app.updateReminder(id, {
              title: reminderDraft.title,
              note: reminderDraft.note || null,
              due_at: reminderDraft.due_at,
              contact_id: reminderDraft.contact_id,
            });
          } else {
            await app.addReminder(reminderDraft);
          }
        }}
        onDelete={(id) => app.deleteReminder(id)}
      />
    </div>
  );
}

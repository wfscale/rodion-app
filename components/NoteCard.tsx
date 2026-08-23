'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { ChevronDown, RotateCcw, Trash2 } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { AudioPlayer } from '@/components/notes/AudioPlayer';
import { Badge } from '@/components/ui';
import { formatDateTime } from '@/lib/date';
import { TRASH_DAYS } from '@/hooks/useNotes';
import type { Note } from '@/lib/types';

/**
 * Сколько знаков видно в карточке до раскрытия.
 *
 * Длинную мысль список превращает в стену, по которой не пробежаться
 * глазами. Расшифровка голосового почти всегда длиннее — поэтому раскрытие
 * живёт прямо здесь, а не только в шторке: переслушать и перечитать хочется
 * не выходя из списка.
 */
const PREVIEW_CHARS = 120;

export function NoteCard({
  note,
  onOpen,
  index = 0,
  audioUrl,
}: {
  note: Note;
  onOpen: () => void;
  index?: number;
  /** Подписать ссылку на запись. Без него плеер не показывается. */
  audioUrl?: (path: string) => Promise<string | null>;
}) {
  const { t, lang } = useLanguage();
  const edited = note.updated_at && note.updated_at !== note.created_at;
  const hasAudio = Boolean(note.audio_path && audioUrl);

  const [expanded, setExpanded] = useState(false);
  const long = note.content.length > PREVIEW_CHARS;

  /*
   * div с ролью кнопки, а не <button>: внутри лежит плеер со своей кнопкой,
   * а вложенные кнопки в HTML недопустимы — браузер разворачивает разметку,
   * и карточка разъезжается.
   */
  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      whileTap={{ scale: 0.985 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index, 8) * 0.035 }}
      className="glass w-full cursor-pointer p-4 text-left"
    >
      {/* У голосовой заметки текстом может быть расшифровка, а может не быть
          ничего — тогда вместо пустоты стоит честная подпись, иначе карточка
          выглядит сломанной. */}
      {note.content.trim() ? (
        <p className="whitespace-pre-wrap text-base leading-snug">
          {expanded || !long ? note.content : `${note.content.slice(0, PREVIEW_CHARS)}…`}
        </p>
      ) : (
        <p className="text-base italic leading-snug text-white/30">
          {hasAudio ? t.voice.emptyText : t.voice.untitled}
        </p>
      )}

      {long && (
        <button
          type="button"
          onClick={(e) => {
            // Карточка по нажатию открывает заметку — раскрытие текста
            // не должно её открывать заодно.
            e.stopPropagation();
            setExpanded((value) => !value);
          }}
          className="mt-2 flex min-h-[36px] items-center gap-1.5 text-xs font-bold text-white/45 transition-colors hover:text-white"
        >
          <motion.span
            initial={false}
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex"
          >
            <ChevronDown size={14} />
          </motion.span>
          {expanded ? t.voice.hideText : t.voice.showText}
        </button>
      )}

      {hasAudio && (
        <div className="mt-3">
          <AudioPlayer
            path={note.audio_path as string}
            duration={note.audio_duration}
            resolve={audioUrl as (path: string) => Promise<string | null>}
            compact
          />
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <Badge>{t.tags[note.tag]}</Badge>
        <span className="text-xs text-white/25">
          {formatDateTime(note.created_at, lang)}
          {edited && ` · ${t.notes.edited} ${formatDateTime(note.updated_at, lang)}`}
        </span>
      </div>
    </motion.div>
  );
}

/** Карточка в корзине: восстановить или удалить навсегда. */
export function TrashedNoteCard({
  note,
  onRestore,
  onDeleteForever,
}: {
  note: Note;
  onRestore: () => void;
  onDeleteForever: () => void;
}) {
  const { t, lang, days } = useLanguage();

  const deletedAt = note.deleted_at ? new Date(note.deleted_at).getTime() : Date.now();
  const left = Math.max(
    0,
    TRASH_DAYS - Math.floor((Date.now() - deletedAt) / 86_400_000),
  );

  return (
    <div className="glass p-4">
      <p className="whitespace-pre-wrap text-sm leading-snug text-white/55">
        {note.content.slice(0, 120)}
        {note.content.length > 120 ? '…' : ''}
      </p>

      <p className="mt-2 text-xs text-white/25">
        {formatDateTime(note.created_at, lang)} · {left} {days(left)}{' '}
        {t.notes.daysLeft}
      </p>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onRestore}
          className="btn-ghost min-h-[44px] flex-1 text-sm font-semibold"
        >
          <RotateCcw size={15} />
          {t.notes.restore}
        </button>

        <button
          type="button"
          onClick={onDeleteForever}
          aria-label={t.notes.deleteForever}
          className="btn-ghost min-h-[44px] w-14 shrink-0 border-[rgba(255,107,107,0.25)] text-danger"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

'use client';

import { motion } from 'framer-motion';
import { Check, ChevronDown, ChevronUp, ExternalLink, Plus } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useLanguage } from '@/components/LanguageProvider';
import { daysSince } from '@/components/outreach/ContactCards';
import {
  emptyDraft,
  instagramUrlFrom,
  normalizeHandle,
  statusTone,
  telegramUrl,
  type ContactDraft,
} from '@/components/outreach/ContactSheet';
import { useColumnWidths, type ColumnWidths } from '@/components/outreach/useColumnWidths';
import { Badge } from '@/components/ui';
import { daysBetween, formatShortDate, getLogicalDate } from '@/lib/date';
import { followUpState, needsTouch } from '@/lib/followup';
import {
  CONTACT_STATUSES,
  NEGATIVE_STATUSES,
  normalizeStatus,
  type ContactStatus,
  type OutreachContact,
} from '@/lib/types';

/* -------------------------------------------------------------------------- */
/*  Колонки и сортировка                                                       */
/* -------------------------------------------------------------------------- */

type ColumnKey =
  | 'num'
  | 'status'
  | 'name'
  | 'telegram'
  | 'instagram'
  | 'niche'
  | 'date'
  | 'days'
  | 'comment'
  | 'nextStep'
  | 'speed';

export type SortKey = 'name' | 'status' | 'niche' | 'date';
export type TableSort = { key: SortKey; dir: 'asc' | 'desc' };

const DEFAULT_WIDTHS: ColumnWidths<ColumnKey> = {
  num: 60,
  status: 136,
  name: 180,
  telegram: 140,
  instagram: 112,
  niche: 140,
  date: 116,
  days: 92,
  comment: 260,
  nextStep: 180,
  speed: 128,
};

/** Первые три колонки прилипают слева на телефоне при горизонтальном скролле. */
const PINNED: ColumnKey[] = ['num', 'status', 'name'];

/** Сколько символов комментария видно до тапа (§12). */
const COMMENT_PREVIEW = 30;

/* -------------------------------------------------------------------------- */
/*  Ячейка статуса с mini-dropdown                                             */
/* -------------------------------------------------------------------------- */

function StatusCell({
  status,
  onChange,
}: {
  status: ContactStatus;
  onChange: (status: ContactStatus) => void;
}) {
  const { t } = useLanguage();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState<{ top: number; left: number } | null>(null);

  // Меню позиционируется фиксировано от кнопки: внутри скроллящейся таблицы
  // абсолютный дропдаун обрезался бы краем контейнера.
  function open() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const height = CONTACT_STATUSES.length * 40 + 12;
    const fitsBelow = window.innerHeight - rect.bottom > height;
    setMenu({
      top: fitsBelow ? rect.bottom + 6 : Math.max(8, rect.top - height - 6),
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 196)),
    });
  }

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    // Скролл таблицы уводит кнопку — держать открытым меню бессмысленно.
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (menu) setMenu(null);
          else open();
        }}
        aria-haspopup="listbox"
        aria-expanded={menu !== null}
        className="flex min-h-[44px] w-full items-center rounded-lg px-1 text-left transition-colors hover:bg-white/[0.06]"
      >
        <Badge tone={statusTone(status)}>{t.statuses[status]}</Badge>
      </button>

      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
          <motion.div
            role="listbox"
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.14 }}
            style={{ top: menu.top, left: menu.left }}
            className="glass-flat fixed z-50 w-[188px] rounded-2xl p-1.5 shadow-glass"
          >
            {CONTACT_STATUSES.map((option) => (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={option === status}
                onClick={() => {
                  setMenu(null);
                  if (option !== status) onChange(option);
                }}
                className="flex min-h-[40px] w-full items-center justify-between gap-2 rounded-xl px-3 text-left text-sm font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                {t.statuses[option]}
                {option === status && <Check size={15} />}
              </button>
            ))}
          </motion.div>
        </>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Таблица                                                                    */
/* -------------------------------------------------------------------------- */

type ContactTableProps = {
  contacts: OutreachContact[];
  onOpenContact: (contact: OutreachContact) => void;
  onStatusChange: (contact: OutreachContact, status: ContactStatus) => void;
  onInlineAdd: (draft: ContactDraft) => void;
  /** Свежая строка: slide-down + свечение, гаснущее за секунду. */
  highlightId: string | null;
  /** Колонка «Скорость ответа» — открывается на 4-м уровне. */
  showSpeed?: boolean;
  /** Колонка «Следующий шаг» — тоже 4-й уровень. */
  showNextStep?: boolean;
  /** null — порядок как пришёл (по дате добавления). */
  sort: TableSort | null;
  onSortChange: (sort: TableSort) => void;
};

export function ContactTable({
  contacts,
  onOpenContact,
  onStatusChange,
  onInlineAdd,
  highlightId,
  showSpeed = false,
  showNextStep = false,
  sort,
  onSortChange,
}: ContactTableProps) {
  const { t, lang, days } = useLanguage();
  const { widths, startResize, resetColumn } = useColumnWidths(DEFAULT_WIDTHS);

  const columns = useMemo(() => {
    const list: { key: ColumnKey; label: string; sort?: SortKey }[] = [
      { key: 'num', label: t.outreach.colNum },
      { key: 'status', label: t.outreach.colStatus, sort: 'status' },
      { key: 'name', label: t.outreach.colName, sort: 'name' },
      { key: 'telegram', label: t.outreach.colTelegram },
      { key: 'instagram', label: t.outreach.colInstagram },
      { key: 'niche', label: t.outreach.colNiche, sort: 'niche' },
      { key: 'date', label: t.outreach.colDate, sort: 'date' },
      { key: 'days', label: t.outreach.colDays },
      { key: 'comment', label: t.outreach.colComment },
    ];
    if (showNextStep) list.push({ key: 'nextStep', label: t.outreach.colNextStep });
    if (showSpeed) list.push({ key: 'speed', label: t.outreach.colSpeed });
    return list;
  }, [t, showNextStep, showSpeed]);

  /**
   * № — порядковый номер по дате добавления. Считается один раз по всему
   * списку, поэтому сортировка колонок его не трогает.
   */
  const numbers = useMemo(() => {
    const map = new Map<string, number>();
    [...contacts]
      .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
      .forEach((contact, index) => map.set(contact.id, index + 1));
    return map;
  }, [contacts]);

  const rows = useMemo(() => {
    if (!sort) return contacts;
    const direction = sort.dir === 'asc' ? 1 : -1;
    return [...contacts].sort((a, b) => direction * compareBy(a, b, sort.key));
  }, [contacts, sort]);

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggleComment = useCallback((id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /* ---------------------------- инлайн-добавление ------------------------- */

  const inlineOrder = useMemo(() => {
    const order: InlineKey[] = ['name', 'telegram', 'instagram', 'niche', 'comment'];
    if (showNextStep) order.push('nextStep');
    return order;
  }, [showNextStep]);

  const [inline, setInline] = useState<InlineRow>(EMPTY_INLINE);
  const inlineRefs = useRef<Array<HTMLInputElement | null>>([]);

  const submitInline = useCallback(() => {
    const name = inline.name.trim();
    if (!name) {
      inlineRefs.current[0]?.focus();
      return;
    }
    onInlineAdd({
      ...emptyDraft(),
      name,
      niche: inline.niche.trim(),
      telegram_handle: normalizeHandle(inline.telegram),
      instagram_url: instagramUrlFrom(inline.instagram),
      comment: inline.comment.trim(),
      next_step: inline.nextStep.trim(),
    });
    setInline(EMPTY_INLINE);
    inlineRefs.current[0]?.focus();
  }, [inline, onInlineAdd]);

  function onInlineKey(e: ReactKeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key === 'Escape') {
      setInline(EMPTY_INLINE);
      return;
    }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    // Tab ходит по ячейкам сам — Enter доводит до конца и сохраняет.
    if (index === inlineOrder.length - 1) submitInline();
    else inlineRefs.current[index + 1]?.focus();
  }

  /* ------------------------------ скролл-тень ----------------------------- */

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const check = () =>
      setScrollable(node.scrollWidth - node.clientWidth - node.scrollLeft > 8);
    check();
    node.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      node.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [columns.length, widths]);

  /* -------------------------------- рендер -------------------------------- */

  const totalWidth = columns.reduce((sum, column) => sum + widths[column.key], 0);
  const pinnedOffsets = pinnedLeft(widths);
  const today = getLogicalDate();

  function headerCell(column: { key: ColumnKey; label: string; sort?: SortKey }) {
    const pinned = PINNED.includes(column.key);
    const active = sort?.key === column.sort;

    return (
      <th
        key={column.key}
        scope="col"
        style={{ '--sl': `${pinnedOffsets[column.key] ?? 0}px` } as CSSProperties}
        className={`sticky top-0 h-11 border-b border-glass-border bg-[rgba(255,255,255,0.06)] px-3 text-left align-middle backdrop-blur-[16px] ${
          pinned ? 'z-30 max-md:sticky max-md:left-[var(--sl)]' : 'z-20'
        }`}
      >
        {column.sort ? (
          <button
            type="button"
            onClick={() => toggleSort(column.sort as SortKey)}
            className="flex min-h-[44px] w-full items-center gap-1 py-2 text-left text-xs font-bold uppercase tracking-wide text-white/45 transition-colors hover:text-white"
          >
            <span className="truncate">{column.label}</span>
            {active &&
              (sort?.dir === 'asc' ? (
                <ChevronUp size={13} className="shrink-0" />
              ) : (
                <ChevronDown size={13} className="shrink-0" />
              ))}
          </button>
        ) : (
          <span className="block truncate text-xs font-bold uppercase tracking-wide text-white/45">
            {column.label}
          </span>
        )}

        {/* Зона ресайза 4px по правому краю; двойной клик — сброс ширины. */}
        <div
          onPointerDown={(e) => startResize(column.key, e)}
          onDoubleClick={() => resetColumn(column.key)}
          role="separator"
          aria-orientation="vertical"
          className="absolute right-0 top-0 z-10 h-full w-1 cursor-col-resize touch-none select-none transition-colors hover:bg-white/30"
        />
      </th>
    );
  }

  function toggleSort(key: SortKey) {
    if (sort?.key === key) onSortChange({ key, dir: sort.dir === 'asc' ? 'desc' : 'asc' });
    // Дата по умолчанию сверху вниз: свежие касания интереснее старых.
    else onSortChange({ key, dir: key === 'date' ? 'desc' : 'asc' });
  }

  function bodyCell(key: ColumnKey, children: React.ReactNode, tint: RowTint | null = null) {
    const pinned = PINNED.includes(key);

    return (
      <td
        key={key}
        style={{ '--sl': `${pinnedOffsets[key] ?? 0}px` } as CSSProperties}
        className={[
          'border-b border-divider px-3 align-middle',
          tint?.cell ?? '',
          // Прилипающие колонки на телефоне обязаны быть непрозрачными, иначе
          // под ними просвечивает уезжающий текст. Поэтому у подсвеченной
          // строки им нужен свой непрозрачный фон того же оттенка.
          pinned
            ? `max-md:sticky max-md:left-[var(--sl)] max-md:z-10 ${
                tint?.pinned ?? 'max-md:bg-ink max-md:group-hover:bg-[#141414]'
              }`
            : '',
          key === 'num' && tint?.bar ? `border-l-2 ${tint.bar}` : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {children}
      </td>
    );
  }

  function cellContent(contact: OutreachContact, key: ColumnKey) {
    switch (key) {
      case 'num':
        return (
          <span className="block tabular-nums text-white/30">
            {numbers.get(contact.id) ?? ''}
          </span>
        );

      case 'status':
        return (
          <StatusCell
            status={contact.status}
            onChange={(status) => onStatusChange(contact, status)}
          />
        );

      case 'name':
        return (
          <button
            type="button"
            onClick={() => onOpenContact(contact)}
            className="flex min-h-[44px] w-full items-center rounded-lg text-left font-semibold transition-colors hover:text-white/70"
          >
            <span className="truncate">{contact.name}</span>
          </button>
        );

      case 'telegram': {
        const url = telegramUrl(contact.telegram_handle);
        if (!url) return null;
        return (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[44px] items-center truncate text-white/60 underline-offset-4 transition-colors hover:text-white hover:underline"
          >
            @{normalizeHandle(contact.telegram_handle)}
          </a>
        );
      }

      case 'instagram': {
        const url = contact.instagram_url;
        if (!url) return null;
        return (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-white/60 transition-colors hover:text-white"
          >
            <span className="truncate">{t.outreach.openLink}</span>
            <ExternalLink size={13} className="shrink-0" />
          </a>
        );
      }

      case 'niche':
        return <span className="block truncate text-white/70">{contact.niche ?? ''}</span>;

      case 'date':
        return (
          <span className="block truncate text-white/60">
            {shortDate(contact.first_contact_date, lang)}
          </span>
        );

      case 'days':
        return (
          <span className="block tabular-nums text-white/60">
            {daysSince(contact.first_contact_date)}
          </span>
        );

      case 'comment': {
        const text = contact.comment ?? '';
        if (!text) return null;
        const open = expanded.has(contact.id);
        const short = text.length > COMMENT_PREVIEW;
        return (
          <button
            type="button"
            onClick={() => toggleComment(contact.id)}
            className="flex min-h-[44px] w-full items-center py-2 text-left text-white/55 transition-colors hover:text-white"
          >
            <span className={open ? 'whitespace-pre-wrap break-words' : 'truncate'}>
              {open || !short ? text : `${text.slice(0, COMMENT_PREVIEW)}...`}
            </span>
          </button>
        );
      }

      case 'nextStep':
        return (
          <span className="block truncate text-white/60">{contact.next_step ?? ''}</span>
        );

      case 'speed':
        return <span className="block truncate text-white/60">{replySpeed(contact)}</span>;
    }
  }

  function replySpeed(contact: OutreachContact): string {
    if (!contact.replied_at || !contact.first_contact_date) return t.common.none;
    const n = Math.max(
      0,
      daysBetween(contact.replied_at.slice(0, 10), contact.first_contact_date.slice(0, 10)),
    );
    return n === 0 ? t.outreach.today : `${n} ${days(n)}`;
  }

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="no-scrollbar max-h-[70dvh] overflow-auto rounded-glass border border-glass-border"
      >
        <table
          className="table-fixed border-separate border-spacing-0 text-sm"
          style={{ width: totalWidth, minWidth: totalWidth }}
        >
          <colgroup>
            {columns.map((column) => (
              <col key={column.key} style={{ width: widths[column.key] }} />
            ))}
          </colgroup>

          <thead>
            <tr>{columns.map(headerCell)}</tr>
          </thead>

          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="border-b border-divider px-3 py-8 text-center text-sm text-muted"
                >
                  {t.outreach.empty}
                </td>
              </tr>
            )}

            {rows.map((contact) => {
              const fresh = contact.id === highlightId;
              const tint = rowTint(contact, today);
              return (
                <motion.tr
                  key={contact.id}
                  className="group h-12"
                  initial={fresh ? { opacity: 0, y: -16 } : false}
                  animate={
                    fresh
                      ? {
                          opacity: 1,
                          y: 0,
                          backgroundColor: [
                            'rgba(255,255,255,0.16)',
                            'rgba(255,255,255,0)',
                          ],
                        }
                      : { opacity: 1, y: 0 }
                  }
                  whileHover={{ backgroundColor: 'rgba(255,255,255,0.045)' }}
                  transition={{
                    duration: 0.3,
                    ease: [0.22, 1, 0.36, 1],
                    backgroundColor: { duration: 1, ease: 'linear' },
                  }}
                >
                  {columns.map((column) =>
                    bodyCell(column.key, cellContent(contact, column.key), tint),
                  )}
                </motion.tr>
              );
            })}

            {/* Последняя строка — пустая, добавление прямо в таблице. */}
            <tr className="group h-12">
              {columns.map((column) => {
                const field = inlineFieldFor(column.key);
                const index = field ? inlineOrder.indexOf(field) : -1;

                if (field && index >= 0) {
                  return bodyCell(
                    column.key,
                    <input
                      ref={(node) => {
                        inlineRefs.current[index] = node;
                      }}
                      value={inline[field]}
                      onChange={(e) =>
                        setInline((current) => ({ ...current, [field]: e.target.value }))
                      }
                      onKeyDown={(e) => onInlineKey(e, index)}
                      placeholder={inlinePlaceholder(field, t)}
                      autoCapitalize={field === 'name' ? 'words' : 'none'}
                      autoCorrect="off"
                      spellCheck={false}
                      className="min-h-[44px] w-full bg-transparent text-white outline-none placeholder:text-white/25"
                    />,
                  );
                }

                if (column.key === 'num') {
                  return bodyCell(
                    column.key,
                    <Plus size={16} className="text-white/25" aria-hidden />,
                  );
                }
                if (column.key === 'status') {
                  return bodyCell(
                    column.key,
                    <Badge tone={statusTone('sent')}>{t.statuses.sent}</Badge>,
                  );
                }
                if (column.key === 'date') {
                  return bodyCell(
                    column.key,
                    <span className="block truncate text-white/30">
                      {shortDate(today, lang)}
                    </span>,
                  );
                }
                if (column.key === 'days') {
                  return bodyCell(
                    column.key,
                    <span className="block tabular-nums text-white/30">0</span>,
                  );
                }
                return bodyCell(column.key, null);
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Подсказка, что таблица уезжает вправо — на планшете колонки не влезают. */}
      {scrollable && (
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 rounded-r-glass bg-gradient-to-l from-ink to-transparent" />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Подсветка строк                                                            */
/* -------------------------------------------------------------------------- */

type RowTint = {
  /** Классы фона ячейки. */
  cell: string;
  /** Непрозрачный фон для прилипающих колонок на телефоне. */
  pinned: string;
  /** Цвет полосы слева. */
  bar: string;
};

/**
 * Два состояния, которые нужно видеть боковым зрением.
 *
 * Красный — исход отрицательный, работа с человеком окончена: «Ответил —
 * отказ» и «Заблокировал». Жёлтая полоса — сегодня пора коснуться. Всё
 * остальное остаётся нейтральным: если подсвечивать всё, не видно ничего.
 */
function rowTint(contact: OutreachContact, today: string): RowTint | null {
  if (NEGATIVE_STATUSES.includes(normalizeStatus(contact.status))) {
    return {
      cell: 'bg-[rgba(255,107,107,0.07)]',
      pinned: 'max-md:bg-[#1B0E0E] max-md:group-hover:bg-[#241313]',
      bar: 'border-l-[#FF6B6B]',
    };
  }

  const state = followUpState({
    status: contact.status,
    lastTouchAt: contact.last_touch_at,
    touchCount: contact.touch_count ?? 1,
    muted: Boolean(contact.muted),
    today,
  });

  if (needsTouch(state)) {
    return {
      cell: '',
      pinned: 'max-md:bg-ink max-md:group-hover:bg-[#141414]',
      bar: 'border-l-[#FFD166]',
    };
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/*  Мелочи                                                                     */
/* -------------------------------------------------------------------------- */

type InlineKey = 'name' | 'telegram' | 'instagram' | 'niche' | 'comment' | 'nextStep';
type InlineRow = Record<InlineKey, string>;

const EMPTY_INLINE: InlineRow = {
  name: '',
  telegram: '',
  instagram: '',
  niche: '',
  comment: '',
  nextStep: '',
};

function inlineFieldFor(key: ColumnKey): InlineKey | null {
  switch (key) {
    case 'name':
      return 'name';
    case 'telegram':
      return 'telegram';
    case 'instagram':
      return 'instagram';
    case 'niche':
      return 'niche';
    case 'comment':
      return 'comment';
    case 'nextStep':
      return 'nextStep';
    default:
      return null;
  }
}

function inlinePlaceholder(
  field: InlineKey,
  t: ReturnType<typeof useLanguage>['t'],
): string {
  switch (field) {
    case 'name':
      return t.outreach.colName;
    case 'telegram':
      return t.outreach.colTelegram;
    case 'instagram':
      return t.outreach.fieldInstagram;
    case 'niche':
      return t.outreach.colNiche;
    case 'comment':
      return t.outreach.colComment;
    case 'nextStep':
      return t.outreach.colNextStep;
  }
}

/** Смещения прилипающих колонок считаются от текущих ширин, а не от дефолтных. */
function pinnedLeft(widths: ColumnWidths<ColumnKey>): Partial<Record<ColumnKey, number>> {
  return {
    num: 0,
    status: widths.num,
    name: widths.num + widths.status,
  };
}

function shortDate(iso: string | null | undefined, lang: 'ru' | 'en'): string {
  if (!iso) return '';
  try {
    return formatShortDate(iso.slice(0, 10), lang);
  } catch {
    return '';
  }
}

function compareBy(a: OutreachContact, b: OutreachContact, key: SortKey): number {
  switch (key) {
    case 'name':
      return a.name.localeCompare(b.name);
    case 'niche':
      // Пустая ниша всегда внизу — иначе она забивает верх списка.
      if (!a.niche) return b.niche ? 1 : 0;
      if (!b.niche) return -1;
      return a.niche.localeCompare(b.niche);
    case 'status':
      return CONTACT_STATUSES.indexOf(a.status) - CONTACT_STATUSES.indexOf(b.status);
    case 'date':
      return (a.first_contact_date ?? a.created_at ?? '').localeCompare(
        b.first_contact_date ?? b.created_at ?? '',
      );
  }
}

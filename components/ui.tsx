'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Plus } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

/* -------------------------------------------------------------------------- */
/*  Кнопки                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * У framer-motion свои сигнатуры drag/animation-обработчиков, они конфликтуют
 * с нативными React-типами. Нативные версии здесь не нужны — убираем их.
 */
type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  | 'onDrag'
  | 'onDragStart'
  | 'onDragEnd'
  | 'onDragEnter'
  | 'onDragExit'
  | 'onDragLeave'
  | 'onDragOver'
  | 'onDrop'
  | 'onAnimationStart'
  | 'onAnimationEnd'
  | 'onAnimationIteration'
  | 'style'
>;

type ButtonProps = {
  children: ReactNode;
  variant?: 'primary' | 'ghost' | 'danger';
  full?: boolean;
} & NativeButtonProps;

export function Button({
  children,
  variant = 'primary',
  full = false,
  className = '',
  ...rest
}: ButtonProps) {
  const base =
    variant === 'primary'
      ? 'btn-primary'
      : variant === 'danger'
        ? 'btn-ghost border-[rgba(255,107,107,0.3)] text-danger hover:bg-[rgba(255,107,107,0.1)]'
        : 'btn-ghost';

  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      className={`${base} ${full ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

/** Круглая плавающая кнопка «+». Всегда над нижней навигацией. */
export function Fab({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={label}
      whileTap={{ scale: 0.92 }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className="fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-white text-ink shadow-glow-white md:right-8"
      style={{ bottom: 'calc(80px + env(safe-area-inset-bottom))' }}
    >
      <Plus size={26} strokeWidth={2.6} color="#0A0A0A" />
    </motion.button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Поля ввода                                                                 */
/* -------------------------------------------------------------------------- */

export function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <span className="mb-1.5 block">
      <span className="text-sm font-semibold text-white/70">{children}</span>
      {hint && <span className="ml-2 text-xs text-white/30">{hint}</span>}
    </span>
  );
}

type FieldProps = {
  label?: string;
  hint?: string;
  error?: string;
} & InputHTMLAttributes<HTMLInputElement>;

export function Field({ label, hint, error, className = '', ...rest }: FieldProps) {
  return (
    <label className="block">
      {label && <Label hint={hint}>{label}</Label>}
      <input
        className={`field ${error ? 'border-[rgba(255,107,107,0.5)]' : ''} ${className}`}
        {...rest}
      />
      {error && <span className="mt-1.5 block text-sm text-danger">{error}</span>}
    </label>
  );
}

type TextAreaProps = {
  label?: string;
  hint?: string;
  rows?: number;
} & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function TextArea({
  label,
  hint,
  rows = 4,
  className = '',
  ...rest
}: TextAreaProps) {
  return (
    <label className="block">
      {label && <Label hint={hint}>{label}</Label>}
      <textarea rows={rows} className={`field resize-none ${className}`} {...rest} />
    </label>
  );
}

type SelectOption = { value: string; label: string };

export function Select({
  label,
  value,
  onChange,
  options,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
}) {
  return (
    <label className="block">
      {label && <Label>{label}</Label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22rgba(255,255,255,0.5)%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22/%3E%3C/svg%3E')] bg-[length:18px] bg-[right_14px_center] bg-no-repeat pr-10"
      >
        {options.map((o) => (
          // Фон опций задаётся явно: в тёмной теме нативный список иначе белый.
          <option key={o.value} value={o.value} className="bg-[#141414] text-white">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Группа кнопок-переключателей (например «Легко / Нормально / Тяжело»). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className = '',
}: {
  value: T | null;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <div className={`flex gap-2 ${className}`}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <motion.button
            key={o.value}
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={`min-h-[44px] flex-1 rounded-2xl border px-2 text-sm font-semibold transition-colors ${
              active
                ? 'border-white bg-white text-ink'
                : 'border-glass-border bg-white/[0.05] text-white/60 hover:bg-white/10'
            }`}
          >
            {o.label}
          </motion.button>
        );
      })}
    </div>
  );
}

/** Горизонтальная лента фильтров со скроллом. */
export function FilterChips<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; count?: number }[];
}) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={`min-h-[44px] shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition-colors ${
              active
                ? 'border-white bg-white text-ink'
                : 'border-glass-border bg-white/[0.05] text-white/55 hover:bg-white/10'
            }`}
          >
            {o.label}
            {typeof o.count === 'number' && (
              <span className={active ? 'ml-1.5 text-black/45' : 'ml-1.5 text-white/30'}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Сворачиваемые блоки                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Состояние, переживающее перезагрузку.
 *
 * Свернул раздел — он должен остаться свёрнутым и завтра. Иначе сворачивание
 * это не настройка экрана, а разовый жест, который приходится повторять.
 * Читается только в эффекте: на сервере localStorage нет, и расхождение
 * первого рендера сломало бы гидратацию.
 */
export function useStickyState(key: string, fallback: boolean): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(fallback);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored === '1' || stored === '0') setValue(stored === '1');
    } catch {
      // приватный режим — просто живём с умолчанием
    }
  }, [key]);

  const update = (next: boolean) => {
    setValue(next);
    try {
      window.localStorage.setItem(key, next ? '1' : '0');
    } catch {
      // см. выше
    }
  };

  return [value, update];
}

type CollapsibleProps = {
  title: ReactNode;
  /** Что показать справа в шапке — счётчик, бейдж, кнопка. */
  right?: ReactNode;
  /** Ключ в localStorage; без него состояние живёт только до перезагрузки. */
  storageKey?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
};

/**
 * Заголовок-переключатель со скрываемым содержимым.
 *
 * Нужен там, где длинный список отодвигает вниз то, ради чего на страницу
 * заходят. Свёрнутый блок обязан оставаться видимым и осмысленным — поэтому
 * счётчик и подпись живут в шапке, а не внутри.
 */
export function Collapsible({
  title,
  right,
  storageKey,
  defaultOpen = true,
  children,
  className = '',
}: CollapsibleProps) {
  // Без явного ключа состояние привязывается к экземпляру: два блока без
  // ключа не должны сворачиваться и разворачиваться вместе.
  const fallbackKey = useId();
  const [open, setOpen] = useStickyState(storageKey ?? `collapsible:${fallbackKey}`, defaultOpen);

  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 text-left"
        >
          <motion.span
            animate={{ rotate: open ? 0 : -90 }}
            transition={{ duration: 0.2 }}
            className="shrink-0 text-white/40"
          >
            <ChevronDown size={16} />
          </motion.span>
          <h2 className="truncate text-sm font-bold tracking-wide text-white">{title}</h2>
        </button>
        {right}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Прочее                                                                     */
/* -------------------------------------------------------------------------- */

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'danger' | 'warn' | 'active';
}) {
  const tones = {
    neutral: 'bg-white/[0.08] text-white/60 border-white/10',
    active: 'bg-white text-ink border-white',
    success: 'bg-[rgba(100,255,140,0.12)] text-success border-[rgba(100,255,140,0.3)]',
    danger: 'bg-[rgba(255,107,107,0.12)] text-danger border-[rgba(255,107,107,0.3)]',
    warn: 'bg-[rgba(255,209,102,0.12)] text-warn border-[rgba(255,209,102,0.3)]',
  } as const;

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-bold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({ text, icon }: { text: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {icon && <div className="text-white/20">{icon}</div>}
      <p className="max-w-[280px] text-sm leading-relaxed text-muted">{text}</p>
    </div>
  );
}

export function PageTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h1 className="text-2xl font-extrabold tracking-tight">{children}</h1>
      {right}
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div
      className={`h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white ${className}`}
      role="status"
      aria-label="loading"
    />
  );
}

/** Полноэкранный лоадер на время первой загрузки данных. */
export function FullPageLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Spinner className="h-7 w-7" />
    </div>
  );
}

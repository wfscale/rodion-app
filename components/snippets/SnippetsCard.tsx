'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { CardTitle, GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { Button } from '@/components/ui';
import { copyText } from '@/lib/clipboard';
import { snippetPreview, totalUses } from '@/lib/snippets';
import type { Snippet } from '@/lib/types';

type SnippetsCardProps = {
  snippets: Snippet[];
  /** false — таблицы ещё нет, миграция v9 не прогнана. */
  ready: boolean;
  onUse: (id: string) => void;
  onEdit: (snippet: Snippet) => void;
  onAdd: () => void;
  delay?: number;
};

/**
 * Библиотека готовых сообщений.
 *
 * Главное действие строки — копирование, поэтому по строке жмут, а не по
 * маленькой иконке: между «ответил» и «созвон» человек отвечает на ходу, и
 * попасть надо с первого раза. Правка спрятана в отдельную кнопку справа —
 * её жмут раз в месяц, а копируют десять раз в день.
 */
export function SnippetsCard({
  snippets,
  ready,
  onUse,
  onEdit,
  onAdd,
  delay = 0,
}: SnippetsCardProps) {
  const { t, tf } = useLanguage();

  // id заготовки, которую только что скопировали: галочка вместо иконки.
  const [flash, setFlash] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function handleCopy(snippet: Snippet) {
    const ok = await copyText(snippet.content);
    if (!ok) {
      setFailed(true);
      setTimeout(() => setFailed(false), 2200);
      return;
    }

    onUse(snippet.id);
    setFlash(snippet.id);
    setTimeout(() => setFlash((current) => (current === snippet.id ? null : current)), 1200);
  }

  const total = totalUses(snippets);

  return (
    <GlassCard delay={delay}>
      <CardTitle
        right={
          total > 0 ? (
            <span className="shrink-0 text-xs tabular-nums text-white/35">
              {tf(t.snippets.total, { n: total })}
            </span>
          ) : undefined
        }
      >
        {t.snippets.title}
      </CardTitle>

      {!ready ? (
        <p className="text-sm leading-relaxed text-muted">{t.snippets.notReady}</p>
      ) : snippets.length === 0 ? (
        // Своё пустое состояние, а не общий EmptyState: тот рассчитан на
        // пустой экран целиком и добавляет 56px воздуха сверху и снизу.
        // Внутри карточки, под которой сразу кнопка, это выглядит дырой.
        <div className="px-2 pb-4 pt-1 text-center">
          <span className="mx-auto mb-3 flex h-8 w-8 items-center justify-center text-white/20">
            <Copy size={26} />
          </span>
          <p className="text-sm leading-relaxed text-muted">{t.snippets.empty}</p>
          {/* Три примера вместо инструкции: показать, что сюда класть,
              короче и честнее, чем объяснять зачем. */}
          <p className="mt-2 text-xs leading-relaxed text-white/25">{t.snippets.emptyHint}</p>
        </div>
      ) : (
        <ul className="mb-3 space-y-1">
          {snippets.map((snippet) => (
            <li key={snippet.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void handleCopy(snippet)}
                aria-label={`${t.snippets.copy}: ${snippet.title}`}
                className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 rounded-xl px-2 text-left transition-colors hover:bg-white/[0.04]"
              >
                <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
                  <AnimatePresence mode="wait" initial={false}>
                    {flash === snippet.id ? (
                      <motion.span
                        key="done"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                        className="absolute text-success"
                      >
                        <Check size={18} strokeWidth={2.6} />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="copy"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="absolute text-white/30"
                      >
                        <Copy size={17} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="min-w-0 truncate text-sm font-bold">{snippet.title}</span>
                    {snippet.used_count > 0 && (
                      <span className="shrink-0 text-[11px] tabular-nums text-white/25">
                        {snippet.used_count}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-white/35">
                    {snippetPreview(snippet.content)}
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => onEdit(snippet)}
                aria-label={t.common.edit}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/25 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Pencil size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {ready && (
        <Button variant="ghost" full onClick={onAdd}>
          <Plus size={16} />
          {t.snippets.add}
        </Button>
      )}

      {failed && <p className="mt-2 text-sm text-danger">{t.snippets.copyFailed}</p>}
    </GlassCard>
  );
}

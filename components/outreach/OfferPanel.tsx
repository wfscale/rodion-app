'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { CardTitle, GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { Button } from '@/components/ui';
import { copyText } from '@/lib/clipboard';
import type { Snippet } from '@/lib/types';

type OfferPanelProps = {
  snippets: Snippet[];
  /** Выбранный оффер. Состояние живёт на странице: его же копируют из строк. */
  active: Snippet | null;
  onPick: (id: string) => void;
  /** Отметить использование: список сам всплывает тем, чем пользуешься. */
  onUse: (id: string) => void;
  delay?: number;
};

/**
 * Оффер рядом с базой.
 *
 * Раньше за текстом приходилось уходить на другую страницу и возвращаться —
 * на каждого человека из двадцати. Здесь он лежит целиком, без сворачивания
 * в узкое окошко: перед отправкой его перечитывают глазами, а не копируют
 * вслепую.
 *
 * Выбранным по умолчанию встаёт самый частый — тот же порядок, что и в
 * заготовках. Обычно за один заход по базе оффер не меняют вовсе.
 */
export function OfferPanel({ snippets, active, onPick, onUse, delay = 0 }: OfferPanelProps) {
  const { t } = useLanguage();

  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const activeId = active?.id ?? null;

  async function copy() {
    if (!active) return;

    const ok = await copyText(active.content);
    if (!ok) {
      setFailed(true);
      setTimeout(() => setFailed(false), 2200);
      return;
    }

    onUse(active.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <GlassCard delay={delay}>
      <CardTitle>{t.leads.offerTitle}</CardTitle>

      {snippets.length === 0 ? (
        <p className="text-sm leading-relaxed text-muted">{t.leads.offerEmpty}</p>
      ) : (
        <>
          {/* Переключатель офферов — лента: заходов под разные ниши бывает
              много, а вертикальный список отодвинул бы сам текст вниз. */}
          {snippets.length > 1 && (
            <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
              {snippets.map((snippet) => {
                const on = snippet.id === activeId;
                return (
                  <button
                    key={snippet.id}
                    type="button"
                    onClick={() => onPick(snippet.id)}
                    aria-pressed={on}
                    className={`min-h-[40px] shrink-0 whitespace-nowrap rounded-full border px-3.5 text-sm font-semibold transition-colors ${
                      on
                        ? 'border-white bg-white text-ink'
                        : 'border-glass-border bg-white/[0.05] text-white/55 hover:bg-white/10'
                    }`}
                  >
                    {snippet.title}
                  </button>
                );
              })}
            </div>
          )}

          {active && (
            <p className="whitespace-pre-wrap rounded-2xl bg-white/[0.04] p-3 text-sm leading-relaxed text-white/85">
              {active.content}
            </p>
          )}

          <Button full className="mt-3" onClick={() => void copy()}>
            <AnimatePresence mode="wait" initial={false}>
              {copied ? (
                <motion.span
                  key="done"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                  className="flex items-center gap-2"
                >
                  <Check size={17} strokeWidth={2.6} />
                  {t.leads.copied}
                </motion.span>
              ) : (
                <motion.span
                  key="copy"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-2"
                >
                  <Copy size={17} />
                  {t.leads.copy}
                </motion.span>
              )}
            </AnimatePresence>
          </Button>

          {failed && <p className="mt-2 text-sm text-danger">{t.leads.copyFailed}</p>}
        </>
      )}
    </GlassCard>
  );
}

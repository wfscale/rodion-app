'use client';

import { motion } from 'framer-motion';
import { Check, FlaskConical, Minus, Wand2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CardTitle, GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { buildBlueprint, type BlueprintStep, type PatternSample } from '@/lib/offer-patterns';

/** Иконка и цвет по вердикту блока. */
function stepTone(action: BlueprintStep['action']) {
  switch (action) {
    case 'keep':
      return { icon: <Check size={13} strokeWidth={3} />, wrap: 'border-[rgba(100,255,140,0.3)] bg-[rgba(100,255,140,0.07)]', mark: 'text-success' };
    case 'drop':
      return { icon: <Minus size={13} strokeWidth={3} />, wrap: 'border-[rgba(255,107,107,0.28)] bg-[rgba(255,107,107,0.06)]', mark: 'text-danger' };
    default:
      return { icon: <FlaskConical size={13} />, wrap: 'border-glass-border bg-white/[0.03]', mark: 'text-white/35' };
  }
}

/**
 * Каркас оффера, собранный из собственных результатов.
 *
 * Это не «шаблон, который надо копировать», а текущая гипотеза: блоки в нём
 * стоят ровно потому, что на них отвечали, и исчезают, когда перестают
 * работать. Поэтому карточка пересобирается на каждом новом оффере и всегда
 * честно говорит, насколько ей самой можно верить.
 */
export function BlueprintCard({ samples }: { samples: PatternSample[] }) {
  const { t, tf } = useLanguage();
  const [open, setOpen] = useState(false);

  const blueprint = useMemo(() => buildBlueprint(samples), [samples]);

  const keep = blueprint.steps.filter((step) => step.action === 'keep');
  const drop = blueprint.steps.filter((step) => step.action === 'drop');

  return (
    <GlassCard delay={2}>
      <CardTitle>{t.blueprint.title}</CardTitle>

      {samples.length === 0 ? (
        <p className="text-sm leading-relaxed text-muted">{t.blueprint.empty}</p>
      ) : !open ? (
        <>
          <p className="mb-3 text-sm leading-relaxed text-muted">{t.blueprint.pitch}</p>
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => setOpen(true)}
            className="btn-primary w-full"
          >
            <Wand2 size={17} />
            {t.blueprint.build}
          </motion.button>
        </>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Доверие к каркасу — первым делом. Красивая структура на трёх
              офферах это не стратегия, и об этом надо сказать сразу. */}
          <div className="mb-4 flex items-baseline justify-between gap-3 rounded-2xl border border-glass-border bg-white/[0.04] px-3 py-2.5">
            <span className="min-w-0 text-xs leading-snug text-white/45">
              {t.blueprint.confidence}
            </span>
            <span className="shrink-0 text-lg font-extrabold tabular-nums">
              {blueprint.confidence}%
            </span>
          </div>

          {/* Сам каркас: порядок блоков сверху вниз — порядок в тексте. */}
          <ol className="space-y-1.5">
            {blueprint.steps
              .filter((step) => step.action !== 'drop')
              .map((step, i) => {
                const tone = stepTone(step.action);
                return (
                  <li
                    key={step.id}
                    className={`flex items-start gap-2.5 rounded-2xl border p-2.5 ${tone.wrap}`}
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current ${tone.mark}`}
                    >
                      {tone.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold leading-snug">
                        <span className="mr-1.5 text-white/30 tabular-nums">{i + 1}.</span>
                        {t.patterns.names[step.id]}
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-white/40">
                        {t.blueprint.lines[step.id]}
                      </span>
                    </span>
                    {step.action === 'keep' && (
                      <span className="shrink-0 text-sm font-extrabold tabular-nums text-success">
                        +{step.lift}
                      </span>
                    )}
                  </li>
                );
              })}
          </ol>

          {/* Длина — отдельная ось: она не блок текста, а его габарит. */}
          {blueprint.length && (
            <p className="mt-3 rounded-2xl border border-glass-border bg-white/[0.03] px-3 py-2.5 text-sm leading-snug">
              <span className="text-white/45">{t.blueprint.length}</span>{' '}
              <span className="font-bold">
                {blueprint.length === 'short'
                  ? t.patterns.lengthShort
                  : blueprint.length === 'medium'
                    ? t.patterns.lengthMedium
                    : t.patterns.lengthLong}
              </span>
              <span className="text-white/45"> · {blueprint.lengthRate}%</span>
            </p>
          )}

          {drop.length > 0 && (
            <div className="mt-4 border-t border-divider pt-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-danger">
                {t.blueprint.dropTitle}
              </p>
              <ul className="space-y-1">
                {drop.map((step) => (
                  <li key={step.id} className="text-sm leading-snug text-white/55">
                    <span className="font-bold text-white/75">{t.patterns.names[step.id]}</span>
                    <span className="text-white/35"> · {step.lift}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Следующий эксперимент — единственное, что превращает разбор в
              работу: без него таблица просто описывает прошлое. */}
          {blueprint.experiment && (
            <div className="mt-4 rounded-2xl border border-[rgba(255,209,102,0.3)] bg-[rgba(255,209,102,0.07)] p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-warn">
                {t.blueprint.experimentTitle}
              </p>
              <p className="mt-1 text-sm font-bold leading-snug">
                {tf(t.blueprint.experiment, { name: t.patterns.names[blueprint.experiment] })}
              </p>
              <p className="mt-1 text-xs leading-snug text-white/45">
                {t.blueprint.lines[blueprint.experiment]}
              </p>
            </div>
          )}

          {keep.length === 0 && drop.length === 0 && (
            <p className="mt-3 text-xs leading-relaxed text-white/30">{t.blueprint.thin}</p>
          )}

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-3 min-h-[44px] w-full text-sm font-semibold text-white/35 transition-colors hover:text-white"
          >
            {t.common.collapse}
          </button>
        </motion.div>
      )}
    </GlassCard>
  );
}

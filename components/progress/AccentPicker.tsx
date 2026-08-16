'use client';

import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CardTitle, GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { ACCENT_KEYS, ACCENTS, applyAccent, readAccent, type AccentKey } from '@/lib/accent';

/** Выбор акцентного цвета — перк 17-го уровня. */
export function AccentPicker() {
  const { t } = useLanguage();
  const [accent, setAccent] = useState<AccentKey>('mono');

  // localStorage читается только в браузере, иначе рассыплется гидратация.
  useEffect(() => {
    setAccent(readAccent());
  }, []);

  return (
    <GlassCard delay={7}>
      <CardTitle>{t.themes.title}</CardTitle>

      <div className="flex gap-2">
        {ACCENT_KEYS.map((key) => {
          const active = accent === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setAccent(key);
                applyAccent(key);
              }}
              aria-pressed={active}
              className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl border transition-colors ${
                active ? 'border-white bg-white/10' : 'border-glass-border bg-white/[0.04]'
              }`}
            >
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full"
                style={{ backgroundColor: ACCENTS[key] }}
              >
                {active && <Check size={12} color="#0A0A0A" strokeWidth={3.5} />}
              </span>
              <span className={`text-[11px] font-bold ${active ? 'text-white' : 'text-white/45'}`}>
                {t.themes[key]}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-white/25">{t.themes.hint}</p>
    </GlassCard>
  );
}

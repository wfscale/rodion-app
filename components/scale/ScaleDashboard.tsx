'use client';

import { useEffect, useState } from 'react';
import { GlassCard, CardTitle } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { Field, PageTitle } from '@/components/ui';
import type { Language } from '@/lib/types';

type ScaleDashboardProps = {
  sentTotal: number;
  closedTotal: number;
  /** Сколько дней человек в системе — из них считается темп. */
  daysActive: number;
  avgDeal: number;
  onAvgDealChange: (value: number) => void;
};

/** Ниже этого числа рассылок конверсия — случайность, а не показатель. */
const MIN_SENT_FOR_RATE = 5;

/**
 * Дашборд масштаба — темп и то, из чего он сложился.
 *
 * Прогноза дохода здесь нет намеренно. Один эксперт приносит два миллиона,
 * десять других — ноль; между рассылками и деньгами стоят твёрдость ниши,
 * лояльность аудитории, чек и то, сколько людей пришло горячими. Умножение
 * среднего чека на средний темп не предсказывает ни одну из этих величин,
 * зато выглядит как знание — и на него начинают опираться. Поэтому на экране
 * только то, что уже случилось.
 *
 * Средний чек остался: от него считается «сколько рублей приносит одна
 * рассылка» в целях (`rublesPerOutreach`) — там он делится на собственную
 * цену закрытия, а не на догадку.
 */
export function ScaleDashboard({
  sentTotal,
  closedTotal,
  daysActive,
  avgDeal,
  onAvgDealChange,
}: ScaleDashboardProps) {
  const { t, lang } = useLanguage();

  // Поле держит собственную строку: пустое поле — это не ноль.
  const [raw, setRaw] = useState(avgDeal ? String(avgDeal) : '');

  useEffect(() => {
    setRaw((prev) => {
      const current = Number(prev.replace(/\D/g, ''));
      if (current === avgDeal) return prev;
      return avgDeal ? String(avgDeal) : '';
    });
  }, [avgDeal]);

  const days = Math.max(1, daysActive);
  const pace = sentTotal / days;

  const facts: { value: string; label: string }[] = [
    { value: formatInt(sentTotal), label: t.common.msg5 },
    { value: formatInt(closedTotal), label: t.scale.closings },
    { value: formatInt(daysActive), label: t.common.days5 },
  ];

  return (
    <div className="space-y-4">
      <PageTitle>{t.scale.title}</PageTitle>

      {/* Темп — единственная цифра, на которую человек влияет напрямую */}
      <GlassCard>
        <CardTitle>{t.scale.pace}</CardTitle>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-extrabold leading-none tabular-nums">
            {formatDecimal(pace, lang)}
          </span>
          <span className="text-sm text-muted">{t.scale.perDay}</span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-divider pt-4">
          {facts.map((fact) => (
            <div key={fact.label}>
              <p className="text-2xl font-extrabold leading-none tabular-nums">{fact.value}</p>
              <p className="mt-1 text-xs leading-snug text-white/35">{fact.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-divider pt-4">
          <span className="text-sm text-muted">{t.offers.colRate}</span>
          {sentTotal >= MIN_SENT_FOR_RATE ? (
            <span className="text-base font-bold tabular-nums">
              {formatDecimal((closedTotal / sentTotal) * 100, lang)}
            </span>
          ) : (
            <span className="text-base font-bold text-white/35">{t.common.none}</span>
          )}
        </div>
      </GlassCard>

      <GlassCard delay={1}>
        <Field
          label={t.scale.avgDeal}
          hint={t.scale.avgDealHint}
          inputMode="numeric"
          value={raw}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '');
            setRaw(digits);
            onAvgDealChange(Number(digits) || 0);
          }}
        />
        {avgDeal > 0 && (
          <p className="mt-2 text-sm tabular-nums text-white/35">{formatInt(avgDeal)}</p>
        )}
      </GlassCard>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Форматирование чисел                                                       */
/* -------------------------------------------------------------------------- */

/**
 * 1 200 000 — разряды делит неразрывный пробел, чтобы число не переносилось
 * по строкам. Форматируем вручную, а не через toLocaleString: результат
 * должен совпадать на сервере и в браузере, иначе ломается гидратация.
 */
function formatInt(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
}

/** Пока значение меньше десяти, десятая доля важна: 0,4 рассылки в день ≠ 0. */
function formatDecimal(value: number, lang: Language): string {
  if (value >= 10) return formatInt(value);
  const separator = lang === 'ru' ? ',' : '.';
  return (Math.round(value * 10) / 10).toFixed(1).replace('.', separator);
}

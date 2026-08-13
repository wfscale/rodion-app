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
const MIN_SENT_FOR_FORECAST = 5;

const HORIZONS = [30, 60, 90] as const;

/**
 * Дашборд масштаба — прогноз дохода при текущем темпе и текущей конверсии.
 *
 * Средний чек не угадывается: его вводит человек. Всё остальное считается
 * из фактических рассылок и закрытий — прогноз должен опираться на то,
 * что уже произошло, иначе это просто мечты с цифрами.
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
  const closeRate = sentTotal > 0 ? closedTotal / sentTotal : 0;

  const enoughData = sentTotal >= MIN_SENT_FOR_FORECAST;

  const labels: Record<(typeof HORIZONS)[number], string> = {
    30: t.scale.in30,
    60: t.scale.in60,
    90: t.scale.in90,
  };

  return (
    <div className="space-y-4">
      <PageTitle>{t.scale.title}</PageTitle>

      <GlassCard>
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

      {/* Темп — единственная цифра, на которую человек влияет напрямую */}
      <GlassCard delay={1}>
        <CardTitle>{t.scale.pace}</CardTitle>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-extrabold leading-none tabular-nums">
            {formatDecimal(pace, lang)}
          </span>
          <span className="text-sm text-muted">{t.scale.perDay}</span>
        </div>
      </GlassCard>

      <GlassCard delay={2}>
        <CardTitle>{t.scale.forecast}</CardTitle>

        {!enoughData ? (
          <p className="py-2 text-sm leading-relaxed text-muted">{t.scale.needData}</p>
        ) : (
          <div className="space-y-3">
            {HORIZONS.map((horizon) => {
              const closings = pace * horizon * closeRate;
              const money = closings * avgDeal;

              return (
                <div
                  key={horizon}
                  className="flex items-center justify-between gap-3 border-b border-divider pb-3 last:border-b-0 last:pb-0"
                >
                  <span className="w-[80px] shrink-0 text-sm font-bold text-white/70">
                    {labels[horizon]}
                  </span>

                  <div className="min-w-0 flex-1 text-right">
                    <p className="text-xl font-extrabold leading-none tabular-nums">
                      {formatMoneyValue(money, lang)}
                    </p>
                    <p className="mt-1 text-xs text-white/35">{t.scale.money}</p>
                  </div>

                  <div className="w-[92px] shrink-0 text-right">
                    <p className="text-xl font-extrabold leading-none tabular-nums">
                      {formatDecimal(closings, lang)}
                    </p>
                    <p className="mt-1 text-xs text-white/35">{t.scale.closings}</p>
                  </div>
                </div>
              );
            })}
          </div>
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

/** Пока значение меньше десяти, десятая доля важна: 0,4 закрытия ≠ 0. */
function formatDecimal(value: number, lang: Language): string {
  if (value >= 10) return formatInt(value);
  const separator = lang === 'ru' ? ',' : '.';
  return (Math.round(value * 10) / 10).toFixed(1).replace('.', separator);
}

/** Деньги всегда целые — копейки в прогнозе только мешают. */
function formatMoneyValue(value: number, lang: Language): string {
  if (value >= 1) return formatInt(value);
  return formatDecimal(value, lang);
}

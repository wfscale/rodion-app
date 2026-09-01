'use client';

import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { CardTitle, GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { compareWindows, dailySeries, funnelTotals } from '@/lib/insights';
import type { OutreachContact } from '@/lib/types';

/**
 * Ширина окна в днях.
 *
 * Ровно две семёрки: на графике видно форму двух недель, а под ним они же
 * сравниваются между собой. Одно окно на обе цифры — значит, число под
 * графиком всегда про то, что на графике нарисовано.
 */
const HALF = 7;
const DAYS = HALF * 2;

type PulseCardProps = {
  contacts: OutreachContact[];
  today: string;
  delay?: number;
};

/**
 * Как идёт — картина происходящего одной карточкой.
 *
 * На главной не хватало ответа на «а как вообще дела». Счётчик отвечает
 * про сегодня, лента — про последний час, и всё: чтобы понять, растёшь ты
 * или стоишь, приходилось уходить на страницу прогресса. За этим туда никто
 * не ходит — а вопрос возникает каждый день.
 *
 * Здесь три ответа подряд и ровно в том порядке, в каком они нужны:
 * форма двух недель, неделя против прошлой, воронка за всё время. Ни одного
 * прогноза и ни одной цели — только то, что уже случилось.
 */
export function PulseCard({ contacts, today, delay = 0 }: PulseCardProps) {
  const { t, tf } = useLanguage();

  const days = useMemo(() => dailySeries(contacts, today, DAYS), [contacts, today]);
  const funnel = useMemo(() => funnelTotals(contacts), [contacts]);

  /*
   * Скользящие семь дней, а не календарная неделя: по календарю текущая
   * всегда неполная и в среду обязана проигрывать прошлой. Считается из
   * того же ряда, что нарисован выше, — цифра всегда про этот график.
   */
  const { recent, previous, delta } = useMemo(() => compareWindows(days, HALF), [days]);

  const peak = Math.max(1, ...days.map((d) => d.sent));
  const active = days.filter((d) => d.sent > 0).length;

  return (
    <GlassCard delay={delay}>
      <CardTitle
        right={
          <span className="shrink-0 text-xs tabular-nums text-white/35">
            {tf(t.pulse.days, { n: DAYS })}
          </span>
        }
      >
        {t.pulse.title}
      </CardTitle>

      {/*
        Столбики, а не кривая.

        День с нулём обязан быть виден нулём: сглаженная линия протягивает
        через пропуск ровную дугу, и две недели с провалом посередине
        выглядят как ровная работа. Здесь провал видно провалом.
      */}
      <div className="flex h-14 items-end gap-[3px]" aria-hidden>
        {days.map((day, i) => {
          const last = i === days.length - 1;
          const pct = (day.sent / peak) * 100;
          return (
            <motion.div
              key={day.date}
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(day.sent > 0 ? 8 : 3, pct)}%` }}
              transition={{ duration: 0.4, delay: i * 0.015, ease: [0.22, 1, 0.36, 1] }}
              className={`min-w-0 flex-1 rounded-sm ${
                day.sent === 0
                  ? 'bg-white/[0.07]'
                  : last
                    ? 'bg-white'
                    : 'bg-white/30'
              }`}
            />
          );
        })}
      </div>

      <p className="mt-2 text-xs text-white/30">
        {tf(t.pulse.active, { n: active, of: DAYS })} · {tf(t.pulse.peak, { n: peak })}
      </p>

      {/* Сравнение, которое человек может подтвердить памятью: он помнит,
          как шла прошлая неделя. */}
      <div className="mt-3 flex items-baseline gap-2 border-t border-divider pt-3">
        <span className="text-sm text-white/45">{t.pulse.week}</span>
        <span className="text-xl font-extrabold tabular-nums">{recent}</span>
        {delta !== null && previous > 0 && (
          <span
            className={`text-sm font-bold tabular-nums ${
              delta > 0 ? 'text-success' : delta < 0 ? 'text-white/40' : 'text-white/30'
            }`}
          >
            {delta > 0 ? '+' : ''}
            {delta}%
          </span>
        )}
        <span className="ml-auto text-xs tabular-nums text-white/25">
          {tf(t.pulse.lastWeek, { n: previous })}
        </span>
      </div>

      {/* Воронка за всё время: четыре числа, от объёма к деньгам. */}
      <div className="mt-3 grid grid-cols-4 gap-1 border-t border-divider pt-3">
        <Cell label={t.outreach.funnelSent} value={funnel.sent} />
        <Cell label={t.outreach.funnelReplied} value={funnel.replied} base={funnel.sent} />
        <Cell label={t.outreach.funnelCall} value={funnel.calls} base={funnel.sent} />
        <Cell label={t.outreach.funnelClosed} value={funnel.closed} base={funnel.sent} accent />
      </div>
    </GlassCard>
  );
}

/**
 * Ступень воронки.
 *
 * Доля считается от написанных, а не от предыдущей ступени: «половина
 * созвонов закрылась» звучит громко ровно до того момента, когда созвонов
 * было два. От общего числа врать нечем.
 */
function Cell({
  label,
  value,
  base,
  accent = false,
}: {
  label: string;
  value: number;
  base?: number;
  accent?: boolean;
}) {
  const share = base && base > 0 ? (value / base) * 100 : null;

  return (
    <div className="min-w-0">
      <p className="truncate text-[11px] leading-tight text-white/30">{label}</p>
      <p
        className={`mt-0.5 text-lg font-extrabold leading-none tabular-nums ${
          accent && value > 0 ? 'text-success' : ''
        }`}
      >
        {value}
      </p>
      {share !== null && (
        <p className="mt-0.5 text-[11px] leading-none tabular-nums text-white/25">
          {share >= 10 ? Math.round(share) : share.toFixed(1)}%
        </p>
      )}
    </div>
  );
}

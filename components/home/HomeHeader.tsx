'use client';

import { useLanguage } from '@/components/LanguageProvider';
import { StreakPill } from '@/components/StreakBlock';
import { XpBar } from '@/components/XpBar';
import type { DayGuard } from '@/lib/shield';

type HomeHeaderProps = {
  /** Дни серии — огонь. */
  streak: number;
  /** Чем защищён сегодняшний день: щитом, привалом или ничем. */
  guard?: DayGuard;
  /** Дни подряд, в которые была хотя бы одна рассылка. Отдельный счётчик. */
  chainDays: number;
  level: number;
  levelName: string;
  /** Прогресс до следующего уровня, 0..100. */
  xpPct: number;
  totalXp: number;
  /** Сколько XP осталось до следующего уровня. */
  xpToNext: number;
  /** Уровень максимальный — показывать нечего, кроме общего опыта. */
  isMax: boolean;
  /** Дата старта цикла, уже отформатированная («13.08.2025»). */
  cycleDate: string;
  cycleDay: number;
};

/**
 * Хедер главной — одна компактная строка со статусом.
 *
 * Он намеренно маленький: стрик, уровень и XP это фон, а не событие.
 * Всю высоту экрана забирает счётчик рассылок ниже.
 */
export function HomeHeader({
  streak,
  guard = null,
  chainDays,
  level,
  levelName,
  xpPct,
  totalXp,
  xpToNext,
  isMax,
  cycleDate,
  cycleDay,
}: HomeHeaderProps) {
  const { t, tf } = useLanguage();

  return (
    <div className="glass px-3.5 py-3">
      <div className="flex items-center gap-2">
        <StreakPill streak={streak} guard={guard} />

        {/* Цепочка появляется только с 3 дней — раньше она ничего не значит. */}
        {chainDays >= 3 && (
          <span
            aria-label={t.home.chain}
            className="flex shrink-0 items-center gap-1 rounded-full border border-glass-border bg-white/[0.05] px-2.5 py-1.5 text-sm font-extrabold"
          >
            <span aria-hidden="true">⛓</span>
            <span className="tabular-nums">{chainDays}</span>
          </span>
        )}

        <div className="min-w-0 flex-1 text-right">
          <p className="truncate text-sm font-extrabold leading-tight">{levelName}</p>
          <p className="text-xs leading-tight text-white/35">
            {t.progress.levelTitle} {level}
          </p>
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-2.5">
        <XpBar pct={isMax ? 100 : xpPct} height={4} className="flex-1" />
        <span className="shrink-0 text-xs font-semibold tabular-nums text-white/35">
          {isMax ? totalXp : xpToNext} {t.common.xp}
        </span>
      </div>

      <p className="mt-1.5 text-xs text-white/25">
        {tf(t.home.cycle, { date: cycleDate, n: cycleDay })}
      </p>
    </div>
  );
}

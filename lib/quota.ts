import { daysBetween } from '@/lib/date';

/**
 * Прогрессивная дневная квота рассылок.
 *
 * Квота растёт только когда её выполняешь: каждые 3 закрытых дня она
 * поднимается на 3. Если день провален — квота не растёт, но и не падает.
 * Смысл: планка поднимается ровно с той скоростью, с какой человек её берёт.
 *
 * Дни 1–3 → 5, дни 4–6 → 8, дни 7–9 → 11, дни 10–12 → 14, дни 13–15 → 17,
 * дни 16+ → 20, потолок 30.
 */
export const QUOTA_BASE = 5;
export const QUOTA_STEP = 3;
export const QUOTA_MAX = 30;
/** Сколько закрытых дней нужно, чтобы квота выросла на шаг. */
export const QUOTA_DAYS_PER_STEP = 3;

export function calculateQuota(quotaStreak: number): number {
  const streak = Math.max(0, quotaStreak || 0);
  const increments = Math.floor(streak / QUOTA_DAYS_PER_STEP);
  return Math.min(QUOTA_BASE + increments * QUOTA_STEP, QUOTA_MAX);
}

/** Сколько закрытых дней осталось до следующего роста квоты. */
export function daysUntilQuotaGrows(quotaStreak: number): number {
  const streak = Math.max(0, quotaStreak || 0);
  if (calculateQuota(streak) >= QUOTA_MAX) return 0;
  return QUOTA_DAYS_PER_STEP - (streak % QUOTA_DAYS_PER_STEP);
}

/** Какой станет квота после следующего роста. */
export function nextQuota(quotaStreak: number): number {
  const streak = Math.max(0, quotaStreak || 0);
  const remaining = daysUntilQuotaGrows(streak);
  return calculateQuota(streak + remaining);
}

/**
 * Пересчёт квоты на новый день.
 *
 * Вызывается один раз за сутки, когда логическая дата сменилась:
 *  — вчера квота взята  → серия +1, квота может подрасти;
 *  — вчера не взята     → серия обнуляется, квота остаётся прежней.
 *
 * Пропущенные дни (приложение не открывали) считаются невыполненными.
 */
export function rollQuotaForNewDay(input: {
  quotaStreak: number;
  quotaLastDate: string | null;
  yesterdaySent: number;
  yesterdayQuota: number;
  today: string;
}): { quotaStreak: number; currentQuota: number; changed: boolean } {
  const { quotaStreak, quotaLastDate, yesterdaySent, yesterdayQuota, today } = input;

  // За сегодня уже пересчитывали.
  if (quotaLastDate === today) {
    return {
      quotaStreak,
      currentQuota: calculateQuota(quotaStreak),
      changed: false,
    };
  }

  // Первый запуск: просто фиксируем день.
  if (!quotaLastDate) {
    return { quotaStreak, currentQuota: calculateQuota(quotaStreak), changed: true };
  }

  const gap = daysBetween(today, quotaLastDate);
  let streak = quotaStreak;

  if (gap === 1) {
    // Ровно следующий день — судим по вчерашнему результату.
    streak = yesterdaySent >= yesterdayQuota ? streak + 1 : 0;
  } else if (gap > 1) {
    // Были пропущенные сутки — серия рвётся.
    streak = 0;
  }

  return { quotaStreak: streak, currentQuota: calculateQuota(streak), changed: true };
}

/**
 * Бонусы за рассылки сверх квоты: +50 XP за каждые полные 5 штук.
 * Возвращает номера достигнутых пятёрок, чтобы начислить каждую один раз.
 */
export function bonusStepsReached(sent: number, quota: number): number[] {
  const over = sent - quota;
  if (over <= 0) return [];
  const steps = Math.floor(over / 5);
  return Array.from({ length: steps }, (_, i) => i + 1);
}

/** Прогресс к квоте в процентах, 0..100 (сверх квоты не растёт). */
export function quotaPct(sent: number, quota: number): number {
  if (quota <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((sent / quota) * 100)));
}

/** Цепочка: дни подряд, в которые была хотя бы одна рассылка. */
export function rollChain(input: {
  chainDays: number;
  chainLastDate: string | null;
  today: string;
}): number {
  const { chainDays, chainLastDate, today } = input;
  if (chainLastDate === today) return chainDays;
  if (!chainLastDate) return 1;

  const gap = daysBetween(today, chainLastDate);
  if (gap === 1) return chainDays + 1;
  return 1; // пропуск — начинаем заново с сегодняшнего дня
}

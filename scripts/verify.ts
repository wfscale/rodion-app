/**
 * Проверка детерминированной логики приложения без базы данных.
 * Запуск: npm run verify
 */
import { computeStreak, bonusesForStreak } from '@/lib/streak';
import {
  featureAtLevel,
  getLevelInfo,
  hiddenAhead,
  levelForXp,
  levelLadder,
  LEVEL_THRESHOLDS,
  MAX_LEVEL,
  revealCeiling,
  XP,
  FEATURE_LEVEL,
  unlocked,
  nextLevelTeaser,
} from '@/lib/xp';
import {
  calculateQuota,
  daysUntilQuotaGrows,
  nextQuota,
  rollQuotaForNewDay,
  bonusStepsReached,
  quotaPct,
  rollChain,
} from '@/lib/quota';
import {
  breakStreak,
  daysUntilDeadline,
  isModeActive,
  modeStageKey,
  MODE_KEYS,
  rollMode,
  type ModeCounters,
} from '@/lib/mode';
import { isReplyStatus, onOutreachAdded, onStatusChanged, totalXp, hasOverlay } from '@/lib/gamification';
import {
  followUpState,
  needsTouch,
  intervalFor,
  compareUrgency,
  reasonFor,
  SILENT_STEPS,
} from '@/lib/followup';
import {
  OFFER_RESULTS,
  CONTACT_STATUSES,
  HARSH_STATUSES,
  NEGATIVE_STATUSES,
  normalizeStatus,
  SENT_STATUSES,
  REPLIED_STATUSES,
} from '@/lib/types';
import type { OutreachContact } from '@/lib/types';
import { isRound, milestonesCrossed, milestoneWeight, pickNudge, roundTarget } from '@/lib/round';
import { ACCENT_KEYS } from '@/lib/accent';
import {
  assignRoles,
  authorsOf,
  chatIssues,
  chatMetrics,
  chatScore,
  CHAT_ISSUE_IDS,
  digestChats,
  parseChat,
  parseMessages,
  type ChatMessage,
} from '@/lib/conversation';
import {
  activeCount,
  composeDueAt,
  forContacts,
  groupReminders,
  isActive,
  reminderDate,
  reminderTime,
  standalone,
  urgencyOf,
} from '@/lib/reminders';
import {
  activeFilterCount,
  applyOutreachFilters,
  EMPTY_FILTERS,
  matchesFilters,
  matchesQuery,
  nicheOptions,
  sortContacts,
} from '@/lib/outreach-filter';
import {
  achievements,
  ACHIEVEMENT_IDS,
  dailySeries,
  deltaPct,
  hallOfFame,
  heatmap,
  primeScore,
  spanDays,
  weakLink,
} from '@/lib/insights';
import { countByTag, hasNoteToday, resurface } from '@/lib/notes-stats';
import {
  formatMinutes,
  hasEstimate,
  MAX_TASK_MINUTES,
  parseMinutes,
  taskBudget,
} from '@/lib/tasktime';
import {
  durationMs,
  elapsedMs,
  formatClock,
  isFinalStretch,
  isOver,
  isRecord,
  isSession,
  isStale,
  pacePerHour,
  parseSession,
  pctFromRemaining,
  remainingMs,
  runMinutes,
  sessionPct,
  sprintResult,
  SPRINT_OPTIONS,
} from '@/lib/session';
import { niceMax, smoothPath } from '@/lib/chart';
import { missingWeeks, reportsToWrite, sameNumbers, statsForWeek, toWeekRow } from '@/lib/reports';
import { buildPush } from '@/lib/push-messages';
import {
  daysBetween,
  formatTimeLeft,
  getLogicalDate,
  formatDateSmart,
  minutesUntilDayEnd,
  shiftDate,
  weekDates,
} from '@/lib/date';
import {
  armShield,
  burnLevel,
  canArmShield,
  daysUntilShield,
  disarmShield,
  endPause,
  guardFor,
  pauseDay,
  rollGuardForNewDay,
  SHIELD_MAX,
  startPause,
  type GuardState,
  type RollGuardInput,
} from '@/lib/shield';
import {
  currentStage,
  daysToDeadline,
  defaultStages,
  dueState,
  GATE_ID,
  isPipelineId,
  isPotential,
  PIPELINE_IDS,
  spreadDues,
  stageProgress,
} from '@/lib/pipeline';
import { forecast, FORECAST_MIN_SENT, reachedAt, type ForecastContact } from '@/lib/forecast';
import { assetsOf, externalHref, formatNumber, hasAssets, stagesOf } from '@/lib/project';
import { snippetPreview, sortSnippets, totalUses } from '@/lib/snippets';
import { instagramUrl, parseHandle, parseLeads, summarizeIntake } from '@/lib/leads';
import {
  daysLeft,
  daysPassed,
  goalProgress,
  goalState,
  newStepId,
  remaining,
  sortGoals,
  stepProgress,
  stepsOf,
  timeProgress,
} from '@/lib/goals';
import {
  audioPath,
  extForMime,
  formatDuration,
  MAX_RECORDING_SECONDS,
  pickMimeType,
  RECORDING_WARN_SECONDS,
} from '@/lib/audio';
import { ru } from '@/lib/i18n/ru';
import { en } from '@/lib/i18n/en';

let failed = 0;
let passed = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed += 1;
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}\n        ожидалось ${e}, получено ${a}`);
  }
}

function section(title: string) {
  console.log(`\n${title}`);
}

/* -------------------------------------------------------------------------- */
section('Логический день (перенос в 4:00)');

check('23:30 → тот же день', getLogicalDate(new Date('2026-08-10T23:30:00')), '2026-08-10');
check('00:30 → всё ещё вчера', getLogicalDate(new Date('2026-08-11T00:30:00')), '2026-08-10');
check('03:59 → всё ещё вчера', getLogicalDate(new Date('2026-08-11T03:59:00')), '2026-08-10');
check('04:00 → новый день', getLogicalDate(new Date('2026-08-11T04:00:00')), '2026-08-11');
check('08:30 подъём → новый день', getLogicalDate(new Date('2026-08-11T08:30:00')), '2026-08-11');

/* -------------------------------------------------------------------------- */
section('Стрик');

const today = '2026-08-10';

check('пустая история → 0', computeStreak([], 70, today).current, 0);

check(
  'три дня подряд, включая сегодня',
  computeStreak(
    [
      { date: '2026-08-10', completion_pct: 90 },
      { date: '2026-08-09', completion_pct: 75 },
      { date: '2026-08-08', completion_pct: 100 },
    ],
    70,
    today,
  ).current,
  3,
);

check(
  'сегодня ещё не набрано → серия держится на вчера',
  computeStreak(
    [
      { date: '2026-08-10', completion_pct: 10 },
      { date: '2026-08-09', completion_pct: 75 },
      { date: '2026-08-08', completion_pct: 100 },
    ],
    70,
    today,
  ).current,
  2,
);

check(
  'сегодня не набрано → todayCounted false',
  computeStreak([{ date: '2026-08-10', completion_pct: 10 }], 70, today).todayCounted,
  false,
);

check(
  'пропущенный день рвёт серию',
  computeStreak(
    [
      { date: '2026-08-10', completion_pct: 90 },
      { date: '2026-08-08', completion_pct: 90 },
      { date: '2026-08-07', completion_pct: 90 },
    ],
    70,
    today,
  ).current,
  1,
);

check(
  'ровно на пороге засчитывается',
  computeStreak([{ date: '2026-08-10', completion_pct: 70 }], 70, today).current,
  1,
);

check(
  'на единицу ниже порога не засчитывается',
  computeStreak([{ date: '2026-08-10', completion_pct: 69 }], 70, today).current,
  0,
);

check(
  'рекорд помнит прошлую длинную серию',
  computeStreak(
    [
      { date: '2026-08-10', completion_pct: 90 },
      { date: '2026-08-01', completion_pct: 90 },
      { date: '2026-07-31', completion_pct: 90 },
      { date: '2026-07-30', completion_pct: 90 },
      { date: '2026-07-29', completion_pct: 90 },
    ],
    70,
    today,
  ).longest,
  4,
);

check('бонусы при стрике 2', bonusesForStreak(2).map((b) => b.days), []);
check('бонусы при стрике 7', bonusesForStreak(7).map((b) => b.days), [3, 7]);
check('бонусы при стрике 20', bonusesForStreak(20).map((b) => b.days), [3, 7, 14]);

/* -------------------------------------------------------------------------- */
section('Уровни и XP — двадцать ступеней');

check('0 XP → уровень 1', levelForXp(0), 1);
check('299 XP → уровень 1', levelForXp(299), 1);
check('300 XP → уровень 2', levelForXp(300), 2);
check('799 XP → уровень 2', levelForXp(799), 2);
check('800 XP → уровень 3', levelForXp(800), 3);
check('1800 XP → уровень 4', levelForXp(1800), 4);
check('3500 XP → уровень 5', levelForXp(3500), 5);
check('6500 XP → уровень 6', levelForXp(6500), 6);
check('10000 XP → уровень 7', levelForXp(10000), 7);
check('20000 XP → уровень 9', levelForXp(20000), 9);
check('27000 XP → уровень 10', levelForXp(27000), 10);
check('73000 XP → уровень 14', levelForXp(73000), 14);
check('240000 XP → уровень 20', levelForXp(240000), 20);
check('999999 XP → уровень 20 (максимум)', levelForXp(999999), 20);
check('ступеней ровно 20', MAX_LEVEL, 20);
check('пороги не убывают', LEVEL_THRESHOLDS.every((v, i, a) => i === 0 || v > a[i - 1]), true);
check(
  'первые шесть порогов не менялись',
  LEVEL_THRESHOLDS.slice(0, 6),
  [0, 300, 800, 1800, 3500, 6500],
);

const lvl2 = getLevelInfo(550, ru);
check('550 XP → «Охотник»', lvl2.name, 'Охотник');
check('550 XP → до следующего 250', lvl2.xpToNext, 250);
check('550 XP → 50% внутри уровня', lvl2.progressPct, 50);

const lvlMax = getLevelInfo(300000, ru);
check('максимум → isMax', lvlMax.isMax, true);
check('максимум → «Апекс»', lvlMax.name, 'Апекс');
check('максимум → до следующего 0', lvlMax.xpToNext, 0);
check('английские названия уровней', getLevelInfo(550, en).name, 'Hunter');

section('XP: рассылка весит больше всего блока привычек');
check('рассылка дороже привычки', XP.OUTREACH_SENT > XP.HABIT * 6, true);
check('стоимость рассылки', XP.OUTREACH_SENT, 8);
check('стоимость ответа', XP.REPLIED, 80);
check('стоимость созвона', XP.CALL, 250);
check('стоимость закрытия', XP.CLOSED, 1000);
check('квота', XP.QUOTA_DONE, 100);
check('рекорд дня', XP.DAILY_RECORD, 200);
check('веха дешевле рекорда', XP.MILESTONE < XP.DAILY_RECORD, true);
check('мысль почти ничего не стоит', XP.NOTE_FIRST < XP.OUTREACH_SENT, true);

section('Разблокировки по уровням');
check('офферы с уровня 2', FEATURE_LEVEL.offers, 2);
check('ниши с уровня 3', FEATURE_LEVEL.niches, 3);
check('скорость с уровня 4', FEATURE_LEVEL.speed, 4);
check('проект с уровня 5', FEATURE_LEVEL.project, 5);
check('отчёт с уровня 6', FEATURE_LEVEL.report, 6);
check('масштаб с уровня 7', FEATURE_LEVEL.scale, 7);
check('тепловая карта с уровня 8', FEATURE_LEVEL.heatmap, 8);
check('приоритет с уровня 9', FEATURE_LEVEL.prime, 9);
check('апекс на двадцатом', FEATURE_LEVEL.apex, 20);
check('на уровне 1 офферы закрыты', unlocked('offers', 1), false);
check('на уровне 2 офферы открыты', unlocked('offers', 2), true);
check('тизер после 1-го — офферы', nextLevelTeaser(1), 'offers');
check('на каждом уровне со 2-го есть что открыть',
  Array.from({ length: MAX_LEVEL - 1 }, (_, i) => featureAtLevel(i + 2)).every(Boolean), true);
check('на максимуме тизера нет', nextLevelTeaser(MAX_LEVEL), null);

section('Постепенное раскрытие лестницы');
check('на 1-м видно три ступени', revealCeiling(1), 3);
check('на 2-м всё ещё три', revealCeiling(2), 3);
check('взял 3-й — открылось шесть', revealCeiling(3), 6);
check('на 5-м всё ещё шесть', revealCeiling(5), 6);
check('взял 6-й — открылось девять', revealCeiling(6), 9);
check('взял 18-й — открылось двадцать', revealCeiling(18), 20);
check('выше максимума не показываем', revealCeiling(20), 20);
check('на 1-м скрыто семнадцать', hiddenAhead(1), 17);
check('на максимуме скрытого нет', hiddenAhead(20), 0);

// Впереди текущего всегда одна-три ступени: этого хватает, чтобы видеть
// куда шагать, и мало, чтобы прикинуть длину всего пути.
check(
  'впереди никогда не больше трёх ступеней',
  Array.from({ length: MAX_LEVEL }, (_, i) => revealCeiling(i + 1) - (i + 1)).filter(
    (ahead) => ahead > 3,
  ),
  [],
);
check(
  'ниже максимума впереди всегда хоть одна ступень',
  Array.from({ length: MAX_LEVEL - 1 }, (_, i) => revealCeiling(i + 1) - (i + 1)).filter(
    (ahead) => ahead < 1,
  ),
  [],
);

check('лестница обрывается на потолке видимости', levelLadder(3).length, 6);
check('текущий уровень помечен', levelLadder(3).find((r) => r.level === 3)?.state, 'current');
check('пройденные помечены', levelLadder(3).find((r) => r.level === 2)?.state, 'done');
check('следующий помечен', levelLadder(3).find((r) => r.level === 4)?.state, 'next');
check('дальний закрыт', levelLadder(3).find((r) => r.level === 5)?.state, 'locked');
check('за потолок не заглядываем', levelLadder(3).some((r) => r.level > 6), false);

section('Прогрессивная квота');
check('старт — 5', calculateQuota(0), 5);
check('после 2 закрытых дней всё ещё 5', calculateQuota(2), 5);
check('после 3 закрытых дней — 8', calculateQuota(3), 8);
check('после 6 — 11', calculateQuota(6), 11);
check('после 9 — 14', calculateQuota(9), 14);
check('после 12 — 17', calculateQuota(12), 17);
check('после 15 — 20', calculateQuota(15), 20);
check('потолок 30', calculateQuota(999), 30);
check('до роста с 0 — 3 дня', daysUntilQuotaGrows(0), 3);
check('до роста с 2 — 1 день', daysUntilQuotaGrows(2), 1);
check('следующая квота с 0 — 8', nextQuota(0), 8);

check(
  'взятая квота растит серию',
  rollQuotaForNewDay({ quotaStreak: 2, quotaLastDate: '2026-08-12', yesterdaySent: 5, yesterdayQuota: 5, today: '2026-08-13' }).quotaStreak,
  3,
);
check(
  'проваленная квота обнуляет серию',
  rollQuotaForNewDay({ quotaStreak: 5, quotaLastDate: '2026-08-12', yesterdaySent: 2, yesterdayQuota: 8, today: '2026-08-13' }).quotaStreak,
  0,
);
check(
  'проваленная квота НЕ уменьшает саму квоту',
  rollQuotaForNewDay({ quotaStreak: 5, quotaLastDate: '2026-08-12', yesterdaySent: 2, yesterdayQuota: 8, today: '2026-08-13' }).currentQuota,
  5,
);
check(
  'пропущенные сутки рвут серию',
  rollQuotaForNewDay({ quotaStreak: 9, quotaLastDate: '2026-08-09', yesterdaySent: 20, yesterdayQuota: 5, today: '2026-08-13' }).quotaStreak,
  0,
);
check(
  'повторный пересчёт за тот же день ничего не меняет',
  rollQuotaForNewDay({ quotaStreak: 4, quotaLastDate: '2026-08-13', yesterdaySent: 0, yesterdayQuota: 8, today: '2026-08-13' }).quotaStreak,
  4,
);

check('бонусов нет пока квота не взята', bonusStepsReached(4, 5), []);
check('бонусов нет ровно на квоте', bonusStepsReached(5, 5), []);
check('первая пятёрка сверх квоты', bonusStepsReached(10, 5), [1]);
check('две пятёрки сверх квоты', bonusStepsReached(15, 5), [1, 2]);
check('процент не превышает 100', quotaPct(20, 5), 100);

check('цепочка: первый день', rollChain({ chainDays: 0, chainLastDate: null, today: '2026-08-13' }), 1);
check('цепочка: следующий день', rollChain({ chainDays: 4, chainLastDate: '2026-08-12', today: '2026-08-13' }), 5);
check('цепочка: тот же день не растит', rollChain({ chainDays: 4, chainLastDate: '2026-08-13', today: '2026-08-13' }), 4);
check('цепочка: пропуск обнуляет', rollChain({ chainDays: 9, chainLastDate: '2026-08-10', today: '2026-08-13' }), 1);

section('Режим воздержания');
check('0 дней — начальная стадия', modeStageKey(0), 's0');
check('2 дня — первые 72 часа', modeStageKey(2), 's1');
check('5 дней — неделя', modeStageKey(5), 's2');
check('10 дней — норадреналин', modeStageKey(10), 's3');
check('18 дней — скулы', modeStageKey(18), 's4');
check('30 дней — новый режим', modeStageKey(30), 's5');
const mode = (n: number): ModeCounters =>
  Object.fromEntries(MODE_KEYS.map((k) => [k, n])) as ModeCounters;

check('в режиме шесть пунктов', MODE_KEYS.length, 6);
check('режим активен при 14+ у всех шести', isModeActive(mode(14)), true);
check('один отстающий гасит бейдж', isModeActive({ ...mode(30), reels: 13 }), false);

/*
 * Счёт по умолчанию. Раньше день засчитывал вечерний ответ, и у человека,
 * который держался, но не открыл приложение, счётчик замирал. Замерший
 * счётчик обесценивает выдержку ровно тем, что её не замечает.
 */
check('тот же день второй раз не начисляем', rollMode(mode(5), '2026-08-27', '2026-08-27').changed, false);
check('первый запуск только фиксирует день', rollMode(mode(0), null, '2026-08-27').changed, true);
check('сутки — всем плюс один', rollMode(mode(5), '2026-08-26', '2026-08-27').counters.porn, 6);
// Приложение не открывали четыре дня, но жили: дни засчитываются все.
check('пропуск четырёх суток — всем плюс четыре', rollMode(mode(5), '2026-08-23', '2026-08-27').counters.reels, 9);
check('часы уехали назад — ничего не трогаем', rollMode(mode(5), '2026-08-28', '2026-08-27').changed, false);

check('срыв обнуляет только свой счётчик', breakStreak(mode(9), 'sugar').sugar, 0);
check('остальные после срыва продолжают расти', breakStreak(mode(9), 'sugar').porn, 9);

check('дней до дедлайна', daysUntilDeadline('2027-04-15', '2026-08-13'), 245);

section('Привычки — шесть штук, вес минимальный');

check('весь блок привычек дешевле одной рассылки', XP.HABIT * 6 < XP.OUTREACH_SENT, true);

section('Даты и недели');

check('неделя начинается с понедельника', weekDates('2026-08-10')[0], '2026-08-10');
check('неделя кончается воскресеньем', weekDates('2026-08-10')[6], '2026-08-16');
check('воскресенье принадлежит своей неделе', weekDates('2026-08-16')[0], '2026-08-10');
check('в неделе 7 дней', weekDates('2026-08-12').length, 7);
check('разница дат', daysBetween('2026-08-10', '2026-08-01'), 9);


/* -------------------------------------------------------------------------- */
section('Каскад: добавление рассылки');

const add = (over: Partial<Parameters<typeof onOutreachAdded>[0]> = {}) =>
  onOutreachAdded({
    sentToday: 3, quota: 5, record: 9, date: '2026-08-13',
    awardedBonusSteps: [], totalBefore: 1, ...over,
  });

const plain = add();
check('обычная рассылка даёт 8 XP', totalXp(plain), 8);
check('обычная рассылка не открывает оверлей', plain.some((e) => e.kind === 'overlay'), false);
check('обычная рассылка даёт один тост', plain.filter((e) => e.kind === 'toast').length, 1);
check('обычная рассылка даёт тактильный отклик', plain.some((e) => e.kind === 'fx'), true);

const closing = add({ sentToday: 5, quota: 5 });
check('закрытие квоты: 8 + 100 + 25 за ровное число', totalXp(closing), 133);
check('закрытие квоты показывает оверлей', hasOverlay(closing, 'quota'), true);
check('при оверлее квоты тоста нет', closing.filter((e) => e.kind === 'toast').length, 0);

const record = add({ sentToday: 11, quota: 20 });
check('рекорд: 8 + 200', totalXp(record), 208);
check('рекорд обновляет профиль', record.some((e) => e.kind === 'profile'), true);
check('тост рекорда важнее остальных', record.find((e) => e.kind === 'toast'), { kind: 'toast', textKey: 'record', vars: { n: 11 }, tone: 'record' });

const round = add({ sentToday: 20, quota: 30, record: 50 });
check('ровное число за день даёт 8 + 25', totalXp(round), 33);
check('ровное число даёт свой тост', round.find((e) => e.kind === 'toast'), { kind: 'toast', textKey: 'round', vars: { n: 20 }, tone: 'round' });

const bonus = add({ sentToday: 11, quota: 5, record: 99 });
check('первая пятёрка сверх квоты: 8 + 50', totalXp(bonus), 58);

const bonusAgain = add({ sentToday: 11, quota: 5, record: 99, awardedBonusSteps: [1] });
check('уже начисленный бонус не повторяется', totalXp(bonusAgain), 8);

section('Вехи по общему счёту и двойной удар');

const milestone = add({ sentToday: 3, quota: 5, record: 99, totalBefore: 24 });
check('25-я рассылка за всё время даёт веху: 8 + 150', totalXp(milestone), 158);
check('веха даёт свой тост', milestone.find((e) => e.kind === 'toast'), { kind: 'toast', textKey: 'milestone', vars: { n: 25 }, tone: 'record' });
check('обычная рассылка вехи не даёт', totalXp(add({ totalBefore: 25 })), 8);

const overdrive = add({ sentToday: 10, quota: 5, record: 99, doubleXp: true, awardedBonusSteps: [1] });
check('перк двойного удара удваивает каждую десятую', totalXp(overdrive), 8 + 8 + 25);
check('без перка десятая обычная', totalXp(add({ sentToday: 10, quota: 5, record: 99, awardedBonusSteps: [1] })), 8 + 25);

section('Ровное число');

check('следующая пятёрка от 22 — это 25', roundTarget(22).target, 25);
check('от 22 осталось три', roundTarget(22).remaining, 3);
check('от 24 цель растягивается до 30', roundTarget(24).target, 30);
check('от 24 осталось шесть', roundTarget(24).remaining, 6);
check('от 24 цель именно растянута', roundTarget(24).stretched, true);
check('от 25 идём к 30', roundTarget(25).target, 30);
check('от 29 идём к 30, растяжки нет', roundTarget(29).stretched, false);
check('от нуля — к пятёрке', roundTarget(0).target, 5);
check('ноль не считается ровным', isRound(0), false);
check('десять — ровное', isRound(10), true);
check('вес сотни выше веса пятёрки', milestoneWeight(100) > milestoneWeight(15), true);
check('вехи между 24 и 26', milestonesCrossed(24, 26, 25), [25]);
check('пачка контактов перепрыгивает веху', milestonesCrossed(20, 55, 25), [25, 50]);
check('назад вехи не считаются', milestonesCrossed(30, 20, 25), []);

check('пока квота не закрыта — цель квота', pickNudge({ sentToday: 3, quota: 5, total: 22 }).kind, 'quota');
check('после квоты — ровный день', pickNudge({ sentToday: 7, quota: 5, total: 22 }).kind, 'round-day');
check('ровный день → ровный общий счёт', pickNudge({ sentToday: 10, quota: 5, total: 22 }).kind, 'round-total');
check('и он ведёт к 25', pickNudge({ sentToday: 10, quota: 5, total: 22 }).target, 25);

/* -------------------------------------------------------------------------- */
section('Редкое событие празднуется каждый раз');

const again = (status: 'call' | 'closed', had: boolean) =>
  onStatusChanged({
    contactId: 'c1',
    status,
    hadFirstReply: true,
    hadFirstCall: status === 'call' ? had : true,
    hadFirstClosed: status === 'closed' ? had : true,
  });

// Ответы приходят почти каждый день — оверлей на каждый был бы помехой.
check(
  'повторный ответ обходится тостом',
  hasOverlay(
    onStatusChanged({
      contactId: 'c1',
      status: 'replied',
      hadFirstReply: true,
      hadFirstCall: true,
      hadFirstClosed: true,
    }),
    'first-reply',
  ),
  false,
);

// Созвон раз в неделю, закрытие реже: отметить их тостом в полторы секунды
// значит не отметить вовсе.
check('первый созвон — свой оверлей', hasOverlay(again('call', false), 'first-call'), true);
check('второй созвон тоже празднуется', hasOverlay(again('call', true), 'call-again'), true);
check('первое закрытие — свой оверлей', hasOverlay(again('closed', false), 'first-closed'), true);
check('второе закрытие тоже празднуется', hasOverlay(again('closed', true), 'closed-again'), true);
// Отметку «первое было» ставим один раз: иначе дата первого закрытия
// переписывалась бы каждым следующим.
check(
  'повторное закрытие не трогает дату первого',
  again('closed', true).some((e) => e.kind === 'profile'),
  false,
);
check(
  'первое закрытие дату ставит',
  again('closed', false).some((e) => e.kind === 'profile'),
  true,
);
check('цена закрытия не изменилась', totalXp(again('closed', true)), XP.CLOSED);

/* -------------------------------------------------------------------------- */
section('Каскад: продвижение по воронке');

const firstReply = onStatusChanged({ contactId: 'c1', status: 'replied', hadFirstReply: false, hadFirstCall: false, hadFirstClosed: false });
check('первый ответ даёт 80 XP', totalXp(firstReply), 80);
check('первый ответ показывает спецэкран', hasOverlay(firstReply, 'first-reply'), true);
check('первый ответ не дублируется тостом', firstReply.some((e) => e.kind === 'toast'), false);

const secondReply = onStatusChanged({ contactId: 'c2', status: 'replied', hadFirstReply: true, hadFirstCall: false, hadFirstClosed: false });
check('второй ответ тоже даёт 80 XP', totalXp(secondReply), 80);
check('второй ответ спецэкран не показывает', hasOverlay(secondReply, 'first-reply'), false);
check('второй ответ показывает тост', secondReply.some((e) => e.kind === 'toast'), true);

const firstClose = onStatusChanged({ contactId: 'c3', status: 'closed', hadFirstReply: true, hadFirstCall: true, hadFirstClosed: false });
check('первое закрытие даёт 1000 XP', totalXp(firstClose), 1000);
check('первое закрытие показывает спецэкран', hasOverlay(firstClose, 'first-closed'), true);
check('закрытие даёт отдельный тактильный отклик', firstClose.find((e) => e.kind === 'fx'), { kind: 'fx', fx: 'close' });

const neutral = onStatusChanged({ contactId: 'c4', status: 'read', hadFirstReply: true, hadFirstCall: true, hadFirstClosed: true });
check('статус «Прочитал» не награждается', neutral.length, 0);

check(
  'XP за статус привязан к паре контакт+статус',
  onStatusChanged({ contactId: 'c9', status: 'call', hadFirstReply: true, hadFirstCall: true, hadFirstClosed: true })
    .find((e) => e.kind === 'xp' && 'onceKey' in e ? e.onceKey : null) !== undefined,
  true,
);

section('«Ответил — отказ» это ответ');

const repliedNo = onStatusChanged({ contactId: 'c6', status: 'replied_no', hadFirstReply: false, hadFirstCall: false, hadFirstClosed: false });
check('отказ словами даёт те же 80 XP', totalXp(repliedNo), 80);
check('и открывает спецэкран первого ответа', hasOverlay(repliedNo, 'first-reply'), true);
check('«ответил» считается ответом', isReplyStatus('replied'), true);
check('«ответил — отказ» считается ответом', isReplyStatus('replied_no'), true);
check('«прочитал» ответом не считается', isReplyStatus('read'), false);

const replyKey = (status: 'replied' | 'replied_no') =>
  onStatusChanged({ contactId: 'c7', status, hadFirstReply: true, hadFirstCall: true, hadFirstClosed: true })
    .flatMap((e) => (e.kind === 'xp' ? [e.onceKey] : []))[0];
check(
  'оба ответных статуса делят один ключ — 160 XP за один ответ не выйдет',
  replyKey('replied') === replyKey('replied_no'),
  true,
);
check('у отказа свой тост', onStatusChanged({ contactId: 'c8', status: 'replied_no', hadFirstReply: true, hadFirstCall: true, hadFirstClosed: true })
  .find((e) => e.kind === 'toast' && e.textKey === 'repliedNo') !== undefined, true);

section('Статуса «Отказ» больше нет');
check('в шкале девять статусов', CONTACT_STATUSES.length, 9);
check('«Отказ» убран', (CONTACT_STATUSES as readonly string[]).includes('refused'), false);
check('старый «Отказ» превращается в «Ответил — отказ»', normalizeStatus('refused'), 'replied_no');
check('старый ignored тоже', normalizeStatus('ignored'), 'replied_no');
check('живой статус не трогаем', normalizeStatus('call'), 'call');
check('мусор превращается в «Отправлено»', normalizeStatus('чепуха'), 'sent');
check('пусто превращается в «Отправлено»', normalizeStatus(null), 'sent');
check('«Ответил — отказ» входит в ответы', REPLIED_STATUSES.includes('replied_no'), true);
check('«Ответил — отказ» подсвечивается красным', NEGATIVE_STATUSES.includes('replied_no'), true);


/* -------------------------------------------------------------------------- */
section('Напоминания о касаниях');

const fu = (over: Partial<Parameters<typeof followUpState>[0]> = {}) =>
  followUpState({ status: 'sent', lastTouchAt: '2026-08-13', touchCount: 1, muted: false, today: '2026-08-13', ...over });

check('каскад касаний', [...SILENT_STEPS], [1, 3, 7, 15, 30]);
check('первое напоминание через день', intervalFor('sent', 1), 1);
check('второе — через 3', intervalFor('sent', 2), 3);
check('третье — через 7', intervalFor('sent', 3), 7);
check('четвёртое — через 15', intervalFor('sent', 4), 15);
check('пятое — через 30', intervalFor('sent', 5), 30);
check('после пятого каскад кончился', intervalFor('sent', 6), null);
check('прочитавшего ведём тем же каскадом', intervalFor('read', 2), 3);
check('ответившего тоже ведём каскадом — он ушёл в игнор', intervalFor('replied', 1), 1);
check('и дальше по тем же шагам', intervalFor('replied', 3), 7);
check('и он тоже когда-то остывает', intervalFor('replied', 6), null);
check('перед созвоном — за день', intervalFor('call', 1), 1);
check('«ответил — отказ» не дожимаем: он сказал нет словами', intervalFor('replied_no', 1), null);
check('заблокировавшего не напоминаем', intervalFor('blocked', 1), null);
check('закрытого не напоминаем', intervalFor('closed', 1), null);
check('не отправленного не напоминаем', intervalFor('not_sent', 1), null);

check('причина для молчуна', reasonFor('sent'), 'silent');
check('причина для ответившего', reasonFor('replied'), 'replied');
check('причина для созвона', reasonFor('call'), 'call');
check(
  'ответивший созревает на следующий день',
  followUpState({ status: 'replied', lastTouchAt: '2026-08-13', touchCount: 1, muted: false, today: '2026-08-14' }).urgency,
  'due',
);
check(
  'у ответившего каскад тоже исчерпывается',
  followUpState({ status: 'replied', lastTouchAt: '2026-08-13', touchCount: 6, muted: false, today: '2026-11-30' }).urgency,
  'cold',
);

check('в день отправки — уже завтра', fu().urgency, 'soon');
check('на следующий день — пора', fu({ today: '2026-08-14' }).urgency, 'due');
check('через три дня — просрочено', fu({ today: '2026-08-16' }).urgency, 'overdue');
check('просрочка считается верно', fu({ today: '2026-08-16' }).daysUntil, -2);

check(
  'второе касание созревает на третий день',
  fu({ touchCount: 2, lastTouchAt: '2026-08-13', today: '2026-08-16' }).urgency,
  'due',
);
check(
  'третье касание ждёт неделю',
  fu({ touchCount: 3, lastTouchAt: '2026-08-13', today: '2026-08-18' }).urgency,
  'none',
);
check(
  'третье касание созревает на седьмой день',
  fu({ touchCount: 3, lastTouchAt: '2026-08-13', today: '2026-08-20' }).urgency,
  'due',
);

check(
  'исчерпанный каскад помечает остывшего',
  fu({ touchCount: 6, today: '2026-11-30' }).urgency,
  'cold',
);
check('заглушённый контакт молчит', fu({ muted: true, today: '2026-08-20' }).urgency, 'none');

check('пора касаться — просрочено', needsTouch(fu({ today: '2026-08-17' })), true);
check('пора касаться — сегодня', needsTouch(fu({ today: '2026-08-14' })), true);
check('не пора — ещё рано', needsTouch(fu({ touchCount: 3, today: '2026-08-15' })), false);

const overdue = fu({ today: '2026-08-20' });
const due = fu({ today: '2026-08-14' });
check('просроченные идут первыми', compareUrgency(overdue, due) < 0, true);

section('Результат оффера зеркалит статус рассылки');
check('шкалы совпадают один в один', [...OFFER_RESULTS], [...CONTACT_STATUSES]);
check('заблокировал есть в статусах', CONTACT_STATUSES.includes('blocked'), true);
check('заблокировал считается дошедшей рассылкой', SENT_STATUSES.includes('blocked'), true);
check('заблокировал НЕ считается ответом', REPLIED_STATUSES.includes('blocked'), false);


/* -------------------------------------------------------------------------- */
section('Недельные отчёты');

const mk = (over: Partial<OutreachContact>): OutreachContact =>
  ({
    id: 'x', user_id: 'u', name: 'n', niche: null, audience_size: null, platform: null,
    status: 'sent', note: null, status_history: [], telegram_handle: null,
    instagram_url: null, first_contact_date: '2026-08-10', comment: null, next_step: null,
    replied_at: null, last_touch_at: null, touch_count: 1, muted: false,
    created_at: '2026-08-10T10:00:00Z', updated_at: '2026-08-10T10:00:00Z', ...over,
  }) as OutreachContact;

const week = '2026-08-10'; // понедельник

check(
  'рассылки недели считаются по дате касания',
  statsForWeek([mk({ first_contact_date: '2026-08-11' }), mk({ first_contact_date: '2026-08-03' })], week).sent,
  1,
);

check(
  'ответ засчитывается по дате перехода, а не по текущему статусу',
  statsForWeek(
    [mk({ status: 'closed', first_contact_date: '2026-08-03', status_history: [
      { status: 'sent', at: '2026-08-11T10:00:00Z' },
      { status: 'replied', at: '2026-08-12T10:00:00Z' },
      { status: 'closed', at: '2026-08-20T10:00:00Z' },
    ] })],
    week,
  ),
  { weekStart: week, sent: 0, replied: 1, calls: 0, closed: 0, bestDay: null, bestCount: 0 },
);

check(
  '«ответил — отказ» тоже считается ответом',
  statsForWeek([mk({ status_history: [{ status: 'replied_no', at: '2026-08-12T10:00:00Z' }] })], week).replied,
  1,
);

check(
  'один контакт не даёт два ответа',
  statsForWeek([mk({ status_history: [
    { status: 'replied', at: '2026-08-11T10:00:00Z' },
    { status: 'replied_no', at: '2026-08-12T10:00:00Z' },
  ] })], week).replied,
  1,
);

const best = statsForWeek(
  [
    mk({ first_contact_date: '2026-08-11' }),
    mk({ first_contact_date: '2026-08-11' }),
    mk({ first_contact_date: '2026-08-13' }),
  ],
  week,
);
check('лучший день недели найден', best.bestDay, '2026-08-11');
check('и его результат', best.bestCount, 2);

check(
  'текущая неделя в отчёты не попадает',
  missingWeeks({ cycleStart: '2026-08-10', today: '2026-08-13', existing: [] }),
  [],
);
check(
  'закрытые недели попадают',
  missingWeeks({ cycleStart: '2026-08-03', today: '2026-08-13', existing: [] }),
  ['2026-08-03'],
);
check(
  'уже посчитанные не дублируются',
  missingWeeks({ cycleStart: '2026-07-27', today: '2026-08-13', existing: ['2026-08-03'] }),
  ['2026-07-27'],
);


/* -------------------------------------------------------------------------- */
section('Отчёт не считает базу рассылками');

const wk = '2026-08-10';

// Жалоба была ровно эта: сумма недель не сходилась с общим числом рассылок.
// Причина — собранная база: у неё есть дата касания, но письма не было.
check(
  'собранная база не считается рассылкой',
  statsForWeek(
    [
      mk({ status: 'not_sent', first_contact_date: '2026-08-11' }),
      mk({ status: 'sent', first_contact_date: '2026-08-11' }),
    ],
    wk,
  ).sent,
  1,
);
check(
  'неделя из одной базы пустая',
  statsForWeek([mk({ status: 'not_sent', first_contact_date: '2026-08-11' })], wk),
  { weekStart: wk, sent: 0, replied: 0, calls: 0, closed: 0, bestDay: null, bestCount: 0 },
);
// Лучший день считался из того же цикла — база зажигала день, в который
// не было отправлено ни одного сообщения.
check(
  'лучший день не считает базу',
  statsForWeek(
    [
      mk({ status: 'not_sent', first_contact_date: '2026-08-11' }),
      mk({ status: 'not_sent', first_contact_date: '2026-08-11' }),
      mk({ status: 'sent', first_contact_date: '2026-08-13' }),
    ],
    wk,
  ).bestDay,
  '2026-08-13',
);
check(
  'старый статус приводится к шкале и считается рассылкой',
  statsForWeek([mk({ status: 'refused' as never, first_contact_date: '2026-08-11' })], wk).sent,
  1,
);
check(
  'удалённый чат и блокировка — тоже рассылки',
  statsForWeek(
    [
      mk({ status: 'deleted_chat', first_contact_date: '2026-08-11' }),
      mk({ status: 'blocked', first_contact_date: '2026-08-12' }),
    ],
    wk,
  ).sent,
  2,
);

const twoWeeks = [
  mk({ status: 'not_sent', first_contact_date: '2026-08-11' }),
  mk({ status: 'sent', first_contact_date: '2026-08-11' }),
  mk({ status: 'sent', first_contact_date: '2026-08-04' }),
];
check(
  'сумма недель равна общему числу рассылок',
  statsForWeek(twoWeeks, '2026-08-10').sent + statsForWeek(twoWeeks, '2026-08-03').sent,
  2,
);

/* -------------------------------------------------------------------------- */
section('Отчёт лечит сам себя');

const healContacts = [
  mk({ status: 'sent', first_contact_date: '2026-08-04' }),
  mk({ status: 'not_sent', first_contact_date: '2026-08-05' }),
];
const heal = (existing: Parameters<typeof reportsToWrite>[0]['existing']) =>
  reportsToWrite({ contacts: healContacts, cycleStart: '2026-08-03', today: '2026-08-13', existing });

// Строки, посчитанные до починки, так и остались бы завышенными: отчёт
// считался один раз и застывал.
check(
  'завышенная строка переписывается',
  heal([{ week_start: '2026-08-03', sent: 2, replied: 0, calls: 0, closed: 0, best_day: '2026-08-04', best_count: 1 }])
    .map((r) => r.sent),
  [1],
);
check(
  'совпавшая строка не переписывается',
  heal([{ week_start: '2026-08-03', sent: 1, replied: 0, calls: 0, closed: 0, best_day: '2026-08-04', best_count: 1 }]),
  [],
);
check('отсутствующая строка создаётся', heal([]).map((r) => r.week_start), ['2026-08-03']);
// Текущая неделя не закончилась, её итог ещё изменится.
check(
  'текущая неделя не пишется',
  reportsToWrite({
    contacts: [mk({ status: 'sent', first_contact_date: '2026-08-11' })],
    cycleStart: '2026-08-10',
    today: '2026-08-13',
    existing: [],
  }),
  [],
);
// Страховка от вечной перезаписи пустых недель.
check(
  'null против null расхождением не считается',
  sameNumbers(
    { week_start: 'w', sent: 0, replied: 0, calls: 0, closed: 0, best_day: null, best_count: 0 },
    toWeekRow({ weekStart: 'w', sent: 0, replied: 0, calls: 0, closed: 0, bestDay: null, bestCount: 0 }),
  ),
  true,
);
check(
  'расхождение по лучшему дню тоже переписывает',
  sameNumbers(
    { week_start: 'w', sent: 1, replied: 0, calls: 0, closed: 0, best_day: '2026-08-05', best_count: 1 },
    toWeekRow({ weekStart: 'w', sent: 1, replied: 0, calls: 0, closed: 0, bestDay: '2026-08-04', bestCount: 1 }),
  ),
  false,
);

/* -------------------------------------------------------------------------- */
section('Переписка');

const msg = (role: 'me' | 'them', text: string) => ({ role, text });

check('мусор из базы не роняет разбор', parseMessages(null).length, 0);
check('объект вместо массива тоже', parseMessages({ role: 'me' }).length, 0);
check('пустые сообщения отбрасываются', parseMessages([{ role: 'me', text: '   ' }]).length, 0);
check('неизвестная роль считается своей', parseMessages([{ role: 'x', text: 'а' }])[0]?.role, 'me');
check('нормальная запись проходит', parseMessages([{ role: 'them', text: ' да ' }])[0]?.text, 'да');

const pasted = parseChat(
  'Родион, [16.08.2025 14:03]\nпривет\nсмотрел твой запуск\n\nЭксперт, [16.08.2025 14:10]\nда, слушаю\n\nРодион, [16.08.2025 14:11]\nмогу помочь?',
);
check('экспорт разбирается на блоки', pasted.length, 3);
check('многострочное сообщение склеивается', pasted[0]?.text, 'привет\nсмотрел твой запуск');
check('авторы вытаскиваются по порядку', authorsOf(pasted), ['Родион', 'Эксперт']);
check('роли расставляются по выбранному автору', assignRoles(pasted, 'Родион').map((m) => m.role), ['me', 'them', 'me']);
check('текст без заголовков не разбирается', parseChat('просто текст').length, 0);
check('заголовок без тела ничего не добавляет', parseChat('Родион, [16.08.2025 14:03]').length, 0);

// Пользователь решил, что подпись «максимум 200» под полем — это лимит
// символов. Лимит на количество сообщений, длина не режется нигде.
check(
  'длинное сообщение не режется при разборе',
  parseChat('Родион, [16.08.2025 14:03]\n' + 'я'.repeat(2400))[0]?.text.length,
  2400,
);
check(
  'и не режется на обратном пути из базы',
  parseMessages([{ role: 'them', text: 'я'.repeat(2400) }])[0]?.text.length,
  2400,
);
check(
  'лимит считает сообщения, а не символы',
  parseChat(
    Array.from({ length: 250 }, (_, i) => `Родион, [16.08.2025 14:03]\nm${i}`).join('\n'),
  ).length,
  200,
);

// Переписку вставляют кусками: скопировал две реплики, сохранил, вернулся
// за следующими. Куски обязаны дописываться, а не заменять предыдущие.
const chunks: ChatMessage[] = (() => {
  let acc: ChatMessage[] = [];
  for (const chunk of ['Родион, [1]\nраз', 'Эксперт, [2]\nдва', 'Родион, [3]\nтри']) {
    acc = parseMessages([...acc, ...assignRoles(parseChat(chunk), 'Родион')]);
  }
  return acc;
})();
check('куски дописываются в конец', chunks.map((m) => m.text), ['раз', 'два', 'три']);
check('и роли кусков не путаются', chunks.map((m) => m.role), ['me', 'them', 'me']);

const goodChat = [msg('me', 'привет, смотрел запуск'), msg('them', 'да'), msg('me', 'могу разобрать. интересно?')];
const goodMetrics = chatMetrics(goodChat);
check('сообщения считаются по ролям', [goodMetrics.mine, goodMetrics.theirs], [2, 1]);
check('последним написал ты', goodMetrics.lastRole, 'me');
check('и закончил вопросом', goodMetrics.endsWithQuestion, true);
check('монолога нет', goodMetrics.longestMonologue, 1);
check('здоровый диалог без замечаний', chatIssues(goodMetrics), []);
check('и с полным баллом', chatScore(goodMetrics), 100);

const monologue = [msg('me', 'раз?'), msg('me', 'два'), msg('me', 'три')];
check('три подряд — монолог', chatMetrics(monologue).longestMonologue, 3);
check('монолог попадает в замечания', chatIssues(chatMetrics(monologue)).includes('monologue'), true);

const waiting = [msg('me', 'привет?'), msg('them', 'а что именно?')];
check('ход за тобой — главное замечание', chatIssues(chatMetrics(waiting))[0], 'ballTheirs');

const deadEnd = [msg('them', 'ок'), msg('me', 'понял, спасибо')];
check('тупик распознаётся', chatIssues(chatMetrics(deadEnd)).includes('deadEnd'), true);
check('и вопроса в переписке нет', chatIssues(chatMetrics(deadEnd)).includes('noQuestion'), true);

const wall = [msg('me', 'а'.repeat(600) + '?'), msg('them', 'ок')];
check('стена текста распознаётся', chatIssues(chatMetrics(wall)).includes('wall'), true);

// Одно слово в ответ не делает нормальную реплику стеной: без абсолютного
// порога это правило ругалось бы на любой живой диалог.
check(
  'короткий ответ не делает тебя стеной',
  chatIssues(chatMetrics([msg('me', 'привет, смотрел запуск. интересно?'), msg('them', 'да')])).includes('wall'),
  false,
);
check(
  'два сообщения против одного — ещё не перекос',
  chatIssues(chatMetrics([msg('me', 'раз?'), msg('them', 'да'), msg('me', 'два?')])),
  [],
);
check('пустая переписка без замечаний', chatIssues(chatMetrics([])), []);
check('и без балла', chatScore(chatMetrics([])), 0);
check('балл не уходит ниже нуля', chatScore(chatMetrics(
  [msg('me', 'а'.repeat(600)), msg('me', 'б'.repeat(600)), msg('me', 'в'.repeat(600)), msg('them', 'ок')],
)) >= 0, true);

const digest = digestChats([goodChat, monologue, waiting, []]);
check('пустые переписки не считаются', digest.chats, 3);
check('монолог посчитан', digest.counts.monologue, 1);
check('ждущие ответа посчитаны', digest.waiting, 1);
check('самая частая ошибка найдена', Boolean(digest.worst), true);
check('средний балл в границах', digest.averageScore >= 0 && digest.averageScore <= 100, true);
check('на пустом входе сводка пустая', digestChats([]).chats, 0);
check('и худшей ошибки нет', digestChats([]).worst, null);
check(
  'у каждой ошибки есть название и что делать (ru)',
  CHAT_ISSUE_IDS.filter((id) => !ru.chat.issues[id] || !ru.chat.fixes[id]),
  [],
);
check(
  'у каждой ошибки есть название и что делать (en)',
  CHAT_ISSUE_IDS.filter((id) => !en.chat.issues[id] || !en.chat.fixes[id]),
  [],
);

/* -------------------------------------------------------------------------- */
section('Напоминания');

check('время склеивается', composeDueAt('2026-08-16', '14:30'), '2026-08-16T14:30');
check('пустое время — девять утра', composeDueAt('2026-08-16', ''), '2026-08-16T09:00');
check('дата вытаскивается', reminderDate('2026-08-16T14:30'), '2026-08-16');
check('время вытаскивается', reminderTime('2026-08-16T14:30'), '14:30');

const rem = (over: Partial<{ due_at: string; done: boolean }> = {}) => ({
  due_at: '2026-08-16T14:00',
  done: false,
  ...over,
});

check('до срока — ждём', urgencyOf(rem(), '2026-08-16T13:00'), 'today');
check('минута в минуту — пора', urgencyOf(rem(), '2026-08-16T14:00'), 'due');
check('через час всё ещё пора — весь день висит', urgencyOf(rem(), '2026-08-16T15:00'), 'due');
check('на следующий день — долг', urgencyOf(rem(), '2026-08-17T09:00'), 'overdue');
check('завтрашнее — впереди', urgencyOf(rem({ due_at: '2026-08-18T10:00' }), '2026-08-16T13:00'), 'upcoming');
check('закрытое молчит', urgencyOf(rem({ done: true }), '2026-08-17T09:00'), 'done');
check('пора — это активное', isActive('due'), true);
check('долг — тоже активное', isActive('overdue'), true);
check('будущее — не активное', isActive('upcoming'), false);

const reminderRows = [
  { id: 'a', user_id: 'u', title: 'Долг', note: null, due_at: '2026-08-15T10:00', contact_id: null, done: false, created_at: '', updated_at: '' },
  { id: 'b', user_id: 'u', title: 'Сейчас', note: null, due_at: '2026-08-16T09:00', contact_id: 'c1', done: false, created_at: '', updated_at: '' },
  { id: 'c', user_id: 'u', title: 'Позже', note: null, due_at: '2026-08-16T20:00', contact_id: null, done: false, created_at: '', updated_at: '' },
  { id: 'd', user_id: 'u', title: 'Завтра', note: null, due_at: '2026-08-17T10:00', contact_id: null, done: false, created_at: '', updated_at: '' },
  { id: 'e', user_id: 'u', title: 'Закрыто', note: null, due_at: '2026-08-14T10:00', contact_id: null, done: true, created_at: '', updated_at: '' },
];

const groups = groupReminders(reminderRows, '2026-08-16T12:00');
check('активных двое', groups.active.map((r) => r.id), ['a', 'b']);
check('сегодня позже — одно', groups.today.map((r) => r.id), ['c']);
check('впереди — одно', groups.upcoming.map((r) => r.id), ['d']);
check('закрытое отдельно', groups.done.map((r) => r.id), ['e']);
check('счётчик активных', activeCount(reminderRows, '2026-08-16T12:00'), 2);
check('привязанные к людям отделяются', forContacts(reminderRows).map((r) => r.id), ['b']);
check('общие отделяются', standalone(reminderRows).map((r) => r.id), ['a', 'c', 'd', 'e']);

/* -------------------------------------------------------------------------- */
section('Поиск и фильтры по рассылкам');

const c = (over: Partial<OutreachContact>): OutreachContact => mk(over);

const roster = [
  c({ id: '1', name: 'Дима', niche: 'Фитнес', telegram_handle: 'dima_fit', status: 'sent', first_contact_date: '2026-08-16', created_at: '2026-08-16T10:00:00Z' }),
  c({ id: '2', name: 'Аня', niche: 'Психология', instagram_url: 'https://instagram.com/anya', status: 'replied', first_contact_date: '2026-08-01', created_at: '2026-08-01T10:00:00Z' }),
  c({ id: '3', name: 'Олег', niche: 'фитнес', status: 'replied_no', comment: 'Оффер про запуск', first_contact_date: '2026-06-01', created_at: '2026-06-01T10:00:00Z', muted: true }),
];

check('поиск по имени', roster.filter((x) => matchesQuery(x, 'дим')).map((x) => x.id), ['1']);
check('поиск по хендлу телеграма', roster.filter((x) => matchesQuery(x, 'dima_fit')).map((x) => x.id), ['1']);
check('ведущая @ в запросе не мешает', roster.filter((x) => matchesQuery(x, '@dima_fit')).map((x) => x.id), ['1']);
check('поиск по нише без регистра', roster.filter((x) => matchesQuery(x, 'Фитнес')).map((x) => x.id), ['1', '3']);
check('поиск по тексту оффера', roster.filter((x) => matchesQuery(x, 'запуск')).map((x) => x.id), ['3']);
check('пустой запрос пропускает всех', roster.filter((x) => matchesQuery(x, '  ')).length, 3);

const withFilters = (over: Partial<typeof EMPTY_FILTERS>) => ({ ...EMPTY_FILTERS, ...over });
const today2 = '2026-08-16';

check('фильтр по статусу', roster.filter((x) => matchesFilters(x, withFilters({ statuses: ['replied'] }), today2)).map((x) => x.id), ['2']);
check('фильтр по нише', roster.filter((x) => matchesFilters(x, withFilters({ niches: ['фитнес'] }), today2)).map((x) => x.id), ['1', '3']);
check('фильтр «есть телеграм»', roster.filter((x) => matchesFilters(x, withFilters({ hasTelegram: true }), today2)).map((x) => x.id), ['1']);
check('фильтр «есть инстаграм»', roster.filter((x) => matchesFilters(x, withFilters({ hasInstagram: true }), today2)).map((x) => x.id), ['2']);
check('фильтр «есть оффер»', roster.filter((x) => matchesFilters(x, withFilters({ hasOffer: true }), today2)).map((x) => x.id), ['3']);
check('фильтр по периоду', roster.filter((x) => matchesFilters(x, withFilters({ period: 30 }), today2)).map((x) => x.id), ['1', '2']);
check('заглушённые по умолчанию видны', roster.filter((x) => matchesFilters(x, EMPTY_FILTERS, today2)).length, 3);
check('фильтр «заглушённые» оставляет только их', roster.filter((x) => matchesFilters(x, withFilters({ muted: true }), today2)).map((x) => x.id), ['3']);
check('счётчик активных фильтров', activeFilterCount(withFilters({ statuses: ['sent'], period: 7 })), 2);
check('пустые фильтры ничего не считают', activeFilterCount(EMPTY_FILTERS), 0);

check('сортировка по имени', sortContacts(roster, 'name', today2).map((x) => x.name), ['Аня', 'Дима', 'Олег']);
check('сортировка «сначала новые»', sortContacts(roster, 'new', today2).map((x) => x.id), ['1', '2', '3']);
check('сортировка «сначала старые»', sortContacts(roster, 'old', today2).map((x) => x.id), ['3', '2', '1']);
check('ниши собираются с подсчётом', nicheOptions(roster).map((n) => `${n.key}:${n.count}`), ['фитнес:2', 'психология:1']);
check(
  'поиск и фильтры работают вместе',
  applyOutreachFilters({ contacts: roster, query: 'фитнес', filters: withFilters({ statuses: ['sent'] }), today: today2 }).map((x) => x.id),
  ['1'],
);

/* -------------------------------------------------------------------------- */
section('Аналитика');

const series = dailySeries(
  [c({ first_contact_date: '2026-08-16' }), c({ first_contact_date: '2026-08-16' }), c({ first_contact_date: '2026-08-14' })],
  '2026-08-16',
  3,
);
check('ряд по дням строится с нулями', series.map((p) => p.sent), [1, 0, 2]);
check('ряд заканчивается сегодня', series[series.length - 1].date, '2026-08-16');

// Окно «за всё время»: от первой рассылки до сегодня, обе границы включительно.
const spanContacts = [c({ first_contact_date: '2026-08-01' }), c({ first_contact_date: '2026-08-16' })];
check('окно считается от первой рассылки', spanDays(spanContacts, '2026-08-16', 365), 16);
check('без контактов — неделя', spanDays([], '2026-08-16', 365), 7);
check('короткая история всё равно неделя', spanDays([c({ first_contact_date: '2026-08-15' })], '2026-08-16', 365), 7);
check('потолок соблюдается', spanDays([c({ first_contact_date: '2020-01-01' })], '2026-08-16', 365), 365);
check('дата из будущего не ломает окно', spanDays([c({ first_contact_date: '2027-01-01' })], '2026-08-16', 365), 7);
check(
  'ряд за всё время накрывает первую рассылку',
  dailySeries(spanContacts, '2026-08-16', spanDays(spanContacts, '2026-08-16', 365))[0].date,
  '2026-08-01',
);

const grid = heatmap([c({ first_contact_date: '2026-08-16' })], '2026-08-16', 4);
check('в карте четыре недели', grid.length, 4);
check('в неделе семь дней', grid[0].length, 7);

check('закрытый контакт не попадает в приоритет', primeScore(c({ status: 'closed' }), today2), 0);
check('заглушённый не попадает', primeScore(c({ status: 'replied', muted: true }), today2), 0);
check(
  'созвон весит больше ответа',
  primeScore(c({ status: 'call', last_touch_at: today2 }), today2) >
    primeScore(c({ status: 'replied', last_touch_at: today2 }), today2),
  true,
);
check(
  'просрочка поднимает вес',
  primeScore(c({ status: 'replied', last_touch_at: '2026-08-01' }), today2) >
    primeScore(c({ status: 'replied', last_touch_at: today2 }), today2),
  true,
);

check('мало объёма — виноват объём', weakLink({ sent: 10, replied: 0, calls: 0, closed: 0, overdueTouches: 0 }), 'volume');
check('брошенные касания важнее оффера', weakLink({ sent: 100, replied: 2, calls: 0, closed: 0, overdueTouches: 7 }), 'followup');
check('низкая конверсия — оффер', weakLink({ sent: 100, replied: 3, calls: 0, closed: 0, overdueTouches: 0 }), 'offer');
check('ответы есть, созвонов нет — переход', weakLink({ sent: 100, replied: 20, calls: 1, closed: 0, overdueTouches: 0 }), 'transition');
check('созвоны есть, закрытий нет — закрытие', weakLink({ sent: 100, replied: 20, calls: 10, closed: 1, overdueTouches: 0 }), 'closing');
check('всё работает — масштаб', weakLink({ sent: 100, replied: 20, calls: 10, closed: 5, overdueTouches: 0 }), 'scale');

const medals = achievements({ sent: 30, replied: 4, calls: 0, closed: 0, chain: 8, record: 12, quotaStreak: 3 });
check('медаль за 25 рассылок взята', medals.find((m) => m.id === 'sent25')?.done, true);
check('медаль за сотню ещё нет', medals.find((m) => m.id === 'sent100')?.done, false);
check('прогресс к сотне считается', medals.find((m) => m.id === 'sent100')?.pct, 30);
check('медаль за неделю цепочки взята', medals.find((m) => m.id === 'chain7')?.done, true);

check(
  'зал славы берёт лучшие дни',
  hallOfFame([
    c({ first_contact_date: '2026-08-16' }),
    c({ first_contact_date: '2026-08-16' }),
    c({ first_contact_date: '2026-08-15' }),
  ]),
  [{ date: '2026-08-16', sent: 2 }, { date: '2026-08-15', sent: 1 }],
);

check('рост считается в процентах', deltaPct(12, 10), 20);
check('падение считается', deltaPct(8, 10), -20);
check('с нуля сравнивать не с чем', deltaPct(0, 0), null);

/* -------------------------------------------------------------------------- */
section('Заметки');

const note = (id: string, createdAt: string, tag: 'idea' | 'goal' | 'insight' | 'thought' = 'thought') => ({
  id, user_id: 'u', content: `мысль ${id}`, tag, deleted_at: null,
  audio_path: null, audio_duration: null,
  created_at: createdAt, updated_at: createdAt,
});

const noteRows = [
  note('1', '2026-08-16T10:00:00'),
  note('2', '2026-08-15T10:00:00', 'insight'),
  note('3', '2026-08-14T10:00:00'),
  note('4', '2026-08-01T10:00:00', 'idea'),
];

check('заметка за сегодня есть', hasNoteToday(noteRows, '2026-08-16'), true);
check('за завтра нет', hasNoteToday(noteRows, '2026-08-17'), false);
check('счёт по меткам', countByTag(noteRows).insight, 1);
check('старая заметка всплывает', resurface(noteRows, '2026-08-16')?.note.id, '4');
check('и знает свой возраст', resurface(noteRows, '2026-08-16')?.daysAgo, 15);
check('всплывать нечему — null', resurface([note('1', '2026-08-16T10:00:00')], '2026-08-16'), null);
check('выбор стабилен в течение дня', resurface(noteRows, '2026-08-16')?.note.id, resurface(noteRows, '2026-08-16')?.note.id);

/* -------------------------------------------------------------------------- */
section('График');

check('шкала до 5 при малых числах', niceMax(3), 5);
check('десять остаётся десяткой', niceMax(10), 10);
check('семнадцать округляется до двадцати', niceMax(17), 20);
check('сто остаётся сотней', niceMax(100), 100);
check('сто один → сто пятьдесят', niceMax(101), 150);
check('ноль даёт минимальную шкалу', niceMax(0), 5);
check('пустой набор точек — пустой путь', smoothPath([], 0, 100), '');
check('одна точка — просто M', smoothPath([{ x: 1, y: 2 }], 0, 100), 'M 1 2');
check('две точки дают одну кривую', (smoothPath([{ x: 0, y: 0 }, { x: 10, y: 10 }], 0, 100).match(/C/g) ?? []).length, 1);
check(
  'кривая не вылетает выше поля',
  smoothPath([{ x: 0, y: 100 }, { x: 10, y: 0 }, { x: 20, y: 100 }], 0, 100)
    .split(/[ ,]/)
    .map(Number)
    .filter((n) => !Number.isNaN(n))
    .every((n) => n >= -1),
  true,
);

/* -------------------------------------------------------------------------- */
section('Тексты уведомлений');

const push = (over: Partial<Parameters<typeof buildPush>[0]>) =>
  buildPush({ slot: 'morning', sent: 0, quota: 5, sentYesterday: 0, quotaYesterday: 5, streak: 0, ...over });

check('утро после закрытой квоты', push({ sentYesterday: 6 })?.body, 'Вчера: 6 рассылок. Сегодня квота 5. Начинай.');
check('утро после провала', push({ sentYesterday: 2 })?.body, 'Вчера не дотянул. Сегодня закрываешь. 5 рассылок.');
check('день, меньше трети', push({ slot: 'midday', sent: 1 })?.body, 'Только 1 из 5. Полдня прошло. Садись.');
check('день, середина', push({ slot: 'midday', sent: 2 })?.body, '2 из 5. Хорошо. Не останавливайся.');
check('день, почти добил', push({ slot: 'midday', sent: 4 })?.body, '4 из 5. Почти. Добей.');
check('днём при закрытой квоте молчим', push({ slot: 'midday', sent: 5 }), null);
check('вечер после успеха', push({ slot: 'evening', sent: 5, streak: 3 })?.body, 'Закрыл 5. Стрик: 3 дней. Завтра квота растёт.');
check('вечер после провала', push({ slot: 'evening', sent: 3 })?.body, '3 из 5. Завтра с нуля. Квота та же — ещё шанс.');
check('ночью зовём на чекин режима', push({ slot: 'night' })?.title, 'Сегодня держался?');
check('ночной пуш ведёт на прогресс', push({ slot: 'night' })?.url, '/progress');
check('на привале утром молчим', push({ paused: true }), null);
check('на привале днём молчим', push({ paused: true, slot: 'midday', sent: 1 }), null);
check('на привале вечером молчим', push({ paused: true, slot: 'evening', sent: 1 }), null);
check('ночной чекин приходит и на привале', push({ paused: true, slot: 'night' })?.tag, 'mode');
check('под щитом утром молчим', push({ shielded: true }), null);
check('под щитом днём молчим', push({ shielded: true, slot: 'midday', sent: 1 }), null);
check(
  'вечером под щитом зовём вернуть заряд',
  push({ shielded: true, slot: 'evening', sent: 2 })?.body,
  'День под щитом. Закроешь 5 — заряд вернётся.',
);
check(
  'закрытая квота под щитом — обычный вечер',
  push({ shielded: true, slot: 'evening', sent: 5, streak: 4 })?.body,
  'Закрыл 5. Стрик: 4 дней. Завтра квота растёт.',
);

/* -------------------------------------------------------------------------- */
section('Щит и привал');

const g = (over: Partial<GuardState> = {}): GuardState => ({
  charges: 3,
  progress: 0,
  shieldDate: null,
  auto: true,
  pauseStart: null,
  ...over,
});

check('день без защиты голый', guardFor(g(), '2026-08-21'), null);
check('щит закрывает свой день', guardFor(g({ shieldDate: '2026-08-21' }), '2026-08-21'), 'shield');
check('щит не закрывает соседний', guardFor(g({ shieldDate: '2026-08-20' }), '2026-08-21'), null);
check('привал накрывает день включения', guardFor(g({ pauseStart: '2026-08-21' }), '2026-08-21'), 'pause');
check('привал накрывает всё после', guardFor(g({ pauseStart: '2026-08-18' }), '2026-08-21'), 'pause');
check('привал не действует задним числом', guardFor(g({ pauseStart: '2026-08-21' }), '2026-08-20'), null);
check(
  'привал сильнее щита',
  guardFor(g({ pauseStart: '2026-08-20', shieldDate: '2026-08-21' }), '2026-08-21'),
  'pause',
);

check('день включения привала первый', pauseDay('2026-08-21', '2026-08-21'), 1);
check('третьи сутки привала', pauseDay('2026-08-19', '2026-08-21'), 3);
check('без привала дней нет', pauseDay(null, '2026-08-21'), 0);

check('щит тратит заряд', armShield(g(), '2026-08-21').charges, 2);
check('щит помечает свой день', armShield(g(), '2026-08-21').shieldDate, '2026-08-21');
check('дважды за день щит не взвести', armShield(armShield(g(), '2026-08-21'), '2026-08-21').charges, 2);
check('без зарядов щит не взводится', armShield(g({ charges: 0 }), '2026-08-21').shieldDate, null);
check('на привале щит не взводится', armShield(g({ pauseStart: '2026-08-20' }), '2026-08-21').shieldDate, null);
check('снятый щит возвращает заряд', disarmShield(armShield(g(), '2026-08-21'), '2026-08-21').charges, 3);
check(
  'чужой день щит не снимает',
  disarmShield(g({ charges: 2, shieldDate: '2026-08-20' }), '2026-08-21').charges,
  2,
);
check(
  'возврат не пробивает потолок',
  disarmShield(g({ charges: SHIELD_MAX, shieldDate: '2026-08-21' }), '2026-08-21').charges,
  SHIELD_MAX,
);

check('привал возвращает взведённый щит', startPause(armShield(g(), '2026-08-21'), '2026-08-21').charges, 3);
check('привал начинается сегодня', startPause(g(), '2026-08-21').pauseStart, '2026-08-21');
check(
  'повторный привал не сдвигает дату',
  startPause(g({ pauseStart: '2026-08-18' }), '2026-08-21').pauseStart,
  '2026-08-18',
);
check('возврат в работу снимает привал', endPause(g({ pauseStart: '2026-08-18' })).pauseStart, null);

check('до нового заряда четыре дня', daysUntilShield(g({ charges: 0 })), 4);
check('после двух закрытых осталось два', daysUntilShield(g({ charges: 1, progress: 2 })), 2);
check('при полном запасе копить нечего', daysUntilShield(g()), 0);
check('щит доступен', canArmShield(g(), '2026-08-21'), true);
check('без зарядов недоступен', canArmShield(g({ charges: 0 }), '2026-08-21'), false);
check('уже взведённый повторно недоступен', canArmShield(g({ shieldDate: '2026-08-21' }), '2026-08-21'), false);

check('днём время есть', burnLevel(600), 'safe');
check('шесть часов — жёлтый', burnLevel(360), 'warn');
check('два часа — красный', burnLevel(120), 'danger');
check('время вышло', burnLevel(0), 'danger');

check('в 22:00 остаётся шесть часов', minutesUntilDayEnd('2026-08-21T22:00'), 360);
check('в 00:00 остаётся четыре часа', minutesUntilDayEnd('2026-08-22T00:00'), 240);
check('в 03:30 остаётся полчаса', minutesUntilDayEnd('2026-08-22T03:30'), 30);
check('в 04:00 начинается новый день', minutesUntilDayEnd('2026-08-22T04:00'), 1440);
check('часы и минуты', formatTimeLeft(312, 'ru'), '5 ч 12 мин');
check('ровный час без минут', formatTimeLeft(120, 'ru'), '2 ч');
check('меньше часа — только минуты', formatTimeLeft(45, 'ru'), '45 мин');
check('английский формат без пробела', formatTimeLeft(312, 'en'), '5h 12m');

const roll = (over: Partial<RollGuardInput> = {}) =>
  rollGuardForNewDay({
    today: '2026-08-21',
    lastDate: '2026-08-20',
    quota: 5,
    quotaStreak: 7,
    sentByDate: {},
    guard: g(),
    ...over,
  });

check('за сегодня повторно не судим', roll({ lastDate: '2026-08-21' }).changed, false);
check('первый запуск ничего не судит', roll({ lastDate: null }).quotaStreak, 7);
check('часы уехали назад — молчим', roll({ lastDate: '2026-08-22' }).changed, false);

check('закрытый день продлевает серию', roll({ sentByDate: { '2026-08-20': 5 } }).quotaStreak, 8);
check('квота пересчитывается по серии', roll({ sentByDate: { '2026-08-20': 5 } }).currentQuota, 11);
check('провал без автосейва рвёт серию', roll({ guard: g({ auto: false }) }).quotaStreak, 0);
check('порванная серия помнит день', roll({ guard: g({ auto: false }) }).brokenAt, '2026-08-20');

check('автосейв держит серию', roll().quotaStreak, 7);
check('автосейв тратит заряд', roll().guard.charges, 2);
check('спасённый день назван', roll().spent, ['2026-08-20']);
check('спасённая серия не растёт', roll().quotaStreak, 7);

check(
  'взведённый щит не тратит второй заряд',
  roll({ guard: g({ charges: 2, shieldDate: '2026-08-20' }) }).guard.charges,
  2,
);
check(
  'взведённый щит держит серию',
  roll({ guard: g({ charges: 2, shieldDate: '2026-08-20' }) }).quotaStreak,
  7,
);
check(
  'после разбора метка щита снимается',
  roll({ guard: g({ charges: 2, shieldDate: '2026-08-20' }) }).guard.shieldDate,
  null,
);
check(
  'щит на закрытом дне возвращается',
  roll({ sentByDate: { '2026-08-20': 5 }, guard: g({ charges: 2, shieldDate: '2026-08-20' }) })
    .guard.charges,
  3,
);
check(
  'возврат щита назван',
  roll({ sentByDate: { '2026-08-20': 5 }, guard: g({ charges: 2, shieldDate: '2026-08-20' }) })
    .refunded,
  ['2026-08-20'],
);

const trip = roll({ today: '2026-08-24', lastDate: '2026-08-21' });
check('три дня поездки закрываются тремя зарядами', trip.spent.length, 3);
check('после поездки зарядов не осталось', trip.guard.charges, 0);
check('серия пережила поездку', trip.quotaStreak, 7);

const overrun = roll({ today: '2026-08-25', lastDate: '2026-08-21' });
check('четвёртый день без зарядов рвёт серию', overrun.quotaStreak, 0);
check('день обрыва назван', overrun.brokenAt, '2026-08-24');

const paused = roll({
  today: '2026-08-25',
  lastDate: '2026-08-20',
  guard: g({ charges: 0, auto: false, pauseStart: '2026-08-19' }),
});
check('привал держит серию сколько угодно', paused.quotaStreak, 7);
check('привал не тратит заряды', paused.guard.charges, 0);
check('привал не рвётся сам', paused.guard.pauseStart, '2026-08-19');

const workedOnPause = roll({
  sentByDate: { '2026-08-20': 6 },
  guard: g({ pauseStart: '2026-08-18' }),
});
check('привал сам не снимается закрытым днём', workedOnPause.guard.pauseStart, '2026-08-18');
check('закрытая квота на привале растит серию', workedOnPause.quotaStreak, 8);

const earned = roll({
  today: '2026-08-25',
  lastDate: '2026-08-21',
  quotaStreak: 0,
  sentByDate: {
    '2026-08-21': 5,
    '2026-08-22': 5,
    '2026-08-23': 5,
    '2026-08-24': 5,
  },
  guard: g({ charges: 0 }),
});
check('четыре закрытых дня дают заряд', earned.guard.charges, 1);
check('восстановление посчитано', earned.earned, 1);
check('серия выросла на четыре дня', earned.quotaStreak, 4);

const full = roll({
  today: '2026-08-29',
  lastDate: '2026-08-21',
  sentByDate: Object.fromEntries(
    Array.from({ length: 8 }, (_, i) => [`2026-08-${21 + i}`, 5]),
  ),
});
check('запас щитов не превышает трёх', full.guard.charges, SHIELD_MAX);
check('при полном запасе прогресс не копится', full.guard.progress, 0);

/* -------------------------------------------------------------------------- */
section('Статус «Удалил чат»');

check('удаление чата — отдельный исход', CONTACT_STATUSES.includes('deleted_chat'), true);
check('старое значение deleted приводится', normalizeStatus('deleted'), 'deleted_chat');
check('старое значение chat_deleted приводится', normalizeStatus('chat_deleted'), 'deleted_chat');
check('письмо всё-таки ушло', SENT_STATUSES.includes('deleted_chat'), true);
check('ответом это не считается', REPLIED_STATUSES.includes('deleted_chat'), false);
check('работа с человеком окончена', NEGATIVE_STATUSES.includes('deleted_chat'), true);
// Дверь не захлопнули, её тихо закрыли: красным это красить нельзя, иначе
// доля резких отказов завышается и выводы про офферы едут.
check('но красным не красится', HARSH_STATUSES.includes('deleted_chat'), false);
check('резкие исходы остались прежними', HARSH_STATUSES, ['replied_no', 'blocked']);
check('касаний больше не предлагаем', intervalFor('deleted_chat', 1), null);
check(
  'в приоритет не попадает',
  primeScore(
    { status: 'deleted_chat', last_touch_at: '2026-08-01', touch_count: 1, muted: false } as never,
    '2026-08-21',
  ),
  0,
);

/* -------------------------------------------------------------------------- */
section('Воронка продюсирования');

const stages = () => defaultStages(ru);

check('в каркасе семь этапов', stages().length, 7);
check('порядок этапов зафиксирован', stages().map((s) => s.id), [...PIPELINE_IDS]);
check('новый проект начинается с нуля', stageProgress(stages()).done, 0);
check('этапы каркаса опознаются', PIPELINE_IDS.every(isPipelineId), true);
check('свой этап каркасом не считается', isPipelineId('a1b2c3'), false);
check('точка решения — анкета', GATE_ID, 'survey');
check('у нового этапа даты нет', stages().every((s) => s.due === null), true);

const half = stages().map((s, i) => ({ ...s, done: i < 3 }));
check('прогресс считается по галочкам', stageProgress(half), { done: 3, total: 7, pct: 43 });
check('текущий этап — первый невыполненный', currentStage(half)?.id, 'custdev');
check('все закрыты — текущего нет', currentStage(stages().map((s) => ({ ...s, done: true }))), null);

// Галочки ставят не по порядку: «сейчас» обязано означать ближайшее
// незакрытое дело, а не самое дальнее из тронутых.
const jumped = stages().map((s) => ({ ...s, done: s.id === 'mvp' }));
check('пропуск вперёд не двигает текущий этап', currentStage(jumped)?.id, 'call');

check('до договора проект потенциальный', isPotential(stages()), true);
check('после договора — уже работа', isPotential(half), false);

check('у выполненного этапа дата не горит', dueState({ id: 'call', title: '', done: true, due: '2026-01-01' }, '2026-08-21'), 'none');
check('без даты не горит ничего', dueState({ id: 'call', title: '', done: false, due: null }, '2026-08-21'), 'none');
check('вчерашняя дата просрочена', dueState({ id: 'call', title: '', done: false, due: '2026-08-20' }, '2026-08-21'), 'overdue');
check('сегодняшняя — сегодня', dueState({ id: 'call', title: '', done: false, due: '2026-08-21' }, '2026-08-21'), 'today');
check('через два дня — скоро', dueState({ id: 'call', title: '', done: false, due: '2026-08-23' }, '2026-08-21'), 'soon');
check('через неделю — спокойно', dueState({ id: 'call', title: '', done: false, due: '2026-08-28' }, '2026-08-21'), 'ahead');

const spread = spreadDues(stages(), '2026-09-01', '2026-12-01');
check('даты расставились всем этапам', spread.every((s) => Boolean(s.due)), true);
check('даты идут по возрастанию', spread.every((s, i) => i === 0 || s.due! >= spread[i - 1].due!), true);
check('последний этап заканчивается запуском', spread[spread.length - 1].due, '2026-12-01');
check('первый этап не позже второго', spread[0].due! <= spread[1].due!, true);
// Кастдевы весят вчетверо больше созвона: равномерная раскладка дала бы
// заведомо ложный план, а ложный план бросают после первой просрочки.
const gap = (id: string) => {
  const i = spread.findIndex((s) => s.id === id);
  return daysBetween(spread[i].due!, i === 0 ? '2026-09-01' : spread[i - 1].due!);
};
check('кастдевы длиннее созвона', gap('custdev') > gap('call'), true);
check('прогрев длиннее договора', gap('warmup') > gap('contract'), true);
check('выполненный этап дату не получает', spreadDues(half, '2026-09-01', '2026-12-01')[0].due, null);
check('запуск раньше старта — раскладки нет', spreadDues(stages(), '2026-12-01', '2026-09-01')[0].due, null);

check('дедлайн через десять дней', daysToDeadline('2026-08-31', '2026-08-21'), 10);
check('просроченный дедлайн отрицателен', daysToDeadline('2026-08-18', '2026-08-21'), -3);
check('без дедлайна ничего не считаем', daysToDeadline(null, '2026-08-21'), null);

/* -------------------------------------------------------------------------- */
section('Прогноз по своей конверсии');

const fc = (date: string, status: string, at?: string): ForecastContact => ({
  status,
  first_contact_date: date,
  status_history: at ? [{ status: status as never, at }] : [],
});

/** n-е сутки от начала года. Через shiftDate, чтобы не упереться в конец месяца. */
const day = (n: number) => shiftDate('2026-01-01', n);
/** n рассылок подряд, по одной в день. */
const sends = (n: number) => Array.from({ length: n }, (_, i) => fc(day(i), 'sent'));

check('без рассылок считать нечего', forecast([]).sent, 0);
check('без рассылок данных не хватает', forecast([]).enough, false);
check('порог статистики', FORECAST_MIN_SENT, 10);
check('девяти рассылок мало', forecast(sends(9)).enough, false);
check('десяти уже хватает', forecast(sends(10)).enough, true);
check('созвонов не было — строка пустая', forecast(sends(20)).call, { count: 0, per: 0, since: 0, left: 0 });

// Семьдесят рассылок, закрытие на семидесятой: следующее стоит столько же.
const closedAt70 = [...sends(69), fc(day(69), 'closed', `${day(69)}T12:00:00Z`)];
check('цена закрытия — все рассылки до него', forecast(closedAt70).close.per, 70);
check('после закрытия счётчик полон', forecast(closedAt70).close.left, 70);
check('закрытие засчитано одно', forecast(closedAt70).close.count, 1);

// Десять новых рассылок после закрытия: остаток обязан убывать.
const after10 = [...closedAt70, ...Array.from({ length: 10 }, (_, i) => fc(day(70 + i), 'sent'))];
check('новые рассылки съедают остаток', forecast(after10).close.left, 60);
check('прошло с последнего закрытия', forecast(after10).close.since, 10);
check('цена закрытия не поехала', forecast(after10).close.per, 70);

// Перебрал цену — по арифметике закрытие уже должно было случиться.
const after80 = [...closedAt70, ...Array.from({ length: 80 }, (_, i) => fc(day(70 + i), 'sent'))];
check('остаток ниже нуля не уходит', forecast(after80).close.left, 0);

// Два созвона на двадцать рассылок — цена десять.
const twoCalls = [
  ...sends(8),
  fc(day(8), 'call', `${day(8)}T10:00:00Z`),
  ...Array.from({ length: 10 }, (_, i) => fc(day(9 + i), 'sent')),
  fc(day(19), 'call', `${day(19)}T10:00:00Z`),
];
check('цена созвона — средняя по двум', forecast(twoCalls).call.per, 10);
check('созвонов засчитано два', forecast(twoCalls).call.count, 2);
check('закрытый контакт считается и созвоном', forecast(closedAt70).call.count, 1);

check('момент события берётся из истории', reachedAt(fc(day(5), 'call', `${day(5)}T10:00:00Z`), ['call']), day(5));
check('без истории момент — день касания', reachedAt(fc(day(5), 'call'), ['call']), day(5));
check('чужой статус момента не даёт', reachedAt(fc(day(5), 'sent'), ['call']), null);
// Контакт мог уйти в созвон, вернуться и уйти снова — заплачено было раз.
check(
  'берётся первый заход в статус',
  reachedAt(
    { status: 'call', first_contact_date: day(1), status_history: [
      { status: 'call' as never, at: `${day(7)}T10:00:00Z` },
      { status: 'call' as never, at: `${day(3)}T10:00:00Z` },
    ] },
    ['call'],
  ),
  day(3),
);

/* -------------------------------------------------------------------------- */
section('Проект: активы, ссылки, числа');

check('этапы из jsonb приходят массивом', stagesOf({ stages: stages() }).length, 7);
// В jsonb может лежать что угодно: null после старой записи или объект после
// правки руками. Экран не должен падать ни на том, ни на другом.
check('null вместо этапов не роняет', stagesOf({ stages: null as never }), []);
check('объект вместо этапов не роняет', stagesOf({ stages: {} as never }), []);

check('пустые активы — пустой объект', assetsOf(null), {});
check('активы не замеряли', hasAssets({}), false);
check('ноль подписчиков — тоже замер', hasAssets({ ig_followers: 0 }), true);
check('замерили охват сторис', hasAssets({ ig_reach: 2100 }), true);
check('null в поле замером не считается', hasAssets({ ig_followers: null }), false);

// Без протокола браузер считает ссылку относительным путём и уводит внутрь
// приложения — эксперт «открывается» на пустой странице.
check('ссылка без протокола чинится', externalHref('instagram.com/anna'), 'https://instagram.com/anna');
check('https не трогаем', externalHref('https://t.me/anna'), 'https://t.me/anna');
check('http не трогаем', externalHref('http://t.me/anna'), 'http://t.me/anna');
check('регистр протокола не важен', externalHref('HTTPS://t.me/anna'), 'HTTPS://t.me/anna');

check('разряды разделяются', formatNumber(1200000), '1\u00A0200\u00A0000');
check('три знака не делятся', formatNumber(640), '640');
check('четыре знака делятся', formatNumber(1720), '1\u00A0720');
check('дробное округляется', formatNumber(2100.6), '2\u00A0101');
check('ноль остаётся нулём', formatNumber(0), '0');

/* -------------------------------------------------------------------------- */
section('Заготовки');

const sn = (over: Partial<Parameters<typeof sortSnippets>[0][number]> = {}) => ({
  used_count: 0,
  last_used_at: null,
  created_at: '2026-08-01T10:00:00Z',
  ...over,
});

// Наверх заготовка попадает работой, а не тем, что её перетащили: иначе
// через месяц список снова придётся разбирать руками.
check(
  'частое всплывает наверх',
  sortSnippets([sn({ used_count: 1 }), sn({ used_count: 9 }), sn({ used_count: 4 })]).map(
    (x) => x.used_count,
  ),
  [9, 4, 1],
);
check(
  'при равном счёте выше свежее',
  sortSnippets([
    sn({ used_count: 3, last_used_at: '2026-08-10T10:00:00Z' }),
    sn({ used_count: 3, last_used_at: '2026-08-20T10:00:00Z' }),
  ]).map((x) => x.last_used_at),
  ['2026-08-20T10:00:00Z', '2026-08-10T10:00:00Z'],
);
check(
  'ни разу не использованные — по дате создания',
  sortSnippets([
    sn({ created_at: '2026-08-01T10:00:00Z' }),
    sn({ created_at: '2026-08-09T10:00:00Z' }),
  ]).map((x) => x.created_at),
  ['2026-08-09T10:00:00Z', '2026-08-01T10:00:00Z'],
);
check('использованная выше нетронутой', sortSnippets([sn(), sn({ used_count: 1 })])[0].used_count, 1);
check('пустой список не ломается', sortSnippets([]), []);
check('исходный массив не меняется', (() => {
  const list = [sn({ used_count: 1 }), sn({ used_count: 5 })];
  sortSnippets(list);
  return list[0].used_count;
})(), 1);

// Заготовки часто начинаются с обращения на отдельной строке: обрезка по
// символам показала бы у всех одинаковое «Привет!».
check('предпросмотр берёт первую непустую строку', snippetPreview('\n\nПривет!\nЦена от 90к'), 'Привет!');
check('пробельные строки пропускаются', snippetPreview('   \n  \nСуть'), 'Суть');
check('длинная строка обрезается', snippetPreview('а'.repeat(200)).length, 91);
check('короткая не трогается', snippetPreview('Цена от 90к'), 'Цена от 90к');
check('пустой текст даёт пустую строку', snippetPreview(''), '');
check('обрезка не оставляет висячий пробел', snippetPreview(`${'а'.repeat(89)} хвост`, 90), `${'а'.repeat(89)}…`);

check('всего копирований', totalUses([sn({ used_count: 3 }), sn({ used_count: 7 })]), 10);
check('без использований — ноль', totalUses([sn(), sn()]), 0);

/* -------------------------------------------------------------------------- */
section('Голосовые заметки');

// Safari и Chrome пишут в разные контейнеры. Ошибка здесь означает файл,
// который потом нигде не проигрывается, — а понять это можно только на живом
// телефоне, через неделю после записи.
check('opus предпочтительнее всего', pickMimeType((m) => m.startsWith('audio/')), 'audio/webm;codecs=opus');
check('на Safari берём mp4', pickMimeType((m) => m.startsWith('audio/mp4')), 'audio/mp4;codecs=mp4a.40.2');
check('когда не умеет ничего — пусто', pickMimeType(() => false), '');
check('бросающая проверка не роняет выбор', pickMimeType((m) => {
  if (m.includes('webm')) throw new Error('нет');
  return m === 'audio/mp4';
}), 'audio/mp4');

check('webm остаётся webm', extForMime('audio/webm;codecs=opus'), 'webm');
check('mp4 становится m4a', extForMime('audio/mp4'), 'm4a');
check('ogg остаётся ogg', extForMime('audio/ogg;codecs=opus'), 'ogg');
check('регистр не важен', extForMime('AUDIO/MP4'), 'm4a');
check('неизвестный тип пишем как webm', extForMime('что-то своё'), 'webm');
check('пустой тип не роняет', extForMime(''), 'webm');

// Первая папка пути — id владельца: по ней работает политика хранилища.
check('путь начинается с владельца', audioPath('u-1', 'n-2', 'audio/mp4'), 'u-1/n-2.m4a');
check('и учитывает формат', audioPath('u-1', 'n-2', 'audio/webm;codecs=opus'), 'u-1/n-2.webm');

check('секунды с ведущим нулём', formatDuration(67), '1:07');
check('меньше минуты', formatDuration(9), '0:09');
check('ровная минута', formatDuration(60), '1:00');
check('ноль', formatDuration(0), '0:00');
check('дробное округляется вниз', formatDuration(9.9), '0:09');
check('отрицательное не ломает', formatDuration(-5), '0:00');
check('десять минут', formatDuration(MAX_RECORDING_SECONDS), '10:00');
check('предупреждаем за минуту', MAX_RECORDING_SECONDS - RECORDING_WARN_SECONDS, 60);

/* -------------------------------------------------------------------------- */
section('База: разбор вставленных ссылок');

// Вставляют по-разному: ссылкой из адресной строки, ссылкой с хвостом от
// «поделиться», просто ником. Разбирать это руками — двадцать правок на
// двадцать строк, то есть ровно та работа, от которой вставка и избавляет.
check('полная ссылка', parseHandle('https://instagram.com/anna_psy'), 'anna_psy');
check('без протокола', parseHandle('instagram.com/anna_psy'), 'anna_psy');
check('www и слэш на конце', parseHandle('https://www.instagram.com/anna_psy/'), 'anna_psy');
check('хвост от «поделиться»', parseHandle('https://instagram.com/anna_psy?igsh=abc123'), 'anna_psy');
check('короткий домен', parseHandle('https://instagr.am/anna_psy'), 'anna_psy');
check('ник с собакой', parseHandle('@anna_psy'), 'anna_psy');
check('просто ник', parseHandle('anna_psy'), 'anna_psy');
check('точки в нике сохраняются', parseHandle('anna.psy.coach'), 'anna.psy.coach');
check('регистр приводится к нижнему', parseHandle('Anna_PSY'), 'anna_psy');
check('кавычки и запятая из таблицы', parseHandle('"anna_psy",'), 'anna_psy');

check('пустая строка', parseHandle('   '), null);
check('чужая ссылка', parseHandle('https://t.me/anna_psy'), null);
// Ссылка на пост — это не аккаунт, и заводить по ней лид нельзя.
check('ссылка на пост', parseHandle('https://instagram.com/p/Cabc123'), null);
check('ссылка на рилс', parseHandle('https://instagram.com/reel/Cabc123'), null);
check('пробел внутри — не ник', parseHandle('анна психолог'), null);
check('кириллица ником не бывает', parseHandle('@анна'), null);
check('одни точки', parseHandle('...'), null);
check('слишком длинный ник', parseHandle('a'.repeat(31)), null);
check('ровно тридцать знаков — ок', parseHandle('a'.repeat(30)), 'a'.repeat(30));

check('ссылка собирается', instagramUrl('anna_psy'), 'https://instagram.com/anna_psy');

const leadDump = `
https://instagram.com/anna_psy
@dmitry_coach
instagram.com/maria.psy/
мусор строка
https://instagram.com/anna_psy
`;

check('разобрано три лида', parseLeads(leadDump).length, 3);
check('порядок сохраняется', parseLeads(leadDump).map((l) => l.handle), ['anna_psy', 'dmitry_coach', 'maria.psy']);
// Повтор означал бы второе сообщение тому же человеку — худшее, что можно
// сделать с холодной базой.
check('дубль внутри вставки отсеивается', parseLeads('@a @a @a').length, 1);
check(
  'уже известные отсеиваются',
  parseLeads(leadDump, ['https://instagram.com/anna_psy']).map((l) => l.handle),
  ['dmitry_coach', 'maria.psy'],
);
check('известные сравниваются по нику, а не по строке', parseLeads('@Anna_PSY', ['anna_psy']).length, 0);
check('список одной строкой через запятую', parseLeads('@a, @b, @c').length, 3);
check('пустая вставка', parseLeads(''), []);

check('сводка считает пропущенные', summarizeIntake(leadDump, parseLeads(leadDump)), { added: 3, skipped: 3 });
check('сводка на пустом вводе', summarizeIntake('', []), { added: 0, skipped: 0 });

/* -------------------------------------------------------------------------- */
section('Цели: срок, доли и шаги');

const goal = (over: Partial<Parameters<typeof goalProgress>[0]> = {}) => ({
  target_amount: 30000 as number | null,
  current_amount: 0,
  deadline: '2026-09-13',
  started_at: '2026-08-14',
  done: false,
  ...over,
});

const TODAY = '2026-08-23';

check('до срока три недели', daysLeft('2026-09-13', TODAY), 21);
check('срок вышел вчера', daysLeft('2026-08-22', TODAY), -1);
check('день старта уже день', daysPassed('2026-08-23', TODAY), 1);
check('десятый день работы', daysPassed('2026-08-14', TODAY), 10);

check('прогресс пустой цели', goalProgress(goal()), 0);
check('прогресс наполовину', goalProgress(goal({ current_amount: 15000 })), 50);
check('перебор не даёт больше ста', goalProgress(goal({ current_amount: 45000 })), 100);
check('закрытая цель — сто', goalProgress(goal({ done: true })), 100);
// Цель без суммы либо сделана, либо нет: середины у неё не бывает.
check('цель без суммы до закрытия', goalProgress(goal({ target_amount: null })), 0);
check('цель без суммы закрыта', goalProgress(goal({ target_amount: null, done: true })), 100);

check('остаток', remaining(goal({ current_amount: 12400 })), 17600);
check('остатка нет', remaining(goal({ current_amount: 30000 })), 0);
check('перебор не даёт отрицательного', remaining(goal({ current_amount: 45000 })), 0);

// Вторая половина честного ответа на «успеваю ли я»: сколько срока прошло.
// Прогноза здесь нет намеренно — один эксперт может дать два миллиона, а
// десять ноль, и предсказывать приход денег значит врать точным числом.
check('доля срока', timeProgress(goal(), TODAY), 30);
check('в день старта срок не начался', timeProgress(goal({ started_at: TODAY }), TODAY), 0);
check('после дедлайна — сто', timeProgress(goal({ deadline: '2026-08-20' }), TODAY), 100);
check('дедлайн раньше старта не ломает', timeProgress(goal({ deadline: '2026-08-01' }), TODAY), 100);

// Деньги приходят кусками, поэтому отставанием считается расхождение
// больше пяти пунктов, а не любое.
check('деньга обгоняет время', goalState(goal({ current_amount: 15000 }), TODAY), 'ahead');
check('деньга отстаёт от времени', goalState(goal({ current_amount: 3000 }), TODAY), 'behind');
check('идёшь вровень', goalState(goal({ current_amount: 9000 }), TODAY), 'ontrack');
check('закрытая цель', goalState(goal({ done: true }), TODAY), 'done');
check('срок вышел', goalState(goal({ deadline: '2026-08-20' }), TODAY), 'overdue');
check('цель без суммы просто идёт', goalState(goal({ target_amount: null }), TODAY), 'ontrack');
// Нулевой прогресс в первые дни — это не отставание, а ещё не начатая работа.
check('работа только началась', goalState(goal({ started_at: '2026-08-22' }), TODAY), 'fresh');

const steps = [
  { id: 'a', title: 'Закрыть эксперта', done: true },
  { id: 'b', title: 'Подписать договор', done: true },
  { id: 'c', title: 'Сделать запуск', done: false },
];
check('прогресс по шагам', stepProgress(steps), { done: 2, total: 3, pct: 67 });
check('шагов нет — ноль', stepProgress([]), { done: 0, total: 0, pct: 0 });

// В jsonb может лежать что угодно: null у старых строк, объект после правки
// руками. Экран не должен падать ни на том, ни на другом.
check('шаги из jsonb', stepsOf({ steps }).length, 3);
check('null вместо шагов не роняет', stepsOf({ steps: null }), []);
check('объект вместо шагов не роняет', stepsOf({ steps: {} }), []);
check('мусор в массиве отсеивается', stepsOf({ steps: [null, 1, { title: 'ок', id: 'x', done: false }] }).length, 1);
check('id шага уникален', newStepId() !== newStepId(), true);

const goals = [
  { deadline: '2026-11-01', done: false },
  { deadline: '2026-09-13', done: false },
  { deadline: '2026-08-01', done: true },
  { deadline: '2026-10-01', done: false },
];
check('незакрытые по сроку, закрытые в конец', sortGoals(goals).map((g) => g.deadline), [
  '2026-09-13',
  '2026-10-01',
  '2026-11-01',
  '2026-08-01',
]);
check('исходный список не меняется', (() => {
  const list = [{ deadline: '2026-11-01', done: false }, { deadline: '2026-09-13', done: false }];
  sortGoals(list);
  return list[0].deadline;
})(), '2026-11-01');

// Прогноз по цели уезжает на год вперёд, и «16 июн.» без года читается как
// ближайший июнь — то есть ровно наоборот тому, что произошло.
check('в этом году год не пишем', formatDateSmart('2026-09-13', '2026-08-23', 'ru'), '13 сент.');
check('в другом году пишем', formatDateSmart('2027-06-16', '2026-08-23', 'ru'), '16 июн. 2027');

/* -------------------------------------------------------------------------- */
section('Время на задачу');

check('ноль показывается словом', formatMinutes(0, ru), '0 мин');
check('меньше часа', formatMinutes(45, ru), '45 мин');
check('ровный час без минут', formatMinutes(60, ru), '1 ч');
check('час с минутами', formatMinutes(90, ru), '1 ч 30 мин');
check('сутки', formatMinutes(1440, ru), '24 ч');
check('минуса не бывает', formatMinutes(-5, ru), '0 мин');
check('английский формат', formatMinutes(90, en), '1 h 30 min');

// То, что приложение напечатало, обязано разбираться обратно: иначе правка
// оценки превращается в пересчёт в уме.
check('обратный разбор своего же формата', parseMinutes('1 ч 30 мин'), 90);
check('и английского тоже', parseMinutes('1 h 30 min'), 90);
check('голое число — минуты', parseMinutes('90'), 90);
check('часы точкой', parseMinutes('1.5ч'), 90);
check('часы запятой', parseMinutes('1,5 ч'), 90);
check('латинское h', parseMinutes('2h'), 120);
check('минуты буквой', parseMinutes('45м'), 45);
check('без пробелов', parseMinutes('1ч30'), 90);
check('верхний регистр', parseMinutes('2 ЧАСА'), 120);
// Полутора минут не бывает — голое дробное это часы.
check('голое дробное — часы', parseMinutes('0.4'), 24);
check('пусто', parseMinutes(''), null);
check('одни пробелы', parseMinutes('   '), null);
check('ноль оценкой не считается', parseMinutes('0'), null);
check('слово', parseMinutes('завтра'), null);
check('чужая единица', parseMinutes('30 abc'), null);
check('минус', parseMinutes('-5'), null);
check('потолок в минутах', parseMinutes('3000'), MAX_TASK_MINUTES);
check('потолок в часах', parseMinutes('25ч'), MAX_TASK_MINUTES);

check('null оценкой не считается', hasEstimate(null), false);
check('ноль оценкой не считается', hasEstimate(0), false);
check('положительное — оценка', hasEstimate(10), true);

// Задачи без оценки в сумму не входят, но их число надо знать: иначе «3 часа»
// выглядит полной картиной дня, когда половина задач просто не оценена.
check(
  'бюджет смешанного списка',
  taskBudget([
    { minutes: 45, completed: false },
    { minutes: 15, completed: true },
    { minutes: null, completed: false },
    { minutes: 120, completed: true },
  ]),
  { total: 180, done: 135, left: 45, untimed: 1 },
);
check('пустой список', taskBudget([]), { total: 0, done: 0, left: 0, untimed: 0 });
check(
  'никто не оценён',
  taskBudget([
    { minutes: null, completed: true },
    { minutes: 0, completed: false },
  ]),
  { total: 0, done: 0, left: 0, untimed: 2 },
);

/* -------------------------------------------------------------------------- */
section('Спринт и таймер задачи');

const T0 = 1_700_000_000_000;
const sprint = {
  id: 's1', kind: 'outreach' as const, label: 'Рассылки',
  minutes: 60, startedAt: T0, sentAtStart: 10,
};

check('длительность захода', durationMs(sprint), 3_600_000);
check('прошло десять минут', elapsedMs(sprint, T0 + 600_000), 600_000);
// Часы на устройстве могут уехать назад — отрицательного времени не бывает.
check('часы назад не дают минуса', elapsedMs(sprint, T0 - 5000), 0);
check('остаток на старте', remainingMs(sprint, T0), 3_600_000);
check('остаток за полминуты до конца', remainingMs(sprint, T0 + 3_570_000), 30_000);
check('после конца остаток ноль', remainingMs(sprint, T0 + 7_200_000), 0);
check('за миллисекунду до конца ещё идёт', isOver(sprint, T0 + 3_599_999), false);
check('ровно в конце — вышло', isOver(sprint, T0 + 3_600_000), true);
check('прогресс на старте', sessionPct(sprint, T0), 0);
check('прогресс на половине', sessionPct(sprint, T0 + 1_800_000), 50);
check('прогресс после конца', sessionPct(sprint, T0 + 9_000_000), 100);
check('нулевая длительность не делит на ноль', pctFromRemaining(0, 0), 100);

check('часы минут и секунд', formatClock(754_000), '12:34');
check('больше часа', formatClock(3_900_000), '1:05:00');
check('ровно час', formatClock(3_600_000), '1:00:00');
check('без секунды до часа', formatClock(3_599_000), '59:59');
check('ноль', formatClock(0), '0:00');
check('минус не ломает', formatClock(-500), '0:00');
check('секунды с ведущим нулём', formatClock(9400), '0:09');

check('последняя минута', isFinalStretch(59_000), true);
check('минута с секундой — ещё нет', isFinalStretch(61_000), false);

// Заход, кончившийся ночью, не должен утром зачеркнуть задачу: это враньё
// в списке дня.
check('свежий заход восстанавливается', isStale(sprint, T0 + 3_600_000), false);
check('через полчаса после конца ещё жив', isStale(sprint, T0 + 5_400_000), false);
check('наутро выбрасывается', isStale(sprint, T0 + 40_000_000), true);

check('реальная длительность', runMinutes(sprint, T0 + 1_200_000), 20);
check('меньше минуты считается минутой', runMinutes(sprint, T0 + 10_000), 1);
check('не больше отведённого', runMinutes(sprint, T0 + 5_400_000), 60);

check('темп за час', pacePerHour(12, 60), 12);
check('темп за двадцать минут', pacePerHour(12, 20), 36);
check('без времени темпа нет', pacePerHour(5, 0), 0);

check('итог захода', sprintResult({ sentAtStart: 10, sentNow: 22, minutes: 45 }), {
  count: 12, minutes: 45, perHour: 16,
});
check('без отметки старта считать нечего', sprintResult({ sentNow: 22, minutes: 30 }).count, 0);
check('счётчик уехал назад — ноль', sprintResult({ sentAtStart: 30, sentNow: 22, minutes: 30 }).count, 0);

/*
 * Рекорд считается в штуках, а не в темпе: две рассылки за пять минут дают
 * 24 в час и перебили бы честный час работы. Но при равном числе выигрывает
 * более короткий заход — поэтому длительность хранится рядом всегда.
 */
check('первый рекорд', isRecord(3, 15, 0, 0), true);
check('ноль рекордом не бывает', isRecord(0, 60, 0, 0), false);
check('больше — рекорд', isRecord(13, 60, 12, 20), true);
check('меньше — не рекорд', isRecord(11, 20, 12, 60), false);
check('столько же, но быстрее — рекорд', isRecord(12, 20, 12, 60), true);
check('столько же, но дольше — нет', isRecord(12, 60, 12, 20), false);
check('ровно то же самое — нет', isRecord(12, 45, 12, 45), false);

check('варианты длительности', SPRINT_OPTIONS, [15, 25, 45, 60, 90]);
check('разбор сохранённого захода', parseSession(JSON.stringify(sprint))?.id, 's1');
check('битый json не роняет', parseSession('{'), null);
check('пусто', parseSession(null), null);
check('чужой объект не сессия', parseSession('{"id":"x"}'), null);
check('нулевая длительность не сессия', isSession({ ...sprint, minutes: 0 }), false);

/* -------------------------------------------------------------------------- */
section('Полнота словарей');

function flatten(obj: unknown, prefix = ''): string[] {
  if (Array.isArray(obj)) return [prefix];
  if (obj && typeof obj === 'object') {
    return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
      flatten(v, prefix ? `${prefix}.${k}` : k),
    );
  }
  return [prefix];
}

const ruKeys = flatten(ru).sort();
const enKeys = flatten(en).sort();
check('ключи ru и en совпадают', enKeys.length, ruKeys.length);
const missing = ruKeys.filter((k) => !enKeys.includes(k));
check('нет ключей без перевода', missing, []);
check('уровней ровно 20 (ru)', ru.levels.length, MAX_LEVEL);
check('уровней ровно 20 (en)', en.levels.length, MAX_LEVEL);
check(
  'у каждой фичи есть название, описание и фраза открытия',
  (Object.keys(FEATURE_LEVEL) as (keyof typeof FEATURE_LEVEL)[]).every(
    (key) => ru.features[key] && ru.features[`${key}Desc`] && ru.features[`${key}Unlock`],
  ),
  true,
);

// Ключи ниже подставляются в интерфейс динамически. Пропущенный перевод
// не уронит сборку — он просто нарисует пустое место на экране.
for (const [label, ids, dict] of [
  ['статусы', CONTACT_STATUSES, ru.statuses],
  ['достижения', ACHIEVEMENT_IDS, ru.achievements.names],
  ['акценты', ACCENT_KEYS, ru.themes],
] as [string, readonly string[], Record<string, string>][]) {
  check(`переведены все ${label} (ru)`, ids.filter((id) => !dict[id]), []);
}

check(
  'переведены все причины разбора воронки',
  (['volume', 'followup', 'offer', 'transition', 'closing', 'scale'] as const).filter(
    (key) => !ru.mentor[key] || !en.mentor[key],
  ),
  [],
);

/* -------------------------------------------------------------------------- */
console.log(`\n${'─'.repeat(50)}`);
console.log(`Пройдено: ${passed}   Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);

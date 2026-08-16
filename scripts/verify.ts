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
import { modeStageKey, isModeActive, applyCheckin, daysUntilDeadline } from '@/lib/mode';
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
  NEGATIVE_STATUSES,
  normalizeStatus,
  SENT_STATUSES,
  REPLIED_STATUSES,
} from '@/lib/types';
import type { OutreachContact } from '@/lib/types';
import { isRound, milestonesCrossed, milestoneWeight, pickNudge, roundTarget } from '@/lib/round';
import { ACCENT_KEYS } from '@/lib/accent';
import {
  compareLengths,
  comparePatterns,
  isReplied,
  patternsOf,
  PATTERN_IDS,
  summarize,
} from '@/lib/offer-patterns';
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
  weakLink,
} from '@/lib/insights';
import { countByTag, hasNoteToday, noteStreak, resurface } from '@/lib/notes-stats';
import { niceMax, smoothPath } from '@/lib/chart';
import { statsForWeek, missingWeeks } from '@/lib/reports';
import { buildPush } from '@/lib/push-messages';
import { getLogicalDate, weekDates, daysBetween } from '@/lib/date';
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
check('на 1-м видно пять ступеней', revealCeiling(1), 5);
check('на 4-м всё ещё пять', revealCeiling(4), 5);
check('взял 5-й — открылось десять', revealCeiling(5), 10);
check('на 9-м всё ещё десять', revealCeiling(9), 10);
check('взял 10-й — открылось пятнадцать', revealCeiling(10), 15);
check('взял 15-й — открылось двадцать', revealCeiling(15), 20);
check('выше максимума не показываем', revealCeiling(20), 20);
check('на 1-м скрыто пятнадцать', hiddenAhead(1), 15);
check('на максимуме скрытого нет', hiddenAhead(20), 0);
check('лестница обрывается на потолке видимости', levelLadder(3).length, 5);
check('текущий уровень помечен', levelLadder(3).find((r) => r.level === 3)?.state, 'current');
check('пройденные помечены', levelLadder(3).find((r) => r.level === 2)?.state, 'done');
check('следующий помечен', levelLadder(3).find((r) => r.level === 4)?.state, 'next');
check('дальний закрыт', levelLadder(3).find((r) => r.level === 5)?.state, 'locked');

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
check('режим активен при 14+ у всех', isModeActive({ porn: 14, mb: 20, sugar: 15 }), true);
check('режим не активен если один отстаёт', isModeActive({ porn: 14, mb: 20, sugar: 13 }), false);
check(
  '«да» растит, «нет» обнуляет',
  applyCheckin({ porn: 5, mb: 5, sugar: 5 }, { porn: true, mb: false, sugar: true }),
  { porn: 6, mb: 0, sugar: 6 },
);
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
check('в шкале восемь статусов', CONTACT_STATUSES.length, 8);
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
section('Разбор паттернов офферов');

const sample = (content: string, result: string) => ({ content, result });

check('личное наблюдение распознаётся', patternsOf('Посмотрел твой блог').includes('personal'), true);
check('приветствие распознаётся', patternsOf('Привет! Как дела').includes('greeting'), true);
check('приветствие только в начале', patternsOf('Хочу сказать привет').includes('greeting'), false);
check('вопрос распознаётся', patternsOf('Интересно?').includes('question'), true);
check('цифры распознаются', patternsOf('Поднял выручку на 40%').includes('numbers'), true);
check('короткий текст', patternsOf('Коротко и по делу').includes('short'), true);
check('длинный текст не короткий', patternsOf('а'.repeat(1000)).includes('short'), false);
check('длинный текст помечается длинным', patternsOf('а'.repeat(1000)).includes('long'), true);
check('абзацы распознаются', patternsOf('Первый\n\nВторой').includes('structured'), true);
check('пустой текст не даёт признаков', patternsOf('').length, 0);

check('ответ засчитывается', isReplied('replied'), true);
check('отказ тоже засчитывается как ответ', isReplied('replied_no'), true);
check('старый «Отказ» тоже', isReplied('refused'), true);
check('молчание не засчитывается', isReplied('sent'), false);

const patternRows = comparePatterns([
  sample('Привет! Посмотрел твой блог, зацепило. Могу помочь?', 'replied'),
  sample('Привет! Посмотрел последний запуск, сильно. Давай обсудим?', 'replied_no'),
  sample('Привет! Смотрел твои сторис, круто. Интересно?', 'call'),
  sample('Предлагаю сотрудничество', 'sent'),
  sample('Предлагаю сотрудничество на выгодных условиях', 'sent'),
  sample('Здравствуйте, предлагаю услуги продюсера', 'sent'),
]);

const personalRow = patternRows.find((row) => row.id === 'personal');
check('личное наблюдение сработало на всех троих', personalRow?.withCount, 3);
check('и все трое ответили', personalRow?.withRate, 100);
check('без него не ответил никто', personalRow?.withoutRate, 0);
check('разница максимальная', personalRow?.lift, 100);
check('выборка достаточна', personalRow?.reliable, true);
check('самый сильный признак идёт первым', patternRows[0]?.reliable, true);

check('признак без единого вхождения выпадает', comparePatterns([sample('текст', 'sent')]).find((r) => r.id === 'emoji'), undefined);
check('на пустом входе таблицы нет', comparePatterns([]).length, 0);

const lengthRows = compareLengths([
  sample('коротко', 'replied'),
  sample('а'.repeat(1200), 'sent'),
]);
check('длина разбивается на корзины', lengthRows.length, 2);
check('короткие ответили на 100%', lengthRows.find((r) => r.bucket === 'short')?.rate, 100);

const patternSummary = summarize(
  [sample('Посмотрел твой блог', 'replied'), sample('текст', 'sent')],
  patternRows,
);
check('сводка считает долю ответов', patternSummary.rate, 50);

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
  created_at: createdAt, updated_at: createdAt,
});

const noteRows = [
  note('1', '2026-08-16T10:00:00'),
  note('2', '2026-08-15T10:00:00', 'insight'),
  note('3', '2026-08-14T10:00:00'),
  note('4', '2026-08-01T10:00:00', 'idea'),
];

check('цепочка заметок считается', noteStreak(noteRows, '2026-08-16'), 3);
check('пустой сегодня не рвёт цепочку', noteStreak(noteRows, '2026-08-17'), 3);
check('пропуск рвёт', noteStreak(noteRows, '2026-08-18'), 0);
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
  ['признаки офферов', PATTERN_IDS, ru.patterns.names],
  ['подсказки к признакам', PATTERN_IDS, ru.patterns.hints],
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

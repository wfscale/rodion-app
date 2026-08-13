/**
 * Проверка детерминированной логики приложения без базы данных.
 * Запуск: npm run verify
 */
import { computeStreak, bonusesForStreak } from '@/lib/streak';
import {
  getLevelInfo,
  levelForXp,
  LEVEL_THRESHOLDS,
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
import { onOutreachAdded, onStatusChanged, totalXp, hasOverlay } from '@/lib/gamification';
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
section('Уровни и XP — девять ступеней');

check('0 XP → уровень 1', levelForXp(0), 1);
check('299 XP → уровень 1', levelForXp(299), 1);
check('300 XP → уровень 2', levelForXp(300), 2);
check('799 XP → уровень 2', levelForXp(799), 2);
check('800 XP → уровень 3', levelForXp(800), 3);
check('1800 XP → уровень 4', levelForXp(1800), 4);
check('3500 XP → уровень 5', levelForXp(3500), 5);
check('6500 XP → уровень 6', levelForXp(6500), 6);
check('12000 XP → уровень 7', levelForXp(12000), 7);
check('22000 XP → уровень 8', levelForXp(22000), 8);
check('40000 XP → уровень 9', levelForXp(40000), 9);
check('999999 XP → уровень 9 (максимум)', levelForXp(999999), 9);
check(
  'пороги совпадают с ТЗ',
  [...LEVEL_THRESHOLDS],
  [0, 300, 800, 1800, 3500, 6500, 12000, 22000, 40000],
);

const lvl2 = getLevelInfo(550, ru);
check('550 XP → «Охотник»', lvl2.name, 'Охотник');
check('550 XP → до следующего 250', lvl2.xpToNext, 250);
check('550 XP → 50% внутри уровня', lvl2.progressPct, 50);

const lvlMax = getLevelInfo(50000, ru);
check('максимум → isMax', lvlMax.isMax, true);
check('максимум → «Легенда»', lvlMax.name, 'Легенда');
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

section('Разблокировки по уровням');
check('офферы с уровня 2', FEATURE_LEVEL.offers, 2);
check('ниши с уровня 3', FEATURE_LEVEL.niches, 3);
check('скорость с уровня 4', FEATURE_LEVEL.speed, 4);
check('проект с уровня 5', FEATURE_LEVEL.project, 5);
check('отчёт с уровня 6', FEATURE_LEVEL.report, 6);
check('масштаб с уровня 7', FEATURE_LEVEL.scale, 7);
check('на уровне 1 офферы закрыты', unlocked('offers', 1), false);
check('на уровне 2 офферы открыты', unlocked('offers', 2), true);
check('тизер после 1-го — офферы', nextLevelTeaser(1), 'offers');
check('после 7-го тизера нет (уровень 8 — тайна)', nextLevelTeaser(7), null);
check('после 8-го тизера нет', nextLevelTeaser(8), null);

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

const plain = onOutreachAdded({ sentToday: 3, quota: 5, record: 9, date: '2026-08-13', awardedBonusSteps: [] });
check('обычная рассылка даёт 8 XP', totalXp(plain), 8);
check('обычная рассылка не открывает оверлей', plain.some((e) => e.kind === 'overlay'), false);
check('обычная рассылка даёт один тост', plain.filter((e) => e.kind === 'toast').length, 1);
check('обычная рассылка даёт тактильный отклик', plain.some((e) => e.kind === 'fx'), true);

const closing = onOutreachAdded({ sentToday: 5, quota: 5, record: 9, date: '2026-08-13', awardedBonusSteps: [] });
check('закрытие квоты: 8 + 100', totalXp(closing), 108);
check('закрытие квоты показывает оверлей', hasOverlay(closing, 'quota'), true);
check('при оверлее квоты тоста нет', closing.filter((e) => e.kind === 'toast').length, 0);

const record = onOutreachAdded({ sentToday: 10, quota: 20, record: 9, date: '2026-08-13', awardedBonusSteps: [] });
check('рекорд: 8 + 200', totalXp(record), 208);
check('рекорд обновляет профиль', record.some((e) => e.kind === 'profile'), true);
check('тост рекорда важнее круглого числа', record.find((e) => e.kind === 'toast'), { kind: 'toast', textKey: 'record', vars: { n: 10 }, tone: 'record' });

const round = onOutreachAdded({ sentToday: 20, quota: 30, record: 50, date: '2026-08-13', awardedBonusSteps: [] });
check('круглое число даёт свой тост', round.find((e) => e.kind === 'toast'), { kind: 'toast', textKey: 'round', vars: { n: 20 }, tone: 'round' });

const bonus = onOutreachAdded({ sentToday: 10, quota: 5, record: 99, date: '2026-08-13', awardedBonusSteps: [] });
check('первая пятёрка сверх квоты: 8 + 50', totalXp(bonus), 58);

const bonusAgain = onOutreachAdded({ sentToday: 10, quota: 5, record: 99, date: '2026-08-13', awardedBonusSteps: [1] });
check('уже начисленный бонус не повторяется', totalXp(bonusAgain), 8);

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

const refused = onStatusChanged({ contactId: 'c5', status: 'refused', hadFirstReply: true, hadFirstCall: true, hadFirstClosed: true });
check('отказ не награждается', refused.length, 0);

check(
  'XP за статус привязан к паре контакт+статус',
  onStatusChanged({ contactId: 'c9', status: 'call', hadFirstReply: true, hadFirstCall: true, hadFirstClosed: true })
    .find((e) => e.kind === 'xp' && 'onceKey' in e ? e.onceKey : null) !== undefined,
  true,
);

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
check('уровней ровно 9 (ru)', ru.levels.length, 9);
check('уровней ровно 9 (en)', en.levels.length, 9);

/* -------------------------------------------------------------------------- */
console.log(`\n${'─'.repeat(50)}`);
console.log(`Пройдено: ${passed}   Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);

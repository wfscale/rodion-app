/**
 * Проверка детерминированной логики приложения без базы данных.
 * Запуск: npm run verify
 */
import { computeStreak, bonusesForStreak } from '@/lib/streak';
import { getLevelInfo, levelForXp, LEVEL_THRESHOLDS } from '@/lib/xp';
import { summarizeWeeks, computeUnlockLevel, unlockedHabits } from '@/lib/unlocks';
import { countTasks, FIXED_TASKS } from '@/lib/tasks';
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
section('Уровни и XP');

check('0 XP → уровень 1', levelForXp(0), 1);
check('199 XP → уровень 1', levelForXp(199), 1);
check('200 XP → уровень 2', levelForXp(200), 2);
check('499 XP → уровень 2', levelForXp(499), 2);
check('500 XP → уровень 3', levelForXp(500), 3);
check('999 XP → уровень 3', levelForXp(999), 3);
check('1000 XP → уровень 4', levelForXp(1000), 4);
check('2000 XP → уровень 5', levelForXp(2000), 5);
check('4000 XP → уровень 6', levelForXp(4000), 6);
check('8000 XP → уровень 7', levelForXp(8000), 7);
check('99999 XP → уровень 7 (максимум)', levelForXp(99999), 7);
check('пороги совпадают с ТЗ', [...LEVEL_THRESHOLDS], [0, 200, 500, 1000, 2000, 4000, 8000]);

const lvl3 = getLevelInfo(750, ru);
check('750 XP → «Снайпер»', lvl3.name, 'Снайпер');
check('750 XP → до следующего 250', lvl3.xpToNext, 250);
check('750 XP → 50% внутри уровня', lvl3.progressPct, 50);

const lvlMax = getLevelInfo(9000, ru);
check('максимум → isMax', lvlMax.isMax, true);
check('максимум → 100%', lvlMax.progressPct, 100);
check('максимум → до следующего 0', lvlMax.xpToNext, 0);
check('английские названия уровней', getLevelInfo(750, en).name, 'Sniper');

/* -------------------------------------------------------------------------- */
section('Процент выполнения дня');

const totalFixed = FIXED_TASKS.length + 1; // + голодание
check('всего фиксированных задач + голодание', totalFixed, 12);

check(
  'ничего не отмечено → 0%',
  countTasks({}, false, [], []),
  { done: 0, total: 12, pct: 0 },
);

const allDone = Object.fromEntries(FIXED_TASKS.map((task) => [task.id, true]));
check(
  'всё отмечено + голодание → 100%',
  countTasks(allDone, true, [], []),
  { done: 12, total: 12, pct: 100 },
);

check(
  'всё кроме голодания → 92%',
  countTasks(allDone, false, [], []).pct,
  Math.round((11 / 12) * 100),
);

check(
  'кастомная задача увеличивает знаменатель',
  countTasks(allDone, true, [], [{ id: 'c_1', title: 'Своя' }]),
  { done: 12, total: 13, pct: 92 },
);

check(
  'открытая привычка увеличивает знаменатель',
  countTasks(allDone, true, [{ id: 'reading', labelKey: 'reading' }], []).total,
  13,
);

/* -------------------------------------------------------------------------- */
section('Недельные разблокировки');

// Регистрация в понедельник 2026-06-01, идеальные две недели.
const perfect: { date: string; completion_pct: number }[] = [];
for (let i = 0; i < 21; i += 1) {
  const d = new Date(Date.UTC(2026, 5, 1));
  d.setUTCDate(d.getUTCDate() + i);
  perfect.push({ date: d.toISOString().slice(0, 10), completion_pct: 100 });
}

const weeks3 = summarizeWeeks(perfect, '2026-06-01', '2026-06-22');
check('три полные недели + текущий день', weeks3.length, 4);
check('первая неделя закрыта', weeks3[0].complete, true);
check('первая неделя зачтена', weeks3[0].qualified, true);
check('уровень после 3 идеальных недель', computeUnlockLevel(weeks3), 4);

// Одна идеальная неделя, вторая провалена.
const mixed = perfect.map((log, i) =>
  i >= 7 && i < 14 ? { ...log, completion_pct: 20 } : log,
);
const weeksMixed = summarizeWeeks(mixed, '2026-06-01', '2026-06-22');
check('провальная неделя не зачтена', weeksMixed[1].qualified, false);
check('уровень с одной провальной неделей', computeUnlockLevel(weeksMixed), 3);

// Пропуски считаются нулями, а не игнорируются.
const sparse = [{ date: '2026-06-01', completion_pct: 100 }];
const weeksSparse = summarizeWeeks(sparse, '2026-06-01', '2026-06-15');
check('один идеальный день из семи → среднее 14%', weeksSparse[0].avgCompletion, 14);
check('такая неделя не открывает фишку', weeksSparse[0].qualified, false);

check('привычки на уровне 4', unlockedHabits(4).length, 0);
check('привычки на уровне 5', unlockedHabits(5).length, 1);
check('привычки на уровне 6', unlockedHabits(6).length, 1);
check('привычки на уровне 7', unlockedHabits(7).length, 2);
check('привычки на уровне 9', unlockedHabits(9).length, 3);

/* -------------------------------------------------------------------------- */
section('Даты и недели');

check('неделя начинается с понедельника', weekDates('2026-08-10')[0], '2026-08-10');
check('неделя кончается воскресеньем', weekDates('2026-08-10')[6], '2026-08-16');
check('воскресенье принадлежит своей неделе', weekDates('2026-08-16')[0], '2026-08-10');
check('в неделе 7 дней', weekDates('2026-08-12').length, 7);
check('разница дат', daysBetween('2026-08-10', '2026-08-01'), 9);

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
check('уровней ровно 7 (ru)', ru.levels.length, 7);
check('уровней ровно 7 (en)', en.levels.length, 7);

/* -------------------------------------------------------------------------- */
console.log(`\n${'─'.repeat(50)}`);
console.log(`Пройдено: ${passed}   Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);

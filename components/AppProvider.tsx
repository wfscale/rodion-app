'use client';

import type { User } from '@supabase/supabase-js';
import { X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { FloatingXp } from '@/components/XpBadge';
import { LevelUpOverlay } from '@/components/LevelUpOverlay';
import { UnlockToast } from '@/components/UnlockToast';
import { useLanguage } from '@/components/LanguageProvider';
import { getLogicalDate, shiftDate } from '@/lib/date';
import { createClient } from '@/lib/supabase/client';
import { syncSheets } from '@/lib/sheets-client';
import { bonusesForStreak, computeStreak } from '@/lib/streak';
import type { TaskDef } from '@/lib/tasks';
import { computeUnlockLevel, summarizeWeeks, unlockedHabits, type WeekSummary } from '@/lib/unlocks';
import { levelForXp } from '@/lib/xp';
import type { DailyLog, Profile } from '@/lib/types';

/** Сколько дней истории держим в памяти: хватает на стрик, неделю и графики. */
const HISTORY_DAYS = 180;

type AppContextValue = {
  user: User | null;
  profile: Profile | null;
  logs: DailyLog[];
  today: string;
  loading: boolean;
  error: string | null;

  streak: { current: number; longest: number; todayCounted: boolean };
  weeks: WeekSummary[];
  unlockLevel: number;
  habits: TaskDef[];

  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  /** Начисляет XP. onceKey защищает от повторного начисления за то же событие. */
  awardXp: (amount: number, reason: string, onceKey?: string) => Promise<number>;
  upsertToday: (patch: Partial<DailyLog>) => Promise<void>;
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { setLang } = useLanguage();

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [xpEvent, setXpEvent] = useState<{ id: number; amount: number } | null>(null);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [newUnlock, setNewUnlock] = useState<number | null>(null);

  // Логический день с переносом в 4:00 — иначе задачу «лёг до 1:00»
  // невозможно отметить, календарь уже показывает завтра.
  const [today, setToday] = useState(() => getLogicalDate());

  const languageApplied = useRef(false);
  const bonusesTried = useRef<Set<string>>(new Set());
  const unlockSynced = useRef(false);

  /* ------------------------------------------------------------------ */
  /*  Загрузка                                                           */
  /* ------------------------------------------------------------------ */

  const load = useCallback(async () => {
    setError(null);

    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      setUser(null);
      setProfile(null);
      setLogs([]);
      setLoading(false);
      return;
    }

    setUser(currentUser);

    const since = shiftDate(getLogicalDate(), -HISTORY_DAYS);

    const [profileRes, logsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', currentUser.id).maybeSingle(),
      supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', currentUser.id)
        .gte('date', since)
        .order('date', { ascending: false }),
    ]);

    if (profileRes.error) {
      setError(profileRes.error.message);
      setLoading(false);
      return;
    }

    let loadedProfile = profileRes.data as Profile | null;

    // Страховка: если триггер on_auth_user_created не отработал, создаём профиль.
    if (!loadedProfile) {
      const { data: created, error: createError } = await supabase
        .from('profiles')
        .insert({ id: currentUser.id, username: currentUser.email?.split('@')[0] ?? null })
        .select('*')
        .single();

      if (createError) {
        setError(createError.message);
        setLoading(false);
        return;
      }
      loadedProfile = created as Profile;
    }

    setProfile(loadedProfile);
    setLogs((logsRes.data as DailyLog[]) ?? []);

    // Язык из профиля применяем один раз за сессию — дальше решает пользователь.
    if (!languageApplied.current && loadedProfile.language) {
      languageApplied.current = true;
      setLang(loadedProfile.language);
    }

    setLoading(false);
  }, [supabase, setLang]);

  useEffect(() => {
    void load();
  }, [load]);

  // Реагируем на выход/смену пользователя в другой вкладке.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setLogs([]);
        router.replace('/auth');
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase, router]);

  // Дата может смениться, пока приложение открыто (например, в 4 утра).
  useEffect(() => {
    const timer = setInterval(() => {
      const current = getLogicalDate();
      setToday((previous) => (previous === current ? previous : current));
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  /* ------------------------------------------------------------------ */
  /*  Мутации                                                            */
  /* ------------------------------------------------------------------ */

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      if (!user) return;
      setProfile((previous) => (previous ? { ...previous, ...patch } : previous));

      const { error: updateError } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', user.id);

      if (updateError) setError(updateError.message);
    },
    [supabase, user],
  );

  const awardXp = useCallback(
    async (amount: number, reason: string, key?: string): Promise<number> => {
      if (!user) return 0;

      const { data, error: rpcError } = await supabase.rpc('award_xp', {
        p_amount: amount,
        p_reason: reason,
        p_once_key: key ?? null,
      });

      if (rpcError) {
        setError(rpcError.message);
        return 0;
      }

      const result = data as unknown as {
        awarded: number;
        total_xp: number;
        level: number;
      } | null;

      if (!result || !result.awarded) return 0;

      const previousLevel = levelForXp(profile?.total_xp ?? 0);

      setProfile((previous) =>
        previous
          ? { ...previous, total_xp: result.total_xp, level: result.level }
          : previous,
      );

      setXpEvent({ id: Date.now() + Math.random(), amount: result.awarded });
      setTimeout(() => setXpEvent(null), 950);

      if (result.level > previousLevel) setLevelUp(result.level);

      return result.awarded;
    },
    [supabase, user, profile?.total_xp],
  );

  const upsertToday = useCallback(
    async (patch: Partial<DailyLog>) => {
      if (!user) return;

      const existing = logs.find((log) => log.date === today);

      // Оптимистично обновляем UI — кольцо и галочки не должны ждать сеть.
      const optimistic: DailyLog = {
        ...(existing ??
          ({
            id: `temp-${today}`,
            user_id: user.id,
            date: today,
            sleep_time: null,
            wake_time: null,
            wake_quality: null,
            morning_comment: null,
            checklist: {},
            custom_tasks: [],
            meal_1_time: null,
            meal_1_note: null,
            meal_2_time: null,
            meal_2_note: null,
            fasting_ok: false,
            day_comment: null,
            completion_pct: 0,
            xp_earned: 0,
            created_at: new Date().toISOString(),
          } as DailyLog)),
        ...patch,
      };

      setLogs((previous) => {
        const rest = previous.filter((log) => log.date !== today);
        return [optimistic, ...rest].sort((a, b) => b.date.localeCompare(a.date));
      });

      const { data, error: upsertError } = await supabase
        .from('daily_logs')
        .upsert(
          {
            user_id: user.id,
            date: today,
            sleep_time: optimistic.sleep_time,
            wake_time: optimistic.wake_time,
            wake_quality: optimistic.wake_quality,
            morning_comment: optimistic.morning_comment,
            checklist: optimistic.checklist,
            custom_tasks: optimistic.custom_tasks,
            meal_1_time: optimistic.meal_1_time,
            meal_1_note: optimistic.meal_1_note,
            meal_2_time: optimistic.meal_2_time,
            meal_2_note: optimistic.meal_2_note,
            fasting_ok: optimistic.fasting_ok,
            day_comment: optimistic.day_comment,
            completion_pct: optimistic.completion_pct,
          },
          { onConflict: 'user_id,date' },
        )
        .select('*')
        .single();

      if (upsertError) {
        setError(upsertError.message);
        return;
      }

      // Подменяем временную запись настоящей (нужен реальный id).
      setLogs((previous) => {
        const rest = previous.filter((log) => log.date !== today);
        return [data as DailyLog, ...rest].sort((a, b) => b.date.localeCompare(a.date));
      });

      // Отложенная выгрузка в Google Sheets. Если интеграция не подключена —
      // вызов ничего не делает; отметки чеклиста идут пачками, поэтому
      // запрос уходит один, после паузы.
      syncSheets();
    },
    [supabase, user, logs, today],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.replace('/auth');
    router.refresh();
  }, [supabase, router]);

  /* ------------------------------------------------------------------ */
  /*  Производные значения                                               */
  /* ------------------------------------------------------------------ */

  const threshold = profile?.streak_threshold ?? 70;

  const streak = useMemo(
    () => computeStreak(logs, threshold, today),
    [logs, threshold, today],
  );

  const weeks = useMemo(() => {
    if (!profile) return [];
    return summarizeWeeks(logs, profile.created_at.slice(0, 10), today);
  }, [logs, profile, today]);

  const unlockLevel = useMemo(() => computeUnlockLevel(weeks), [weeks]);
  const habits = useMemo(() => unlockedHabits(unlockLevel), [unlockLevel]);

  /* ------------------------------------------------------------------ */
  /*  Побочные эффекты геймификации                                      */
  /* ------------------------------------------------------------------ */

  // Стрик пересчитывается из истории и сохраняется в профиль,
  // чтобы значение было одинаковым на всех устройствах.
  useEffect(() => {
    if (!profile) return;

    const needsUpdate =
      streak.current !== profile.current_streak ||
      streak.longest > profile.longest_streak ||
      (streak.todayCounted && profile.last_active_date !== today);

    if (needsUpdate) {
      void updateProfile({
        current_streak: streak.current,
        longest_streak: Math.max(streak.longest, profile.longest_streak),
        last_active_date: streak.todayCounted ? today : profile.last_active_date,
      });
    }
  }, [streak, profile, today, updateProfile]);

  // Разовые бонусы за длину серии.
  const currentStreak = streak.current;
  useEffect(() => {
    if (!profile || currentStreak === 0) return;

    for (const bonus of bonusesForStreak(currentStreak)) {
      const key = `streak:${bonus.days}`;
      if (bonusesTried.current.has(key)) continue;
      bonusesTried.current.add(key);
      void awardXp(bonus.xp, bonus.reasonKey, key);
    }
  }, [currentStreak, profile, awardXp]);

  // Новая недельная разблокировка.
  useEffect(() => {
    if (!profile || unlockSynced.current) return;
    if (weeks.length === 0) return;

    unlockSynced.current = true;

    if (unlockLevel > (profile.unlocked_weeks || 0)) {
      setNewUnlock(unlockLevel);
      void updateProfile({ unlocked_weeks: unlockLevel });
    }
  }, [unlockLevel, weeks.length, profile, updateProfile]);

  const value = useMemo<AppContextValue>(
    () => ({
      user,
      profile,
      logs,
      today,
      loading,
      error,
      streak,
      weeks,
      unlockLevel,
      habits,
      updateProfile,
      awardXp,
      upsertToday,
      reload: load,
      signOut,
    }),
    [
      user,
      profile,
      logs,
      today,
      loading,
      error,
      streak,
      weeks,
      unlockLevel,
      habits,
      updateProfile,
      awardXp,
      upsertToday,
      load,
      signOut,
    ],
  );

  return (
    <AppContext.Provider value={value}>
      {children}

      {/* Ошибки сохранения не должны теряться молча: данные — смысл приложения. */}
      {error && (
        <div className="fixed inset-x-4 top-[calc(12px+env(safe-area-inset-top))] z-[85] mx-auto max-w-md">
          <div className="glass flex items-start gap-3 border-[rgba(255,107,107,0.3)] bg-[rgba(255,107,107,0.08)] p-3">
            <p className="min-w-0 flex-1 text-sm leading-snug text-danger">{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              aria-label="close"
              className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/40 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      <FloatingXp event={xpEvent} />
      <LevelUpOverlay level={levelUp} onDismiss={() => setLevelUp(null)} />
      <UnlockToast level={newUnlock} onDismiss={() => setNewUnlock(null)} />
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

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
import { FirstEventOverlay, type FirstEventKind } from '@/components/overlays/FirstEventOverlay';
import { LevelUpOverlay } from '@/components/overlays/LevelUpOverlay';
import { QuotaClosedOverlay } from '@/components/overlays/QuotaClosedOverlay';
import { Toast, type ToastData } from '@/components/overlays/Toast';
import { useLanguage } from '@/components/LanguageProvider';
import { cycleDay, formatDayMonth, getLogicalDate, shiftDate } from '@/lib/date';
import { celebrate } from '@/lib/feedback';
import {
  onOutreachAdded,
  onStatusChanged,
  type GameEvent,
  type OverlayKind,
} from '@/lib/gamification';
import { calculateQuota, daysUntilQuotaGrows, nextQuota, quotaPct, rollChain, rollQuotaForNewDay } from '@/lib/quota';
import { createClient } from '@/lib/supabase/client';
import { syncSheets } from '@/lib/sheets-client';
import { featureAtLevel, getLevelInfo, levelForXp, type FeatureKey, type LevelInfo } from '@/lib/xp';
import type {
  ActivityEntry,
  ActivityType,
  ContactStatus,
  DailyLog,
  DailyTask,
  OutreachContact,
  Profile,
} from '@/lib/types';

/** Сколько дней истории держим в памяти. */
const HISTORY_DAYS = 180;

export type ContactDraft = {
  name: string;
  niche: string;
  telegram_handle: string;
  instagram_url: string;
  comment: string;
  status: ContactStatus;
  first_contact_date: string;
  next_step: string;
};

type QuotaState = {
  sent: number;
  quota: number;
  pct: number;
  record: number;
  streak: number;
  daysToGrow: number;
  next: number;
  closed: boolean;
};

type AppContextValue = {
  user: User | null;
  profile: Profile | null;
  today: string;
  loading: boolean;
  error: string | null;

  contacts: OutreachContact[];
  activity: ActivityEntry[];
  tasks: DailyTask[];
  logs: DailyLog[];
  todayLog: DailyLog | null;

  quota: QuotaState;
  chain: number;
  levelInfo: LevelInfo;
  cycleDayNumber: number;

  addContact: (draft: ContactDraft) => Promise<OutreachContact | null>;
  updateContact: (id: string, patch: Partial<OutreachContact>) => Promise<void>;
  setStatus: (contact: OutreachContact, status: ContactStatus) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;
  /** Отметить новое касание: сдвигает дату и двигает каскад напоминаний. */
  touchContact: (contact: OutreachContact) => Promise<void>;
  /** Больше не напоминать про этот контакт. */
  muteContact: (id: string, muted: boolean) => Promise<void>;

  addTask: (text: string) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;

  toggleHabit: (habitId: string) => Promise<void>;
  saveDay: (patch: Partial<DailyLog>) => Promise<void>;

  submitModeCheckin: (held: { porn: boolean; mb: boolean; sugar: boolean }) => Promise<void>;

  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  awardXp: (amount: number, reason: string, onceKey?: string) => Promise<number>;
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
};

/**
 * Сообщение об ошибке для человека.
 *
 * Supabase на недоступной базе отвечает текстом от своего прокси
 * («upstream connect error… delayed connect error: 111»). Показывать это
 * пользователю бессмысленно: он не может ничего с этим сделать, а выглядит
 * как поломка приложения. Переводим в понятное и подсказываем, что данные
 * не потеряны.
 */
function humanError(message: string): string {
  const infra =
    /upstream connect|connect error|503|service unavailable|failed to fetch|networkerror|load failed/i;
  if (infra.test(message)) {
    return 'База данных сейчас недоступна. Ничего не потеряно — попробуй через минуту.';
  }
  return message;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { t, tf, setLang } = useLanguage();

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [contacts, setContacts] = useState<OutreachContact[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Оверлеи и тосты
  const [firstEvent, setFirstEvent] = useState<{ kind: FirstEventKind; xp: number } | null>(null);
  const [quotaOverlay, setQuotaOverlay] = useState<{ open: boolean; xp: number }>({ open: false, xp: 0 });
  const [levelUp, setLevelUp] = useState<{ level: number; feature: FeatureKey | null } | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);

  const [today, setToday] = useState(() => getLogicalDate());

  const languageApplied = useRef(false);
  const quotaRolled = useRef<string | null>(null);
  /** Ключи, по которым уже пытались начислить — чтобы не слать лишние запросы. */
  const attemptedKeys = useRef<Set<string>>(new Set());

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
      setLoading(false);
      return;
    }

    setUser(currentUser);

    const logicalToday = getLogicalDate();
    const since = shiftDate(logicalToday, -HISTORY_DAYS);
    const dayStart = `${logicalToday}T00:00:00`;

    const [profileRes, contactsRes, activityRes, tasksRes, logsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', currentUser.id).maybeSingle(),
      supabase
        .from('outreach_contacts')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('activity_feed')
        .select('*')
        .eq('user_id', currentUser.id)
        .gte('created_at', dayStart)
        .order('created_at', { ascending: false })
        .limit(40),
      supabase
        .from('daily_tasks')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('date', logicalToday)
        .order('created_at', { ascending: true }),
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

    if (!loadedProfile) {
      const { data: created, error: createError } = await supabase
        .from('profiles')
        .insert({ id: currentUser.id, username: currentUser.email?.split('@')[0] ?? null })
        .select('*')
        .single();

      if (createError) {
        setError(humanError(createError.message));
        setLoading(false);
        return;
      }
      loadedProfile = created as Profile;
    }

    setProfile(loadedProfile);
    setContacts((contactsRes.data as OutreachContact[]) ?? []);
    setActivity((activityRes.data as ActivityEntry[]) ?? []);
    setTasks((tasksRes.data as DailyTask[]) ?? []);
    setLogs((logsRes.data as DailyLog[]) ?? []);

    if (!languageApplied.current && loadedProfile.language) {
      languageApplied.current = true;
      setLang(loadedProfile.language);
    }

    setLoading(false);
  }, [supabase, setLang]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        router.replace('/auth');
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase, router]);

  // Логический день может смениться прямо во время работы (в 4 утра).
  useEffect(() => {
    const timer = setInterval(() => {
      const current = getLogicalDate();
      setToday((previous) => (previous === current ? previous : current));
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  /* ------------------------------------------------------------------ */
  /*  Базовые мутации                                                    */
  /* ------------------------------------------------------------------ */

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      if (!user) return;
      setProfile((previous) => (previous ? { ...previous, ...patch } : previous));

      const { error: updateError } = await supabase.from('profiles').update(patch).eq('id', user.id);
      if (updateError) setError(humanError(updateError.message));
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
        setError(humanError(rpcError.message));
        return 0;
      }

      const result = data as unknown as { awarded: number; total_xp: number; level: number } | null;
      if (!result || !result.awarded) return 0;

      const previousLevel = levelForXp(profile?.total_xp ?? 0);

      setProfile((previous) =>
        previous ? { ...previous, total_xp: result.total_xp, level: result.level } : previous,
      );

      if (result.level > previousLevel) {
        setLevelUp({ level: result.level, feature: featureAtLevel(result.level) });
      }

      return result.awarded;
    },
    [supabase, user, profile?.total_xp],
  );

  /** Запись события в ленту активности. */
  const logActivity = useCallback(
    async (type: ActivityType, input: { name?: string | null; niche?: string | null; detail?: string | null; xp?: number }) => {
      if (!user) return;

      const optimistic: ActivityEntry = {
        id: `temp-${Date.now()}`,
        user_id: user.id,
        type,
        contact_name: input.name ?? null,
        contact_niche: input.niche ?? null,
        detail: input.detail ?? null,
        xp_earned: input.xp ?? 0,
        created_at: new Date().toISOString(),
      };
      setActivity((previous) => [optimistic, ...previous]);

      const { data } = await supabase
        .from('activity_feed')
        .insert({
          user_id: user.id,
          type,
          contact_name: input.name ?? null,
          contact_niche: input.niche ?? null,
          detail: input.detail ?? null,
          xp_earned: input.xp ?? 0,
        })
        .select('*')
        .single();

      if (data) {
        setActivity((previous) => [data as ActivityEntry, ...previous.filter((e) => e.id !== optimistic.id)]);
      }
    },
    [supabase, user],
  );

  /* ------------------------------------------------------------------ */
  /*  Производные значения                                               */
  /* ------------------------------------------------------------------ */

  /** Рассылки за сегодня: считаем по дате касания, а не по created_at —
   *  дату можно поставить задним числом, и счётчик должен это уважать. */
  const sentToday = useMemo(
    () => contacts.filter((c) => c.first_contact_date === today).length,
    [contacts, today],
  );

  const quota = useMemo<QuotaState>(() => {
    const q = profile?.current_quota ?? calculateQuota(profile?.quota_streak ?? 0);
    const streak = profile?.quota_streak ?? 0;
    return {
      sent: sentToday,
      quota: q,
      pct: quotaPct(sentToday, q),
      record: profile?.daily_record ?? 0,
      streak,
      daysToGrow: daysUntilQuotaGrows(streak),
      next: nextQuota(streak),
      closed: sentToday >= q,
    };
  }, [profile?.current_quota, profile?.quota_streak, profile?.daily_record, sentToday]);

  const levelInfo = useMemo(() => getLevelInfo(profile?.total_xp ?? 0, t), [profile?.total_xp, t]);

  const cycleDayNumber = useMemo(
    () => (profile ? cycleDay(profile.cycle_start_date, today) : 1),
    [profile, today],
  );

  const todayLog = useMemo(() => logs.find((l) => l.date === today) ?? null, [logs, today]);

  /* ------------------------------------------------------------------ */
  /*  Пересчёт квоты и цепочки на новый день                             */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    if (!profile || loading) return;
    if (quotaRolled.current === today) return;
    if (profile.quota_last_date === today) {
      quotaRolled.current = today;
      return;
    }

    quotaRolled.current = today;

    const yesterday = shiftDate(today, -1);
    const yesterdaySent = contacts.filter((c) => c.first_contact_date === yesterday).length;

    const rolled = rollQuotaForNewDay({
      quotaStreak: profile.quota_streak ?? 0,
      quotaLastDate: profile.quota_last_date,
      yesterdaySent,
      yesterdayQuota: profile.current_quota ?? 5,
      today,
    });

    if (rolled.changed) {
      void updateProfile({
        quota_streak: rolled.quotaStreak,
        current_quota: rolled.currentQuota,
        quota_last_date: today,
      });
    }
  }, [profile, contacts, today, loading, updateProfile]);

  /* ------------------------------------------------------------------ */
  /*  Проигрывание каскада                                               */
  /* ------------------------------------------------------------------ */

  const toastText = useCallback(
    (key: string, vars?: Record<string, number>) => {
      switch (key) {
        case 'record':
          return tf(t.outreach.toastRecord, { n: vars?.n ?? 0 });
        case 'round':
          return tf(t.outreach.toastRound, { n: vars?.n ?? 0 });
        case 'added':
          return `+${vars?.n ?? 0} XP · ${t.outreach.toastAdded}`;
        case 'replied':
          return `+${vars?.n ?? 0} XP · ${t.xpReasons.replied}`;
        case 'call':
          return `+${vars?.n ?? 0} XP · ${t.xpReasons.call}`;
        case 'closed':
          return `+${vars?.n ?? 0} XP · ${t.xpReasons.closed}`;
        default:
          return '';
      }
    },
    [t, tf],
  );

  const runEvents = useCallback(
    async (events: GameEvent[]) => {
      const overlayFor: Record<OverlayKind, FirstEventKind | null> = {
        quota: null,
        'first-reply': 'reply',
        'first-call': 'call',
        'first-closed': 'closed',
      };

      for (const event of events) {
        if (event.kind === 'fx') {
          celebrate(event.fx, profile?.sound_enabled ?? false);
        } else if (event.kind === 'xp') {
          if (event.onceKey) {
            if (attemptedKeys.current.has(event.onceKey)) continue;
            attemptedKeys.current.add(event.onceKey);
          }
          await awardXp(event.amount, event.reason, event.onceKey);
        } else if (event.kind === 'toast') {
          setToast({ id: Date.now() + Math.random(), text: toastText(event.textKey, event.vars), tone: event.tone });
          setTimeout(() => setToast(null), 1800);
        } else if (event.kind === 'overlay') {
          if (event.overlay === 'quota') setQuotaOverlay({ open: true, xp: event.xp });
          else {
            const kind = overlayFor[event.overlay];
            if (kind) setFirstEvent({ kind, xp: event.xp });
          }
        } else if (event.kind === 'profile') {
          await updateProfile(event.patch as Partial<Profile>);
        }
      }
    },
    [awardXp, updateProfile, toastText, profile?.sound_enabled],
  );

  /* ------------------------------------------------------------------ */
  /*  Контакты                                                           */
  /* ------------------------------------------------------------------ */

  const addContact = useCallback(
    async (draft: ContactDraft): Promise<OutreachContact | null> => {
      if (!user) return null;

      const now = new Date().toISOString();
      const { data, error: insertError } = await supabase
        .from('outreach_contacts')
        .insert({
          user_id: user.id,
          name: draft.name,
          niche: draft.niche || null,
          telegram_handle: draft.telegram_handle || null,
          instagram_url: draft.instagram_url || null,
          comment: draft.comment || null,
          next_step: draft.next_step || null,
          status: draft.status,
          first_contact_date: draft.first_contact_date,
          status_history: [{ status: draft.status, at: now }],
        } as never)
        .select('*')
        .single();

      if (insertError) {
        setError(humanError(insertError.message));
        return null;
      }

      const contact = data as OutreachContact;
      setContacts((previous) => [contact, ...previous]);

      // Текст рассылки сразу уходит в библиотеку офферов и привязывается к
      // контакту. Дальше результат оффера тянется за статусом сам (триггер в
      // базе), поэтому вручную помечать «сработало / не сработало» не нужно —
      // закономерности собираются из реальных исходов.
      if (draft.comment.trim()) {
        const label = (draft.niche || draft.name).trim();
        await supabase.from('offers').insert({
          user_id: user.id,
          contact_id: contact.id,
          title: `${label} · ${formatDayMonth(draft.first_contact_date, 'ru')}`,
          niche: draft.niche || null,
          content: draft.comment.trim(),
          result: draft.status,
        } as never);
      }

      // Счётчик считает контакты за сегодня — новый учитываем сразу.
      const sentAfter =
        contact.first_contact_date === today ? sentToday + 1 : sentToday;

      await logActivity('sent', { name: contact.name, niche: contact.niche });

      if (contact.first_contact_date === today) {
        await runEvents(
          onOutreachAdded({
            sentToday: sentAfter,
            quota: quota.quota,
            record: quota.record,
            date: today,
            awardedBonusSteps: [],
          }),
        );

        // Цепочка дней с хотя бы одной рассылкой.
        if (profile && profile.chain_last_date !== today) {
          const chain = rollChain({
            chainDays: profile.chain_days ?? 0,
            chainLastDate: profile.chain_last_date,
            today,
          });
          await updateProfile({ chain_days: chain, chain_last_date: today });
        }
      }

      void syncSheets();
      return contact;
    },
    [supabase, user, today, sentToday, quota.quota, quota.record, logActivity, runEvents, profile, updateProfile],
  );

  const setStatus = useCallback(
    async (contact: OutreachContact, status: ContactStatus) => {
      if (contact.status === status) return;
      if (!profile) return;

      const now = new Date().toISOString();
      const history = [...(contact.status_history ?? []), { status, at: now }];

      const patch: Partial<OutreachContact> = { status, status_history: history };
      // Момент первого ответа нужен счётчику скорости (уровень 4).
      if (status === 'replied' && !contact.replied_at) patch.replied_at = now;

      setContacts((previous) =>
        previous.map((c) => (c.id === contact.id ? { ...c, ...patch, updated_at: now } : c)),
      );

      const { error: updateError } = await supabase
        .from('outreach_contacts')
        .update(patch as never)
        .eq('id', contact.id);

      if (updateError) {
        setError(humanError(updateError.message));
        return;
      }

      if (status === 'replied' || status === 'call' || status === 'closed') {
        await logActivity(status, { name: contact.name, niche: contact.niche });
      }

      await runEvents(
        onStatusChanged({
          contactId: contact.id,
          status,
          hadFirstReply: Boolean(profile.first_reply_at),
          hadFirstCall: Boolean(profile.first_call_at),
          hadFirstClosed: Boolean(profile.first_closed_at),
        }),
      );

      void syncSheets();
    },
    [supabase, profile, logActivity, runEvents],
  );

  const updateContact = useCallback(
    async (id: string, patch: Partial<OutreachContact>) => {
      setContacts((previous) => previous.map((c) => (c.id === id ? { ...c, ...patch } : c)));
      const { error: updateError } = await supabase
        .from('outreach_contacts')
        .update(patch as never)
        .eq('id', id);
      if (updateError) setError(humanError(updateError.message));
      else void syncSheets();
    },
    [supabase],
  );

  const deleteContact = useCallback(
    async (id: string) => {
      setContacts((previous) => previous.filter((c) => c.id !== id));
      const { error: deleteError } = await supabase.from('outreach_contacts').delete().eq('id', id);
      if (deleteError) setError(humanError(deleteError.message));
      else void syncSheets();
    },
    [supabase],
  );

  /**
   * Новое касание по контакту.
   *
   * Квоту не двигает намеренно: квота считает новые цели, иначе её можно было
   * бы закрыть, перетрогав одних и тех же людей. Но труд реальный, поэтому XP
   * начисляется — с ключом на номер касания, так что нафармить нельзя.
   */
  const touchContact = useCallback(
    async (contact: OutreachContact) => {
      const count = (contact.touch_count ?? 1) + 1;

      setContacts((previous) =>
        previous.map((c) =>
          c.id === contact.id ? { ...c, last_touch_at: today, touch_count: count } : c,
        ),
      );

      const { error: touchError } = await supabase
        .from('outreach_contacts')
        .update({ last_touch_at: today, touch_count: count } as never)
        .eq('id', contact.id);

      if (touchError) {
        setError(humanError(touchError.message));
        return;
      }

      await logActivity('sent', { name: contact.name, niche: contact.niche, detail: `касание ${count}` });

      const key = `touch:${contact.id}:${count}`;
      if (!attemptedKeys.current.has(key)) {
        attemptedKeys.current.add(key);
        await awardXp(8, 'outreach', key);
      }

      void syncSheets();
    },
    [supabase, today, logActivity, awardXp],
  );

  const muteContact = useCallback(
    async (id: string, muted: boolean) => {
      setContacts((previous) => previous.map((c) => (c.id === id ? { ...c, muted } : c)));
      await supabase.from('outreach_contacts').update({ muted } as never).eq('id', id);
    },
    [supabase],
  );

  /* ------------------------------------------------------------------ */
  /*  Задачи дня                                                         */
  /* ------------------------------------------------------------------ */

  const addTask = useCallback(
    async (text: string) => {
      if (!user || !text.trim()) return;
      const { data } = await supabase
        .from('daily_tasks')
        .insert({ user_id: user.id, date: today, text: text.trim() })
        .select('*')
        .single();
      if (data) setTasks((previous) => [...previous, data as DailyTask]);
    },
    [supabase, user, today],
  );

  const toggleTask = useCallback(
    async (id: string) => {
      const task = tasks.find((x) => x.id === id);
      if (!task) return;
      const completed = !task.completed;
      setTasks((previous) => previous.map((x) => (x.id === id ? { ...x, completed } : x)));
      await supabase.from('daily_tasks').update({ completed }).eq('id', id);
    },
    [supabase, tasks],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      setTasks((previous) => previous.filter((x) => x.id !== id));
      await supabase.from('daily_tasks').delete().eq('id', id);
    },
    [supabase],
  );

  /* ------------------------------------------------------------------ */
  /*  День: привычки, чекин, питание                                     */
  /* ------------------------------------------------------------------ */

  const saveDay = useCallback(
    async (patch: Partial<DailyLog>) => {
      if (!user) return;

      const existing = logs.find((l) => l.date === today);
      const merged = {
        checklist: existing?.checklist ?? {},
        custom_tasks: existing?.custom_tasks ?? [],
        fasting_ok: existing?.fasting_ok ?? false,
        ...existing,
        ...patch,
      } as DailyLog;

      setLogs((previous) => {
        const rest = previous.filter((l) => l.date !== today);
        return [{ ...merged, date: today, user_id: user.id } as DailyLog, ...rest];
      });

      const { data, error: upsertError } = await supabase
        .from('daily_logs')
        .upsert(
          {
            user_id: user.id,
            date: today,
            sleep_time: merged.sleep_time ?? null,
            wake_time: merged.wake_time ?? null,
            wake_quality: merged.wake_quality ?? null,
            morning_comment: merged.morning_comment ?? null,
            checklist: merged.checklist ?? {},
            custom_tasks: merged.custom_tasks ?? [],
            meal_1_time: merged.meal_1_time ?? null,
            meal_1_note: merged.meal_1_note ?? null,
            meal_2_time: merged.meal_2_time ?? null,
            meal_2_note: merged.meal_2_note ?? null,
            fasting_ok: merged.fasting_ok ?? false,
            day_comment: merged.day_comment ?? null,
          },
          { onConflict: 'user_id,date' },
        )
        .select('*')
        .single();

      if (upsertError) {
        setError(humanError(upsertError.message));
        return;
      }

      setLogs((previous) => {
        const rest = previous.filter((l) => l.date !== today);
        return [data as DailyLog, ...rest];
      });

      void syncSheets();
    },
    [supabase, user, logs, today],
  );

  const toggleHabit = useCallback(
    async (habitId: string) => {
      const current = todayLog?.checklist ?? {};
      const turningOn = !current[habitId];
      await saveDay({ checklist: { ...current, [habitId]: turningOn } });

      // Привычка стоит символический 1 XP — она гигиена, а не результат.
      if (turningOn) {
        const key = `habit:${today}:${habitId}`;
        if (!attemptedKeys.current.has(key)) {
          attemptedKeys.current.add(key);
          await awardXp(1, 'habit', key);
        }
      }
    },
    [todayLog?.checklist, saveDay, awardXp, today],
  );

  /* ------------------------------------------------------------------ */
  /*  Вечерний чекин режима                                              */
  /* ------------------------------------------------------------------ */

  const submitModeCheckin = useCallback(
    async (held: { porn: boolean; mb: boolean; sugar: boolean }) => {
      if (!profile) return;

      await updateProfile({
        mode_porn_days: held.porn ? (profile.mode_porn_days ?? 0) + 1 : 0,
        mode_mb_days: held.mb ? (profile.mode_mb_days ?? 0) + 1 : 0,
        mode_sugar_days: held.sugar ? (profile.mode_sugar_days ?? 0) + 1 : 0,
        mode_last_checkin: today,
      });

      // Полностью выдержанный день награждается один раз за сутки.
      if (held.porn && held.mb && held.sugar) {
        const key = `mode:${today}`;
        if (!attemptedKeys.current.has(key)) {
          attemptedKeys.current.add(key);
          await awardXp(8, 'mode', key);
        }
      }
    },
    [profile, updateProfile, awardXp, today],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.replace('/auth');
    router.refresh();
  }, [supabase, router]);

  /* ------------------------------------------------------------------ */

  const value = useMemo<AppContextValue>(
    () => ({
      user,
      profile,
      today,
      loading,
      error,
      contacts,
      activity,
      tasks,
      logs,
      todayLog,
      quota,
      chain: profile?.chain_days ?? 0,
      levelInfo,
      cycleDayNumber,
      addContact,
      updateContact,
      setStatus,
      deleteContact,
      touchContact,
      muteContact,
      addTask,
      toggleTask,
      deleteTask,
      toggleHabit,
      saveDay,
      submitModeCheckin,
      updateProfile,
      awardXp,
      reload: load,
      signOut,
    }),
    [
      user, profile, today, loading, error, contacts, activity, tasks, logs, todayLog,
      quota, levelInfo, cycleDayNumber, addContact, updateContact, setStatus, deleteContact, touchContact, muteContact,
      addTask, toggleTask, deleteTask, toggleHabit, saveDay, submitModeCheckin,
      updateProfile, awardXp, load, signOut,
    ],
  );

  return (
    <AppContext.Provider value={value}>
      {children}

      {/* Ошибки сохранения не должны теряться молча: данные — смысл приложения. */}
      {error && (
        <div className="fixed inset-x-4 top-[calc(12px+env(safe-area-inset-top))] z-[85] mx-auto max-w-md">
          <div className="glass flex items-start gap-3 border-[rgba(255,107,107,0.3)] bg-[rgba(255,107,107,0.08)] p-3">
            <p className="min-w-0 flex-1 text-sm leading-snug text-danger">{humanError(error)}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              aria-label={t.common.close}
              className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/40 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      <Toast toast={toast} />

      <QuotaClosedOverlay
        open={quotaOverlay.open}
        xp={quotaOverlay.xp}
        onContinue={() => setQuotaOverlay({ open: false, xp: 0 })}
        onStop={() => setQuotaOverlay({ open: false, xp: 0 })}
      />

      <FirstEventOverlay
        kind={firstEvent?.kind ?? null}
        xp={firstEvent?.xp ?? 0}
        onDismiss={() => setFirstEvent(null)}
      />

      <LevelUpOverlay
        level={levelUp?.level ?? null}
        featureKey={levelUp?.feature ?? null}
        onDismiss={() => setLevelUp(null)}
      />
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

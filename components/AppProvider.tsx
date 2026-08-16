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
import { applyAccent, readAccent } from '@/lib/accent';
import { FirstEventOverlay, type FirstEventKind } from '@/components/overlays/FirstEventOverlay';
import { LevelUpOverlay } from '@/components/overlays/LevelUpOverlay';
import { QuotaClosedOverlay } from '@/components/overlays/QuotaClosedOverlay';
import { Toast, type ToastData } from '@/components/overlays/Toast';
import { useLanguage } from '@/components/LanguageProvider';
import { cycleDay, formatDayMonth, getLogicalDate, shiftDate } from '@/lib/date';
import { celebrate } from '@/lib/feedback';
import {
  isReplyStatus,
  onOutreachAdded,
  onStatusChanged,
  type GameEvent,
  type OverlayKind,
} from '@/lib/gamification';
import { calculateQuota, daysUntilQuotaGrows, nextQuota, quotaPct, rollChain, rollQuotaForNewDay } from '@/lib/quota';
import { showLocalNotification } from '@/lib/push-client';
import { activeCount, isActive, nowLocal, urgencyOf } from '@/lib/reminders';
import { createClient } from '@/lib/supabase/client';
import { syncSheets } from '@/lib/sheets-client';
import {
  featureAtLevel,
  getLevelInfo,
  levelForXp,
  onceKey,
  REVEAL_BLOCK,
  unlocked,
  XP,
  type FeatureKey,
  type LevelInfo,
} from '@/lib/xp';
import {
  normalizeStatus,
  SENT_STATUSES,
  type ActivityEntry,
  type ActivityType,
  type ContactStatus,
  type DailyLog,
  type DailyTask,
  type OutreachContact,
  type Profile,
  type Reminder,
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

export type ReminderDraft = {
  title: string;
  note: string;
  due_at: string;
  contact_id: string | null;
};

type AppContextValue = {
  user: User | null;
  profile: Profile | null;
  today: string;
  /** Текущий момент как 'YYYY-MM-DDTHH:mm'. Обновляется раз в минуту. */
  now: string;
  loading: boolean;
  error: string | null;

  contacts: OutreachContact[];
  activity: ActivityEntry[];
  tasks: DailyTask[];
  logs: DailyLog[];
  todayLog: DailyLog | null;

  reminders: Reminder[];
  /** false — таблица напоминаний ещё не создана (не прогнали migration-v5). */
  remindersReady: boolean;
  remindersDue: number;

  quota: QuotaState;
  chain: number;
  levelInfo: LevelInfo;
  cycleDayNumber: number;
  /** Всего рассылок, дошедших до адресата, за всё время. */
  sentTotal: number;
  /** Открыта ли фича на текущем уровне. */
  can: (feature: FeatureKey) => boolean;

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

  addReminder: (draft: ReminderDraft) => Promise<Reminder | null>;
  updateReminder: (id: string, patch: Partial<Reminder>) => Promise<void>;
  toggleReminder: (id: string) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;

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
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [remindersReady, setRemindersReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Оверлеи и тосты
  const [firstEvent, setFirstEvent] = useState<{ kind: FirstEventKind; xp: number } | null>(null);
  const [quotaOverlay, setQuotaOverlay] = useState<{ open: boolean; xp: number }>({ open: false, xp: 0 });
  const [levelUp, setLevelUp] = useState<
    { level: number; feature: FeatureKey | null; revealed: boolean } | null
  >(null);
  const [toast, setToast] = useState<ToastData | null>(null);

  const [today, setToday] = useState(() => getLogicalDate());
  const [now, setNow] = useState(() => nowLocal());

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

    const [profileRes, contactsRes, activityRes, tasksRes, logsRes, remindersRes] = await Promise.all([
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
      // Напоминания появились в migration-v5. Пока её не прогнали, таблицы
      // нет — это не ошибка приложения, а не выполненный шаг установки.
      supabase
        .from('reminders')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('due_at', { ascending: true }),
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
    // Статусы из базы могут быть старой шкалы («Отказ» до migration-v5) —
    // приводим их сразу на входе, чтобы ниже по коду вариант был ровно один.
    setContacts(
      ((contactsRes.data as OutreachContact[]) ?? []).map((contact) => ({
        ...contact,
        status: normalizeStatus(contact.status),
      })),
    );
    setActivity((activityRes.data as ActivityEntry[]) ?? []);
    setTasks((tasksRes.data as DailyTask[]) ?? []);
    setLogs((logsRes.data as DailyLog[]) ?? []);

    if (remindersRes.error) {
      setRemindersReady(false);
      setReminders([]);
    } else {
      setRemindersReady(true);
      setReminders((remindersRes.data as Reminder[]) ?? []);
    }

    if (!languageApplied.current && loadedProfile.language) {
      languageApplied.current = true;
      setLang(loadedProfile.language);
    }

    setLoading(false);
  }, [supabase, setLang]);

  useEffect(() => {
    void load();
  }, [load]);

  // Выбранный акцент живёт в localStorage — возвращаем его до первой отрисовки
  // полос прогресса, иначе цвет моргает белым на каждой загрузке.
  useEffect(() => {
    applyAccent(readAccent());
  }, []);

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

  // Логический день может смениться прямо во время работы (в 4 утра),
  // а минутная стрелка двигает напоминания — обе даты тикают вместе.
  useEffect(() => {
    const timer = setInterval(() => {
      const current = getLogicalDate();
      setToday((previous) => (previous === current ? previous : current));

      const stamp = nowLocal();
      setNow((previous) => (previous === stamp ? previous : stamp));
    }, 30_000);
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
        setLevelUp({
          level: result.level,
          feature: featureAtLevel(result.level),
          // Взял последний уровень блока — туман отступил ещё на пять.
          revealed: result.level % REVEAL_BLOCK === 0,
        });
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

  /** Дошедшие до адресата рассылки за всё время — база для вех. */
  const sentTotal = useMemo(
    () => contacts.filter((c) => SENT_STATUSES.includes(c.status)).length,
    [contacts],
  );

  const levelInfo = useMemo(() => getLevelInfo(profile?.total_xp ?? 0, t), [profile?.total_xp, t]);

  const can = useCallback(
    (feature: FeatureKey) => unlocked(feature, levelInfo.level),
    [levelInfo.level],
  );

  const remindersDue = useMemo(() => activeCount(reminders, now), [reminders, now]);

  /**
   * Напоминание, время которого наступило прямо сейчас.
   *
   * При первой загрузке ничего не показываем: старые просроченные задачи
   * выстрелили бы пачкой тостов и обесценили механику. Они и так видны
   * в списке. Сигналим только о переходе «ещё рано → уже пора».
   */
  const notifiedReminders = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!remindersReady || loading) return;

    // День здесь календарный (внутри urgencyOf по умолчанию), а не логический:
    // на срабатывание это не влияет — «пора» и «просрочено» одинаково активны.
    const active = reminders.filter(
      (reminder) => !reminder.done && isActive(urgencyOf(reminder, now)),
    );

    // Первый проход только запоминает состояние.
    if (notifiedReminders.current === null) {
      notifiedReminders.current = new Set(active.map((reminder) => reminder.id));
      return;
    }

    for (const reminder of active) {
      if (notifiedReminders.current.has(reminder.id)) continue;
      notifiedReminders.current.add(reminder.id);

      setToast({
        id: Date.now() + Math.random(),
        text: `⏰ ${reminder.title}`,
        tone: 'round',
      });
      setTimeout(() => setToast(null), 4000);

      void showLocalNotification(t.reminders.notificationTitle, reminder.title);
    }
  }, [reminders, now, remindersReady, loading, t.reminders.notificationTitle]);

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
        case 'milestone':
          return tf(t.outreach.toastMilestone, { n: vars?.n ?? 0 });
        case 'added':
          return `+${vars?.n ?? 0} XP · ${t.outreach.toastAdded}`;
        case 'replied':
          return `+${vars?.n ?? 0} XP · ${t.xpReasons.replied}`;
        case 'repliedNo':
          return `+${vars?.n ?? 0} XP · ${t.outreach.toastRepliedNo}`;
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

      const contact = { ...(data as OutreachContact), status: normalizeStatus(data.status) };
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
            // sentTotal посчитан до вставки — это и есть «было до».
            totalBefore: sentTotal,
            doubleXp: unlocked('doubleXp', levelInfo.level),
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
    [
      supabase, user, today, sentToday, sentTotal, quota.quota, quota.record, levelInfo.level,
      logActivity, runEvents, profile, updateProfile,
    ],
  );

  const setStatus = useCallback(
    async (contact: OutreachContact, status: ContactStatus) => {
      if (contact.status === status) return;
      if (!profile) return;

      const nowIso = new Date().toISOString();
      const history = [...(contact.status_history ?? []), { status, at: nowIso }];

      const patch: Partial<OutreachContact> = { status, status_history: history };
      // Момент первого ответа нужен счётчику скорости (уровень 4). Отказ
      // словами — это тоже ответ, и скорость по нему считается так же.
      if (isReplyStatus(status) && !contact.replied_at) patch.replied_at = nowIso;

      setContacts((previous) =>
        previous.map((c) => (c.id === contact.id ? { ...c, ...patch, updated_at: nowIso } : c)),
      );

      const { error: updateError } = await supabase
        .from('outreach_contacts')
        .update(patch as never)
        .eq('id', contact.id);

      if (updateError) {
        setError(humanError(updateError.message));
        return;
      }

      // «Ответил — отказ» попадает в ленту как ответ: событие ленты — это
      // факт «человек откликнулся», а не оценка исхода.
      if (isReplyStatus(status)) {
        await logActivity('replied', { name: contact.name, niche: contact.niche });
      } else if (status === 'call' || status === 'closed') {
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
  /*  Напоминания                                                        */
  /* ------------------------------------------------------------------ */

  const addReminder = useCallback(
    async (draft: ReminderDraft): Promise<Reminder | null> => {
      if (!user || !draft.title.trim() || !draft.due_at) return null;

      const { data, error: insertError } = await supabase
        .from('reminders')
        .insert({
          user_id: user.id,
          title: draft.title.trim(),
          note: draft.note.trim() || null,
          due_at: draft.due_at,
          contact_id: draft.contact_id,
          done: false,
        } as never)
        .select('*')
        .single();

      if (insertError) {
        // Таблицы может не быть, если migration-v5 ещё не прогнали.
        setRemindersReady(false);
        setError(humanError(insertError.message));
        return null;
      }

      const reminder = data as Reminder;
      setReminders((previous) =>
        [...previous, reminder].sort((a, b) => a.due_at.localeCompare(b.due_at)),
      );
      return reminder;
    },
    [supabase, user],
  );

  const updateReminder = useCallback(
    async (id: string, patch: Partial<Reminder>) => {
      setReminders((previous) =>
        previous
          .map((r) => (r.id === id ? { ...r, ...patch } : r))
          .sort((a, b) => a.due_at.localeCompare(b.due_at)),
      );
      const { error: updateError } = await supabase
        .from('reminders')
        .update(patch as never)
        .eq('id', id);
      if (updateError) setError(humanError(updateError.message));
    },
    [supabase],
  );

  /**
   * Закрытие напоминания.
   *
   * XP символический и один раз на напоминание: иначе можно было бы
   * штамповать задачи «встать со стула» и качать уровень мимо рассылок.
   */
  const toggleReminder = useCallback(
    async (id: string) => {
      const reminder = reminders.find((r) => r.id === id);
      if (!reminder) return;

      const done = !reminder.done;
      await updateReminder(id, { done });

      if (done) {
        const key = onceKey.reminder(id);
        if (!attemptedKeys.current.has(key)) {
          attemptedKeys.current.add(key);
          await awardXp(XP.NOTE_FIRST, 'reminder', key);
        }
      }
    },
    [reminders, updateReminder, awardXp],
  );

  const deleteReminder = useCallback(
    async (id: string) => {
      setReminders((previous) => previous.filter((r) => r.id !== id));
      const { error: deleteError } = await supabase.from('reminders').delete().eq('id', id);
      if (deleteError) setError(humanError(deleteError.message));
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
      now,
      loading,
      error,
      contacts,
      activity,
      tasks,
      logs,
      todayLog,
      reminders,
      remindersReady,
      remindersDue,
      quota,
      chain: profile?.chain_days ?? 0,
      levelInfo,
      cycleDayNumber,
      sentTotal,
      can,
      addContact,
      updateContact,
      setStatus,
      deleteContact,
      touchContact,
      muteContact,
      addTask,
      toggleTask,
      deleteTask,
      addReminder,
      updateReminder,
      toggleReminder,
      deleteReminder,
      toggleHabit,
      saveDay,
      submitModeCheckin,
      updateProfile,
      awardXp,
      reload: load,
      signOut,
    }),
    [
      user, profile, today, now, loading, error, contacts, activity, tasks, logs, todayLog,
      reminders, remindersReady, remindersDue, quota, levelInfo, cycleDayNumber, sentTotal, can,
      addContact, updateContact, setStatus, deleteContact, touchContact, muteContact,
      addTask, toggleTask, deleteTask, addReminder, updateReminder, toggleReminder, deleteReminder,
      toggleHabit, saveDay, submitModeCheckin, updateProfile, awardXp, load, signOut,
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
        revealed={levelUp?.revealed ?? false}
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

/**
 * То же самое, но без падения вне провайдера.
 *
 * Нужно навигации: она рисуется и на витрине компонентов (/auth/preview),
 * где никакого провайдера нет. Значок непрочитанных напоминаний там просто
 * не появится — это лучше, чем белый экран.
 */
export function useAppOptional(): AppContextValue | null {
  return useContext(AppContext);
}

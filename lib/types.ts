// ---------------------------------------------------------------------------
// Доменные типы + типизация схемы Supabase
// ---------------------------------------------------------------------------

export type WakeQuality = 'easy' | 'normal' | 'hard';
export type Language = 'ru' | 'en';

/**
 * Статусы воронки. Порядок = порядок движения вперёд, поэтому им же
 * пользуются кнопки в карточке и уровни визуальной воронки.
 *
 * Статуса «Отказ» здесь нет намеренно: он дублировал «Ответил — отказ», а два
 * почти одинаковых слова в списке заставляли выбирать между ними каждый раз.
 * Отказ без ответа — это просто молчание, для него есть «Отправлено».
 */
export const CONTACT_STATUSES = [
  'not_sent',
  'sent',
  'read',
  'replied',
  'replied_no',
  'blocked',
  'call',
  'closed',
] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

/**
 * Статусы, исчезнувшие из шкалы. В базе строки со старым значением ещё
 * встречаются, поэтому любой статус, пришедший снаружи, проходит через
 * normalizeStatus() — иначе UI споткнётся о ключ, которого нет в словаре.
 */
export const LEGACY_STATUS_ALIASES: Record<string, ContactStatus> = {
  refused: 'replied_no',
  ignored: 'replied_no',
};

/** Приводит любое значение статуса к текущей шкале. */
export function normalizeStatus(value: string | null | undefined): ContactStatus {
  if (!value) return 'sent';
  if ((CONTACT_STATUSES as readonly string[]).includes(value)) return value as ContactStatus;
  return LEGACY_STATUS_ALIASES[value] ?? 'sent';
}

/**
 * Статусы, которые считаются «дошёл до ответа».
 *
 * «Ответил — отказ» здесь обязателен: человек ответил. То, что ответ
 * отрицательный, — вопрос качества оффера, а не факта контакта. Считать это
 * молчанием значит занижать собственную конверсию и не видеть, что тексты
 * доходят.
 */
export const REPLIED_STATUSES: ContactStatus[] = ['replied', 'replied_no', 'call', 'closed'];
/** Статусы, которые считаются «дошёл до созвона». */
export const CALL_STATUSES: ContactStatus[] = ['call', 'closed'];
/** Отправленные — всё, кроме «ещё не написал». */
export const SENT_STATUSES: ContactStatus[] = [
  'sent',
  'read',
  'replied',
  'replied_no',
  'blocked',
  'call',
  'closed',
];
/** Исходы, которые подсвечиваются красным: дверь закрылась. */
export const NEGATIVE_STATUSES: ContactStatus[] = ['replied_no', 'blocked'];

/**
 * Результат оффера — это и есть статус контакта, которому его отправили.
 * Отдельная шкала означала бы таблицу соответствий и неизбежный разъезд.
 */
export const OFFER_RESULTS = CONTACT_STATUSES;
export type OfferResult = ContactStatus;

export const NOTE_TAGS = ['idea', 'goal', 'insight', 'thought'] as const;
export type NoteTag = (typeof NOTE_TAGS)[number];

/** Тип события в ленте активности. */
export const ACTIVITY_TYPES = [
  'sent',
  'replied',
  'call',
  'closed',
  'quota',
  'record',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** События воронки, которые подсвечиваются в ленте ярче остальных. */
export const LOUD_ACTIVITY: ActivityType[] = ['replied', 'call', 'closed', 'record'];

export type Checklist = Record<string, boolean>;
export type CustomTask = { id: string; title: string };
export type StatusHistoryEntry = { status: ContactStatus; at: string };

/** Этап проекта. */
export type ProjectStage = { id: string; title: string; done: boolean };

// ---------------------------------------------------------------------------
// Строки таблиц
// ---------------------------------------------------------------------------

export type Profile = {
  id: string;
  username: string | null;
  total_xp: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  unlocked_weeks: number;
  daily_goal: number;
  streak_threshold: number;
  language: Language;
  created_at: string;

  // Квота
  current_quota: number;
  quota_streak: number;
  daily_record: number;
  quota_last_date: string | null;

  // Ставки и цикл
  deadline_date: string;
  cycle_start_date: string;

  // Режим
  mode_porn_days: number;
  mode_mb_days: number;
  mode_sugar_days: number;
  mode_last_checkin: string | null;

  // Цепочка дней с рассылками
  chain_days: number;
  chain_last_date: string | null;

  // Первые события воронки
  first_reply_at: string | null;
  first_call_at: string | null;
  first_closed_at: string | null;

  sound_enabled: boolean;
  avg_deal_amount: number;
  timezone: string;
  push_enabled: boolean;
};

export type DailyLog = {
  id: string;
  user_id: string;
  date: string;
  sleep_time: string | null;
  wake_time: string | null;
  wake_quality: WakeQuality | null;
  morning_comment: string | null;
  checklist: Checklist;
  custom_tasks: CustomTask[];
  meal_1_time: string | null;
  meal_1_note: string | null;
  meal_2_time: string | null;
  meal_2_note: string | null;
  fasting_ok: boolean;
  day_comment: string | null;
  completion_pct: number;
  xp_earned: number;
  created_at: string;
};

export type OutreachContact = {
  id: string;
  user_id: string;
  name: string;
  /** Свободный текст: никаких select по всему приложению. */
  niche: string | null;
  audience_size: string | null;
  platform: string | null;
  status: ContactStatus;
  note: string | null;
  status_history: StatusHistoryEntry[];
  telegram_handle: string | null;
  instagram_url: string | null;
  first_contact_date: string;
  comment: string | null;
  next_step: string | null;
  replied_at: string | null;
  /** Дата последнего касания — от неё считается следующее напоминание. */
  last_touch_at: string | null;
  touch_count: number;
  /** Ручная пометка «больше не напоминать». */
  muted: boolean;
  created_at: string;
  updated_at: string;
};

export type Offer = {
  id: string;
  user_id: string;
  title: string;
  niche: string | null;
  content: string;
  result: OfferResult;
  note: string | null;
  contact_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Note = {
  id: string;
  user_id: string;
  content: string;
  tag: NoteTag;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Напоминание — задача с датой и временем.
 *
 * contact_id делит их на два непересекающихся мира: с привязкой напоминание
 * всплывает в блоке касаний на странице рассылок, без привязки живёт только
 * во вкладке «Напоминания». Смешивать нельзя — рабочий список дня должен
 * содержать только людей.
 */
export type Reminder = {
  id: string;
  user_id: string;
  title: string;
  note: string | null;
  /** Локальный момент срабатывания: 'YYYY-MM-DDTHH:mm'. Без таймзоны. */
  due_at: string;
  contact_id: string | null;
  done: boolean;
  created_at: string;
  updated_at: string;
};

export type XpTransaction = {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  once_key: string | null;
  created_at: string;
};

export type ActivityEntry = {
  id: string;
  user_id: string;
  type: ActivityType;
  contact_name: string | null;
  contact_niche: string | null;
  detail: string | null;
  xp_earned: number;
  created_at: string;
};

export type DailyTask = {
  id: string;
  user_id: string;
  date: string;
  text: string;
  completed: boolean;
  created_at: string;
};

export type Project = {
  id: string;
  user_id: string;
  contact_id: string | null;
  expert_name: string;
  niche: string | null;
  status: 'prep' | 'launch' | 'done';
  stages: ProjectStage[];
  launch_date: string | null;
  deal_amount: number;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type WeeklyReport = {
  id: string;
  user_id: string;
  week_start: string;
  sent: number;
  replied: number;
  calls: number;
  closed: number;
  xp_earned: number;
  best_day: string | null;
  best_count: number;
  created_at: string;
};

export type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
};

/**
 * То, что видит браузер. refresh_token намеренно не входит: колоночные
 * гранты в Postgres не отдают его роли authenticated.
 */
export type GoogleIntegration = {
  user_id: string;
  google_email: string | null;
  sheet_id: string | null;
  last_synced_at: string | null;
  last_sync_status: string | null;
  connected_at: string | null;
};

/** Полная строка — доступна только серверу через service_role. */
export type GoogleIntegrationRow = GoogleIntegration & {
  refresh_token: string | null;
};

// ---------------------------------------------------------------------------
// Схема для generic-параметра supabase-js
// ---------------------------------------------------------------------------

type Table<Row, RequiredInsert extends keyof Row> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, RequiredInsert>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile, 'id'>;
      daily_logs: Table<DailyLog, 'user_id' | 'date'>;
      outreach_contacts: Table<OutreachContact, 'user_id' | 'name'>;
      offers: Table<Offer, 'user_id' | 'title' | 'content'>;
      notes: Table<Note, 'user_id' | 'content'>;
      reminders: Table<Reminder, 'user_id' | 'title' | 'due_at'>;
      xp_transactions: Table<XpTransaction, 'user_id' | 'amount' | 'reason'>;
      activity_feed: Table<ActivityEntry, 'user_id' | 'type'>;
      daily_tasks: Table<DailyTask, 'user_id' | 'date' | 'text'>;
      projects: Table<Project, 'user_id' | 'expert_name'>;
      weekly_reports: Table<WeeklyReport, 'user_id' | 'week_start'>;
      push_subscriptions: Table<PushSubscriptionRow, 'user_id' | 'endpoint' | 'p256dh' | 'auth'>;
      google_integrations: Table<GoogleIntegrationRow, 'user_id'>;
    };
    Views: Record<string, never>;
    Functions: {
      award_xp: {
        Args: { p_amount: number; p_reason: string; p_once_key?: string | null };
        Returns: { awarded: number; total_xp: number; level: number };
      };
      resync_xp: {
        Args: Record<string, never>;
        Returns: { total_xp: number; level: number };
      };
      level_for_xp: {
        Args: { p_xp: number };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

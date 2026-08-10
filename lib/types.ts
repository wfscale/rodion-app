// ---------------------------------------------------------------------------
// Доменные типы + типизация схемы Supabase
// ---------------------------------------------------------------------------

export type WakeQuality = 'easy' | 'normal' | 'hard';
export type Language = 'ru' | 'en';

/** Статусы воронки контакта — порядок совпадает с порядком кнопок в UI. */
export const CONTACT_STATUSES = [
  'sent',
  'ignored',
  'read',
  'replied',
  'refused',
  'call',
  'closed',
] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

/** Результаты оффера (у оффера нет «отказа», но есть «не отправлен»). */
export const OFFER_RESULTS = [
  'not_sent',
  'ignored',
  'read',
  'replied',
  'call',
  'closed',
] as const;
export type OfferResult = (typeof OFFER_RESULTS)[number];

export const NOTE_TAGS = ['idea', 'goal', 'insight', 'thought'] as const;
export type NoteTag = (typeof NOTE_TAGS)[number];

export const NICHES = [
  'english',
  'fitness',
  'psychology',
  'finance',
  'marketing',
  'realestate',
  'creative',
  'other',
] as const;
export type Niche = (typeof NICHES)[number];

export const AUDIENCE_SIZES = ['<10k', '10-50k', '50-200k', '200k+'] as const;
export type AudienceSize = (typeof AUDIENCE_SIZES)[number];

export const PLATFORMS = ['instagram', 'telegram', 'youtube', 'tiktok'] as const;
export type Platform = (typeof PLATFORMS)[number];

/** Кастомная задача чеклиста, добавленная пользователем. */
export type CustomTask = { id: string; title: string };

/** Запись в истории смены статусов контакта. */
export type StatusHistoryEntry = { status: ContactStatus; at: string };

export type Checklist = Record<string, boolean>;

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
  niche: Niche | null;
  audience_size: AudienceSize | null;
  platform: Platform | null;
  status: ContactStatus;
  note: string | null;
  status_history: StatusHistoryEntry[];
  created_at: string;
  updated_at: string;
};

export type Offer = {
  id: string;
  user_id: string;
  title: string;
  niche: Niche | null;
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

export type XpTransaction = {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  once_key: string | null;
  created_at: string;
};

/**
 * То, что видит браузер. refresh_token сюда намеренно не входит: колоночные
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
      xp_transactions: Table<XpTransaction, 'user_id' | 'amount' | 'reason'>;
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

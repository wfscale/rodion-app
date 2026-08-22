// ---------------------------------------------------------------------------
// Доменные типы + типизация схемы Supabase
// ---------------------------------------------------------------------------

import type { ChatMessage } from '@/lib/conversation';

export type WakeQuality = 'easy' | 'normal' | 'hard';
export type Language = 'ru' | 'en';

/**
 * Статусы воронки. Порядок = порядок движения вперёд, поэтому им же
 * пользуются кнопки в карточке и уровни визуальной воронки.
 *
 * Статуса «Отказ» здесь нет намеренно: он дублировал «Ответил — отказ», а два
 * почти одинаковых слова в списке заставляли выбирать между ними каждый раз.
 * Отказ без ответа — это просто молчание, для него есть «Отправлено».
 *
 * «Удалил чат» — отдельный исход, а не разновидность блокировки. Человек не
 * закрывал дверь: он прочитал и убрал переписку с глаз. Писать туда больше
 * незачем ровно так же, но складывать это в «Заблокировал» значит завышать
 * себе долю резких отказов и делать выводы про офферы по кривым цифрам.
 */
export const CONTACT_STATUSES = [
  'not_sent',
  'sent',
  'read',
  'replied',
  'replied_no',
  'deleted_chat',
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
  deleted: 'deleted_chat',
  chat_deleted: 'deleted_chat',
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
  'deleted_chat',
  'blocked',
  'call',
  'closed',
];
/**
 * Исходы, после которых работа с человеком окончена.
 *
 * «Удалил чат» сюда входит: писать некуда. Но красным он не подсвечивается —
 * см. statusTone(): резкий отказ и молчаливое удаление переписки читаются
 * по-разному, и валить их в один цвет значит терять эту разницу.
 */
export const NEGATIVE_STATUSES: ContactStatus[] = ['replied_no', 'deleted_chat', 'blocked'];
/** Исходы, которые подсвечиваются красным: дверь закрыли в лицо. */
export const HARSH_STATUSES: ContactStatus[] = ['replied_no', 'blocked'];

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

/**
 * Этап проекта.
 *
 * id совпадает с шагом воронки продюсирования из lib/pipeline.ts — по нему
 * подтягивается название и подсказка. У добавленного вручную этапа id
 * случайный, и тогда работает сохранённый title.
 *
 * due — примерная дата, к которой этап должен закончиться. Именно примерная:
 * жёсткий срок на кастдевах, которые зависят от чужого расписания, — это
 * гарантированно просроченная задача и повод бросить план целиком.
 */
export type ProjectStage = { id: string; title: string; done: boolean; due?: string | null };

/** Активы эксперта на площадках. Пустое поле означает «не замеряли». */
export type ProjectAssets = {
  ig_followers?: number | null;
  ig_reach?: number | null;
  tg_subs?: number | null;
  tg_reach?: number | null;
};

/** Ключи активов в том порядке, в каком они показываются. */
export const ASSET_KEYS = ['ig_followers', 'ig_reach', 'tg_subs', 'tg_reach'] as const;
export type AssetKey = (typeof ASSET_KEYS)[number];

/**
 * Исход проекта.
 *
 * Этап живёт в stages, а не здесь: статус отвечает только на вопрос, чем
 * дело кончилось. 'lost' вместо удаления — иначе из истории пропадает сам
 * факт, что подход был, и кажется, будто работы было меньше, чем на самом деле.
 */
export const PROJECT_STATUSES = ['active', 'done', 'lost'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** Область задачи проекта: дневная поднимается в список дня, недельная — нет. */
export const TASK_SCOPES = ['day', 'week'] as const;
export type TaskScope = (typeof TASK_SCOPES)[number];

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

  /**
   * Щит и привал (migration-v7). Страховка серии закрытых дней:
   * заряды тратятся по одному на день, привал останавливает счёт целиком.
   */
  shield_charges: number;
  shield_progress: number;
  shield_date: string | null;
  shield_auto: boolean;
  pause_start: string | null;

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
  /**
   * Переписка целиком, в порядке сообщений. Лежит рядом с контактом, а не
   * отдельной таблицей: читается и пишется всегда вся сразу, а список
   * рассылок и без того грузится одним запросом.
   */
  conversation: ChatMessage[];
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

/**
 * Заготовка — готовое сообщение, которое отправляют не один раз.
 *
 * used_count здесь не статистика, а порядок: список сам всплывает тем, чем
 * реально пользуешься, и не превращается в архив, который надо разбирать.
 */
export type Snippet = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  used_count: number;
  last_used_at: string | null;
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
  status: ProjectStatus;
  stages: ProjectStage[];
  /** Дата запуска — конец проекта. */
  launch_date: string | null;
  /** Дата старта работы. */
  started_at: string | null;
  deal_amount: number;
  note: string | null;

  /** Куда вернуться, чтобы вспомнить, с кем работаешь. */
  instagram_url: string | null;
  telegram_url: string | null;

  /** Активы на входе и сегодня: «с чего начали — к чему пришли». */
  assets_start: ProjectAssets;
  assets_now: ProjectAssets;

  created_at: string;
  updated_at: string;
};

/**
 * Задача проекта.
 *
 * scope='day' + date=сегодня поднимает задачу в «Задачи дня» на главной:
 * работа по проекту и есть работа дня, и держать её в отдельном списке
 * значит гарантированно про неё забыть. Недельная остаётся внутри проекта —
 * иначе список дня перестаёт быть списком дня.
 */
export type ProjectTask = {
  id: string;
  user_id: string;
  project_id: string;
  text: string;
  scope: TaskScope;
  date: string | null;
  done: boolean;
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
      snippets: Table<Snippet, 'user_id' | 'title' | 'content'>;
      reminders: Table<Reminder, 'user_id' | 'title' | 'due_at'>;
      xp_transactions: Table<XpTransaction, 'user_id' | 'amount' | 'reason'>;
      activity_feed: Table<ActivityEntry, 'user_id' | 'type'>;
      daily_tasks: Table<DailyTask, 'user_id' | 'date' | 'text'>;
      projects: Table<Project, 'user_id' | 'expert_name'>;
      project_tasks: Table<ProjectTask, 'user_id' | 'project_id' | 'text'>;
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
      use_snippet: {
        Args: { p_id: string };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

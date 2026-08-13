import { NextResponse } from 'next/server';
import {
  createSpreadsheet,
  getGoogleConfig,
  refreshAccessToken,
  writeSheets,
  type SheetPayload,
} from '@/lib/google';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { DailyLog, Offer, OutreachContact } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Человекочитаемые статусы: в таблице их читает человек, а не машина. */
const STATUS_LABELS: Record<string, string> = {
  not_sent: 'Не отправлено',
  sent: 'Отправлено',
  read: 'Прочитал',
  replied: 'Ответил',
  replied_no: 'Ответил — отказ',
  refused: 'Отказ',
  blocked: 'Заблокировал',
  call: 'Созвон',
  closed: 'Закрыт',
};

/** Дней с касания на момент выгрузки. */
function daysSince(iso: string | null, today: string): number {
  if (!iso) return 0;
  const ms = new Date(`${today}T00:00:00Z`).getTime() - new Date(`${iso}T00:00:00Z`).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** Переносим данные пользователя в три листа таблицы. */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const config = getGoogleConfig();
  if (!config) {
    return NextResponse.json({ error: 'google not configured' }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'service key missing' }, { status: 500 });
  }

  const { data: integration } = await admin
    .from('google_integrations')
    .select('refresh_token, sheet_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!integration?.refresh_token) {
    return NextResponse.json({ error: 'not connected' }, { status: 400 });
  }

  const accessToken = await refreshAccessToken(config, integration.refresh_token);
  if (!accessToken) {
    await admin
      .from('google_integrations')
      .update({ last_sync_status: 'auth_failed' })
      .eq('user_id', user.id);
    return NextResponse.json({ error: 'google auth failed' }, { status: 401 });
  }

  // Таблицы может ещё не быть — создаём её при первой синхронизации.
  let sheetId = integration.sheet_id;
  if (!sheetId) {
    sheetId = await createSpreadsheet(accessToken, 'Твой рост — данные');
    if (!sheetId) {
      return NextResponse.json({ error: 'cannot create spreadsheet' }, { status: 500 });
    }
    await admin.from('google_integrations').update({ sheet_id: sheetId }).eq('user_id', user.id);
  }

  // Данные читаем обычным клиентом — RLS гарантирует, что это строки владельца.
  const [logsRes, contactsRes, offersRes] = await Promise.all([
    supabase.from('daily_logs').select('*').eq('user_id', user.id).order('date', { ascending: false }),
    supabase
      .from('outreach_contacts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase.from('offers').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const logs = (logsRes.data as DailyLog[]) ?? [];
  const contacts = (contactsRes.data as OutreachContact[]) ?? [];
  const offers = (offersRes.data as Offer[]) ?? [];

  const payloads: SheetPayload[] = [
    {
      title: 'Ежедневный лог',
      rows: [
        [
          'Дата',
          '% выполнения',
          'Лёг',
          'Встал',
          'Подъём',
          'Приём 1',
          'Что ел 1',
          'Приём 2',
          'Что ел 2',
          'Голодание',
          'Утренний комментарий',
          'Заметка дня',
        ],
        ...logs.map((log) => [
          log.date,
          log.completion_pct ?? 0,
          log.sleep_time ?? '',
          log.wake_time ?? '',
          log.wake_quality ?? '',
          log.meal_1_time ?? '',
          log.meal_1_note ?? '',
          log.meal_2_time ?? '',
          log.meal_2_note ?? '',
          log.fasting_ok ? 'да' : 'нет',
          log.morning_comment ?? '',
          log.day_comment ?? '',
        ]),
      ],
    },
    {
      title: 'Рассылки',
      rows: [
        [
          '№',
          'Статус',
          'Имя',
          'Telegram',
          'Ссылка Instagram',
          'Ниша',
          'Дата касания',
          'Дней с касания',
          'Оффер / Комментарий',
        ],
        // Нумерация по порядку добавления, поэтому идём от старых к новым.
        ...[...contacts]
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .map((contact, index) => [
            index + 1,
            STATUS_LABELS[contact.status] ?? contact.status,
            contact.name,
            contact.telegram_handle ? `@${contact.telegram_handle}` : '',
            contact.instagram_url ?? '',
            contact.niche ?? '',
            contact.first_contact_date ?? '',
            // Пересчитывается при каждой синхронизации, а не хранится.
            daysSince(contact.last_touch_at ?? contact.first_contact_date, today),
            contact.comment ?? '',
          ]),
      ],
    },
    {
      title: 'Офферы',
      rows: [
        ['Заголовок', 'Ниша', 'Результат', 'Создан', 'Разбор', 'Текст'],
        ...offers.map((offer) => [
          offer.title,
          offer.niche ?? '',
          offer.result,
          offer.created_at.slice(0, 10),
          offer.note ?? '',
          offer.content,
        ]),
      ],
    },
  ];

  const result = await writeSheets(accessToken, sheetId, payloads);
  const syncedAt = new Date().toISOString();

  await admin
    .from('google_integrations')
    .update({
      last_synced_at: result.ok ? syncedAt : null,
      last_sync_status: result.ok ? 'ok' : (result.error ?? 'error'),
    })
    .eq('user_id', user.id);

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'sync failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, syncedAt, sheetId });
}

import { NextResponse, type NextRequest } from 'next/server';
import webpush from 'web-push';
import { buildPush, type PushSlot } from '@/lib/push-messages';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Рассылка уведомлений по расписанию.
 *
 * Дёргается заданиями pg_cron внутри Supabase, а не Vercel Cron: на тарифе
 * Hobby крон запускается раз в сутки, а слотов четыре.
 *
 * Защищён общим секретом: маршрут публичный, и без него кто угодно мог бы
 * слать пуши от имени приложения.
 */

const SLOTS: PushSlot[] = ['morning', 'midday', 'evening', 'night'];

/** Локальная дата пользователя с учётом его часового пояса. */
function localDate(timezone: string, offsetDays = 0): string {
  const now = new Date();
  now.setDate(now.getDate() + offsetDays);
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now);
  } catch {
    // Некорректная зона в профиле не должна ронять рассылку всем остальным.
    return now.toISOString().slice(0, 10);
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 });
  }
  if (request.headers.get('x-cron-secret') !== secret) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const slot = new URL(request.url).searchParams.get('slot') as PushSlot | null;
  if (!slot || !SLOTS.includes(slot)) {
    return NextResponse.json({ error: 'bad slot' }, { status: 400 });
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return NextResponse.json({ error: 'VAPID keys not set' }, { status: 500 });
  }

  webpush.setVapidDetails('mailto:noreply@rodion-app.vercel.app', publicKey, privateKey);

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'service key missing' }, { status: 500 });

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, current_quota, quota_streak, timezone')
    .eq('push_enabled', true);

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, note: 'no subscribers' });
  }

  let delivered = 0;
  let skipped = 0;
  const stale: string[] = [];

  for (const profile of profiles) {
    const timezone = profile.timezone || 'Europe/Moscow';
    const today = localDate(timezone);
    const yesterday = localDate(timezone, -1);

    const [todayRes, yesterdayRes, subsRes] = await Promise.all([
      admin
        .from('outreach_contacts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('first_contact_date', today),
      admin
        .from('outreach_contacts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('first_contact_date', yesterday),
      admin.from('push_subscriptions').select('*').eq('user_id', profile.id),
    ]);

    const message = buildPush({
      slot,
      sent: todayRes.count ?? 0,
      quota: profile.current_quota ?? 5,
      sentYesterday: yesterdayRes.count ?? 0,
      quotaYesterday: profile.current_quota ?? 5,
      streak: profile.quota_streak ?? 0,
    });

    if (!message) {
      skipped += 1;
      continue;
    }

    for (const sub of subsRes.data ?? []) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(message),
        );
        delivered += 1;
      } catch (error) {
        // 404 и 410 означают, что подписка мертва: приложение удалили или
        // переустановили. Такие чистим, иначе они копятся навсегда.
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) stale.push(sub.endpoint);
      }
    }
  }

  if (stale.length > 0) {
    await admin.from('push_subscriptions').delete().in('endpoint', stale);
  }

  return NextResponse.json({ ok: true, slot, delivered, skipped, cleaned: stale.length });
}

import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Сохранить подписку устройства. */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await request.json()) as {
    endpoint?: string;
    p256dh?: string;
    auth?: string;
  };

  if (!body.endpoint || !body.p256dh || !body.auth) {
    return NextResponse.json({ error: 'bad subscription' }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'service key missing' }, { status: 500 });

  // Одно устройство = один endpoint. Повторная подписка обновляет ключи,
  // а не плодит строки: иначе одно уведомление приходило бы пачкой.
  const { error } = await admin.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: body.endpoint,
      p256dh: body.p256dh,
      auth: body.auth,
    },
    { onConflict: 'endpoint' },
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('profiles').update({ push_enabled: true }).eq('id', user.id);

  return NextResponse.json({ ok: true });
}

/** Отписать устройство. */
export async function DELETE(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await request.json()) as { endpoint?: string };
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'service key missing' }, { status: 500 });

  if (body.endpoint) {
    await admin.from('push_subscriptions').delete().eq('endpoint', body.endpoint);
  }

  // Отключаем флаг, только если у пользователя не осталось других устройств.
  const { count } = await admin
    .from('push_subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (!count) {
    await supabase.from('profiles').update({ push_enabled: false }).eq('id', user.id);
  }

  return NextResponse.json({ ok: true });
}

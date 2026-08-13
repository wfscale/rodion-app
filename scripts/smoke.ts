/**
 * Сквозная проверка на живой базе Supabase.
 *
 * Запуск: npm run smoke
 *
 * Что делает: заводит два временных аккаунта, прогоняет через них весь
 * рабочий сценарий (профиль, чеклист, XP, рассылки, офферы, заметки),
 * отдельно проверяет изоляцию данных между пользователями и защиту от
 * повторного начисления опыта. Свои строки за собой удаляет.
 *
 * Единственный след — две записи в auth.users: удалить их из браузера
 * может только владелец проекта (Authentication → Users), API-ключом
 * с правами publishable это не делается.
 */

import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { levelForXp } from '@/lib/xp';
import type { Database } from '@/lib/types';

/* -------------------------------------------------------------------------- */

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  ✗ ${name}\n      ожидалось ${e}, получено ${a}`);
  }
}

function ok(name: string, condition: boolean, detail = '') {
  check(name + (detail ? ` (${detail})` : ''), Boolean(condition), true);
}

function section(title: string) {
  console.log(`\n${title}`);
}

/* -------------------------------------------------------------------------- */

function readEnv(): { url: string; key: string } {
  let raw = '';
  try {
    raw = readFileSync('.env.local', 'utf8');
  } catch {
    console.error('Не найден .env.local в корне проекта.');
    process.exit(1);
  }

  const get = (name: string) => {
    const line = raw.split('\n').find((l) => l.startsWith(`${name}=`));
    return line ? line.slice(name.length + 1).trim() : '';
  };

  const url = get('NEXT_PUBLIC_SUPABASE_URL');
  const key = get('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  if (!url || url.includes('placeholder')) {
    console.error('NEXT_PUBLIC_SUPABASE_URL не задан (или всё ещё placeholder).');
    process.exit(1);
  }
  if (!key) {
    console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY не задан.');
    process.exit(1);
  }

  return { url, key };
}

type Client = SupabaseClient<Database>;

async function signUpTestUser(
  url: string,
  key: string,
  label: string,
): Promise<{ client: Client; id: string; email: string }> {
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const email = `smoke.${label}.${Date.now().toString(36)}@example.com`;
  const password = `Test-${Math.random().toString(36).slice(2)}!9`;

  const { data, error } = await client.auth.signUp({ email, password });

  if (error) {
    console.error(`\nНе удалось создать тестовый аккаунт: ${error.message}`);
    process.exit(1);
  }
  if (!data.session) {
    console.error(
      '\nПосле регистрации нет сессии — в Supabase всё ещё включено подтверждение email.\n' +
        'Authentication → Sign In / Providers → Email → выключить «Confirm email».',
    );
    process.exit(1);
  }

  return { client, id: data.user!.id, email };
}

/* -------------------------------------------------------------------------- */

async function main() {
  const { url, key } = readEnv();
  console.log(`База: ${url}`);
  console.log(`Ключ: ${key.slice(0, 22)}…\n${'─'.repeat(56)}`);

  const today = new Date().toISOString().slice(0, 10);

  /* ---------------------------------------------------------------- */
  section('Регистрация и автосоздание профиля');

  const a = await signUpTestUser(url, key, 'a');
  ok('аккаунт создан и сессия выдана', true, a.email);

  // Триггеру нужно мгновение.
  await new Promise((r) => setTimeout(r, 800));

  const { data: profile, error: profileError } = await a.client
    .from('profiles')
    .select('*')
    .eq('id', a.id)
    .maybeSingle();

  ok('профиль создан триггером', !profileError && Boolean(profile));
  if (profile) {
    check('стартовый XP', profile.total_xp, 0);
    check('стартовый уровень', profile.level, 1);
    check('стартовая квота', profile.current_quota, 5);
    check('серия квоты с нуля', profile.quota_streak, 0);
    check('язык по умолчанию', profile.language, 'ru');
  }

  /* ---------------------------------------------------------------- */
  section('Запись дня и процент выполнения');

  const checklist: Record<string, boolean> = { water: true, pushups: true };
  const counts = { pct: 33 };

  const { error: logError } = await a.client.from('daily_logs').upsert(
    {
      user_id: a.id,
      date: today,
      checklist,
      completion_pct: counts.pct,
      wake_quality: 'easy',
      fasting_ok: false,
    },
    { onConflict: 'user_id,date' },
  );

  ok('день сохранён', !logError, logError?.message ?? '');

  const { data: savedLog } = await a.client
    .from('daily_logs')
    .select('*')
    .eq('user_id', a.id)
    .eq('date', today)
    .maybeSingle();

  check('процент выполнения записан', savedLog?.completion_pct, counts.pct);
  check('чеклист сохранён как jsonb', savedLog?.checklist, checklist);

  // Повторный upsert не должен плодить строки — уникальность (user_id, date).
  await a.client
    .from('daily_logs')
    .upsert(
      { user_id: a.id, date: today, checklist, completion_pct: counts.pct },
      { onConflict: 'user_id,date' },
    );

  const { count: logCount } = await a.client
    .from('daily_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', a.id);

  check('повторное сохранение не создало дубль', logCount, 1);

  /* ---------------------------------------------------------------- */
  section('Начисление XP и защита от фарма');

  const first = await a.client.rpc('award_xp', {
    p_amount: 10,
    p_reason: 'task',
    p_once_key: `task:${today}:water`,
  });

  const firstResult = first.data as unknown as { awarded: number; total_xp: number };
  ok('первое начисление прошло', !first.error, first.error?.message ?? '');
  check('начислено 10 XP', firstResult?.awarded, 10);
  check('в профиле стало 10 XP', firstResult?.total_xp, 10);

  const second = await a.client.rpc('award_xp', {
    p_amount: 10,
    p_reason: 'task',
    p_once_key: `task:${today}:water`,
  });

  const secondResult = second.data as unknown as { awarded: number; total_xp: number };
  check('повтор с тем же ключом ничего не начислил', secondResult?.awarded, 0);
  check('итог не изменился', secondResult?.total_xp, 10);

  // Без ключа начисляется всегда — так работают, например, бонусы за действия.
  const third = await a.client.rpc('award_xp', {
    p_amount: 5,
    p_reason: 'task',
    p_once_key: null,
  });
  check('начисление без ключа проходит', (third.data as { awarded: number })?.awarded, 5);

  // Проверяем, что уровень пересчитался на стороне базы.
  const levelUp = await a.client.rpc('award_xp', {
    p_amount: 200,
    p_reason: 'test',
    p_once_key: `test:levelup:${Date.now()}`,
  });
  const levelResult = levelUp.data as unknown as { total_xp: number; level: number };
  check('уровень пересчитан в базе', levelResult?.level, levelForXp(levelResult?.total_xp ?? 0));
  ok('215 XP → всё ещё уровень 1 (порог 300)', levelResult?.level === 1, `total=${levelResult?.total_xp}`);

  const { count: txCount } = await a.client
    .from('xp_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', a.id);
  check('транзакций записано', txCount, 3);

  /* ---------------------------------------------------------------- */
  section('Рассылки, офферы, заметки');

  const { data: contact, error: contactError } = await a.client
    .from('outreach_contacts')
    .insert({
      user_id: a.id,
      name: '@smoke_expert',
      niche: 'fitness',
      audience_size: '10-50k',
      platform: 'instagram',
      status: 'sent',
      status_history: [{ status: 'sent', at: new Date().toISOString() }],
    })
    .select('*')
    .single();

  ok('контакт создан', !contactError, contactError?.message ?? '');
  check('статус по умолчанию', contact?.status, 'sent');

  await a.client
    .from('outreach_contacts')
    .update({ status: 'replied' })
    .eq('id', contact!.id);

  const { data: updatedContact } = await a.client
    .from('outreach_contacts')
    .select('status, created_at, updated_at')
    .eq('id', contact!.id)
    .single();

  check('статус обновлён', updatedContact?.status, 'replied');
  ok(
    'триггер обновил updated_at',
    new Date(updatedContact!.updated_at).getTime() >
      new Date(updatedContact!.created_at).getTime(),
  );

  const { data: offer, error: offerError } = await a.client
    .from('offers')
    .insert({
      user_id: a.id,
      title: 'Смоук-оффер',
      niche: 'fitness',
      content: 'Текст оффера для проверки.',
      result: 'replied',
      contact_id: contact!.id,
    })
    .select('*')
    .single();

  ok('оффер создан', !offerError, offerError?.message ?? '');
  check('оффер привязан к контакту', offer?.contact_id, contact!.id);

  const { data: note, error: noteError } = await a.client
    .from('notes')
    .insert({ user_id: a.id, content: 'Смоук-заметка', tag: 'idea' })
    .select('*')
    .single();

  ok('заметка создана', !noteError, noteError?.message ?? '');

  await new Promise((r) => setTimeout(r, 300));
  await a.client.from('notes').update({ content: 'Смоук-заметка изменена' }).eq('id', note!.id);

  const { data: editedNote } = await a.client
    .from('notes')
    .select('content, created_at, updated_at')
    .eq('id', note!.id)
    .single();

  check('текст заметки обновлён', editedNote?.content, 'Смоук-заметка изменена');
  ok(
    'дата изменения заметки обновилась',
    new Date(editedNote!.updated_at).getTime() > new Date(editedNote!.created_at).getTime(),
  );

  // Мягкое удаление — заметка уезжает в корзину, но не исчезает.
  await a.client
    .from('notes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', note!.id);

  const { data: trashed } = await a.client
    .from('notes')
    .select('deleted_at')
    .eq('id', note!.id)
    .single();

  ok('заметка в корзине, а не удалена', Boolean(trashed?.deleted_at));

  /* ---------------------------------------------------------------- */
  section('Изоляция данных между пользователями (RLS)');

  const b = await signUpTestUser(url, key, 'b');
  await new Promise((r) => setTimeout(r, 800));

  const { data: foreignLogs } = await b.client.from('daily_logs').select('*');
  check('чужие записи дня не видны', foreignLogs?.length ?? 0, 0);

  const { data: foreignContacts } = await b.client.from('outreach_contacts').select('*');
  check('чужие контакты не видны', foreignContacts?.length ?? 0, 0);

  const { data: foreignNotes } = await b.client.from('notes').select('*');
  check('чужие заметки не видны', foreignNotes?.length ?? 0, 0);

  const { data: foreignProfiles } = await b.client.from('profiles').select('*');
  check('виден только свой профиль', foreignProfiles?.length ?? 0, 1);

  const { data: foreignXp } = await b.client.from('xp_transactions').select('*');
  check('чужие начисления XP не видны', foreignXp?.length ?? 0, 0);

  // Попытка подделать user_id при вставке должна быть отклонена политикой.
  const { error: spoofError } = await b.client
    .from('notes')
    .insert({ user_id: a.id, content: 'Подделка' });
  ok('нельзя записать строку от чужого имени', Boolean(spoofError), spoofError?.code ?? '');

  // Попытка изменить чужой профиль не должна ничего затронуть.
  await b.client.from('profiles').update({ total_xp: 99999 }).eq('id', a.id);
  const { data: untouched } = await a.client
    .from('profiles')
    .select('total_xp')
    .eq('id', a.id)
    .single();
  ok('чужой профиль не изменён', untouched?.total_xp !== 99999, `xp=${untouched?.total_xp}`);

  /* ---------------------------------------------------------------- */
  section('Секрет Google не доступен браузерному ключу');

  const { error: tokenError } = await a.client
    .from('google_integrations')
    .select('refresh_token');

  ok('колонка refresh_token закрыта грантами', Boolean(tokenError), tokenError?.code ?? '');

  const { error: allowedError } = await a.client
    .from('google_integrations')
    .select('user_id, sheet_id, last_synced_at');

  ok('разрешённые колонки читаются', !allowedError, allowedError?.message ?? '');

  /* ---------------------------------------------------------------- */
  section('Уборка');

  for (const client of [a.client, b.client]) {
    const uid = client === a.client ? a.id : b.id;
    await client.from('offers').delete().eq('user_id', uid);
    await client.from('outreach_contacts').delete().eq('user_id', uid);
    await client.from('notes').delete().eq('user_id', uid);
    await client.from('daily_logs').delete().eq('user_id', uid);
    await client.from('xp_transactions').delete().eq('user_id', uid);
    await client.from('profiles').delete().eq('id', uid);
  }

  const { count: leftovers } = await a.client
    .from('daily_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', a.id);

  check('тестовые данные удалены', leftovers, 0);

  await a.client.auth.signOut();
  await b.client.auth.signOut();

  /* ---------------------------------------------------------------- */
  console.log(`\n${'─'.repeat(56)}`);
  console.log(`Пройдено: ${passed}   Провалено: ${failed}`);

  if (failed > 0) {
    console.log(`\nПровалились:\n${failures.map((f) => `  · ${f}`).join('\n')}`);
  }

  console.log(
    `\nОсталось убрать вручную: два аккаунта в Authentication → Users\n` +
      `  ${a.email}\n  ${b.email}`,
  );

  process.exit(failed > 0 ? 1 : 0);
}

void main();

import { NextResponse, type NextRequest } from 'next/server';
import { exchangeCode, fetchGoogleEmail, getGoogleConfig } from '@/lib/google';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Шаг 2 OAuth: меняем код на refresh_token и сохраняем его на сервере. */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const fail = (reason: string) =>
    NextResponse.redirect(`${origin}/settings?google=error&reason=${reason}`);

  if (searchParams.get('error')) return fail('denied');

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const expectedState = request.cookies.get('google_oauth_state')?.value;

  if (!code) return fail('no_code');
  if (!state || !expectedState || state !== expectedState) return fail('bad_state');

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.redirect(`${origin}/auth`);

  const config = getGoogleConfig();
  if (!config) return fail('not_configured');

  const admin = createAdminClient();
  if (!admin) return fail('no_service_key');

  const tokens = await exchangeCode(config, code);
  if (!tokens?.refresh_token) {
    // Google отдаёт refresh_token только при первом согласии. Если его нет —
    // доступ нужно отозвать в аккаунте Google и подключиться заново.
    return fail('no_refresh_token');
  }

  const email = await fetchGoogleEmail(tokens.access_token);

  const { error } = await admin.from('google_integrations').upsert(
    {
      user_id: user.id,
      refresh_token: tokens.refresh_token,
      google_email: email,
      connected_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (error) return fail('save_failed');

  const response = NextResponse.redirect(`${origin}/settings?google=connected`);
  response.cookies.delete('google_oauth_state');
  return response;
}

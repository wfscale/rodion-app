import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { buildConsentUrl, getGoogleConfig } from '@/lib/google';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Шаг 1 OAuth: отправляем пользователя на экран согласия Google. */
export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/auth`);
  }

  const config = getGoogleConfig();
  if (!config) {
    return NextResponse.redirect(`${origin}/settings?google=not_configured`);
  }

  // state защищает от CSRF: значение кладём в httpOnly-куку и сверяем в callback.
  const state = randomUUID();
  const response = NextResponse.redirect(buildConsentUrl(config, state));

  response.cookies.set('google_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });

  return response;
}

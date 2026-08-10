import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Обмен OAuth/PKCE-кода на сессию.
 *
 * Основной сценарий приложения — email + пароль, этот роут в нём не участвует.
 * Он нужен на случай, если в Supabase когда-нибудь включат подтверждение почты
 * или вход через провайдера: ссылка из письма приходит именно сюда.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth?error=callback`);
}

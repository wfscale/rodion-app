import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/auth'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Если переменные Supabase не заданы — не роняем приложение,
  // просто пропускаем запрос (страница /auth покажет понятную ошибку).
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getUser() обязателен: он обновляет истёкший access token и переписывает куки.
  // Если Supabase недоступен, считаем пользователя неавторизованным и уводим
  // на /auth — падать пятисоткой на каждом запросе приложение не должно.
  let user = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch {
    user = null;
  }

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  if (!user && !isPublic) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/auth';
    redirect.searchParams.set('next', path);
    return NextResponse.redirect(redirect);
  }

  if (user && path === '/auth') {
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/';
    redirect.search = '';
    return NextResponse.redirect(redirect);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Всё, кроме:
     *  — служебных файлов Next;
     *  — манифеста и картинок: их запрашивает система при установке ярлыка,
     *    без сессии, и редирект на /auth сломал бы иконку и standalone-режим;
     *  — OAuth-роутов Google: у них своя проверка сессии, редирект middleware
     *    оборвал бы callback.
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|api/google|api/push|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};

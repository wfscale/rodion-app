'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/types';

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * Supabase-клиент для браузера. Синглтон — один инстанс на всё приложение,
 * иначе слушатели onAuthStateChange дублируются.
 */
export function createClient() {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'Не заданы NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
        'Локально — добавь их в .env.local, на Vercel — в Settings → Environment Variables.',
    );
  }

  browserClient = createBrowserClient<Database>(url, key);
  return browserClient;
}

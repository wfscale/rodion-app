import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types';

/**
 * Клиент с service_role. Обходит RLS — использовать ТОЛЬКО на сервере
 * и только там, где нужен доступ к google_integrations.refresh_token.
 * Всегда фильтровать запросы по user_id вручную.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;

  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

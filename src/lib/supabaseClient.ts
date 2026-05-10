import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function readEnv(key: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string {
  const raw = import.meta.env[key];
  return typeof raw === 'string' ? raw.trim() : '';
}

/** True when both URL and anon key are non-empty (build-safe — missing env → false). */
export function isSupabaseConfigured(): boolean {
  return readEnv('VITE_SUPABASE_URL').length > 0 && readEnv('VITE_SUPABASE_ANON_KEY').length > 0;
}

let client: SupabaseClient | null | undefined;

/**
 * Lazily creates a single browser client, or returns null when env vars are absent.
 * Safe to call during `npm run build` / SSR-like contexts: no throw if unset.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (client === undefined) {
    client = createClient(readEnv('VITE_SUPABASE_URL'), readEnv('VITE_SUPABASE_ANON_KEY'), {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return client;
}

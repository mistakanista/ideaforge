// Supabase client, used for the login (VITE_AUTH_SOURCE=supabase) and later for the data (VITE_DATA_SOURCE=supabase).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/** One shared client per browser tab, so all parts of the app see the same session. */
export function getSupabaseClient(): SupabaseClient {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env to use Supabase.');
  }
  client = createClient(url, anonKey);
  return client;
}

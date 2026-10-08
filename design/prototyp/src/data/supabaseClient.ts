// Prepared for the later switch to Supabase (see README). Not used while VITE_DATA_SOURCE=mock.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function createSupabaseClient(): SupabaseClient {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env to use Supabase.');
  }
  return createClient(url, anonKey);
}

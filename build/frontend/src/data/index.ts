// Single entry point for data access. Pages import `repository` from here only.
import { mockRepository } from './mockRepository';
import type { IdeaRepository } from './repository';
import { supabaseRepository } from './supabaseRepository';

export { RuleViolation } from './repository';

const source = import.meta.env.VITE_DATA_SOURCE ?? 'mock';

function chooseRepository(): IdeaRepository {
  if (source === 'supabase') {
    // Row level security needs a signed-in Supabase user.
    if (import.meta.env.VITE_AUTH_SOURCE !== 'supabase') {
      throw new Error('VITE_DATA_SOURCE=supabase needs VITE_AUTH_SOURCE=supabase (see .env.example).');
    }
    return supabaseRepository;
  }
  return mockRepository;
}

export const repository: IdeaRepository = chooseRepository();

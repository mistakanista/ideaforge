// Single entry point for data access. Pages import `repository` from here only.
import { mockRepository } from './mockRepository';
import type { IdeaRepository } from './repository';

export { RuleViolation } from './repository';

const source = import.meta.env.VITE_DATA_SOURCE ?? 'mock';

function chooseRepository(): IdeaRepository {
  if (source === 'supabase') {
    // Next step: implement supabaseRepository.ts with getSupabaseClient() and return it here.
    throw new Error('The Supabase data source is not implemented yet. Set VITE_DATA_SOURCE=mock (see README).');
  }
  return mockRepository;
}

export const repository: IdeaRepository = chooseRepository();

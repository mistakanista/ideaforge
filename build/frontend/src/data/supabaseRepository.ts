// Data source for VITE_DATA_SOURCE=supabase (US-1): categories and ideas come from the database,
// where triggers and row level security enforce the rules (see build/supabase/migrations).
// Votes, reviewer scores, stage history, users and category changes have no tables yet; they are
// still taken from mockRepository, matched by idea_id and title (demo ideas 1-60 have the same ids).
import type { AppUser, Category, IdeaDetails, IdeaListItem } from '../types';
import { mockRepository } from './mockRepository';
import type { IdeaRepository } from './repository';
import { IDEA_COLUMNS, NO_VOTES, toAppError, toIdea, toListItem, type IdeaRow, type VoteInfo } from './supabaseMapping';
import { getSupabaseClient } from './supabaseClient';

const IDEA_WITH_NAMES = `${IDEA_COLUMNS}, category(name), submitter:app_user!idea_submitter_id_fkey(display_name)`;

/** Mock votes per idea_id; only used when the mock idea has the same title (same demo idea). */
async function mockVotes(viewer: AppUser): Promise<Map<number, IdeaListItem>> {
  const items = await mockRepository.listIdeas(viewer);
  return new Map(items.map((item) => [item.idea_id, item]));
}

function votesFor(row: IdeaRow, mock: Map<number, IdeaListItem>): VoteInfo {
  const item = mock.get(row.idea_id);
  return item && item.title === row.title ? { vote_count: item.vote_count, voted_by_me: item.voted_by_me } : NO_VOTES;
}

export const supabaseRepository: IdeaRepository = {
  async listIdeas(viewer) {
    // Row level security returns only the ideas the signed-in user may see (confidential rule).
    const { data, error } = await getSupabaseClient()
      .from('idea')
      .select(IDEA_WITH_NAMES)
      .order('created_at', { ascending: false })
      .returns<IdeaRow[]>();
    if (error) throw toAppError(error);
    const mock = await mockVotes(viewer);
    return data.map((row) => toListItem(row, votesFor(row, mock)));
  },

  async getIdeaDetails(ideaId, viewer): Promise<IdeaDetails | null> {
    const { data, error } = await getSupabaseClient()
      .from('idea')
      .select(IDEA_WITH_NAMES)
      .eq('idea_id', ideaId)
      .maybeSingle<IdeaRow>();
    if (error) throw toAppError(error);
    if (!data) return null; // not found, or not visible for the viewer (confidential)
    const row = data;
    const mock = await mockRepository.getIdeaDetails(ideaId, viewer);
    const sameIdea = mock !== null && mock.idea.title === row.title;
    return {
      idea: toListItem(row, sameIdea ? { vote_count: mock.idea.vote_count, voted_by_me: mock.idea.voted_by_me } : NO_VOTES),
      scorecards: sameIdea ? mock.scorecards : [],
      history: sameIdea ? mock.history : [],
    };
  },

  async createIdea(input) {
    // Submitter, office, stage and creation time are set by the database (trigger idea_check).
    const { data, error } = await getSupabaseClient()
      .from('idea')
      .insert({
        title: input.title.trim(),
        problem: input.problem.trim(),
        solution: input.solution.trim(),
        expected_impact: input.expected_impact.trim(),
        category_id: input.category_id,
        is_confidential: input.is_confidential,
      })
      .select(IDEA_COLUMNS)
      .single<IdeaRow>();
    if (error) throw toAppError(error);
    return toIdea(data);
  },

  async listCategories(): Promise<Category[]> {
    const { data, error } = await getSupabaseClient()
      .from('category')
      .select('category_id, name, description, sort_order, is_active')
      .order('sort_order')
      .returns<Category[]>();
    if (error) throw toAppError(error);
    return data;
  },

  // Not in the database yet: votes (US-4), users and roles in the app (US-5), category changes (US-5).
  toggleVote: (ideaId, user) => mockRepository.toggleVote(ideaId, user),
  listUsers: () => mockRepository.listUsers(),
  updateUserRole: (userId, role, actor) => mockRepository.updateUserRole(userId, role, actor),
  saveCategory: (input, actor) => mockRepository.saveCategory(input, actor),
  resetDemoData: () => mockRepository.resetDemoData(),
};

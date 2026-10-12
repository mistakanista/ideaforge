// Data source for VITE_DATA_SOURCE=supabase (US-1, US-3, US-4): categories, ideas, review scores,
// stage history and votes come from the database, where triggers and row level security enforce the
// rules (see build/supabase/migrations). The user list comes from app_user (US-5); role changes
// and category changes are still taken from mockRepository.
import type { AppUser, Category, IdeaDetails } from '../types';
import { mockRepository } from './mockRepository';
import type { IdeaRepository } from './repository';
import {
  IDEA_COLUMNS,
  TRANSITION_COLUMNS,
  USER_COLUMNS,
  toAppError,
  toIdea,
  toListItem,
  toReviewDetails,
  toVoteInfo,
  toAppUser,
  type IdeaRow,
  type TransitionRow,
  type UserRow,
} from './supabaseMapping';
import { getSupabaseClient } from './supabaseClient';

// Votes (user_id only) and review times are embedded, so vote count, "voted by me" and the
// last review time need no extra request.
const IDEA_WITH_NAMES =
  `${IDEA_COLUMNS}, category(name), submitter:app_user!idea_submitter_id_fkey(display_name), vote(user_id), ` +
  'idea_transition(created_at)';

/** The signed-in user's own app_user.user_id, which differs from the mock user id. */
async function ownUserId(): Promise<number | null> {
  const client = getSupabaseClient();
  const { data: auth } = await client.auth.getSession();
  if (!auth.session) return null;
  const { data, error } = await client
    .from('app_user')
    .select('user_id')
    .eq('auth_user_id', auth.session.user.id)
    .maybeSingle<{ user_id: number }>();
  if (error) throw toAppError(error);
  return data?.user_id ?? null;
}

export const supabaseRepository: IdeaRepository = {
  async listIdeas() {
    // Row level security returns only the ideas the signed-in user may see (confidential rule).
    const [{ data, error }, ownId] = await Promise.all([
      getSupabaseClient().from('idea').select(IDEA_WITH_NAMES).order('created_at', { ascending: false }).returns<IdeaRow[]>(),
      ownUserId(),
    ]);
    if (error) throw toAppError(error);
    return data.map((row) => toListItem(row, toVoteInfo(row.vote, ownId), ownId));
  },

  async getIdeaDetails(ideaId): Promise<IdeaDetails | null> {
    const client = getSupabaseClient();
    const [{ data, error }, transitions, ownId] = await Promise.all([
      client.from('idea').select(IDEA_WITH_NAMES).eq('idea_id', ideaId).maybeSingle<IdeaRow>(),
      // Row level security returns the history only if the viewer may see the idea.
      client.from('idea_transition').select(TRANSITION_COLUMNS).eq('idea_id', ideaId).returns<TransitionRow[]>(),
      ownUserId(),
    ]);
    if (error) throw toAppError(error);
    if (transitions.error) throw toAppError(transitions.error);
    if (!data) return null; // not found, or not visible for the viewer (confidential)
    const idea = toListItem(data, toVoteInfo(data.vote, ownId), ownId);
    return { idea, ...toReviewDetails(idea, transitions.data) };
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

  async reviewIdea(ideaId, input) {
    // Reviewer, previous stage and time are set by the database (trigger idea_transition_check),
    // which also checks the role, the own-idea rule and the stage order.
    const { error } = await getSupabaseClient()
      .from('idea_transition')
      .insert({
        idea_id: ideaId,
        to_stage: input.to_stage,
        reason: input.reason.trim() || null,
        score_impact: input.scores?.impact ?? null,
        score_cost: input.scores?.cost ?? null,
        score_feasibility: input.scores?.feasibility ?? null,
      });
    if (error) throw toAppError(error);
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

  async toggleVote(ideaId) {
    // Take the vote back if there is one (RLS deletes only the viewer's own vote), otherwise vote.
    // The voter and the time are set by the database (trigger vote_check), which also rejects votes
    // on the own idea and on confidential ideas.
    const client = getSupabaseClient();
    const ownId = await ownUserId();
    if (ownId === null) throw toAppError({ code: '42501', message: 'not signed in' });
    const removed = await client.from('vote').delete().eq('idea_id', ideaId).eq('user_id', ownId).select('idea_id');
    if (removed.error) throw toAppError(removed.error);
    if (removed.data.length > 0) return;
    const { error } = await client.from('vote').insert({ idea_id: ideaId });
    if (error) throw toAppError(error);
  },

  async listUsers(): Promise<AppUser[]> {
    const { data, error } = await getSupabaseClient()
      .from('app_user')
      .select(USER_COLUMNS)
      .order('display_name')
      .returns<UserRow[]>();
    if (error) throw toAppError(error);
    return data.map(toAppUser);
  },

  // Not in the database yet (US-5, next steps): role changes and category changes.
  updateUserRole: (userId, role, actor) => mockRepository.updateUserRole(userId, role, actor),
  saveCategory: (input, actor) => mockRepository.saveCategory(input, actor),
  resetDemoData: () => mockRepository.resetDemoData(),
};

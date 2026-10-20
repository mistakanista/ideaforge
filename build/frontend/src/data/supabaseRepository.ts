// Data source for VITE_DATA_SOURCE=supabase (US-1, US-3, US-4): categories, ideas, review scores,
// stage history and votes come from the database, where triggers and row level security enforce the
// rules (see build/supabase/migrations). The user list and role changes use app_user (US-5); category
// changes use the category table (US-5); only the demo data reset is still taken from mockRepository.
import type { AppUser, Category, CommentItem, DigestEntry, IdeaDetails } from '../types';
import { mockRepository } from './mockRepository';
import { RuleViolation, type IdeaRepository } from './repository';
import {
  COMMENT_COLUMNS,
  IDEA_COLUMNS,
  TRANSITION_COLUMNS,
  USER_COLUMNS,
  CATEGORY_COLUMNS,
  toCategory,
  toCommentError,
  toCommentItem,
  toCategoryError,
  type CategoryRow,
  type CommentRow,
  toAppError,
  toIdea,
  toListItem,
  toReviewDetails,
  toVoteInfo,
  toAppUser,
  roleUpdateError,
  type IdeaRow,
  type TransitionRow,
  type UserRow,
} from './supabaseMapping';
import { getSupabaseClient } from './supabaseClient';

// Votes (user_id only), comment times and review times are embedded, so vote count, "voted by me",
// comment count, the last review time and the last activity need no extra request.
const IDEA_WITH_NAMES =
  `${IDEA_COLUMNS}, category(name), submitter:app_user!idea_submitter_id_fkey(display_name), vote(user_id), comment(created_at), ` +
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
        is_anonymous: input.is_anonymous,
        resubmission_of: input.resubmission_of ?? null,
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
      .select(CATEGORY_COLUMNS)
      .order('sort_order')
      .returns<CategoryRow[]>();
    if (error) throw toAppError(error);
    return data.map(toCategory);
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

  async listComments(ideaId): Promise<CommentItem[]> {
    // Row level security returns the comments only if the viewer may see the idea.
    const [{ data, error }, ownId] = await Promise.all([
      getSupabaseClient()
        .from('comment')
        .select(COMMENT_COLUMNS)
        .eq('idea_id', ideaId)
        .order('created_at', { ascending: true })
        .order('comment_id', { ascending: true })
        .returns<CommentRow[]>(),
      ownUserId(),
    ]);
    if (error) throw toAppError(error);
    return data.map((row) => toCommentItem(row, ownId));
  },

  async addComment(input) {
    // The author and the time are set by the database (trigger comment_check), which also rejects
    // comments on confidential ideas and answers on another idea.
    const { error } = await getSupabaseClient()
      .from('comment')
      .insert({ idea_id: input.idea_id, parent_comment_id: input.parent_comment_id, body: input.body });
    if (error) throw toCommentError(error, 'add');
  },

  async deleteComment(commentId) {
    // Row level security lets only the author delete; the foreign key on parent_comment_id refuses
    // a comment that has answers (23503).
    const { data, error } = await getSupabaseClient().from('comment').delete().eq('comment_id', commentId).select('comment_id');
    if (error) throw toCommentError(error, 'delete');
    // Row level security hides rows silently: nothing deleted means not the author's comment.
    if (data.length === 0) throw new RuleViolation('You are not allowed to delete this comment.');
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

  // The acting admin is the signed-in user: the trigger app_user_check() sets role_changed_by/at
  // and enforces "admins only" and "last admin" (the actor argument is not needed here).
  async updateUserRole(userId, role) {
    const { data, error } = await getSupabaseClient()
      .from('app_user')
      .update({ role })
      .eq('user_id', userId)
      .select('user_id');
    if (error) throw toAppError(error);
    const notAllowed = roleUpdateError(data);
    if (notAllowed) throw notAllowed;
  },

  // Only admins may write (RLS); the database trims the texts and sets the sort order of a new category.
  async saveCategory(input): Promise<Category> {
    const fields = { name: input.name.trim(), description: input.description.trim(), is_active: input.is_active };
    if (!fields.name) throw new RuleViolation('Please enter a name.');
    const table = getSupabaseClient().from('category');
    const { data, error } =
      input.category_id === undefined
        ? await table.insert(fields).select(CATEGORY_COLUMNS).returns<CategoryRow[]>()
        : await table.update(fields).eq('category_id', input.category_id).select(CATEGORY_COLUMNS).returns<CategoryRow[]>();
    if (error) throw toCategoryError(error);
    // Row level security hides rows silently: no row back means "not allowed" or "not found".
    if (data.length === 0) throw new RuleViolation('You are not allowed to change this category.');
    return toCategory(data[0]);
  },

  // The database function checks the admin role, leaves out confidential and declined ideas and
  // hides the submitter of anonymous ideas (migration 20261021090000_digest_top_ideas.sql).
  async getDigest(asOf): Promise<DigestEntry[]> {
    const { data, error } = await getSupabaseClient().rpc('digest_top_ideas', { p_as_of: asOf });
    if (error) throw toAppError(error);
    return (data as DigestEntry[]).map((row) => ({ ...row, submitter_name: row.submitter_name ?? null }));
  },

  resetDemoData: () => mockRepository.resetDemoData(),
};

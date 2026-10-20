// Contract between the pages and the data source. The prototype uses mockRepository;
// a supabaseRepository implementing the same interface replaces it later (see README).
import type {
  AppUser,
  Category,
  CommentItem,
  CategoryInput,
  DigestEntry,
  DigestTestResult,
  Idea,
  IdeaDetails,
  IdeaListItem,
  NewCommentInput,
  NewIdeaInput,
  ReviewInput,
  UserRole,
} from '../types';

export interface IdeaRepository {
  /** All ideas the viewer may see (confidential ones only for submitter and reviewers). */
  listIdeas(viewer: AppUser): Promise<IdeaListItem[]>;
  /** Long texts, scores and stage history; null if not found or not visible for the viewer. */
  getIdeaDetails(ideaId: number, viewer: AppUser): Promise<IdeaDetails | null>;
  /** Stores a new idea in stage SUBMITTED for the given user. */
  createIdea(input: NewIdeaInput, submitter: AppUser): Promise<Idea>;
  /**
   * Reviewers only, never for their own idea: moves the idea to the next stage with scores,
   * or declines it with a reason (US-3).
   */
  reviewIdea(ideaId: number, input: ReviewInput, reviewer: AppUser): Promise<void>;
  /** One vote per person and idea: adds the vote or takes it back. */
  toggleVote(ideaId: number, user: AppUser): Promise<void>;

  /** All comments and answers of an idea, oldest first; empty if the idea is not visible for the viewer. */
  listComments(ideaId: number, viewer: AppUser): Promise<CommentItem[]>;

  /** Adds a comment, or an answer when parent_comment_id is set; author and time are set by the data source. */
  addComment(input: NewCommentInput, author: AppUser): Promise<void>;

  /** The author only, and only while nobody has answered the comment. */
  deleteComment(commentId: number, actor: AppUser): Promise<void>;

  listUsers(): Promise<AppUser[]>;
  /** Admins only; the last active admin cannot be downgraded. */
  updateUserRole(userId: number, role: UserRole, actor: AppUser): Promise<void>;

  listCategories(): Promise<Category[]>;
  /** Admins only; adds a category when category_id is missing, otherwise updates it. */
  saveCategory(input: CategoryInput, actor: AppUser): Promise<Category>;

  /**
   * Admins only: the 5 best ideas of the 31 days before the simulated day `asOf` (YYYY-MM-DD),
   * by review ratings plus votes (US-12). No confidential or declined ideas.
   */
  getDigest(asOf: string, actor: AppUser): Promise<DigestEntry[]>;

  /**
   * Admins only: sends the digest test email for the simulated day `asOf` if it is the first working
   * day of its month (US-12); otherwise nothing is sent.
   */
  sendDigestTest(asOf: string, actor: AppUser): Promise<DigestTestResult>;

  /** Prototype only: restore the demo data. */
  resetDemoData(): Promise<void>;
}

/** Error with a message that can be shown to the user as is. */
export class RuleViolation extends Error {}

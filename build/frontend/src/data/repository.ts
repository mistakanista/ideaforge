// Contract between the pages and the data source. The prototype uses mockRepository;
// a supabaseRepository implementing the same interface replaces it later (see README).
import type {
  AppUser,
  Category,
  CategoryInput,
  Idea,
  IdeaDetails,
  IdeaListItem,
  NewIdeaInput,
  UserRole,
} from '../types';

export interface IdeaRepository {
  /** All ideas the viewer may see (confidential ones only for submitter and reviewers). */
  listIdeas(viewer: AppUser): Promise<IdeaListItem[]>;
  /** Long texts, scores and stage history; null if not found or not visible for the viewer. */
  getIdeaDetails(ideaId: number, viewer: AppUser): Promise<IdeaDetails | null>;
  /** Stores a new idea in stage SUBMITTED for the given user. */
  createIdea(input: NewIdeaInput, submitter: AppUser): Promise<Idea>;
  /** One vote per person and idea: adds the vote or takes it back. */
  toggleVote(ideaId: number, user: AppUser): Promise<void>;

  listUsers(): Promise<AppUser[]>;
  /** Admins only; the last active admin cannot be downgraded. */
  updateUserRole(userId: number, role: UserRole, actor: AppUser): Promise<void>;

  listCategories(): Promise<Category[]>;
  /** Admins only; adds a category when category_id is missing, otherwise updates it. */
  saveCategory(input: CategoryInput, actor: AppUser): Promise<Category>;

  /** Prototype only: restore the demo data. */
  resetDemoData(): Promise<void>;
}

/** Error with a message that can be shown to the user as is. */
export class RuleViolation extends Error {}

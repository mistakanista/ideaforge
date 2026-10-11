// Types mirror the tables of design/DataModel/V2-StammdatenIntegriert (snake_case like the database),
// so the mock data layer can later be replaced by Supabase without touching the pages.

export type UserRole = 'STAFF' | 'REVIEWER' | 'ADMIN';

export type IdeaStage = 'SUBMITTED' | 'UNDER_REVIEW' | 'PILOTING' | 'IMPLEMENTED' | 'DECLINED';

export type OfficeCode = 'BRISTOL' | 'LEEDS' | 'GLASGOW';

export interface AppUser {
  user_id: number;
  email: string;
  display_name: string;
  office: OfficeCode;
  role: UserRole;
  role_changed_by: number | null;
  role_changed_at: string | null;
  is_active: boolean;
}

export interface Category {
  category_id: number;
  name: string;
  description: string;
  sort_order: number;
  is_active: boolean;
}

export interface Idea {
  idea_id: number;
  title: string;
  problem: string;
  solution: string;
  expected_impact: string;
  category_id: number;
  submitter_id: number;
  current_stage: IdeaStage;
  /** Added to data model V2 in migration 20261010192020_idea.sql (visible only to the submitter and reviewers). */
  is_confidential: boolean;
  resubmission_of: number | null;
  created_at: string;
}

export interface IdeaStageHistory {
  history_id: number;
  idea_id: number;
  from_stage: IdeaStage | null;
  to_stage: IdeaStage;
  changed_by: number;
  reason: string;
  changed_at: string;
}

export interface Vote {
  idea_id: number;
  user_id: number;
  created_at: string;
}

export interface IdeaScore {
  idea_id: number;
  reviewer_id: number;
  criterion_id: number;
  score: number;
  remark: string | null;
}

/** Idea as shown in the dashboard list (joined with category, submitter and vote count). */
export interface IdeaListItem extends Idea {
  category_name: string;
  submitter_name: string;
  office: OfficeCode;
  vote_count: number;
  voted_by_me: boolean;
  /** The viewer submitted this idea (set by the repository, since mock and database user ids differ). */
  submitted_by_me: boolean;
  /** Time of the latest review (stage change or decline); null if the idea was never reviewed. */
  last_reviewed_at: string | null;
}

/**
 * One row of the "Review scores" table. Mock data: one card per reviewer.
 * Supabase (table idea_transition): one card per scored move, with its stage and date.
 */
export interface ReviewerScorecard {
  /** Unique within one idea (React key). */
  key: string;
  reviewer_id: number;
  reviewer_name: string;
  /** Scores by criterion_id of SCORING_CRITERIA. */
  scores: Record<number, number>;
  /** Stage the idea was moved to with this review (Supabase only). */
  to_stage?: IdeaStage;
  reviewed_at?: string;
}

export interface StageHistoryEntry extends IdeaStageHistory {
  changed_by_name: string;
}

/** Everything shown after a click on "Details". */
export interface IdeaDetails {
  idea: IdeaListItem;
  scorecards: ReviewerScorecard[];
  history: StageHistoryEntry[];
}

export interface NewIdeaInput {
  title: string;
  problem: string;
  solution: string;
  expected_impact: string;
  category_id: number;
  is_confidential: boolean;
}

export interface CategoryInput {
  category_id?: number;
  name: string;
  description: string;
  is_active: boolean;
}

/** The three review scores (1–5, 5 = best / least cost). */
export interface ReviewScores {
  impact: number;
  cost: number;
  feasibility: number;
}

/**
 * A review = one move of an idea (table idea_transition, US-3). Moves to the next stage need scores,
 * a decline needs a reason and may have scores (all three or none).
 */
export interface ReviewInput {
  to_stage: IdeaStage;
  reason: string;
  scores: ReviewScores | null;
}

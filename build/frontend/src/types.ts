// Types mirror the tables of design/DatenModel/V2-StammdatenIntegriert (snake_case like the database),
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
  /** Not yet part of data model V2, see README "Open points". */
  is_confidential: boolean;
  resubmission_of: number | null;
  attempt_no: 1 | 2;
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
}

export interface ReviewerScorecard {
  reviewer_id: number;
  reviewer_name: string;
  scores: Record<number, number>;
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

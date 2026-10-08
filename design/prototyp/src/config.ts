// Display values for codes the database knows (counterpart of design/DatenModel/V2-StammdatenIntegriert/ideaforge.properties).
// Labels can be changed here without touching data or logic.
import type { IdeaStage, OfficeCode, UserRole } from './types';

export interface StageConfig {
  code: IdeaStage;
  label: string;
  color: string;
  description: string;
}

/** Order = pipeline order. */
export const STAGES: StageConfig[] = [
  { code: 'SUBMITTED', label: 'Submitted', color: '#4B5563', description: 'Colleagues can see and back it.' },
  { code: 'UNDER_REVIEW', label: 'Reviewing', color: '#1B2A41', description: 'Reviewers score impact, cost and feasibility.' },
  { code: 'PILOTING', label: 'Piloting', color: '#B9470C', description: 'The idea is tried out on a small scale.' },
  { code: 'IMPLEMENTED', label: 'Implemented', color: '#15803D', description: 'The idea is part of how we work.' },
  { code: 'DECLINED', label: 'Declined', color: '#B91C1C', description: 'Not taken forward. The reason is always shown.' },
];

export const STAGE_BY_CODE = Object.fromEntries(STAGES.map((s) => [s.code, s])) as Record<IdeaStage, StageConfig>;

export const ROLE_LABELS: Record<UserRole, string> = {
  STAFF: 'Staff',
  REVIEWER: 'Reviewer',
  ADMIN: 'Admin',
};

export const OFFICES: { code: OfficeCode; label: string }[] = [
  { code: 'BRISTOL', label: 'Bristol' },
  { code: 'LEEDS', label: 'Leeds' },
  { code: 'GLASGOW', label: 'Glasgow' },
];

export const OFFICE_LABELS = Object.fromEntries(OFFICES.map((o) => [o.code, o.label])) as Record<OfficeCode, string>;

/** Rows of table scoring_criterion. Every score is 1–5, higher is always better. */
export const SCORING_CRITERIA = [
  { criterion_id: 1, code: 'COST', name: 'Costs', hint: '5 = lowest cost' },
  { criterion_id: 2, code: 'FEASIBILITY', name: 'Feasibility', hint: '5 = easy to do' },
  { criterion_id: 3, code: 'IMPACT', name: 'Impact', hint: '5 = high impact' },
] as const;

export const MIN_SCORE = 1;
export const MAX_SCORE = 5;

export const PAGE_SIZES = [10, 20, 50] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 10;

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

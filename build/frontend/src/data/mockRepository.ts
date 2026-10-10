// Prototype data source: keeps the demo database in localStorage (falls back to memory)
// and enforces the same rules the database triggers will enforce later.
import { canSeeIdea } from '../lib/ideaQuery';
import { upsertUserByEmail, type SessionProfile } from '../lib/sessionUser';
import type { AppUser, Category, Idea, IdeaDetails, IdeaListItem, ReviewerScorecard } from '../types';
import { RuleViolation, type IdeaRepository } from './repository';
import { createSeed, type Database } from './seed';

const STORAGE_KEY = 'ideaforge-prototype-db-v1';

let memory: Database | null = null;

function load(): Database {
  if (memory) return memory;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      memory = JSON.parse(stored) as Database;
      return memory;
    }
  } catch {
    // Storage blocked or corrupt: start from the seed.
  }
  memory = createSeed();
  save(memory);
  return memory;
}

function save(db: Database): void {
  memory = db;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Storage not available: keep the data in memory for this session.
  }
}

/** VITE_AUTH_SOURCE=supabase: store the signed-in user in the mock data (see lib/sessionUser.ts). */
export function syncMockUser(profile: SessionProfile): AppUser {
  const db = load();
  const result = upsertUserByEmail(db.users, profile);
  save({ ...db, users: result.users });
  return result.user;
}

function nextId<T>(rows: T[], getId: (row: T) => number): number {
  return rows.reduce((max, row) => Math.max(max, getId(row)), 0) + 1;
}

function requireAdmin(db: Database, actor: AppUser): void {
  const current = db.users.find((u) => u.user_id === actor.user_id);
  if (!current || current.role !== 'ADMIN' || !current.is_active) {
    throw new RuleViolation('Only admins can do this.');
  }
}

function toListItem(db: Database, idea: Idea, viewer: AppUser): IdeaListItem {
  const submitter = db.users.find((u) => u.user_id === idea.submitter_id);
  const category = db.categories.find((c) => c.category_id === idea.category_id);
  const votes = db.votes.filter((v) => v.idea_id === idea.idea_id);
  return {
    ...idea,
    category_name: category?.name ?? 'Unknown',
    submitter_name: submitter?.display_name ?? 'Unknown',
    office: submitter?.office ?? 'BRISTOL',
    vote_count: votes.length,
    voted_by_me: votes.some((v) => v.user_id === viewer.user_id),
  };
}

function userName(db: Database, userId: number): string {
  return db.users.find((u) => u.user_id === userId)?.display_name ?? 'Unknown';
}

export const mockRepository: IdeaRepository = {
  async listIdeas(viewer) {
    const db = load();
    return db.ideas.filter((idea) => canSeeIdea(idea, viewer)).map((idea) => toListItem(db, idea, viewer));
  },

  async getIdeaDetails(ideaId, viewer): Promise<IdeaDetails | null> {
    const db = load();
    const idea = db.ideas.find((i) => i.idea_id === ideaId);
    if (!idea || !canSeeIdea(idea, viewer)) return null;

    const byReviewer = new Map<number, ReviewerScorecard>();
    for (const score of db.scores.filter((s) => s.idea_id === ideaId)) {
      const card = byReviewer.get(score.reviewer_id) ?? {
        reviewer_id: score.reviewer_id,
        reviewer_name: userName(db, score.reviewer_id),
        scores: {},
      };
      card.scores[score.criterion_id] = score.score;
      byReviewer.set(score.reviewer_id, card);
    }

    const history = db.history
      .filter((h) => h.idea_id === ideaId)
      .sort((a, b) => b.changed_at.localeCompare(a.changed_at) || b.history_id - a.history_id)
      .map((h) => ({ ...h, changed_by_name: userName(db, h.changed_by) }));

    return { idea: toListItem(db, idea, viewer), scorecards: [...byReviewer.values()], history };
  },

  async createIdea(input, submitter) {
    const db = load();
    const fields = [input.title, input.problem, input.solution, input.expected_impact];
    if (fields.some((f) => !f.trim())) throw new RuleViolation('Please fill in all required fields.');
    const category = db.categories.find((c) => c.category_id === input.category_id);
    if (!category || !category.is_active) throw new RuleViolation('Please choose an active category.');

    const now = new Date().toISOString();
    const idea: Idea = {
      idea_id: nextId(db.ideas, (i) => i.idea_id),
      title: input.title.trim(),
      problem: input.problem.trim(),
      solution: input.solution.trim(),
      expected_impact: input.expected_impact.trim(),
      category_id: input.category_id,
      submitter_id: submitter.user_id,
      current_stage: 'SUBMITTED',
      is_confidential: input.is_confidential,
      resubmission_of: null,
      attempt_no: 1,
      created_at: now,
    };
    db.ideas.push(idea);
    db.history.push({
      history_id: nextId(db.history, (h) => h.history_id),
      idea_id: idea.idea_id,
      from_stage: null,
      to_stage: 'SUBMITTED',
      changed_by: submitter.user_id,
      reason: 'Idea submitted.',
      changed_at: now,
    });
    save(db);
    return idea;
  },

  async toggleVote(ideaId, user) {
    const db = load();
    const idea = db.ideas.find((i) => i.idea_id === ideaId);
    if (!idea || !canSeeIdea(idea, user)) throw new RuleViolation('This idea is not available.');
    const existing = db.votes.findIndex((v) => v.idea_id === ideaId && v.user_id === user.user_id);
    if (existing >= 0) db.votes.splice(existing, 1);
    else db.votes.push({ idea_id: ideaId, user_id: user.user_id, created_at: new Date().toISOString() });
    save(db);
  },

  async listUsers() {
    return [...load().users].sort((a, b) => a.display_name.localeCompare(b.display_name));
  },

  async updateUserRole(userId, role, actor) {
    const db = load();
    requireAdmin(db, actor);
    const user = db.users.find((u) => u.user_id === userId);
    if (!user) throw new RuleViolation('User not found.');
    if (user.role === role) return;
    const activeAdmins = db.users.filter((u) => u.role === 'ADMIN' && u.is_active);
    if (user.role === 'ADMIN' && activeAdmins.length === 1) {
      throw new RuleViolation('The last active admin cannot be downgraded.');
    }
    user.role = role;
    user.role_changed_by = actor.user_id;
    user.role_changed_at = new Date().toISOString();
    save(db);
  },

  async listCategories() {
    return [...load().categories].sort((a, b) => a.sort_order - b.sort_order);
  },

  async saveCategory(input, actor): Promise<Category> {
    const db = load();
    requireAdmin(db, actor);
    const name = input.name.trim();
    if (!name) throw new RuleViolation('Please enter a name.');
    const duplicate = db.categories.some(
      (c) => c.name.toLowerCase() === name.toLowerCase() && c.category_id !== input.category_id,
    );
    if (duplicate) throw new RuleViolation('A category with this name already exists.');

    if (input.category_id === undefined) {
      const category: Category = {
        category_id: nextId(db.categories, (c) => c.category_id),
        name,
        description: input.description.trim(),
        sort_order: nextId(db.categories, (c) => c.sort_order),
        is_active: input.is_active,
      };
      db.categories.push(category);
      save(db);
      return category;
    }

    const category = db.categories.find((c) => c.category_id === input.category_id);
    if (!category) throw new RuleViolation('Category not found.');
    category.name = name;
    category.description = input.description.trim();
    category.is_active = input.is_active;
    save(db);
    return category;
  },

  async resetDemoData() {
    save(createSeed());
  },
};

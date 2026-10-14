import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { canImprove } from '../lib/resubmitRules';
import { OFFICE_LABELS, STAGES } from '../config';
import { repository, RuleViolation } from '../data';
import { useCurrentUser } from '../session/CurrentUser';
import type { Category, IdeaListItem } from '../types';

interface FormState {
  title: string;
  problem: string;
  solution: string;
  expected_impact: string;
  category_id: string;
  is_confidential: boolean;
  is_anonymous: boolean;
}

type FieldName = Exclude<keyof FormState, 'is_confidential' | 'is_anonymous'>;

const EMPTY: FormState = { title: '', problem: '', solution: '', expected_impact: '', category_id: '', is_confidential: false, is_anonymous: false };

const TITLE_MAX = 120;

function validate(form: FormState): Partial<Record<FieldName, string>> {
  const errors: Partial<Record<FieldName, string>> = {};
  if (!form.title.trim()) errors.title = 'Please enter a title.';
  else if (form.title.trim().length > TITLE_MAX) errors.title = `Please keep the title under ${TITLE_MAX} characters.`;
  if (!form.category_id) errors.category_id = 'Please choose a category.';
  if (!form.problem.trim()) errors.problem = 'Please describe the problem.';
  if (!form.solution.trim()) errors.solution = 'Please describe your proposed solution.';
  if (!form.expected_impact.trim()) errors.expected_impact = 'Please describe the expected impact.';
  return errors;
}

export function SubmitIdeaPage() {
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const improveId = Number(useSearchParams()[0].get('improve')) || null;
  const [original, setOriginal] = useState<IdeaListItem | null>(null);
  const [originalError, setOriginalError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void repository.listCategories().then((all) => setCategories(all.filter((c) => c.is_active)));
  }, []);

  // Second chance (US-6): load the declined idea into the form. The database checks the rules again.
  useEffect(() => {
    if (!improveId || !user) return;
    void repository.listIdeas(user).then((all) => {
      const found = all.find((i) => i.idea_id === improveId);
      if (!found || !canImprove(found, all.some((i) => i.resubmission_of === found.idea_id))) {
        setOriginalError('This idea cannot get a second chance.');
        return;
      }
      setOriginal(found);
      setForm({
        title: found.title,
        problem: found.problem,
        solution: found.solution,
        expected_impact: found.expected_impact,
        category_id: String(found.category_id),
        is_confidential: found.is_confidential,
        is_anonymous: found.is_anonymous,
      });
    });
  }, [improveId, user]);

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [field]: value }));
    if (field !== 'is_confidential' && field !== 'is_anonymous') setErrors((e) => ({ ...e, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setFormError('Please check the highlighted fields.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await repository.createIdea({ ...form, category_id: Number(form.category_id), resubmission_of: original?.idea_id }, user);
      navigate('/dashboard', { state: { created: form.title.trim() } });
    } catch (err) {
      setFormError(err instanceof RuleViolation ? err.message : 'Something went wrong. Please try again.');
      setSaving(false);
    }
  }

  function fieldProps(field: FieldName) {
    return {
      id: field,
      value: form[field],
      'aria-invalid': errors[field] ? true : undefined,
      'aria-describedby': errors[field] ? `${field}-error` : `${field}-hint`,
    };
  }

  function errorText(field: FieldName) {
    return errors[field] ? (
      <p id={`${field}-error`} className="field-error">
        {errors[field]}
      </p>
    ) : null;
  }

  return (
    <>
      <p className="breadcrumb">
        <Link to="/dashboard">Browse</Link> / New idea
      </p>
      <h1>{improveId ? 'Improve your idea' : 'Submit an idea'}</h1>
      {original && (
        <p className="card notice" role="status">
          Second chance of: <strong>{original.title}</strong>. Change what you want to improve and submit it again.
        </p>
      )}
      {originalError && (
        <p className="form-error" role="alert">
          {originalError}
        </p>
      )}
      <p className="muted">Tell us what could work better and how. Reviewers read every submission.</p>

      <div className="submit-layout">
        <form className="card form" onSubmit={handleSubmit} noValidate>
          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}

          <div className="field">
            <label htmlFor="title">Title (required)</label>
            <input type="text" maxLength={TITLE_MAX + 20} {...fieldProps('title')} onChange={(e) => update('title', e.target.value)} />
            <p id="title-hint" className="hint">A short, clear name for your idea.</p>
            {errorText('title')}
          </div>

          <div className="field">
            <label htmlFor="category_id">Category (required)</label>
            <select {...fieldProps('category_id')} onChange={(e) => update('category_id', e.target.value)}>
              <option value="">Choose a category</option>
              {categories.map((c) => (
                <option key={c.category_id} value={c.category_id}>
                  {c.name}
                </option>
              ))}
            </select>
            <p id="category_id-hint" className="hint">
              {categories.find((c) => String(c.category_id) === form.category_id)?.description ?? 'Where does your idea fit best?'}
            </p>
            {errorText('category_id')}
          </div>

          <div className="field">
            <label htmlFor="problem">What problem does it solve? (required)</label>
            <textarea rows={4} {...fieldProps('problem')} onChange={(e) => update('problem', e.target.value)} />
            <p id="problem-hint" className="hint">Who is affected and how often?</p>
            {errorText('problem')}
          </div>

          <div className="field">
            <label htmlFor="solution">Your proposed solution (required)</label>
            <textarea rows={4} {...fieldProps('solution')} onChange={(e) => update('solution', e.target.value)} />
            <p id="solution-hint" className="hint">How would you fix it? Keep it practical.</p>
            {errorText('solution')}
          </div>

          <div className="field">
            <label htmlFor="expected_impact">Expected impact (required)</label>
            <textarea rows={3} {...fieldProps('expected_impact')} onChange={(e) => update('expected_impact', e.target.value)} />
            <p id="expected_impact-hint" className="hint">For example time saved per week, teams affected, cost avoided.</p>
            {errorText('expected_impact')}
          </div>

          <div className="field">
            <label className="checkbox checkbox-card">
              <input
                type="checkbox"
                checked={form.is_confidential}
                onChange={(e) => update('is_confidential', e.target.checked)}
              />
              <span>
                <strong>Confidential</strong>
                <span className="hint">Only you and the innovation panel (reviewers) can see this idea.</span>
              </span>
            </label>
          </div>

          <div className="field">
            <label className="checkbox checkbox-card">
              <input
                type="checkbox"
                checked={form.is_anonymous}
                onChange={(e) => update('is_anonymous', e.target.checked)}
              />
              <span>
                <strong>Submit anonymously</strong>
                <span className="hint">Other people do not see your name. You still find the idea under "My ideas".</span>
              </span>
            </label>
          </div>

          {user && (
            <p className="hint">
              Submitted as <strong>{user.display_name}</strong>, {OFFICE_LABELS[user.office]} office. Your name and office are
              stored with the idea automatically.
            </p>
          )}

          <div className="form-actions">
            <Link to="/dashboard" className="btn btn-secondary">
              Cancel
            </Link>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Submitting…' : 'Submit idea'}
            </button>
          </div>
        </form>

        <aside className="card side-info">
          <h2>What happens next</h2>
          <ol>
            {STAGES.map((s) => (
              <li key={s.code}>
                <strong>{s.label}</strong> – {s.description}
              </li>
            ))}
          </ol>
          <p className="hint">You are notified each time your idea moves. A declined idea can be improved and submitted once more.</p>
        </aside>
      </div>
    </>
  );
}

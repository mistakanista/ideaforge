import { useEffect, useState } from 'react';
import { RoleGuard } from '../components/RoleGuard';
import { formatDate } from '../config';
import { repository, RuleViolation } from '../data';
import { DIGEST_DAYS, DIGEST_SIZE, digestWindow } from '../lib/digest';
import { useCurrentUser } from '../session/CurrentUser';
import type { DigestEntry } from '../types';

function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function DigestContent() {
  const { user } = useCurrentUser();
  const [asOf, setAsOf] = useState(today);
  const [entries, setEntries] = useState<DigestEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !asOf) return;
    let current = true;
    setError(null);
    repository
      .getDigest(asOf, user)
      .then((rows) => current && setEntries(rows))
      .catch((err: unknown) => {
        if (!current) return;
        setEntries(null);
        setError(err instanceof RuleViolation ? err.message : 'Something went wrong. Please try again.');
      });
    return () => {
      current = false;
    };
  }, [asOf, user]);

  const window = asOf ? digestWindow(asOf) : null;

  return (
    <>
      <h1>Top ideas digest</h1>
      <p className="muted">
        The {DIGEST_SIZE} best ideas of the last {DIGEST_DAYS} days: all review scores of all reviewers plus the votes.
        Confidential and declined ideas are not listed. Only admins can see this page.
      </p>

      <section className="card" aria-labelledby="digest-date-heading">
        <h2 id="digest-date-heading">Simulated date</h2>
        <div className="field digest-date">
          <label htmlFor="digest-date">Date</label>
          <input id="digest-date" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </div>
        {window && (
          <p className="muted" aria-live="polite">
            Reviews from {formatDate(window.from)} to {formatDate(window.lastDay)} are counted.
          </p>
        )}
      </section>

      <section className="card" aria-labelledby="digest-top-heading">
        <h2 id="digest-top-heading">Top {DIGEST_SIZE} ideas</h2>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {!asOf && <p className="muted">Please choose a date.</p>}
        {asOf && !error && entries === null && <p className="muted">Loading…</p>}
        {asOf && entries !== null && entries.length === 0 && <p className="muted">No ideas were reviewed in this period.</p>}
        {asOf && entries !== null && entries.length > 0 && (
          <div className="table-wrap">
            <table className="admin-table digest-table">
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Idea</th>
                  <th scope="col">Category</th>
                  <th scope="col">Submitted by</th>
                  <th scope="col" className="num">Reviews</th>
                  <th scope="col" className="num">Rating points</th>
                  <th scope="col" className="num">Votes</th>
                  <th scope="col" className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, index) => (
                  <tr key={e.idea_id}>
                    <td>{index + 1}</td>
                    <th scope="row">
                      {e.title} <span className="muted small">(#{e.idea_id})</span>
                    </th>
                    <td>{e.category_name}</td>
                    <td>{e.submitter_name ?? 'Anonymous'}</td>
                    <td className="num">{e.review_count}</td>
                    <td className="num">{e.rating_sum}</td>
                    <td className="num">{e.vote_count}</td>
                    <td className="num">
                      <strong>{e.total}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export function DigestPage() {
  return (
    <RoleGuard roles={['ADMIN']}>
      <DigestContent />
    </RoleGuard>
  );
}

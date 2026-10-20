# CR-1 Monthly email digest

## description
a monthly email digest of the top ideas (by votes and by stage changes), sent to all staff. You'd like it on the first working day of each month. You have already told the team.

## CHANGE IMPACT NOTE
Change: The client wants a monthly email digest of the top ideas (by votes and by stage changes), sent to all staff on the first working day of each month.
Requested by: Client (T&R) · Date: 2026-10-20

## What it touches:

### Stories and criteria: 
New story US-12 (`requirements/UserStories/12-EmailDigest.md`). US-8 (Notify submitters) is reused for sending, not changed. Note: US-12 is narrower than CR-1 (admin page, simulated date, test mail only).

### Data: 
No new tables. One new read function `digest_top_ideas(as_of date)`; one new function `send_digest_test(as_of date)`; `email_log.transition_id` becomes nullable (a digest mail has no transition). New Vault setting `digest_test_recipient`.

### Screens: 
One new admin-only page "Top ideas digest" (date input, top-5 table, test mail button, status message) and one nav link for admins.

### Rules: 
Confidential ideas never appear. Anonymous ideas never show the submitter. Only admins see the page and call the functions. Declined ideas are excluded.

### Roles and permissions: 
ADMIN only (page guard plus check inside the database functions).

### Calculations: 
Score per idea = sum of impact, cost and feasibility of every scored review in the 31 days before the simulated date + current vote count. Top 5 by score, ties by older idea first.

### Tests: 
New pgTAP file for the digest functions, vitest tests for `src/lib/digest.ts`, existing suites must still pass (especially `idea_review_email_test.sql`, `idea_transition_test.sql`, `vote_test.sql`).

### Documents: 
US-12 criteria, buildLog, `build/supabase/README.md`, `design/DataModel/Implemented-Datamodel/dataModel.md`.

### Questions for the client:
1. CR-1 says "by votes and by stage changes". US-12 counts ratings and votes. Should stage changes get their own weight?
2. "First working day": Monday to Friday only, or also public holidays (which country/office)?
3. Should the real monthly mail go to all staff? This needs a scheduler (pg_cron) and real mail delivery for all addresses; not part of US-12.
4. "Last 31 days" or the previous calendar month?
5. Should declined ideas or ideas without a review be listed at all?
   Risk: Ranking differs between mock mode (newest review per reviewer only) and the database (every review). Leaking confidential ideas or anonymous names through a SECURITY DEFINER function; checked by pgTAP. Changing `email_log` could break the US-8 trigger; checked by re-running `idea_review_email_test.sql`.
   
### Decision: 
Do part of it. Build US-12 now (page, simulated date, test mail). The real scheduled send to all staff waits for answers to questions 1-4.

### Plan:
1. This note (done).
2. Database function `digest_top_ideas` + pgTAP tests.
3. Digest page: lib, repository method, page, route, nav link, tests.
4. Test email function (`send_digest_test`) + button on the page + pgTAP tests.
5. Docs, data model diagram, build log, tick US-12 criteria.
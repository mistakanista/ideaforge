# Supabase setup and local tests

Start a local copy of Supabase. npx supabase start starts the Supabase services (database, Auth API and so on) as Docker containers on your Mac. It’s a completely separate copy, so your cloud project is never touched.
Build the database from scratch. npx supabase db reset empties the local database and then applies, in order:
every file in supabase/migrations/ (creating tables, triggers, rules);
supabase/seed.sql (the 12 dummy users).
This is the same thing the cloud project does with the migrations, so errors show up here first.

Run the test files. Each file in supabase/tests/ is plain SQL with pgTAP checks.
Every check prints ok … or not ok … plus the reason.
Each file runs inside one transaction that is rolled back at the end, so the tests leave no data behind.
I send the file to the database container with docker exec … psql < file. The official shortcut npx supabase test db can’t read files from your Documents folder (a Docker/macOS access restriction), so I use this workaround.
Optionally, try a real login. A curl request to the local Auth API with email and password checks that a dummy user can really sign in.
Stop Supabase. npx supabase stop stops the containers so they don’t use memory or ports.
Doing it yourself, step by step
Once beforehand: start Docker Desktop and wait until it says it’s running. The first start downloads the Supabase images and takes a few minutes.

Open a terminal in the build folder. If you’re still in the forge-hello folder (this session’s working folder), go there first:

1. Start the local Supabase

At the end it prints the local URLs and keys. They’re only for your Mac; they’re not your cloud keys.

2. Rebuild the database with migrations and dummy users

Expected lines: Applying migration …_app_user.sql, …_login.sql, …_idea.sql, …_idea_transition.sql, …_idea_transition_decline_scores.sql, …_vote.sql, …_vote_no_confidential.sql, …_comment.sql, Seeding data from supabase/seed.sql, supabase/scripts/import_demo_ideas.sql, supabase/scripts/import_demo_transitions.sql, supabase/scripts/import_demo_votes.sql, supabase/scripts/import_demo_comments.sql.

3. Run the tests, one command per test file

How to read the output:

1..10 says 10 checks are planned;
each check prints ok 1 - …, ok 2 - … and so on;
a broken rule shows not ok 5 - … followed by # Failed test …, which says what was expected and what was found;
at the end, # Looks like you failed … appears only if something went wrong.
4. Optional: look at the data
   npx supabase start without the -x option also starts Studio, the local version of the dashboard, at http://127.0.0.1:54323. There you see auth.users, app_user, login_allowlist, category and idea like in the cloud.

5. Stop Supabase

Frontend tests
These need no Docker. In the build/frontend folder:

This runs the 15 unit tests for filters, sorting, visibility and pagination. Expected: Tests 15 passed.

Tip: if supabase start complains that a port is in use, another Supabase or app is using it. npx supabase stop fixes the first case; otherwise close the other app.

## Sending email (US-8, step 1)
The Edge Function `functions/send-email` sends one mail through Gmail (`nodemailer`, `smtp.gmail.com`, port 465, because Edge Functions block ports 25 and 587). Only addresses in `MAIL_REAL_RECIPIENTS` really receive it; every other address is only simulated (logged, nothing sent).
- Secrets: `EMAIL`, `EMAIL_PASSWORD` (Google app password), `MAIL_FUNCTION_SECRET` (callers send it in the header `x-mail-secret`), `MAIL_REAL_RECIPIENTS`. Locally in `functions/.env` (git-ignored, template `functions/.env.example`); in the cloud with `npx supabase secrets set NAME=value` or in the dashboard under Edge Functions, Secrets. Never in code.
- Local test, in `build/`: `npx supabase functions serve --env-file supabase/functions/.env`, then
  `curl -s -X POST http://127.0.0.1:54321/functions/v1/send-email -H "x-mail-secret: <secret>" -H "Content-Type: application/json" -d '{"to":"gernotschulmeister28@gmail.com","subject":"Test","text":"Hello"}'` returns `sent`; another address returns `simulated`; a wrong secret returns 401.
- Cloud deploy (not done by the GitHub integration): `npx supabase functions deploy send-email`.

## Review emails (US-8, step 2)
Migration `20261020203000_idea_review_email.sql`: after every review made through the API (not by imports or SQL scripts) the trigger `notify_submitter_after_review()` writes a row to `email_log` and asks the Edge Function `send-email` (through `pg_net`, asynchronous) to mail the submitter. The mail names the idea, the new stage, the scores or the decline reason, but not the reviewer. A problem with the mail never blocks the review. The function decides who really gets a mail (`MAIL_REAL_RECIPIENTS`) and sets the log status: `SENT`, `SIMULATED`, `FAILED`; `PENDING` means no answer yet, `NOT_CONFIGURED` means the settings below are missing. Only admins can read `email_log`.
- Settings per environment (once, in the SQL editor, not saved or committed): `scripts/set_mail_settings.sql` stores `mail_function_url`, `mail_function_secret` (same value as the function secret `MAIL_FUNCTION_SECRET`) and the optional `app_url` in the Vault. Local URL: `http://host.docker.internal:54321/functions/v1/send-email`.
- Redeploy the function after changes (it now also updates `email_log`): `npx supabase functions deploy send-email`.
- Locally `db reset` does not store these settings, so run the script again after a reset.
- Tests: `tests/idea_review_email_test.sql` (18).

## Tables (public schema)
- `app_user`, `login_allowlist`: users, roles and sign-in rules (US-0).
- `category`: the four idea categories, created by the migration (also in the cloud). Signed-in users can read them. Only admins can add categories and change name, description and `is_active` (migration `20261012193813_category_admin_write.sql`, US-5); categories are never deleted, only marked inactive, and `sort_order` and `category_id` cannot be changed through the API. The trigger trims name and description and puts a new category at the end of the list. Names stay unique, ignoring case. Tests: `tests/category_test.sql` (20).
- `idea` (US-1): the database sets submitter, office (copied from the submitter), stage `SUBMITTED` and `created_at` for every idea submitted through the API. A user without an office cannot submit. Confidential ideas are visible only to the submitter and the reviewers, not to admins. No updates or deletes through the API; the stage changes only through `idea_transition`. Second chance (US-6, migration `20261013200312_idea_resubmission.sql`): a new idea may set `resubmission_of` only to the submitter's own DECLINED idea, once; the original stays unchanged. Anonymous ideas (US-11, migration `20261014202404_idea_anonymous.sql`): `is_anonymous` is set when the idea is submitted, cannot be changed afterwards and can be combined with `is_confidential`; the submitter is still stored. Tests: `tests/idea_test.sql` (37).
- `idea_transition` (US-3): one row per stage change. A reviewer moves an idea by inserting a row with `idea_id` and `to_stage`, and the scores `score_impact`, `score_cost`, `score_feasibility` (1–5, 5 = best / least cost). Moves to the next stage need all three scores, and a `reason` is optional. A decline (`DECLINED`) needs a `reason`; scores are optional there, but all three or none (migration `20261011113410_idea_transition_decline_scores.sql`). The trigger sets `from_stage`, `changed_by` (signed-in user) and `created_at`, checks the rules (only active reviewers, never their own idea, no skipped stage, no way back, `IMPLEMENTED` and `DECLINED` are final) and updates `idea.current_stage`. A direct update of `idea.current_stage` is rejected. Everyone who can see the idea can read its history; no updates or deletes. `is_valid_transition(from, to)` can be called as RPC. Tests: `tests/idea_transition_test.sql` (39).
- `vote` (US-4): one vote per person per idea (primary key `idea_id, user_id`). A user votes by inserting a row with `idea_id`; the trigger sets `user_id` (signed-in user) and `created_at` and checks the rules: only active users, only on ideas they may see, never for their own idea, and never on a confidential idea (confidential ideas get no votes at all, migration `20261011141245_vote_no_confidential.sql`). All roles can vote, in every stage. Everyone who can see the idea can read its votes. A user takes a vote back by deleting their own row; no updates, and no deletes of other users' votes. Tests: `tests/vote_test.sql` (21).
- Demo ideas: `scripts/import_demo_ideas.sql` holds the same 60 ideas as the frontend mock data (ids 1–60, generated once from `frontend/src/data/seed.ts`). Locally it runs after `seed.sql` on every `db reset` (`sql_paths` in `config.toml`). In the cloud, run it once in the SQL editor after the idea migration and `import_dummy_users.sql`; it imports nothing if ideas already exist and stops if a demo user is missing. Checked by `tests/seed_test.sql`; run it first after `db reset`, because the other test files use up idea ids (identity values are not rolled back) and its check "next id 61" would then fail.
- Demo review history: `scripts/import_demo_transitions.sql` imports the 75 stage changes of the mock data (69 moves with scores, 6 declines with a reason) into `idea_transition` for 43 demo ideas. It was generated once from `frontend/src/data/seed.ts`; the mapping is described in the file header. Moves whose reviewer gave no scores in the mock data get the scores of another reviewer of the same idea. The ideas are set back to SUBMITTED and the history is replayed through the trigger rules, so every row is checked; at the end every idea must be in its original stage again. Locally it runs after `import_demo_ideas.sql` on every `db reset`. In the cloud, run it once in the SQL editor after the idea_transition migration and `import_demo_ideas.sql`; it imports nothing if transitions already exist, stops if a demo reviewer is missing or a demo idea was changed, and rolls back completely on any error. Checked by `tests/seed_test.sql`.
- `comment` (US-7): a comment on an idea or an answer to another comment (`parent_comment_id`, answers to answers allowed). The trigger sets `author_id` (signed-in user) and `created_at`, trims the text (1–2000 characters) and checks the rules: only active users, only on ideas they may see, never on a confidential idea (no comments at all), and an answer must belong to the same idea as its parent. Everyone who can see the idea can read its comments. No updates. An author deletes only their own comment; there is no `deleted_at`, and the foreign key on `parent_comment_id` (no cascade) makes the database refuse deleting a comment that has answers (error `23503`). Other tests that delete ideas must delete `comment` rows first. Tests: `tests/comment_test.sql` (21).
- Demo votes: `scripts/import_demo_votes.sql` imports 239 of the 269 mock votes on 50 demo ideas into `vote`. It was generated once from `frontend/src/data/seed.ts`. The 30 mock votes that break the rules (24 for the voter's own idea, 9 on confidential ideas, 3 of them both) are left out; the mapping is described in the file header. Every vote goes through the trigger rules. Locally it runs after `import_demo_transitions.sql` on every `db reset`. In the cloud, run it once in the SQL editor after the two vote migrations and `import_demo_ideas.sql`; it imports nothing if votes already exist, stops if a demo user is missing or inactive or a demo idea was changed, and rolls back completely on any error. Checked by `tests/seed_test.sql` (30).
- Demo comments: `scripts/import_demo_comments.sql` imports 22 hand-written comments (9 of them answers, one thread three levels deep) on the 7 demo ideas 1, 2, 3, 5, 8, 9 and 11 (none confidential or anonymous). The same list is `COMMENTS` in `frontend/src/data/seed.ts`; keep both in sync. Authors are looked up by email, `created_at` is fixed, and every comment goes through the trigger `comment_check()`. Locally it runs after `import_demo_votes.sql` on every `db reset`. In the cloud, run it once in the SQL editor after the comment migration and `import_demo_ideas.sql`; it imports nothing if comments already exist, stops if a demo user or idea is missing, and rolls back completely on any error. Checked by `tests/seed_test.sql` (30).
- Users who have ideas cannot be deleted (foreign key); deactivate them instead (`is_active = false`).

## Test login with curl
curl -s -X POST "https://owwdzjerddgavqjqxrru.supabase.co/auth/v1/token?grant_type=password" -H "apikey: <publishable key>" -H "Content-Type: application/json" -d '{"email":"daniel.okafor@tallis.uk","password":"tallis123"}'

## Known limitations
Decided on 2026-10-10: the Supabase Auth settings are left at their defaults (step 5 of US-0 was skipped), because the project is fictive.

1. **"Confirm email" is off.** The app has no sign-up form, but the Supabase sign-up API is reachable with the public publishable key. Someone could register a made-up `@tallis.uk` address with any password, and the allowlist only checks the domain. That person would get a working STAFF account.
   - Fix if needed: switch on *Authentication → Sign In / Providers → Email → Confirm email*. Nobody can receive mails at the fictive domain, so such accounts would stay unusable.
   - Imported users (already confirmed) and Google users are not affected by the switch.
2. **Minimum password length is 6 in Supabase.** The first-login page (`/welcome`) requires 8 characters, but only in the browser; via the API a user could set a 6-character password for their own account.
   - Fix if needed: set *Minimum password length* to 8 in the dashboard and `minimum_password_length = 8` in `config.toml`.
3. **Anonymous ideas are hidden by the app, not by the database.** `idea.submitter_id` is still part of every API response, so a signed-in user who inspects the network traffic could see who submitted an anonymous idea. Decided on 2026-10-14 for US-11; the app shows "Anonymous" to everyone except the submitter.
   - Fix if needed: lock the column for the API and expose the submitter only through a view that hides anonymous ideas of other users (RLS policies on `idea`, `vote` and `idea_transition` would then need a security-definer helper).

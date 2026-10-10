# IdeaForge: idea pipeline project instructions

## Purpose
Workflow for creating, scoring and implementing ideas

## Sources
- the clients brief in clientBriedIdeaPipeline.pdf
- all requirement related artefacts are stored in the requirement folder
- the requirements in requirements.md
- the user stories in the UserStories folder
- all design related artefacts are stored in the design folder
- the data models in the dataModel folder


## Users and roles
- all staff can create an idea and see the dashboard (besides confidential ideas)
- reviewer can decline and score ideas
- the admin can add categories and change the users role to reviewer

## Pathway and tools
- Github and Supabase
- local as fallback and for development

##Data
- Full model: see design/datModel.md

##Screens and design rules
- it should work on screens and phones
- signature color is T&R copper (`#B9470C`) for buttons and links
- T&R navy (`#1B2A41`) for headers
- Cloud grey (`#F4F5F7`) for backgrounds
- IBM Plex Sans font.
- large tap targets
- visible labels on every field
- good colour contrast
- never use colour alone to show status.

## Rules that must never break
- confidential ideas are only visible to the submitter and the reviewers
- a reviewer can never review his own ideas
- admins cannot review ideas
- only admins can access and edit the user and category page


## How to work with us
- Before changing anything, explain your plan
- Please always answer in the same language as the prompt (German or English)
- All artefacts, documents, comments and logs have to be in English
- Build one small feature at a time, and tell us how to check it works.
- Ask if something is unclear. Don't guess.
- Never add features that aren't in our requirements.
- After each change, update the build log in build/logs/buildLog.md.
- Please add also the time to the build log

## Project state and how to work (as of 2026-10-10)

### Folders
- `build/frontend`: the product frontend (Vite + React + TypeScript). Pages access data only through `repository` from `src/data/index.ts`; ideas are still mock data in `localStorage` (`src/data/mockRepository.ts`, `src/data/seed.ts`).
- `build/supabase`: database as code.
  - `migrations/`: applied automatically to the cloud project by the GitHub integration on push to `main`. Never edit an applied migration; every change is a new file (`npx supabase migration new <name>` in `build/`).
  - `tests/`: pgTAP rule tests.
  - `seed.sql`: local demo users only.
  - `scripts/import_dummy_users.sql`: run once by hand in the cloud SQL editor.
  - `README.md`: setup, tests and known limitations.
- `design/prototyp`: frozen click prototype. Do not change it.
- `build/logs/buildLog.md`: build log (date and time for each entry).

### Database (Supabase, project ref owwdzjerddgavqjqxrru)
- `app_user` is linked to `auth.users`. A new auth user gets an `app_user` row with role STAFF via `handle_new_user()`.
- Role rules and RLS are enforced in the database:
  - only admins change roles;
  - the last admin is protected;
  - users edit only their own name and office.
- Sign-in is restricted by the table `login_allowlist` (`@tallis.uk` plus single developer Gmail addresses), maintained in the SQL editor.
- `must_change_password` marks users with the initial password; a trigger clears it when the password really changes.
- Passwords live only in Supabase Auth (bcrypt). There is no password column.
- Demo users: `firstname.lastname@tallis.uk`, initial password `tallis123`.
  - 12 users from the prototype plus the client admin Dev Anand (ADMIN).
  - Reviewers: Ruth Evans, Tom Hallworth, Aisha Rahman.
  - Priya Shah is ADMIN locally, STAFF in the cloud.

### Login modes (`build/frontend/.env`)
- `VITE_AUTH_SOURCE=mock` (default): simulated user with the "Acting as" switcher (US-5).
- `VITE_AUTH_SOURCE=supabase`: real login on `/login` (Google or email/password).
  - Every page requires a session.
  - Users with `must_change_password` are sent to `/welcome` to set a new password.
  - The signed-in user is matched to the mock data by email (`src/lib/sessionUser.ts`).
- `VITE_DATA_SOURCE=supabase` is not implemented yet (no `supabaseRepository`).
- `.env.*` files are git-ignored. `npm run dev:localdb` uses `.env.localdb` for the local Supabase. The dev server runs on port 5800.

### How to test
- Frontend, in `build/frontend`: `npm run test` (unit tests) and `npm run build` (TypeScript check and build).
- Database, in `build/` with Docker Desktop running:
  1. `npx supabase start`
  2. `npx supabase db reset` (migrations and seed)
  3. run each test file: `docker exec -i supabase_db_build psql -U postgres -d postgres -q -t < supabase/tests/<file>.sql` (every line must say `ok`)
  4. `npx supabase stop`

  `npx supabase test db` does not work here, because Docker cannot read files from the Documents folder.
- Browser tests: only against the local Supabase (`npm run dev:localdb`). Never type passwords into the cloud project.

### User stories
- US-0 Login: in review.
- Open points:
  - Step 1b: ban deactivated users in Supabase Auth; today the app signs them out again.
  - Office selection or change after the first login (postponed).
  - Story text: the "password field" criterion is fulfilled by Supabase Auth; the proposed additional acceptance criteria are not added yet.
  - Supabase "Confirm email" and minimum password length are known limitations (`build/supabase/README.md`).
- Next candidates: `supabaseRepository` for ideas (`VITE_DATA_SOURCE=supabase`), the `idea` table with `is_confidential`, and the remaining user stories.
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

Expected lines: Applying migration …_app_user.sql, Applying migration …_login.sql, Seeding data from supabase/seed.sql.

3. Run the tests, one command per test file

How to read the output:

1..10 says 10 checks are planned;
each check prints ok 1 - …, ok 2 - … and so on;
a broken rule shows not ok 5 - … followed by # Failed test …, which says what was expected and what was found;
at the end, # Looks like you failed … appears only if something went wrong.
4. Optional: look at the data
   npx supabase start without the -x option also starts Studio, the local version of the dashboard, at http://127.0.0.1:54323. There you see auth.users, app_user and login_allowlist like in the cloud.

5. Stop Supabase

Frontend tests
These need no Docker. In the build/frontend folder:

This runs the 15 unit tests for filters, sorting, visibility and pagination. Expected: Tests 15 passed.

Tip: if supabase start complains that a port is in use, another Supabase or app is using it. npx supabase stop fixes the first case; otherwise close the other app.

## Test login with curl
curl -s -X POST "https://owwdzjerddgavqjqxrru.supabase.co/auth/v1/token?grant_type=password" -H "apikey: <publishable key>" -H "Content-Type: application/json" -d '{"email":"daniel.okafor@tallis.uk","password":"tallis123"}'
## Known limitations
Decided on 2026-10-10: the Supabase Auth settings are left at their defaults (step 5 of US-0 was skipped), because the project is fictive.

1. **"Confirm email" is off.** The app has no sign-up form, but the Supabase sign-up API is reachable with the public publishable key. Someone could register a made-up `@tallis.uk` address with any password, and the allowlist only checks the domain. That person would get a working STAFF account.
   - Fix if needed: switch on *Authentication → Sign In / Providers → Email → Confirm email*. Nobody can receive mails at the fictive domain, so such accounts would stay unusable.
   - Imported users (already confirmed) and Google users are not affected by the switch.
2. **Minimum password length is 6 in Supabase.** The first-login page (`/welcome`) requires 8 characters, but only in the browser; via the API a user could set a 6-character password for their own account.
   - Fix if needed: set *Minimum password length* to 8 in the dashboard and `minimum_password_length = 8` in `config.toml`.

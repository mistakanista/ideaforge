# idea forge build log summary per day

## 09.10.2026 · User setup supabase and google login
Builder: Gernot · Checked by: Uli

- What we asked for: Setup a supabase project with Google login and a local dev environment for the frontend
- What the AI changed: gave advice and some files in the supabase and frontend folder
- How we checked it:
  - Frontend still worked as expected
  - Supabase: the user was created, the redirect was tested with curl
- What went wrong, and how we fixed it: nothing
- What we learned about building with AI: a lot of regarding supabase and login with Google
- Saved version: configure Google redirect URL

## 10.10.2026 · User story 0 : Login
Builder: Gernot · Checked by: Uli

- What we asked for: user story US-0: Login and authorize, with acceptance criteria for login page, Google login, username/password login
- What the AI changed: a lot of files in the supabase and also frontend folder
- How we checked it:
    - Frontend: npm run test (unit tests) and npm run build (TypeScript check and build)
    - Supabase: we imported the data and checked the changes after the logins
- What went wrong, and how we fixed it: nothing
- What we learned about building with AI: a lot of regarding supabase and how to test it
- Saved version: a lot of commits the last on update claude.md

## 10.10.2026 · User story 1 : Store idea data in the database
Builder: Gernot · Checked by: Uli

- What we asked for: user story US-1: Store idea data in the database, with acceptance criteria for idea submission, category selection, and impact assessment
- What the AI changed: added a new migration for ideas, import script for the ideas, implemented the supabase repo
- How we checked it:
  - Frontend: npm run test (unit tests) and npm run dev, data is now loaded from the database
  - Supabase: we imported the idea data and added a new idea which now shows up in the database
- What went wrong, and how we fixed it: nothing
- What we learned about building with AI: it is good to make small steps, then everything seems to work fine, Claude writes a lot of tests out of the box
- Saved version: US-1 implement supabaseRepo
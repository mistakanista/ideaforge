# IdeaForge – Click Prototype (Vite + React)

Prototype of the three core pages of the Idea Pipeline, with demo data in the browser:

| Page | Route | Requirement |
|---|---|---|
| Dashboard: search, filters (category, office, stage), declined ideas can be hidden, sorting by newest / most votes, voting, details, 10/20/50 per page | `/dashboard` | US-2, US-4 |
| Submit an idea (incl. confidential) | `/submit` | US-1 |
| Admin: users and roles, categories | `/admin` | US-5 |

## Getting started

```bash
npm install
npm run dev        # http://localhost:5800
npm run test       # unit tests for filters, sorting, visibility, pagination
npm run build      # TypeScript check + production build
```

## Testing with different roles
"Acting as" in the top right selects the simulated user (US-5: "The user can be simulated for tests"):
- **Daniel Okafor** – Staff (default)
- **Ruth Evans, Tom Hallworth, Aisha Rahman** – Reviewer
- **Priya Shah** – Admin

All changes are stored only in the `localStorage` of this browser. "Reset demo data" in the footer restores the demo data.

## Structure

```
src/
  config.ts              labels and colours for stages, roles, offices, score criteria
  types.ts               types following data model V2 (snake_case like the database)
  data/repository.ts     interface of the data layer
  data/mockRepository.ts implementation with localStorage (checks the same rules as the database later)
  data/seed.ts           60 demo ideas, 12 users, 4 categories, scores, history
  data/supabaseClient.ts prepared Supabase client
  data/index.ts          selects the data source via VITE_DATA_SOURCE
  lib/ideaQuery.ts       visibility, search, filters, sorting, pagination (+ tests)
  session/CurrentUser.tsx simulated login
  pages/, components/    pages and building blocks
```

The pages access data only through `repository` from `src/data/index.ts`.

## Later: switching to Supabase
1. Create the schema from `design/DatenModel/V2-StammdatenIntegriert` in Supabase. Add the column `idea.is_confidential`.
2. Create RLS policies:
   - confidential ideas only for the submitter and reviewers;
   - admin functions only for admins;
   - votes only for oneself.
3. Write `src/data/supabaseRepository.ts`, which implements `IdeaRepository`. Use `createSupabaseClient()` for this and register the new repository in `src/data/index.ts`.
4. Create `.env` from `.env.example` and set `VITE_DATA_SOURCE=supabase` as well as the URL and anon key.
5. Replace the simulated login (`session/CurrentUser.tsx`) with Google login via Supabase Auth (US-9).

In the prototype, filters, sorting and pagination run in the browser. With many ideas they should move into the query (`range()`, `order()`, full-text search via `search_vector`). `lib/ideaQuery.ts` describes the intended behaviour and serves as the template for this.

## Assumptions
- **Stage codes** as in the data model (`UNDER_REVIEW` etc.). "Reviewing" is displayed, as in the user journey; this can be changed in `config.ts`.
- **Offices** Bristol, Leeds and Glasgow as in US-1. `ideaforge.properties` still contains example values.
- **The office of an idea** is the office of the person who submitted it (`app_user.office`), as in data model V2.
- **Scores** 1–5 for costs, feasibility and impact; higher is always better (cost 5 = lowest cost).
- **Scoring and changing stages** are deliberately not included yet. The details only display scores and history.

## Open points
1. `is_confidential` is missing in data model V2 and has to be added.
2. Are the scores in the details visible to everyone (as in the prototype) or only to the submitter and reviewers?
3. What is the final name of the stage: "Reviewing" or "Under Review"?
4. Should the office be stored with the idea at the time of submission (US-1) instead of being taken from the user?

## Test Google Login 
- Url: https://owwdzjerddgavqjqxrru.supabase.co/auth/v1/authorize?provider=google&redirect_to=http://localhost:5800
- creates an google account in supabase

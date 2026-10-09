# Build Log

## 2026-10-08
- User Journey einer Idee als Mermaid-Datei angelegt: `design/UserJourney/ideaforge_userJourney.md` (Rollen & Rechte, Journey, Ablauf, Sequenz, Stage-Modell, offene Punkte). Kein Code geändert.
- User Journey für vertrauliche Ideen angelegt: `design/UserJourney/ideaforge_userJourney_vertraulich.md` (Unterschiede zur normalen Idee, Journey, Sichtbarkeit, Sequenz, offene Punkte). Kein Code geändert.
- User Journeys zusammengeführt: Inhalt von `ideaforge_userJourney_vertraulich.md` in `design/UserJourney/ideaforge_userJourney.md` übernommen (Vergleich normal/vertraulich, Sichtbarkeitsdiagramm, gemeinsame offene Punkte, kürzere Journey-Beschriftungen); separate Datei entfernt.
- Klick-Prototyp mit Vite + React + TypeScript angelegt: `design/prototyp/`. Seiten: Dashboard (Suche, Filter Kategorie/Office/Stage, Declined ausblendbar, Sortierung neueste/meiste Votes, Voting, Details mit Scores und Stage-Verlauf, 10/20/50 pro Seite), Idee einreichen (inkl. vertraulich), Admin (Rollen, Kategorien). Datenschicht mit Mock (localStorage) hinter `IdeaRepository`, Supabase-Client vorbereitet. 15 Unit-Tests grün, Build fehlerfrei, im Browser getestet (inkl. Sichtbarkeit vertraulicher Ideen und Handy-Breite).

## 2026-10-09
- User journey translated to English: `design/UserJourney/userJourney.md` (all texts, tables and diagram labels). Content unchanged. No code changed.

## 2026-10-09 23:00
- Supabase database: first migration `build/supabase/migrations/20261009205516_app_user.sql` (enum `user_role`, table `app_user` linked to `auth.users`, trigger creating an `app_user` row with role STAFF on each new Google/Auth user, last-login sync, role rules from data model V2 incl. bootstrap admin and last-admin protection, RLS: signed-in users read, users edit own name/office, only admins change roles). Rule tests `build/supabase/tests/app_user_test.sql` (pgTAP, 24 tests) all pass against local Supabase (Docker); `supabase db lint` reports no errors. Not yet pushed to the cloud project.

## 2026-10-09 23:52
- Translated `build/frontend/README.md` to English (content unchanged) and updated the README heading reference in `build/frontend/src/types.ts`. No functional code changed.

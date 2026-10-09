# Build Log

## 2026-10-08
- User Journey einer Idee als Mermaid-Datei angelegt: `design/UserJourney/ideaforge_userJourney.md` (Rollen & Rechte, Journey, Ablauf, Sequenz, Stage-Modell, offene Punkte). Kein Code geändert.
- User Journey für vertrauliche Ideen angelegt: `design/UserJourney/ideaforge_userJourney_vertraulich.md` (Unterschiede zur normalen Idee, Journey, Sichtbarkeit, Sequenz, offene Punkte). Kein Code geändert.
- User Journeys zusammengeführt: Inhalt von `ideaforge_userJourney_vertraulich.md` in `design/UserJourney/ideaforge_userJourney.md` übernommen (Vergleich normal/vertraulich, Sichtbarkeitsdiagramm, gemeinsame offene Punkte, kürzere Journey-Beschriftungen); separate Datei entfernt.
- Klick-Prototyp mit Vite + React + TypeScript angelegt: `design/prototyp/`. Seiten: Dashboard (Suche, Filter Kategorie/Office/Stage, Declined ausblendbar, Sortierung neueste/meiste Votes, Voting, Details mit Scores und Stage-Verlauf, 10/20/50 pro Seite), Idee einreichen (inkl. vertraulich), Admin (Rollen, Kategorien). Datenschicht mit Mock (localStorage) hinter `IdeaRepository`, Supabase-Client vorbereitet. 15 Unit-Tests grün, Build fehlerfrei, im Browser getestet (inkl. Sichtbarkeit vertraulicher Ideen und Handy-Breite).

## 2026-10-09
- User journey translated to English: `design/UserJourney/userJourney.md` (all texts, tables and diagram labels). Content unchanged. No code changed.

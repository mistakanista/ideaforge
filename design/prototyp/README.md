# IdeaForge – Klick-Prototyp (Vite + React)

Prototyp für drei Kernseiten der Idea Pipeline, mit Beispieldaten im Browser:

| Seite | Route | Anforderung |
|---|---|---|
| Dashboard: Suche, Filter (Kategorie, Office, Stage), Declined ausblendbar, Sortierung neueste / meiste Votes, Voting, Details, 10/20/50 pro Seite | `/dashboard` | US-2, US-4 |
| Idee einreichen (inkl. vertraulich) | `/submit` | US-1 |
| Admin: User und Rollen, Kategorien | `/admin` | US-5 |

## Starten

```bash
npm install
npm run dev        # http://localhost:5173
npm run test       # Unit-Tests für Filter, Sortierung, Sichtbarkeit, Pagination
npm run build      # TypeScript-Prüfung + Produktions-Build
```

## Testen mit verschiedenen Rollen
Oben rechts „Acting as“ wählt den simulierten User (US-5: „The user can be simulated for tests“):
- **Daniel Okafor** – Staff (Standard)
- **Ruth Evans, Tom Hallworth, Aisha Rahman** – Reviewer
- **Priya Shah** – Admin

Alle Änderungen liegen nur im `localStorage` dieses Browsers. „Reset demo data“ im Footer stellt die Beispieldaten wieder her.

## Aufbau

```
src/
  config.ts              Labels und Farben für Stages, Rollen, Offices, Score-Kriterien
  types.ts               Typen nach Datenmodell V2 (snake_case wie die DB)
  data/repository.ts     Schnittstelle der Datenschicht
  data/mockRepository.ts Implementierung mit localStorage (prüft dieselben Regeln wie später die DB)
  data/seed.ts           60 Beispiel-Ideen, 12 User, 4 Kategorien, Scores, Verlauf
  data/supabaseClient.ts vorbereiteter Supabase-Client
  data/index.ts          wählt die Datenquelle über VITE_DATA_SOURCE
  lib/ideaQuery.ts       Sichtbarkeit, Suche, Filter, Sortierung, Pagination (+ Tests)
  session/CurrentUser.tsx simulierter Login
  pages/, components/    Seiten und Bausteine
```

Die Seiten greifen nur über `repository` aus `src/data/index.ts` auf Daten zu.

## Später: Wechsel auf Supabase
1. Schema aus `design/DatenModel/V2-StammdatenIntegriert` in Supabase anlegen. Dabei die Spalte `idea.is_confidential` ergänzen.
2. RLS-Policies anlegen:
   - vertrauliche Ideen nur für Submitter und Reviewer;
   - Admin-Funktionen nur für Admins;
   - Votes nur für sich selbst.
3. `src/data/supabaseRepository.ts` schreiben, das `IdeaRepository` implementiert. Dafür `createSupabaseClient()` nutzen und den Repository-Wechsel in `src/data/index.ts` eintragen.
4. `.env` aus `.env.example` anlegen und `VITE_DATA_SOURCE=supabase` sowie URL und Anon-Key eintragen.
5. Den simulierten Login (`session/CurrentUser.tsx`) durch Google-Login über Supabase Auth ersetzen (US-9).

Filter, Sortierung und Pagination laufen im Prototyp im Browser. Bei vielen Ideen sollten sie in die Abfrage wandern (`range()`, `order()`, Volltextsuche über `search_vector`). `lib/ideaQuery.ts` beschreibt das gewünschte Verhalten und dient dafür als Vorlage.

## Annahmen
- **Stage-Codes** wie im Datenmodell (`UNDER_REVIEW` usw.). Angezeigt wird „Reviewing“ laut User Journey; änderbar in `config.ts`.
- **Offices** Bristol, Leeds und Glasgow laut US-1. `ideaforge.properties` enthält noch Beispielwerte.
- **Das Office einer Idee** ist das Office der einreichenden Person (`app_user.office`), wie im Datenmodell V2.
- **Scores** 1–5 für Costs, Feasibility und Impact, höher ist immer besser (Cost 5 = geringste Kosten).
- **Bewerten und Stage ändern** sind bewusst noch nicht enthalten. Die Details zeigen Scores und Verlauf nur an.

## Offene Punkte
1. `is_confidential` fehlt im Datenmodell V2 und muss ergänzt werden.
2. Sind Scores in den Details für alle sichtbar (so im Prototyp) oder nur für Submitter und Reviewer?
3. Wie heißt die Stage endgültig: „Reviewing“ oder „Under Review“?
4. Soll das Office zum Zeitpunkt der Einreichung an der Idee gespeichert werden (US-1), statt es vom User abzuleiten?

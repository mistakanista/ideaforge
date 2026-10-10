# IdeaForge – Datenmodell (UML), Version 2

Relationales Modell für PostgreSQL mit integrierter Benutzer- und Rollenverwaltung.
Version 2 kommt ohne Stammdaten-Tabellen für Rolle, Stufe und Office aus.

> **Note (2026-10-10, implementation of US-1):** the `idea` table in `build/supabase/migrations/20261010192020_idea.sql` extends this model with `office` (copy of the submitter's office at submit time) and `is_confidential` (visible only to the submitter and the reviewers). `search_vector` is not created yet; it follows with the dashboard search (US-2). `attempt_no` is dropped (decided 2026-10-10): it can be derived from `resubmission_of` (NULL = first attempt, set = second attempt). A trigger rejects resubmitting a second attempt, so `UNIQUE(resubmission_of)` plus this check still prevent a third round; `idea.max_attempts` in `ideaforge.properties` is only a UI text.

| Datei | Inhalt |
|---|---|
| `ideaforge_schema.sql` | DDL (11 Tabellen, 4 ENUM-Typen, 4 Sichten) |
| `ideaforge.properties` | Anzeigenamen, Rechte je Rolle, Stufenfarben, Office-Liste |
| `ideaforge_tests.sql` | 28 Regeltests (laufen in einer Transaktion, Rollback am Ende) |

## Was aus den kleinen Tabellen geworden ist

| Vorher (V1) | Jetzt (V2) | Warum so |
|---|---|---|
| `role`, `user_role` | Spalte `app_user.role` vom Typ `ENUM user_role` + `role_changed_by`, `role_changed_at` | Jeder Benutzer hat genau eine Rolle (Admin und Reviewer schließen sich ohnehin aus). Die DB kennt die Werte weiterhin und prüft damit Bewerten und Verschieben. |
| `stage` | `ENUM idea_stage` | Feste fachliche Werte, die Reihenfolge des ENUMs ist die Pipeline-Reihenfolge. |
| `stage_transition` | Funktion `is_valid_transition(from, to)` | Sechs feste Übergänge, als Code lesbarer als als Daten. |
| `office` | Spalte `app_user.office` (Text-Code, Formatprüfung per CHECK), Liste in `ideaforge.properties` | Reine Gruppierung fürs Dashboard; neue Offices ohne DB-Änderung. |
| CHECK-Listen für Panel-Status und Benachrichtigungstyp | `ENUM panel_status`, `ENUM notification_type` | Einheitlich mit den anderen festen Werten. |

**Bleiben Tabellen:** `category` und `scoring_criterion`. Kategorien pflegt der Admin laut Anforderung zur Laufzeit, und beide werden per Fremdschlüssel von Ideen bzw. Bewertungen referenziert. In einer Properties-Datei würde jede Änderung ein Deployment brauchen, und umbenannte Einträge würden alte Daten verwaisen lassen.

**Arbeitsteilung DB ↔ Properties:** Die *Codes* (`REVIEWER`, `PILOTING`, `BERLIN`) sind der Vertrag zwischen beiden. Die Datenbank kennt nur die Codes und setzt die Regeln durch. Die Properties-Datei liefert alles, was nur angezeigt wird: Labels, Beschreibungen, Farben, Rechte für das UI, die Office-Liste. Ein neuer Wert für Rolle oder Stufe braucht deshalb beides: `ALTER TYPE … ADD VALUE` und einen Eintrag in der Properties-Datei.

## Klassendiagramm

```mermaid
classDiagram
    direction LR

    class UserRole {
        <<enumeration>>
        STAFF
        REVIEWER
        ADMIN
    }
    class IdeaStage {
        <<enumeration>>
        SUBMITTED
        UNDER_REVIEW
        PILOTING
        IMPLEMENTED
        DECLINED
    }
    class PanelStatus {
        <<enumeration>>
        PLANNED
        HELD
        CANCELLED
    }
    class NotificationType {
        <<enumeration>>
        STAGE_CHANGED
        COMMENT_ADDED
        PANEL_SCHEDULED
    }

    class AppUser {
        +bigint user_id PK
        +text google_sub UK
        +text email UK
        +text display_name
        +text office
        +UserRole role
        +bigint role_changed_by FK
        +timestamptz role_changed_at
        +boolean is_active
        +timestamptz created_at
        +timestamptz last_login_at
    }
    class Category {
        +smallint category_id PK
        +text name UK
        +text description
        +smallint sort_order
        +boolean is_active
    }
    class Idea {
        +bigint idea_id PK
        +text title
        +text problem
        +text solution
        +text expected_impact
        +smallint category_id FK
        +bigint submitter_id FK
        +IdeaStage current_stage
        +bigint resubmission_of FK,UK
        +smallint attempt_no
        +tsvector search_vector
        +timestamptz created_at
    }
    class IdeaStageHistory {
        +bigint history_id PK
        +bigint idea_id FK
        +IdeaStage from_stage
        +IdeaStage to_stage
        +bigint changed_by FK
        +text reason
        +timestamptz changed_at
    }
    class Vote {
        +bigint idea_id PK,FK
        +bigint user_id PK,FK
        +timestamptz created_at
    }
    class Comment {
        +bigint comment_id PK
        +bigint idea_id FK
        +bigint author_id FK
        +bigint parent_comment_id FK
        +text body
        +timestamptz created_at
        +timestamptz deleted_at
    }
    class ScoringCriterion {
        +smallint criterion_id PK
        +text code UK
        +text name
        +numeric weight
        +smallint min_score
        +smallint max_score
        +boolean is_active
    }
    class IdeaScore {
        +bigint idea_id PK,FK
        +bigint reviewer_id PK,FK
        +smallint criterion_id PK,FK
        +smallint score
        +text remark
    }
    class PanelMeeting {
        +bigint meeting_id PK
        +date meeting_date UK
        +PanelStatus status
        +text notes
    }
    class PanelAgendaItem {
        +bigint meeting_id PK,FK
        +bigint idea_id PK,FK
        +smallint position
        +text outcome_note
    }
    class Notification {
        +bigint notification_id PK
        +bigint recipient_id FK
        +bigint idea_id FK
        +NotificationType notification_type
        +text message
        +timestamptz emailed_at
        +timestamptz read_at
    }

    AppUser ..> UserRole
    Idea ..> IdeaStage
    IdeaStageHistory ..> IdeaStage
    PanelMeeting ..> PanelStatus
    Notification ..> NotificationType

    AppUser "0..1" -- "*" AppUser : vergibt Rolle (role_changed_by)
    AppUser "1" -- "*" Idea : reicht ein
    Category "1" -- "*" Idea : ordnet
    Idea "0..1" -- "0..1" Idea : zweite Chance (resubmission_of)

    Idea "1" *-- "1..*" IdeaStageHistory : Verlauf
    AppUser "1" -- "*" IdeaStageHistory : ändert

    Idea "1" *-- "*" Vote
    AppUser "1" -- "*" Vote : stimmt ab
    Idea "1" *-- "*" Comment
    AppUser "1" -- "*" Comment : schreibt
    Comment "0..1" -- "*" Comment : Antwort auf

    Idea "1" *-- "*" IdeaScore
    AppUser "1" -- "*" IdeaScore : bewertet (Reviewer)
    ScoringCriterion "1" -- "*" IdeaScore

    PanelMeeting "1" *-- "*" PanelAgendaItem
    Idea "1" -- "*" PanelAgendaItem : wird besprochen

    AppUser "1" -- "*" Notification : erhält
    Idea "0..1" -- "*" Notification
```

## Rollenkonzept

| Aktion | STAFF | REVIEWER | ADMIN |
|---|:-:|:-:|:-:|
| Idee einreichen, suchen, abstimmen, kommentieren | ✓ | ✓ | ✓ |
| Idee bewerten (nicht eigene) | – | ✓ | – |
| Idee zwischen Stufen verschieben | – | ✓ | – |
| Kategorien verwalten, Kategorie einer Idee ändern | – | – | ✓ |
| Reviewer ernennen / entziehen | – | – | ✓ |
| Reports / Dashboard | ✓ | ✓ | ✓ |

- Neue Benutzer sind `STAFF` (Default der Spalte). Ein Insert direkt als Reviewer oder Admin wird abgewiesen.
- Rollenänderungen nur mit `role_changed_by` = aktiver Admin; `role_changed_at` setzt der Trigger.
- Bootstrap: Der allererste Admin darf ohne `role_changed_by` gesetzt werden.
- Der letzte aktive Admin kann weder herabgestuft noch deaktiviert werden.
- Die Rechte je Rolle für das UI stehen in `ideaforge.properties` (`role.<CODE>.permissions`). Verbindlich für Bewerten und Verschieben bleiben die Trigger in der DB.
- Login über Google: `google_sub` ist der stabile Schlüssel aus dem Google-ID-Token; die E-Mail kann sich ändern.

**Verlust gegenüber V1:** Es gibt keine Historie der Rollenvergaben mehr, nur noch die letzte Änderung (wer, wann). Falls ein Audit-Trail nötig wird, reicht eine kleine Tabelle `role_change_log`, die per Trigger befüllt wird.

## Pipeline

```mermaid
stateDiagram-v2
    [*] --> SUBMITTED
    SUBMITTED --> UNDER_REVIEW
    UNDER_REVIEW --> PILOTING
    PILOTING --> IMPLEMENTED
    SUBMITTED --> DECLINED
    UNDER_REVIEW --> DECLINED
    PILOTING --> DECLINED
    IMPLEMENTED --> [*]
    DECLINED --> [*] : einmal neu einreichbar (neue Idee, attempt_no = 2)
```

- Ein Stufenwechsel ist ausschließlich ein `INSERT` in `idea_stage_history` (mit Pflicht-Begründung). Ein Trigger prüft den Übergang über `is_valid_transition()` und die Reviewer-Rolle, setzt `idea.current_stage` und erzeugt die Benachrichtigung für die einreichende Person. Ein direktes `UPDATE` der Stufe wird abgewiesen.
- Die zweite Chance ist eine neue Zeile in `idea` mit `resubmission_of` → abgelehnte Originalidee. `UNIQUE(resubmission_of)` und `attempt_no ∈ {1,2}` verhindern eine dritte Runde.

## Abdeckung der Anforderungen

| Anforderung | Umsetzung |
|---|---|
| Idee mit Titel, Problem, Lösung, Kategorie, Impact | `idea` |
| 4 Kategorien | `category` (Startdaten, vom Admin erweiterbar) |
| Suchen | `idea.search_vector` + GIN-Index (Volltext) |
| Eine Stimme pro Person und Idee | PK `vote(idea_id, user_id)` |
| Stufen, kein Überspringen, Ablehnung jederzeit | `ENUM idea_stage`, `is_valid_transition()`, Trigger |
| Begründung für Einreichende sichtbar | `idea_stage_history.reason` |
| Zweite Chance | `idea.resubmission_of`, `attempt_no` |
| Keine Bewertung eigener Ideen, Admins bewerten nicht | Trigger auf `idea_score` |
| Bewertungskriterien | `scoring_criterion` (gewichtet), `idea_score` |
| Panel am ersten Dienstag | `panel_meeting` mit CHECK, `panel_agenda_item` |
| Dashboard nach Stufe, Kategorie, Office | `v_pipeline_dashboard` (GROUPING SETS), Labels aus Properties |
| Benachrichtigung bei Stufenwechsel | `notification` (per Trigger befüllt) |
| Kommentare | `comment` (mit Antworten, Soft-Delete) |
| Duplikate beim Einreichen erkennen | Volltextsuche in derselben Kategorie |
| Leaderboard dieses Quartal | `v_leaderboard_current_quarter` |
| Ready-for-panel-Liste | `v_ready_for_panel` |

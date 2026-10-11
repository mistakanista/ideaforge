# IdeaForge – Datenmodell (UML)

Relationales Modell für PostgreSQL mit integrierter Benutzer- und Rollenverwaltung.
Das zugehörige DDL steht in `ideaforge_schema.sql`, die Regeltests in `ideaforge_tests.sql`.

## Klassendiagramm

```mermaid
classDiagram
    direction LR

    class Office {
        +smallint office_id PK
        +text name UK
        +boolean is_active
    }
    class AppUser {
        +bigint user_id PK
        +text google_sub UK
        +text email UK
        +text display_name
        +smallint office_id FK
        +boolean is_active
        +timestamptz created_at
        +timestamptz last_login_at
    }
    class Role {
        +text role_code PK
        +text name
        +text description
    }
    class UserRole {
        +bigint user_id PK,FK
        +text role_code PK,FK
        +bigint granted_by FK
        +timestamptz granted_at
    }
    class Category {
        +smallint category_id PK
        +text name UK
        +text description
        +smallint sort_order
        +boolean is_active
    }
    class Stage {
        +text stage_code PK
        +text name
        +smallint sort_order
        +boolean is_terminal
    }
    class StageTransition {
        +text from_stage PK,FK
        +text to_stage PK,FK
    }
    class Idea {
        +bigint idea_id PK
        +text title
        +text problem
        +text solution
        +text expected_impact
        +smallint category_id FK
        +bigint submitter_id FK
        +text current_stage FK
        +bigint resubmission_of FK,UK
        +smallint attempt_no
        +tsvector search_vector
        +timestamptz created_at
    }
    class IdeaStageHistory {
        +bigint history_id PK
        +bigint idea_id FK
        +text from_stage FK
        +text to_stage FK
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
        +text status
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
        +text notification_type
        +text message
        +timestamptz emailed_at
        +timestamptz read_at
    }

    Office "0..1" -- "*" AppUser : arbeitet in
    AppUser "1" -- "1..*" UserRole : hat
    Role "1" -- "*" UserRole : wird vergeben als
    AppUser "0..1" -- "*" UserRole : vergibt (granted_by)

    AppUser "1" -- "*" Idea : reicht ein
    Category "1" -- "*" Idea : ordnet
    Stage "1" -- "*" Idea : aktuelle Stufe
    Idea "0..1" -- "0..1" Idea : zweite Chance (resubmission_of)

    Stage "1" -- "*" StageTransition : von / nach
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

- Jeder neue Benutzer bekommt automatisch `STAFF` (Trigger).
- `REVIEWER` und `ADMIN` schließen sich gegenseitig aus, denn Admins dürfen weder bewerten noch verschieben.
- Der allererste Admin wird ohne `granted_by` angelegt (Bootstrap), danach vergeben nur Admins Rollen.
- Login über Google: `google_sub` ist der stabile Schlüssel aus dem Google-ID-Token; die E-Mail kann sich ändern.

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

- Ein Stufenwechsel ist ausschließlich ein `INSERT` in `idea_stage_history` (mit Pflicht-Begründung). Ein Trigger prüft Übergang und Reviewer-Rolle, setzt `idea.current_stage` und erzeugt die Benachrichtigung für die einreichende Person. Ein direktes `UPDATE` der Stufe wird abgewiesen.
- Die zweite Chance ist eine neue Zeile in `idea` mit `resubmission_of` → abgelehnte Originalidee. `UNIQUE(resubmission_of)` und `attempt_no ∈ {1,2}` verhindern eine dritte Runde. So bleibt die Bewertungs- und Abstimmungshistorie der ersten Runde erhalten.

## Abdeckung der Anforderungen

| Anforderung | Umsetzung |
|---|---|
| Idee mit Titel, Problem, Lösung, Kategorie, Impact | `idea` |
| 4 Kategorien | `category` (Stammdaten, vom Admin erweiterbar) |
| Suchen | `idea.search_vector` + GIN-Index (Volltext) |
| Eine Stimme pro Person und Idee | PK `vote(idea_id, user_id)` |
| Stufen, kein Überspringen, Ablehnung jederzeit | `stage`, `stage_transition`, Trigger |
| Begründung für Einreichende sichtbar | `idea_stage_history.reason` |
| Zweite Chance | `idea.resubmission_of`, `attempt_no` |
| Keine Bewertung eigener Ideen, Admins bewerten nicht | Trigger auf `idea_score` |
| Bewertungskriterien | `scoring_criterion` (gewichtet), `idea_score` |
| Panel am ersten Dienstag | `panel_meeting` mit CHECK, `panel_agenda_item` |
| Dashboard nach Stufe, Kategorie, Office | `v_pipeline_dashboard` (GROUPING SETS) |
| Benachrichtigung bei Stufenwechsel | `notification` (per Trigger befüllt) |
| Kommentare | `comment` (mit Antworten, Soft-Delete) |
| Duplikate beim Einreichen erkennen | Volltextsuche in derselben Kategorie |
| Leaderboard dieses Quartal | `v_leaderboard_current_quarter` |
| Ready-for-panel-Liste | `v_ready_for_panel` |

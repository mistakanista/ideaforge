# IdeaForge: implemented data model (Supabase)

Simple overview of the tables that exist in Supabase today (schema `public`, plus the link to `auth.users`).
Update this diagram after each Supabase migration.

- Last update: 2026-10-12, after migration `20261012193813_category_admin_write.sql` (no new tables or columns; only admins can write `category`)
- Source: `build/supabase/migrations/`
- Planned full model: `design/DataModel/V2-StammdatenIntegriert/`

```mermaid
erDiagram
    AUTH_USERS ||--|| APP_USER : "signs in as"
    APP_USER ||--o{ APP_USER : "changed role of"
    APP_USER ||--o{ IDEA : submits
    CATEGORY ||--o{ IDEA : groups
    IDEA |o--o| IDEA : "resubmission of"
    IDEA ||--o{ IDEA_TRANSITION : "moved by"
    APP_USER ||--o{ IDEA_TRANSITION : "reviews (reviewer)"
    IDEA ||--o{ VOTE : "gets"
    APP_USER ||--o{ VOTE : "votes (never own or confidential idea)"

    AUTH_USERS {
        uuid id PK "Supabase Auth, holds the password"
        text email
    }
    APP_USER {
        bigint user_id PK
        uuid auth_user_id FK,UK
        text email UK
        text display_name
        text office "BRISTOL, LEEDS, GLASGOW"
        user_role role "STAFF, REVIEWER, ADMIN"
        bigint role_changed_by FK
        timestamptz role_changed_at
        boolean is_active
        boolean must_change_password
        timestamptz created_at
        timestamptz last_login_at
    }
    LOGIN_ALLOWLIST {
        text entry PK "@domain or single address"
        text note
        timestamptz created_at
    }
    CATEGORY {
        smallint category_id PK
        text name UK
        text description
        smallint sort_order "set by trigger"
        boolean is_active "inactive = not selectable, never deleted"
    }
    IDEA {
        bigint idea_id PK
        text title
        text problem
        text solution
        text expected_impact
        smallint category_id FK
        bigint submitter_id FK
        text office "copied from the submitter"
        boolean is_confidential
        idea_stage current_stage "set only by idea_transition"
        bigint resubmission_of FK,UK
        timestamptz created_at
    }
    IDEA_TRANSITION {
        bigint transition_id PK
        bigint idea_id FK
        idea_stage from_stage
        idea_stage to_stage
        bigint changed_by FK "reviewer"
        text reason "required when declined, optional otherwise"
        smallint score_impact "1-5, optional when declined"
        smallint score_cost "1-5, optional when declined"
        smallint score_feasibility "1-5, optional when declined"
        timestamptz created_at
    }
    VOTE {
        bigint idea_id PK,FK
        bigint user_id PK,FK "voter, set by trigger"
        timestamptz created_at
    }
```

## Enums
- `user_role`: STAFF, REVIEWER, ADMIN
- `idea_stage`: SUBMITTED → UNDER_REVIEW → PILOTING → IMPLEMENTED, or DECLINED

`login_allowlist` has no foreign keys. It is checked by `handle_new_user()` when a new Auth user is created.

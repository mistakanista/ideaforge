-- =====================================================================
--  IdeaForge – Datenmodell / DDL für PostgreSQL (getestet mit PG 16, ab PG 13 lauffähig)
--  Keine Extensions nötig -> läuft auch auf kostenlosen Managed-Tiers.
--
--  Kernregeln, die direkt in der Datenbank erzwungen werden:
--   * Rollen STAFF / REVIEWER / ADMIN; ADMIN und REVIEWER schließen sich aus
--   * Nur Admins vergeben Reviewer-/Admin-Rollen
--   * Stufen nur schrittweise: SUBMITTED -> UNDER_REVIEW -> PILOTING -> IMPLEMENTED,
--     DECLINED aus jeder offenen Stufe; nur Reviewer, immer mit Begründung
--   * Abgelehnte Idee genau einmal neu einreichbar (zweite Chance)
--   * Eine Stimme pro Person und Idee
--   * Reviewer bewerten nie ihre eigenen Ideen; Admins bewerten gar nicht
--   * Panel-Termine nur am ersten Dienstag eines Monats
--   * Benachrichtigung an Einreichende bei jedem Stufenwechsel
-- =====================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS ideaforge;
SET search_path = ideaforge, public;

-- ---------------------------------------------------------------------
-- Hilfsfunktion: updated_at pflegen
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- =====================================================================
-- 1. Benutzer- und Rollenverwaltung
-- =====================================================================

CREATE TABLE office (
  office_id   smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text     NOT NULL UNIQUE,
  is_active   boolean  NOT NULL DEFAULT true
);

CREATE TABLE app_user (
  user_id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  google_sub    text        NOT NULL UNIQUE,          -- stabile Google-Konto-ID ("sub"-Claim)
  email         text        NOT NULL CHECK (position('@' IN email) > 1),
  display_name  text        NOT NULL CHECK (length(trim(display_name)) > 0),
  office_id     smallint    REFERENCES office(office_id),
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);
CREATE UNIQUE INDEX ux_app_user_email ON app_user (lower(email));
CREATE INDEX ix_app_user_office ON app_user (office_id);
CREATE TRIGGER trg_app_user_updated BEFORE UPDATE ON app_user
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE role (
  role_code   text PRIMARY KEY,
  name        text NOT NULL,
  description text NOT NULL
);

CREATE TABLE user_role (
  user_id     bigint      NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  role_code   text        NOT NULL REFERENCES role(role_code),
  granted_by  bigint      REFERENCES app_user(user_id),   -- NULL = System / Erst-Einrichtung
  granted_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_code)
);
CREATE INDEX ix_user_role_role ON user_role (role_code);

CREATE OR REPLACE FUNCTION has_role(p_user_id bigint, p_role text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_role ur JOIN app_user u USING (user_id)
    WHERE ur.user_id = p_user_id AND ur.role_code = p_role AND u.is_active
  );
$$;

-- Jeder neue Benutzer erhält automatisch die Basisrolle STAFF
CREATE OR REPLACE FUNCTION trg_app_user_default_role() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO user_role (user_id, role_code) VALUES (NEW.user_id, 'STAFF');
  RETURN NEW;
END $$;
CREATE TRIGGER trg_app_user_default_role AFTER INSERT ON app_user
  FOR EACH ROW EXECUTE FUNCTION trg_app_user_default_role();

-- Regeln für Rollenvergabe
CREATE OR REPLACE FUNCTION trg_user_role_check() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role_code IN ('REVIEWER', 'ADMIN') THEN
    IF NEW.granted_by IS NULL THEN
      -- Ohne Vergebenden nur die allererste Admin-Einrichtung (Bootstrap)
      IF NEW.role_code <> 'ADMIN' OR EXISTS (SELECT 1 FROM user_role WHERE role_code = 'ADMIN') THEN
        RAISE EXCEPTION 'Rolle % kann nur von einem Admin vergeben werden', NEW.role_code;
      END IF;
    ELSIF NOT has_role(NEW.granted_by, 'ADMIN') THEN
      RAISE EXCEPTION 'Benutzer % ist kein Admin und darf keine Rollen vergeben', NEW.granted_by;
    END IF;
  END IF;

  -- Admins bewerten und verschieben nicht -> Admin und Reviewer schließen sich aus
  IF NEW.role_code = 'ADMIN' AND EXISTS (SELECT 1 FROM user_role WHERE user_id = NEW.user_id AND role_code = 'REVIEWER')
  OR NEW.role_code = 'REVIEWER' AND EXISTS (SELECT 1 FROM user_role WHERE user_id = NEW.user_id AND role_code = 'ADMIN') THEN
    RAISE EXCEPTION 'Ein Benutzer kann nicht gleichzeitig ADMIN und REVIEWER sein';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_user_role_check BEFORE INSERT OR UPDATE ON user_role
  FOR EACH ROW EXECUTE FUNCTION trg_user_role_check();

-- =====================================================================
-- 2. Stammdaten: Kategorien, Pipeline-Stufen, Bewertungskriterien
-- =====================================================================

CREATE TABLE category (
  category_id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text     NOT NULL UNIQUE,
  description text,
  sort_order  smallint NOT NULL DEFAULT 0,
  is_active   boolean  NOT NULL DEFAULT true
);

CREATE TABLE stage (
  stage_code  text     PRIMARY KEY,
  name        text     NOT NULL,
  sort_order  smallint NOT NULL UNIQUE,
  is_terminal boolean  NOT NULL
);

-- Erlaubte Übergänge (kein Überspringen von Stufen)
CREATE TABLE stage_transition (
  from_stage text NOT NULL REFERENCES stage(stage_code),
  to_stage   text NOT NULL REFERENCES stage(stage_code),
  PRIMARY KEY (from_stage, to_stage),
  CHECK (from_stage <> to_stage)
);

CREATE TABLE scoring_criterion (
  criterion_id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code         text         NOT NULL UNIQUE,
  name         text         NOT NULL,
  description  text,
  weight       numeric(4,2) NOT NULL DEFAULT 1 CHECK (weight > 0),
  min_score    smallint     NOT NULL DEFAULT 1,
  max_score    smallint     NOT NULL DEFAULT 5,
  is_active    boolean      NOT NULL DEFAULT true,
  CHECK (min_score < max_score)
);

-- =====================================================================
-- 3. Ideen und Pipeline
-- =====================================================================

CREATE TABLE idea (
  idea_id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title            text        NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 200),
  problem          text        NOT NULL CHECK (length(trim(problem)) > 0),
  solution         text        NOT NULL CHECK (length(trim(solution)) > 0),
  expected_impact  text        NOT NULL CHECK (length(trim(expected_impact)) > 0),
  category_id      smallint    NOT NULL REFERENCES category(category_id),
  submitter_id     bigint      NOT NULL REFERENCES app_user(user_id),
  current_stage    text        NOT NULL DEFAULT 'SUBMITTED' REFERENCES stage(stage_code),
  resubmission_of  bigint      UNIQUE REFERENCES idea(idea_id),   -- UNIQUE: nur EINE zweite Chance
  attempt_no       smallint    NOT NULL DEFAULT 1 CHECK (attempt_no IN (1, 2)),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  search_vector    tsvector GENERATED ALWAYS AS (
                     setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A') ||
                     setweight(to_tsvector('english'::regconfig,
                       coalesce(problem, '') || ' ' || coalesce(solution, '') || ' ' || coalesce(expected_impact, '')), 'B')
                   ) STORED,
  CHECK ((resubmission_of IS NULL) = (attempt_no = 1))
);
CREATE INDEX ix_idea_category   ON idea (category_id);
CREATE INDEX ix_idea_stage      ON idea (current_stage);
CREATE INDEX ix_idea_submitter  ON idea (submitter_id);
CREATE INDEX ix_idea_created    ON idea (created_at);
CREATE INDEX ix_idea_search     ON idea USING gin (search_vector);

CREATE TABLE idea_stage_history (
  history_id  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  idea_id     bigint      NOT NULL REFERENCES idea(idea_id),
  from_stage  text        REFERENCES stage(stage_code),          -- NULL = Ersteinreichung
  to_stage    text        NOT NULL REFERENCES stage(stage_code),
  changed_by  bigint      NOT NULL REFERENCES app_user(user_id),
  reason      text        NOT NULL CHECK (length(trim(reason)) > 0),  -- für Einreichende sichtbar
  changed_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_stage_history_idea ON idea_stage_history (idea_id, changed_at);

-- ---------- Regeln beim Einreichen ----------
CREATE OR REPLACE FUNCTION trg_idea_before_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_orig idea%ROWTYPE;
BEGIN
  NEW.current_stage := 'SUBMITTED';     -- jede Idee startet am Anfang

  IF NEW.resubmission_of IS NULL THEN
    NEW.attempt_no := 1;
  ELSE
    SELECT * INTO v_orig FROM idea WHERE idea_id = NEW.resubmission_of FOR UPDATE;
    IF v_orig.current_stage <> 'DECLINED' THEN
      RAISE EXCEPTION 'Nur abgelehnte Ideen können erneut eingereicht werden (Idee %)', v_orig.idea_id;
    END IF;
    IF v_orig.attempt_no <> 1 THEN
      RAISE EXCEPTION 'Idee % war bereits die zweite Chance – keine weitere Einreichung möglich', v_orig.idea_id;
    END IF;
    IF v_orig.submitter_id <> NEW.submitter_id THEN
      RAISE EXCEPTION 'Nur die ursprünglich einreichende Person darf die Idee erneut einreichen';
    END IF;
    NEW.attempt_no := 2;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_idea_before_insert BEFORE INSERT ON idea
  FOR EACH ROW EXECUTE FUNCTION trg_idea_before_insert();

-- Erster Historieneintrag bei Einreichung
CREATE OR REPLACE FUNCTION trg_idea_after_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO idea_stage_history (idea_id, from_stage, to_stage, changed_by, reason)
  VALUES (NEW.idea_id, NULL, 'SUBMITTED', NEW.submitter_id,
          CASE WHEN NEW.attempt_no = 2 THEN 'Second-chance resubmission' ELSE 'Idea submitted' END);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_idea_after_insert AFTER INSERT ON idea
  FOR EACH ROW EXECUTE FUNCTION trg_idea_after_insert();

-- Stufe darf nicht direkt per UPDATE geändert werden, nur über idea_stage_history
CREATE OR REPLACE FUNCTION trg_idea_before_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.current_stage IS DISTINCT FROM OLD.current_stage
     AND coalesce(current_setting('ideaforge.stage_change', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Stufenwechsel nur über INSERT in idea_stage_history';
  END IF;
  IF NEW.submitter_id <> OLD.submitter_id
     OR NEW.resubmission_of IS DISTINCT FROM OLD.resubmission_of
     OR NEW.attempt_no <> OLD.attempt_no THEN
    RAISE EXCEPTION 'submitter_id, resubmission_of und attempt_no sind unveränderlich';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_idea_before_update BEFORE UPDATE ON idea
  FOR EACH ROW EXECUTE FUNCTION trg_idea_before_update();

-- ---------- Regeln für Stufenwechsel ----------
CREATE OR REPLACE FUNCTION trg_stage_history_before_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_idea idea%ROWTYPE;
BEGIN
  SELECT * INTO v_idea FROM idea WHERE idea_id = NEW.idea_id FOR UPDATE;
  NEW.changed_at := now();

  IF NEW.from_stage IS NULL THEN
    -- nur der automatische Ersteintrag bei Einreichung
    IF NEW.to_stage <> 'SUBMITTED' OR NEW.changed_by <> v_idea.submitter_id
       OR EXISTS (SELECT 1 FROM idea_stage_history WHERE idea_id = NEW.idea_id) THEN
      RAISE EXCEPTION 'Ungültiger Ersteintrag in der Stufenhistorie';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.from_stage <> v_idea.current_stage THEN
    RAISE EXCEPTION 'Idee % steht in Stufe %, nicht in %', NEW.idea_id, v_idea.current_stage, NEW.from_stage;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM stage_transition WHERE from_stage = NEW.from_stage AND to_stage = NEW.to_stage) THEN
    RAISE EXCEPTION 'Übergang % -> % ist nicht erlaubt (keine Stufe überspringen)', NEW.from_stage, NEW.to_stage;
  END IF;
  IF NOT has_role(NEW.changed_by, 'REVIEWER') THEN
    RAISE EXCEPTION 'Nur Reviewer dürfen Ideen zwischen Stufen verschieben';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_stage_history_before_insert BEFORE INSERT ON idea_stage_history
  FOR EACH ROW EXECUTE FUNCTION trg_stage_history_before_insert();

CREATE OR REPLACE FUNCTION trg_stage_history_after_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_submitter bigint;
  v_title     text;
BEGIN
  IF NEW.from_stage IS NULL THEN RETURN NEW; END IF;

  PERFORM set_config('ideaforge.stage_change', 'on', true);
  UPDATE idea SET current_stage = NEW.to_stage WHERE idea_id = NEW.idea_id
  RETURNING submitter_id, title INTO v_submitter, v_title;
  PERFORM set_config('ideaforge.stage_change', 'off', true);

  -- Einreichende benachrichtigen (should have)
  INSERT INTO notification (recipient_id, idea_id, notification_type, message)
  VALUES (v_submitter, NEW.idea_id, 'STAGE_CHANGED',
          format('"%s" moved from %s to %s: %s', v_title, NEW.from_stage, NEW.to_stage, NEW.reason));
  RETURN NEW;
END $$;
CREATE TRIGGER trg_stage_history_after_insert AFTER INSERT ON idea_stage_history
  FOR EACH ROW EXECUTE FUNCTION trg_stage_history_after_insert();

-- Historie ist unveränderlich
CREATE OR REPLACE FUNCTION trg_readonly() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Tabelle % ist nur anhängbar (append-only)', TG_TABLE_NAME;
END $$;
CREATE TRIGGER trg_stage_history_readonly BEFORE UPDATE OR DELETE ON idea_stage_history
  FOR EACH ROW EXECUTE FUNCTION trg_readonly();

-- =====================================================================
-- 4. Beteiligung: Stimmen, Kommentare
-- =====================================================================

CREATE TABLE vote (
  idea_id    bigint      NOT NULL REFERENCES idea(idea_id) ON DELETE CASCADE,
  user_id    bigint      NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (idea_id, user_id)                       -- eine Stimme pro Person und Idee
);
CREATE INDEX ix_vote_user    ON vote (user_id);
CREATE INDEX ix_vote_created ON vote (created_at);

CREATE TABLE comment (
  comment_id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  idea_id           bigint      NOT NULL REFERENCES idea(idea_id) ON DELETE CASCADE,
  author_id         bigint      NOT NULL REFERENCES app_user(user_id),
  parent_comment_id bigint      REFERENCES comment(comment_id) ON DELETE CASCADE,  -- Antworten
  body              text        NOT NULL CHECK (length(trim(body)) > 0),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz                                   -- Soft-Delete
);
CREATE INDEX ix_comment_idea ON comment (idea_id, created_at);
CREATE TRIGGER trg_comment_updated BEFORE UPDATE ON comment
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- 5. Bewertung durch Reviewer
-- =====================================================================

CREATE TABLE idea_score (
  idea_id      bigint      NOT NULL REFERENCES idea(idea_id) ON DELETE CASCADE,
  reviewer_id  bigint      NOT NULL REFERENCES app_user(user_id),
  criterion_id smallint    NOT NULL REFERENCES scoring_criterion(criterion_id),
  score        smallint    NOT NULL,
  remark       text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (idea_id, reviewer_id, criterion_id)
);
CREATE INDEX ix_idea_score_reviewer ON idea_score (reviewer_id);

CREATE OR REPLACE FUNCTION trg_idea_score_check() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_idea idea%ROWTYPE;
  v_crit scoring_criterion%ROWTYPE;
BEGIN
  SELECT * INTO v_idea FROM idea WHERE idea_id = NEW.idea_id;
  SELECT * INTO v_crit FROM scoring_criterion WHERE criterion_id = NEW.criterion_id;

  IF NOT has_role(NEW.reviewer_id, 'REVIEWER') THEN
    RAISE EXCEPTION 'Nur Reviewer dürfen Ideen bewerten';
  END IF;
  IF v_idea.submitter_id = NEW.reviewer_id THEN
    RAISE EXCEPTION 'Interessenkonflikt: Reviewer dürfen eigene Ideen nicht bewerten';
  END IF;
  IF (SELECT is_terminal FROM stage WHERE stage_code = v_idea.current_stage) THEN
    RAISE EXCEPTION 'Idee % ist abgeschlossen (%) und kann nicht mehr bewertet werden', v_idea.idea_id, v_idea.current_stage;
  END IF;
  IF NOT v_crit.is_active THEN
    RAISE EXCEPTION 'Kriterium % ist nicht aktiv', v_crit.code;
  END IF;
  IF NEW.score NOT BETWEEN v_crit.min_score AND v_crit.max_score THEN
    RAISE EXCEPTION 'Punktzahl % außerhalb %..% für Kriterium %', NEW.score, v_crit.min_score, v_crit.max_score, v_crit.code;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_idea_score_check BEFORE INSERT OR UPDATE ON idea_score
  FOR EACH ROW EXECUTE FUNCTION trg_idea_score_check();

-- =====================================================================
-- 6. Innovation Panel (erster Dienstag im Monat)
-- =====================================================================

CREATE OR REPLACE FUNCTION first_tuesday_of_month(p_date date) RETURNS date
LANGUAGE sql IMMUTABLE AS $$
  SELECT d + ((9 - extract(isodow FROM d)::int) % 7)
  FROM (SELECT date_trunc('month', p_date)::date AS d) s;
$$;

CREATE OR REPLACE FUNCTION next_panel_date(p_from date DEFAULT current_date) RETURNS date
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN first_tuesday_of_month(p_from) >= p_from
              THEN first_tuesday_of_month(p_from)
              ELSE first_tuesday_of_month((p_from + interval '1 month')::date) END;
$$;

CREATE TABLE panel_meeting (
  meeting_id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  meeting_date date        NOT NULL UNIQUE
               CHECK (meeting_date = first_tuesday_of_month(meeting_date)),
  status       text        NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'HELD', 'CANCELLED')),
  notes        text,
  created_by   bigint      REFERENCES app_user(user_id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE panel_agenda_item (
  meeting_id   bigint      NOT NULL REFERENCES panel_meeting(meeting_id) ON DELETE CASCADE,
  idea_id      bigint      NOT NULL REFERENCES idea(idea_id) ON DELETE CASCADE,
  position     smallint    NOT NULL CHECK (position > 0),
  added_by     bigint      REFERENCES app_user(user_id),
  outcome_note text,
  PRIMARY KEY (meeting_id, idea_id),
  UNIQUE (meeting_id, position)
);
CREATE INDEX ix_agenda_idea ON panel_agenda_item (idea_id);

-- =====================================================================
-- 7. Benachrichtigungen
-- =====================================================================

CREATE TABLE notification (
  notification_id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recipient_id      bigint      NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  idea_id           bigint      REFERENCES idea(idea_id) ON DELETE CASCADE,
  notification_type text        NOT NULL CHECK (notification_type IN ('STAGE_CHANGED', 'COMMENT_ADDED', 'PANEL_SCHEDULED')),
  message           text        NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  emailed_at        timestamptz,       -- für einen E-Mail-Versand-Job
  read_at           timestamptz
);
CREATE INDEX ix_notification_unread ON notification (recipient_id) WHERE read_at IS NULL;
CREATE INDEX ix_notification_unsent ON notification (created_at)   WHERE emailed_at IS NULL;

-- =====================================================================
-- 8. Sichten für Übersicht, Dashboard, Leaderboard, Panel-Liste
-- =====================================================================

CREATE VIEW v_idea_overview AS
SELECT i.idea_id, i.title, i.current_stage, s.name AS stage_name,
       i.category_id, c.name AS category,
       i.submitter_id, u.display_name AS submitter, o.name AS office,
       i.attempt_no, i.resubmission_of, i.created_at,
       (SELECT count(*) FROM vote v WHERE v.idea_id = i.idea_id)                       AS vote_count,
       (SELECT count(*) FROM comment cm WHERE cm.idea_id = i.idea_id AND cm.deleted_at IS NULL) AS comment_count,
       (SELECT round(sum(sc.score * cr.weight) / nullif(sum(cr.weight), 0), 2)
          FROM idea_score sc JOIN scoring_criterion cr USING (criterion_id)
         WHERE sc.idea_id = i.idea_id)                                                AS weighted_score,
       (SELECT count(DISTINCT sc.reviewer_id) FROM idea_score sc WHERE sc.idea_id = i.idea_id) AS reviewer_count,
       (SELECT h.reason FROM idea_stage_history h WHERE h.idea_id = i.idea_id
         ORDER BY h.changed_at DESC, h.history_id DESC LIMIT 1)                       AS last_stage_reason
FROM idea i
JOIN stage s         ON s.stage_code = i.current_stage
JOIN category c      ON c.category_id = i.category_id
JOIN app_user u      ON u.user_id = i.submitter_id
LEFT JOIN office o   ON o.office_id = u.office_id;

-- Pipeline-Dashboard: Anzahl Ideen nach Stufe, Kategorie und Office (inkl. Zwischensummen)
CREATE VIEW v_pipeline_dashboard AS
SELECT s.stage_code, s.sort_order AS stage_order,
       c.name AS category,
       coalesce(o.name, '(no office)') AS office,
       GROUPING(s.stage_code, s.sort_order, c.name, coalesce(o.name, '(no office)')) AS grouping_level,
       count(*) AS idea_count
FROM idea i
JOIN stage s       ON s.stage_code = i.current_stage
JOIN category c    ON c.category_id = i.category_id
JOIN app_user u    ON u.user_id = i.submitter_id
LEFT JOIN office o ON o.office_id = u.office_id
GROUP BY GROUPING SETS (
  (s.stage_code, s.sort_order, c.name, coalesce(o.name, '(no office)')),
  (s.stage_code, s.sort_order),
  (c.name),
  (coalesce(o.name, '(no office)'))
);

-- Leaderboard: meistunterstützte Ideen (Stimmen im laufenden Quartal)
CREATE VIEW v_leaderboard_current_quarter AS
SELECT rank() OVER (ORDER BY count(*) DESC) AS rank,
       i.idea_id, i.title, c.name AS category, i.current_stage,
       count(*) AS votes_this_quarter
FROM vote v
JOIN idea i     ON i.idea_id = v.idea_id
JOIN category c ON c.category_id = i.category_id
WHERE v.created_at >= date_trunc('quarter', now())
GROUP BY i.idea_id, i.title, c.name, i.current_stage;

-- Bereit fürs Panel: offene Ideen + Tagesordnung des nächsten Termins
CREATE VIEW v_ready_for_panel AS
SELECT next_panel_date() AS next_panel_date,
       ov.idea_id, ov.title, ov.category, ov.current_stage, ov.vote_count,
       ov.weighted_score, ov.reviewer_count,
       a.position AS agenda_position
FROM v_idea_overview ov
JOIN stage s ON s.stage_code = ov.current_stage AND NOT s.is_terminal
LEFT JOIN panel_meeting m     ON m.meeting_date = next_panel_date() AND m.status = 'PLANNED'
LEFT JOIN panel_agenda_item a ON a.meeting_id = m.meeting_id AND a.idea_id = ov.idea_id
ORDER BY a.position NULLS LAST, s.sort_order DESC, ov.vote_count DESC;

-- =====================================================================
-- 9. Stammdaten
-- =====================================================================

INSERT INTO role (role_code, name, description) VALUES
  ('STAFF',    'Staff',    'Ideen einreichen, durchsuchen, abstimmen, kommentieren'),
  ('REVIEWER', 'Reviewer', 'Innovation Panel: Ideen bewerten und Stufen ändern (nicht eigene bewerten)'),
  ('ADMIN',    'Admin',    'Kategorien und Reviewer verwalten, Reports; keine Bewertung, keine Stufenwechsel');

INSERT INTO category (name, sort_order) VALUES
  ('Client delivery', 1),
  ('Internal tools and processes', 2),
  ('Sustainability', 3),
  ('People and culture', 4);

INSERT INTO stage (stage_code, name, sort_order, is_terminal) VALUES
  ('SUBMITTED',    'Submitted',    1, false),
  ('UNDER_REVIEW', 'Under Review', 2, false),
  ('PILOTING',     'Piloting',     3, false),
  ('IMPLEMENTED',  'Implemented',  4, true),
  ('DECLINED',     'Declined',     9, true);

INSERT INTO stage_transition (from_stage, to_stage) VALUES
  ('SUBMITTED',    'UNDER_REVIEW'),
  ('UNDER_REVIEW', 'PILOTING'),
  ('PILOTING',     'IMPLEMENTED'),
  ('SUBMITTED',    'DECLINED'),
  ('UNDER_REVIEW', 'DECLINED'),
  ('PILOTING',     'DECLINED');

INSERT INTO scoring_criterion (code, name, description, weight) VALUES
  ('IMPACT',      'Impact',      'Erwarteter Nutzen (1 = gering, 5 = sehr hoch)', 2.0),
  ('COST',        'Cost',        'Kosten (1 = sehr teuer, 5 = sehr günstig)',      1.0),
  ('FEASIBILITY', 'Feasibility', 'Umsetzbarkeit (1 = schwer, 5 = leicht)',         1.0);

COMMIT;

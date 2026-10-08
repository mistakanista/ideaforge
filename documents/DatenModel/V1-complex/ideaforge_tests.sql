-- IdeaForge – Testskript für die Geschäftsregeln (setzt ideaforge_schema.sql voraus)
-- Läuft in einer Transaktion und wird am Ende zurückgerollt.
SET search_path = ideaforge, public;
\set ON_ERROR_STOP 1
BEGIN;

-- Hilfsprozedur: erwartet, dass ein Statement fehlschlägt
CREATE OR REPLACE FUNCTION pg_temp.expect_fail(p_label text, p_sql text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'FEHLER: "%" hätte scheitern müssen', p_label;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'FEHLER: %' THEN RAISE; END IF;
  RAISE NOTICE 'OK (blockiert): % -> %', p_label, SQLERRM;
END $$;

INSERT INTO office (name) VALUES ('Frankfurt'), ('Berlin');
INSERT INTO app_user (google_sub, email, display_name, office_id) VALUES
  ('g-admin', 'dev.anand@example.com', 'Dev Anand', 1),   -- 1
  ('g-rev1',  'rev1@example.com',      'Reviewer One', 1),-- 2
  ('g-rev2',  'rev2@example.com',      'Reviewer Two', 2),-- 3
  ('g-staff', 'staff@example.com',     'Staff Member', 2);-- 4

-- Bootstrap-Admin ohne granted_by, danach vergibt der Admin Reviewer-Rollen
INSERT INTO user_role (user_id, role_code) VALUES (1, 'ADMIN');
INSERT INTO user_role (user_id, role_code, granted_by) VALUES (2, 'REVIEWER', 1), (3, 'REVIEWER', 1);

SELECT pg_temp.expect_fail('Zweiter Admin ohne Vergebenden', $q$INSERT INTO user_role (user_id, role_code) VALUES (4,'ADMIN')$q$);
SELECT pg_temp.expect_fail('Staff vergibt Reviewer-Rolle',   $q$INSERT INTO user_role (user_id, role_code, granted_by) VALUES (4,'REVIEWER',4)$q$);
SELECT pg_temp.expect_fail('Admin zusätzlich Reviewer',      $q$INSERT INTO user_role (user_id, role_code, granted_by) VALUES (1,'REVIEWER',1)$q$);
SELECT pg_temp.expect_fail('E-Mail doppelt (Groß/Klein)',    $q$INSERT INTO app_user (google_sub,email,display_name) VALUES ('x','STAFF@example.com','X')$q$);

-- Ideen einreichen
INSERT INTO idea (title, problem, solution, expected_impact, category_id, submitter_id) VALUES
  ('Digital timesheets', 'Paper timesheets are slow', 'Use a web form', 'Saves 2h per week', 2, 4),  -- 1
  ('Reviewer idea',      'Problem',                   'Solution',       'Impact',            3, 2),  -- 2
  ('Admin idea',         'Problem',                   'Solution',       'Impact',            4, 1);  -- 3

-- Stimmen
INSERT INTO vote (idea_id, user_id) VALUES (1,1),(1,2),(1,3),(2,4);
SELECT pg_temp.expect_fail('Doppelte Stimme', $q$INSERT INTO vote (idea_id,user_id) VALUES (1,1)$q$);

-- Stufenwechsel
SELECT pg_temp.expect_fail('Direktes UPDATE der Stufe',   $q$UPDATE idea SET current_stage='PILOTING' WHERE idea_id=1$q$);
SELECT pg_temp.expect_fail('Stufe überspringen',          $q$INSERT INTO idea_stage_history (idea_id,from_stage,to_stage,changed_by,reason) VALUES (1,'SUBMITTED','PILOTING',2,'skip')$q$);
SELECT pg_temp.expect_fail('Admin verschiebt Idee',       $q$INSERT INTO idea_stage_history (idea_id,from_stage,to_stage,changed_by,reason) VALUES (1,'SUBMITTED','UNDER_REVIEW',1,'x')$q$);
SELECT pg_temp.expect_fail('Staff verschiebt Idee',       $q$INSERT INTO idea_stage_history (idea_id,from_stage,to_stage,changed_by,reason) VALUES (1,'SUBMITTED','UNDER_REVIEW',4,'x')$q$);
SELECT pg_temp.expect_fail('Stufenwechsel ohne Begründung',$q$INSERT INTO idea_stage_history (idea_id,from_stage,to_stage,changed_by,reason) VALUES (1,'SUBMITTED','UNDER_REVIEW',2,'  ')$q$);

INSERT INTO idea_stage_history (idea_id, from_stage, to_stage, changed_by, reason)
VALUES (1, 'SUBMITTED', 'UNDER_REVIEW', 2, 'Promising, needs cost estimate');
SELECT pg_temp.expect_fail('Falsche from_stage',          $q$INSERT INTO idea_stage_history (idea_id,from_stage,to_stage,changed_by,reason) VALUES (1,'SUBMITTED','UNDER_REVIEW',2,'again')$q$);
SELECT pg_temp.expect_fail('Historie ändern',             $q$UPDATE idea_stage_history SET reason='x' WHERE idea_id=1$q$);

-- Bewertung
INSERT INTO idea_score (idea_id, reviewer_id, criterion_id, score) VALUES (1,2,1,5),(1,2,2,3),(1,3,1,4),(2,3,1,4);
SELECT pg_temp.expect_fail('Reviewer bewertet eigene Idee', $q$INSERT INTO idea_score (idea_id,reviewer_id,criterion_id,score) VALUES (2,2,1,5)$q$);
SELECT pg_temp.expect_fail('Admin bewertet',                $q$INSERT INTO idea_score (idea_id,reviewer_id,criterion_id,score) VALUES (1,1,1,5)$q$);
SELECT pg_temp.expect_fail('Staff bewertet',                $q$INSERT INTO idea_score (idea_id,reviewer_id,criterion_id,score) VALUES (1,4,1,5)$q$);
SELECT pg_temp.expect_fail('Punktzahl außerhalb Skala',     $q$INSERT INTO idea_score (idea_id,reviewer_id,criterion_id,score) VALUES (1,3,2,9)$q$);
SELECT pg_temp.expect_fail('Doppelte Bewertung',            $q$INSERT INTO idea_score (idea_id,reviewer_id,criterion_id,score) VALUES (1,2,1,4)$q$);

-- Ablehnung und zweite Chance
INSERT INTO idea_stage_history (idea_id, from_stage, to_stage, changed_by, reason)
VALUES (3, 'SUBMITTED', 'DECLINED', 2, 'Out of scope for this year');
SELECT pg_temp.expect_fail('Bewertung abgelehnter Idee',     $q$INSERT INTO idea_score (idea_id,reviewer_id,criterion_id,score) VALUES (3,2,1,3)$q$);
SELECT pg_temp.expect_fail('Neueinreichung nicht abgelehnt', $q$INSERT INTO idea (title,problem,solution,expected_impact,category_id,submitter_id,resubmission_of) VALUES ('Idea x2','p','s','i',2,4,1)$q$);
SELECT pg_temp.expect_fail('Neueinreichung durch Fremde',    $q$INSERT INTO idea (title,problem,solution,expected_impact,category_id,submitter_id,resubmission_of) VALUES ('Idea x2','p','s','i',4,4,3)$q$);
INSERT INTO idea (title, problem, solution, expected_impact, category_id, submitter_id, resubmission_of)
VALUES ('Admin idea v2', 'Problem', 'Better solution', 'Impact', 4, 1, 3);
SELECT pg_temp.expect_fail('Dritte Chance (zweimal dieselbe)', $q$INSERT INTO idea (title,problem,solution,expected_impact,category_id,submitter_id,resubmission_of) VALUES ('Idea v3','p','s','i',4,1,3)$q$);
INSERT INTO idea_stage_history (idea_id, from_stage, to_stage, changed_by, reason)
SELECT idea_id, 'SUBMITTED', 'DECLINED', 3, 'Still not feasible' FROM idea WHERE title = 'Admin idea v2';
SELECT pg_temp.expect_fail('Dritte Chance (Kette)',          format($q$INSERT INTO idea (title,problem,solution,expected_impact,category_id,submitter_id,resubmission_of) VALUES ('Idea v3','p','s','i',4,1,%s)$q$, (SELECT idea_id FROM idea WHERE title='Admin idea v2')));

-- Panel
SELECT pg_temp.expect_fail('Panel nicht am 1. Dienstag', $q$INSERT INTO panel_meeting (meeting_date) VALUES ('2026-11-10')$q$);
INSERT INTO panel_meeting (meeting_date, created_by) VALUES ('2026-11-03', 2), (next_panel_date(), 2) ON CONFLICT DO NOTHING;
INSERT INTO panel_agenda_item (meeting_id, idea_id, position, added_by)
SELECT meeting_id, 1, 1, 2 FROM panel_meeting WHERE meeting_date = next_panel_date();

-- Kommentare
INSERT INTO comment (idea_id, author_id, body) VALUES (1, 3, 'Could we reuse the HR portal?');

\echo '--- Datumsfunktionen'
SELECT first_tuesday_of_month('2026-10-15') AS okt, first_tuesday_of_month('2026-12-01') AS dez,
       next_panel_date('2026-10-07') AS ab_7okt, next_panel_date('2026-10-06') AS ab_6okt;
\echo '--- Ideenübersicht'
SELECT idea_id, title, current_stage, attempt_no, vote_count, weighted_score, reviewer_count, last_stage_reason FROM v_idea_overview ORDER BY idea_id;
\echo '--- Benachrichtigungen'
SELECT recipient_id, idea_id, message FROM notification ORDER BY notification_id;
\echo '--- Dashboard (nur Stufen-Summen)'
SELECT stage_code, idea_count FROM v_pipeline_dashboard WHERE grouping_level = 3 ORDER BY stage_order;
\echo '--- Leaderboard'
SELECT * FROM v_leaderboard_current_quarter;
\echo '--- Bereit fürs Panel'
SELECT * FROM v_ready_for_panel;
\echo '--- Volltextsuche "timesheet"'
SELECT idea_id, title FROM idea WHERE search_vector @@ websearch_to_tsquery('english', 'timesheet');

ROLLBACK;

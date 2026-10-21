# CR-2 Merge ideas

## Description
Reviewers can merge two near-identical ideas into one. The merged idea keeps all the votes (without counting anyone twice) and both submitters are credited.

## CHANGE IMPACT NOTE
Change: The client wants to merge two near-identical ideas into one. We propose to relate them instead (duplicates, replaces, is related to), so nothing is overwritten.
Requested by: Client (T&R) · Date: 2026-10-21

## What it touches:

### Stories and criteria:
New story US-13 (`requirements/UserStories/13-Merge ideas.md`), already rewritten to "relate" only (inverse labels, confidential ideas excluded). US-2 Dashboard/detail page: related ideas are shown on the detail page. US-4 Vote and US-12 Digest are not changed.

### Data:
New enum `idea_relation_type` (DUPLICATES, REPLACES, RELATED_TO) and new table `idea_relation` (relation_id, idea_id, related_idea_id, 
relation_type, created_by, created_at). One relation per pair of ideas, no relation of an idea to itself. No change to `idea`,
`vote`, `idea_transition`, `email_log`. The data model diagram gets one table.

### Screens:
Detail page (`IdeaDetails.tsx`): button "Relate" (reviewers only) opening a form with the relation type, a searchable list of active 
ideas (alphabetical) and a "Relate" button; a list "Related ideas" with title, relation, votes, owner and status. can be seen by everyone 
No new page.

### Rules:
- Only reviewers can relate ideas (not staff, not admins).
- The relations can be seen by everyone
- An idea cannot be related to itself; a pair has only one relation.
- Confidential ideas cannot be related (neither side), so a relation can never leak a confidential idea. The dropdown does not list them.
- Labels: one row is stored per relation. Seen from the first idea it reads "duplicates" / "replaces" / "is related to", seen from the other idea "is duplicated by" / "is replaced by" / "is related to".
- Anonymous ideas: the owner is not shown to other users (rule of US-11).
- Votes stay with their idea; no vote is moved or summed, so nobody is counted twice.

### Roles and permissions:
REVIEWER may create relations (row level security plus trigger check in the database, button hidden for others). STAFF and ADMIN read 
relations of ideas they can see. ADMIN cannot relate (admins cannot review). All can see the relations

### Calculations:
None. Votes are only displayed per idea. The digest ranking (US-12) is unchanged, so duplicates can both appear in the top 5 (question 4).

### Tests:
New pgTAP file `idea_relation_test.sql`; vitest for the new helper (searchable list, active ideas, alphabetical, no self, inverse label); existing suites must still pass (`idea_test`, `vote_test`, `idea_transition_test`, frontend 116 tests).

### Documents:
US-13 (criteria for "no self relation" and "one relation per pair" still to add), build log, `build/supabase/README.md`, `design/DataModel/Implemented-Datamodel/dataModel.md`.

### Questions for the client:
1. The request says "merge, keep all votes, credit both submitters". Is relating (ideas stay separate, each keeps its votes and owner) acceptable?
2. What is an "active" idea: everything except declined, or only ideas still in the pipeline (not declined, not implemented)? Default: not declined.
3. Can a reviewer relate an idea they submitted themselves (a relation is not a review)? Default: yes.
4. Should related ideas show combined votes, and should duplicates be left out of the monthly digest? Default: no, unchanged.
5. Can a relation be removed or changed after it was set? Not in the criteria, so not planned; a mistake cannot be undone.
6. Duplicates and replaces are directional (A replaces B), "is related to" is symmetric. Correct?

### Risk:
A confidential idea ending up in a relation: refused by the trigger, checked by pgTAP on both sides. Showing an anonymous owner: covered by the existing anonymity helper and a test. Wrong direction for replaces/duplicates: tested. Existing triggers (`idea_check`, `vote_check`) are not touched, so the old suites should stay green.

### Decision:
Do it as "relate" (not merge), once the client confirms question 1. Questions 2-6 have defaults and can be changed cheaply.

### Plan:
1. This note (done).
2. Database: migration `idea_relation` (table, check trigger, row level security) + pgTAP tests + data model diagram.
3. Frontend data layer: types, repository (mock and Supabase), rule helper + vitest.
4. Detail page: button, form, searchable dropdown, related ideas list.
5. Docs: US-13 criteria ticked after the manual check, README, build log.
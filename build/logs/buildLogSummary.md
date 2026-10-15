# idea forge build log summary per day

## 09.10.2026 · User setup supabase and google login
Builder: Gernot · Checked by: Uli

- What we asked for: Setup a supabase project with Google login and a local dev environment for the frontend
- What the AI changed: gave advice and some files in the supabase and frontend folder
- How we checked it:
  - Frontend still worked as expected
  - Supabase: the user was created, the redirect was tested with curl
- What went wrong, and how we fixed it: nothing
- What we learned about building with AI: a lot of regarding supabase and login with Google
- Saved version: configure Google redirect URL

## 10.10.2026 · User story 0 : Login
Builder: Gernot · Checked by: Uli

- What we asked for: user story US-0: Login and authorize, with acceptance criteria for login page, Google login, username/password login
- What the AI changed: a lot of files in the supabase and also frontend folder
- How we checked it:
    - Frontend: npm run test (unit tests) and npm run build (TypeScript check and build)
    - Supabase: we imported the data and checked the changes after the logins
- What went wrong, and how we fixed it: nothing
- What we learned about building with AI: a lot of regarding supabase and how to test it
- Saved version: a lot of commits the last on update claude.md

## 10.10.2026 · User story 1 : Store idea data in the database
Builder: Gernot · Checked by: Uli

- What we asked for: user story US-1: Store idea data in the database, with acceptance criteria for idea submission, category selection, and impact assessment
- What the AI changed: added a new migration for ideas, import script for the ideas, implemented the supabase repo
- How we checked it:
  - Frontend: npm run test (unit tests) and npm run dev, data is now loaded from the database
  - Supabase: we imported the idea data and added a new idea which now shows up in the database
- What went wrong, and how we fixed it: nothing
- What we learned about building with AI: it is good to make small steps, then everything seems to work fine, Claude writes a lot of tests out of the box
- Saved version: US-1 implement supabaseRepo

## 11.10.2026 · User story 2 : implement dashboard with data from supabase
Builder: Gernot · Checked by: Uli

- What we asked for: user story US-2: adjust the filters, put also the stages in a dropdown, make the users filterable and add a chip for my ideas
- What the AI changed: it changed the filters and the dashboard pages
- How we checked it:
  - Frontend: checked the filters, checked the own ideas, created a confidential idea (it showed up for the user who created it)
- What went wrong, and how we fixed it: 
  - the my chip did not work on the first attempt because Claude mixed up the supabase ids with the mock ids
  - after logout and login the filters of the previous user were still active
- What we learned about building with AI: the code is already to difficult to fix such a problem without AI in a short time
- Saved version: US-2 reset filter after logout and login

## 11.10.2026 · User story 3 : implement reviews
Builder: Gernot · Checked by: Uli

- What we asked for: user story US-3: implement reviews, with a simplified data structure (only one table)
- What the AI changed: 
  - simplified and created data structure for supabase
  - migrated the review dummy data to import it
  - displayed the review data from the database instead of the mock data
  - implemented the review form
- How we checked it:
  - Supabase: table was added, data was added, new row was added after sending a review
  - Frontend: moved a review to the next stage, declined a review
- What went wrong, and how we fixed it:
  - the acceptance criteria was initially not so clear, so no scoring was allowed in case the idea was declined, now scoring is optional
- What we learned about building with AI: you have to stay concentrated and keep on doing it with small steps
- Saved version: US-3 add confirmation before declining an idea

## 11.10.2026 · User story 4 : implement votes
Builder: Gernot · Checked by: Uli

- What we asked for: user story US-4: implement votes
- What the AI changed:
  - created data structure and import for votes
  - add rules for not voting confidential and own ideas
- How we checked it:
  - Supabase: table was added, data was added, new row was added after sending a review
  - Frontend: checked the votes for own ideas, voted for other ideas, checked confidential ideas that they have no votes
- What went wrong, and how we fixed it: nothing
- What we learned about building with AI: you have to stay concentrated and keep on doing it with small steps
- Saved version: US-4 add vote functionality

## 12.10.2026 · User story 5 : admin features
Builder: Gernot · Checked by: Uli

- What we asked for: user story US-5: implement admin features
- What the AI changed:
  - list users from supabase
  - admins can edit user roles
  - load and edit categories from supabase
- How we checked it:
  - Supabase: new category row was added
  - Frontend: changed user role to review, took away the admin role, set category to inactive
- What went wrong, and how we fixed it: nothing
- What we learned about building with AI: also Sonnet 5.5 is very reliable
- Saved version: US-5 update summary

## 13.10.2026 · User story 6 : resubmit declined ideas once
Builder: Gernot · Checked by: Uli

- What we asked for: user story US-6: implement resubmit declined ideas once
- What the AI changed:
  - added supabase rules
  - added resubmit button to declined ideas visible for creator
- How we checked it:
  - Frontend: resubmitted an idea
- What went wrong, and how we fixed it: nothing
- What we learned about building with AI: Claude works reliable
- Saved version: US-6 frontend changes

## 14.10.2026 · User story 11 : anonymous ideas
Builder: Gernot · Checked by: Uli

- What we asked for: user story US-11: implement anonymous ideas
- What the AI changed:
  - added supabase rules and added anonymous field to the idea table
  - added frontend changes: anonymous checkbox in idea form, name is not visible for others in anonymous ideas
- How we checked it:
  - Supabase: a new field was added to the idea table
  - Frontend: created an anonymous idea and checked it with another user
- What went wrong, and how we fixed it: nothing
- What we learned about building with AI: Claude works reliable
- Saved version: US-11 update buildLogSummary

## 15.10.2026 · User story 7 : add comments
Builder: Gernot · Checked by: Uli

- What we asked for: user story US-7: add comments
- What the AI changed:
  - added supabase rules and added comment field to the idea table, added seed data
  - added frontend changes: comment form, comment list
- How we checked it:
  - Supabase: checked the comment table
  - Frontend: created a comment and checked it with another user
- What went wrong, and how we fixed it: nothing
- What we learned about building with AI: Claude had no problems with this task 
- Saved version: US-7 update buildLogSummary
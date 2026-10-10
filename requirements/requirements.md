# Reuirements

We will try to follow the github and supabase path, as a fallback we will go for the local path

## Feature List
### must-haves
- US-0 Technical breakthrough: login and authorization with Google or email/password, first login password change, import dummy users
- US-1 Submit an idea: title, the problem it solves, the proposed solution, category and expected impact
- US-1 There are 4 categories: client delivery, internal tools and processes, sustainability, and people and culture
- US-1 Reviewers and admin can also send ideas but they must not score their own ideas
- US-1 ideas can be marked as confidential, then they are only visible to the submitter and the innovation panel (reviewers)
- US-1 if an idea is marked confidential, then it stays confidential also after implementation
- US-2 Browse and search ideas; one vote per person per idea
- US-2 A pipeline dashboard: ideas by stage, category and office
- US-3 Pipeline stages: Submitted → Under Review → Piloting → Implemented, or Declined, an idea can be declined all the times, but it cannot take the fast lane and has to move through all stages
- US-3 Only reviewers can move ideas between stages, and the submitter can see why, admins do not score and move ideas,
- US-3 impact, cost and feasibility are expected to be scored from 0 to 5, where cost 5 means least costs
- US-4 There is only one vote per idea and person
- US-5 can change category and make users to reviewers
- US-6 A declined idea can be submitted once more (second chance) with improvements

### should have
- US-7 Comments on ideas
- US-8 Notify submitters when their idea changes stage
- US-9 The app should work with Google Accounts 
- US-10 The app should be open for everyone and completely free to use
### could have
- Show ideas in the same category while someone is submitting, so they can spot duplicates
- A leaderboard of the most-backed ideas this quarter
- A ready for the panel list for the first Tuesday of each month, where the ideas will be discussed
- Users can edit their ideas
- Users can change their office

### must not have
- the app must not cost anything

## Design rules
- signature color is T&R copper (`#B9470C`) for buttons and links 
- T&R navy (`#1B2A41`) for headers
- Cloud grey (`#F4F5F7`) for backgrounds 
- IBM Plex Sans font. 
- [PNG logo](https://drive.google.com/file/d/1AwDg28tMh6ipaCcQtkWDZJ1zPzMoM2Po/view?usp=drive_link) and [SVG logo](https://drive.google.com/file/d/1k0RXz4vdB7GFPNcy8yYfvoGLPwe5Qn3V/view?usp=drive_link).
- large tap targets
- visible labels on every field
- good colour contrast
- never use color alone to show status.
# IdeaForge: idea pipeline project instructions

## Purpose
Workflow for creating, scoring and implementing ideas

## Sources
- the clients brief in [brief_b_idea_pipeline_for_tallis_and_reeve_8bf8aa26bd.pdf](clientBrief.pdf)
- all requirement related artefacts are stored in the requirement folder
- the requirements in requirements.md
- the user stories in the UserStories folder
- all design related artefacts are stored in the design folder
- the data models in the dataModel folder


## Users and roles
- all staff can create an idea and see the dashboard (besides confidential ideas)
- reviewer can decline and score ideas
- the admin can add categories and change the users role to reviewer

## Pathway and tools
- Github and Supabase
- local as fallback and for development

##Data
- Full model: see design/datModel.md

##Screens and design rules
- it should work on screens and phones
- signature color is T&R copper (`#B9470C`) for buttons and links
- T&R navy (`#1B2A41`) for headers
- Cloud grey (`#F4F5F7`) for backgrounds
- IBM Plex Sans font.
- large tap targets
- visible labels on every field
- good colour contrast
- never use colour alone to show status.

## Rules that must never break
- confidential ideas are only visible to the submitter and the reviewers
- a reviewer can never review his own ideas
- admins cannot review ideas
- only admins can access and edit the user and category page


## How to work with us
- Before changing anything, explain your plan in German or English and wait for us to agree.
- Build one small feature at a time, and tell us how to check it works.
- Ask if something is unclear. Don't guess.
- Never add features that aren't in our requirements.
- After each change, update the build log in build/logs/buildLog.md.
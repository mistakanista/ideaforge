# My reflection on building with AI

## A moment where AI helped most
AI built all features reliably and with hardly any bugs. It considered a lot of aspects we were not aware of and asked good questions in the plan phase, before we implemented the features. It set up the architecture of the frontend well structured and especially we would not have been able to implement the row based security constraints in supabase and all the tests regarding it.

## A moment where AI misled you
The initial data model was too complex and also the user journey included more than we had asked for. But as we implemented the data model step by step with only the fields and tables that were necessary, we were able to simplify it. There were also some functional bugs like that the My ideas button did not work right away and some business rules were too strict like that it is not allowed to score ideas, when they are declined

## Something only you or your team could do
We retrieved the missing and additional requirements from the client. We created and prioritized the user stories. We wrote the acceptance criterias and made the slices or bounded contexts for the implementation. We reviewed the code and tested the implementations before they were pushed to the repo. We created the CLAUDE.md and questioned the plans of the AI

## What you’d do differently next time
For me the dependency on the AI was too high in this project. There would not have been a chance to implement a feature without AI, especially regarding Supabase, there is a lack of knowledge. It was also not possible to understand all aspects of the code when reviewing. The business rules in the migrations are also hard to read, understand and they must not be changed. They are also not well structured and encapsulated. So for a real long lasting customer project, I would not take Supabase as the backend again

## How you’ll use this in your own work
The CLAUDE.md and the build Log are very useful. Also having all the user stories and acceptance criteria in the repo as md Files helps, because it enables Claude to find discrepancies and conflict. But the md Files are not so well readable for humans. I also prefer to not so depend on the AI, be able to implement features on my own and understand better what has been created.



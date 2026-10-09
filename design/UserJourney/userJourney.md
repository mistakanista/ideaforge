# IdeaForge: User Journey of an Idea

The journey of an idea from submission to implementation or rejection, for normal and for **confidential** ideas.
Sources: `requirements/requirements.md`, `requirements/UserStories/1–10`, `CLAUDE.md`, `design/DatenModel/V2-StammdatenIntegriert/ideaforge_datenmodell.md` and decisions from the chat on 2026-10-08.

## 1. Roles & permissions

| Action | Staff | Reviewer / Innovation Panel | Admin |
|---|---|---|---|
| Submit an idea | ✅ | ✅ | ✅ |
| View, search and filter the dashboard | ✅ | ✅ | ✅ |
| See confidential ideas | own only | ✅ | own only |
| Vote (1 vote per person and idea) | ✅ | ✅ | ✅ |
| Comment | ✅ | ✅ | ✅ |
| Score an idea (1–5) | ❌ | ✅, but **never their own idea** | ❌ |
| Change stage / decline | ❌ | ✅, but **never their own idea** | ❌ |
| Manage users and categories | ❌ | ❌ | ✅ |

## 2. Normal and confidential ideas compared

Rule from `CLAUDE.md` and US-1: confidential ideas are visible **only to the submitter and the reviewers (Innovation Panel)**. Flow, stages, scoring, declining and second chance are identical; only the visibility differs.

| Step | Normal idea | Confidential idea |
|---|---|---|
| Visibility | all users | submitter and reviewers only; **not** colleagues, **not** admins |
| Dashboard / search | findable by everyone | only in the view of the submitter and reviewers |
| Voting | all users | only those who can see the idea (submitter, reviewers) |
| Comments | all users | submitter and reviewers only |
| Scoring / changing stage | reviewers, never their own idea | same |
| Notifications | to the submitter | same |
| Stages, declining, second chance | Submitted → Reviewing → Piloting → Implemented, Declined | same |

## 3. User journey

The values show the satisfaction per step: 1 = frustrated, 5 = delighted. The labels are kept short on purpose, because Mermaid cuts off long texts in this diagram type.

```mermaid
journey
    title User journey of an idea in IdeaForge
    section Submit
      Sign in with Google: 4: Submitter
      Fill in the form: 3: Submitter
      Check similar ideas: 3: Submitter
      Optionally confidential: 4: Submitter
      Submit, stage Submitted: 5: Submitter
    section Feedback normal
      Visible in dashboard: 5: Submitter, Colleagues
      Vote: 4: Colleagues
      Comment: 4: Colleagues
      Notified about comment: 4: Submitter
    section Feedback confidential
      Submitter and reviewers only: 5: Submitter, Reviewer
      Colleagues and admins see nothing: 4: Submitter
      Question from a reviewer: 4: Reviewer, Submitter
    section Review
      Stage Reviewing: 4: Reviewer, Submitter
      Score costs, feasibility, impact: 3: Reviewer
      Panel discusses: 3: Innovation Panel
      Move on or decline: 3: Innovation Panel, Submitter
    section Pilot
      Stage Piloting: 5: Submitter, Innovation Panel
      Evaluate pilot: 3: Reviewer
    section Implementation
      Stage Implemented: 5: Submitter, Innovation Panel
    section Declined
      Read the reason: 2: Submitter
      Resubmit once: 3: Submitter
```

Depending on the flag, an idea goes through **either** "Feedback normal" **or** "Feedback confidential".

## 4. Flow with decisions

```mermaid
flowchart TD
    subgraph SUB["Submitter (any user)"]
        A([Start: sign in with Google]) --> B["Create idea:<br/>title, problem, solution,<br/>category, expected impact"]
        B --> C{"Confidential?"}
        C -- yes --> C1["Visible to submitter<br/>and reviewers only"]
        C -- no --> C2["Visible to everyone"]
        C1 --> D["Submit<br/>office and user are<br/>stored automatically"]
        C2 --> D
        N1["Notification about<br/>stage change and reason"]
        R1{"Declined<br/>before?"}
        R1 -- "no, 1st decline" --> R2["Improve and<br/>resubmit once<br/>(second chance)"]
        R1 -- "yes, 2nd decline" --> X([Finally declined])
        R2 --> B
    end

    subgraph ALL["All users allowed to see the idea"]
        E["Dashboard: search, filter<br/>by category, office, votes"]
        F["Vote<br/>(1 vote per person)"]
        G["Comment"]
        E --> F
        E --> G
    end

    subgraph REV["Reviewer / Innovation Panel"]
        H{"Own idea?"}
        H -- yes --> H1["Another reviewer<br/>takes over"]
        H1 --> I
        H -- no --> I["Score 1 to 5 each:<br/>costs, feasibility, impact"]
        I --> J{"Decision"}
        J -- move on --> K["Next stage<br/>(no skipping)"]
        J -- decline --> L["Give a reason<br/>(required)"]
        L --> M["Stage: Declined"]
    end

    D --> S1[["Stage: Submitted"]]
    S1 -- "normal: everyone<br/>confidential: submitter<br/>and reviewers only" --> E
    S1 --> H
    K --> S2[["Submitted → Reviewing<br/>→ Piloting → Implemented"]]
    S2 -- "not yet Implemented" --> H
    S2 -- "Implemented" --> Z([Idea implemented])
    K --> N1
    M --> N1
    G --> N1
    N1 -- "if Declined" --> R1
```

Note: admins submit ideas like everyone else, but they do not score ideas or move stages.

## 5. Visibility of a confidential idea

```mermaid
flowchart LR
    I[["Confidential idea"]]
    I -- "sees, comments,<br/>gets notifications" --> S["Submitter"]
    I -- "sees, comments,<br/>scores, changes stage" --> R["Reviewer / Innovation Panel"]
    I -. "not visible" .-> K["Colleagues"]
    I -. "not visible" .-> A["Admin"]
    R --> C{"Own idea?"}
    C -- yes --> C1["May only view,<br/>not score"]
    C -- no --> C2["May score<br/>and change stage"]
```

## 6. Sequence: who does what?

```mermaid
sequenceDiagram
    autonumber
    actor S as Submitter
    participant App as IdeaForge
    actor K as Colleagues and admins
    actor R as Reviewer
    actor P as Innovation Panel

    S->>App: Create idea (title, problem, solution, category, impact, optionally confidential)
    App-->>S: Saved with ID, stage Submitted
    alt Idea is not confidential
        K->>App: Vote and comment
        App-->>S: Notification about comment
    else Idea is confidential
        K-xApp: Dashboard and search
        Note over K,App: Confidential idea is not shown
        R->>App: Question as a comment
        App-->>S: Notification about comment
        S->>App: Answer as a comment
    end
    R->>App: Set stage to Reviewing
    App-->>S: Notification about stage change
    R->>App: Score costs, feasibility, impact (1 to 5 each)
    Note over R,App: Not allowed for own idea. Admins do not score.
    R->>P: Prepare idea with scores for the panel
    alt Panel agrees
        P->>App: Set stage to Piloting, with reason
        App-->>S: Notification with reason
        P->>App: After a successful pilot, set stage to Implemented
        App-->>S: Notification: idea implemented
    else Panel declines (possible in every active stage)
        P->>App: Set stage to Declined, reason required
        App-->>S: Notification with reason
        opt First decline
            S->>App: Resubmit the improved idea once
        end
    end
```

## 7. Stage model

```mermaid
stateDiagram-v2
    [*] --> Submitted : Any user submits
    Submitted --> Reviewing : Reviewer
    Reviewing --> Piloting : Panel, after scoring
    Piloting --> Implemented : Panel
    Implemented --> [*]

    Submitted --> Declined : Reason required
    Reviewing --> Declined : Reason required
    Piloting --> Declined : Reason required

    Declined --> Submitted : Second chance, once only
    Declined --> [*] : final after 2nd decline

    note right of Reviewing
        Score 1 to 5 each
        Costs, Feasibility, Impact
        Reviewers and panel only,
        never their own idea
    end note
```

Rules for normal and confidential ideas:
- No stage may be skipped.
- An idea can be declined from every active stage.
- Only reviewers or the Innovation Panel change stages.
- The submitter sees the reason for every change.

## 8. Open points

### Differences from existing documents

| # | Topic | This user journey | Existing documents | To clarify |
|---|---|---|---|---|
| 1 | Name of the 2nd stage | **Reviewing** | "Under Review" (requirements.md, US-3), `UNDER_REVIEW` (data model V2) | Agree on one name and align the documents |
| 2 | Score scale | **1–5** | 0–5 (requirements.md, US-3) | Decide the scale, adjust `scoring_criterion.min_score` |
| 3 | Meaning of the cost score | – | "cost 5 means least costs" (requirements.md) | Confirm: 5 = lowest cost, so "higher = better" applies everywhere |
| 4 | Reason | Required when declining | US-3: reason with scores for **every** stage change; data model: `reason` always required | Required only when declining or for every change? |
| 5 | Second chance | Resubmit a declined idea once | Data model: as a **new** idea with `attempt_no = 2` | The diagram simplifies this as a return to Submitted |

### Confidential ideas (not covered by the requirements)

| # | Question | Why it matters |
|---|---|---|
| 6 | Does a confidential idea stay confidential after **Implemented**, or does it become public? | Implemented ideas are often interesting for everyone |
| 7 | May the submitter **change** the confidential flag later? | Not covered by the requirements |
| 8 | Does a resubmitted idea (second chance) keep the flag? | New idea with `attempt_no = 2` in the data model |
| 9 | Do confidential ideas count in the **dashboard statistics** (by stage, category, office), e.g. anonymously as a number? | US-2 dashboard for all users |
| 10 | May reviewers **vote** on confidential ideas? | Otherwise voting is a signal from colleagues, which is missing here |

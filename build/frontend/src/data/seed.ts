// Deterministic demo data: 12 users, 4 categories and 60 ideas in all stages,
// with votes, comments, reviewer scores and stage history. Same result on every reset.
import { SCORING_CRITERIA } from '../config';
import { canSeeIdea } from '../lib/ideaQuery';
import type { AppUser, Category, Comment, Idea, IdeaRelation, IdeaScore, IdeaStage, IdeaStageHistory, OfficeCode, UserRole, Vote } from '../types';

export interface Database {
  users: AppUser[];
  categories: Category[];
  ideas: Idea[];
  history: IdeaStageHistory[];
  votes: Vote[];
  comments: Comment[];
  relations: IdeaRelation[];
  scores: IdeaScore[];
}

const USERS: [string, OfficeCode, UserRole][] = [
  ['Priya Shah', 'BRISTOL', 'ADMIN'],
  ['Ruth Evans', 'LEEDS', 'REVIEWER'],
  ['Tom Hallworth', 'GLASGOW', 'REVIEWER'],
  ['Aisha Rahman', 'BRISTOL', 'REVIEWER'],
  ['Daniel Okafor', 'BRISTOL', 'STAFF'],
  ['Sofia Marin', 'LEEDS', 'STAFF'],
  ['Lena Fischer', 'GLASGOW', 'STAFF'],
  ['Marcus Reid', 'LEEDS', 'STAFF'],
  ['Gareth Lowe', 'GLASGOW', 'STAFF'],
  ['Chloe Bennett', 'BRISTOL', 'STAFF'],
  ['Sam Patel', 'LEEDS', 'STAFF'],
  ['Morgan Hughes', 'GLASGOW', 'STAFF'],
];

const CATEGORIES: [string, string][] = [
  ['Client delivery', 'How we serve and deliver work for our clients.'],
  ['Internal tools and processes', 'Software, workflows and admin that make daily work easier.'],
  ['Sustainability', 'Reducing waste, travel and energy across our offices.'],
  ['People and culture', 'Wellbeing, learning and how we work together.'],
];

// [title, problem, proposed solution, expected impact, category index]
const IDEAS: [string, string, string, string, number][] = [
  ['Snap expense receipts with your phone', 'Paper receipts get lost and month-end claims take hours to reconcile by hand. Finance chases missing receipts every month and claims are often paid late because of it.', 'Let staff photograph receipts in a mobile app that reads amount, date and supplier and attaches them to the claim automatically.', 'Saves around two hours per person per month and gets claims paid within a week.', 1],
  ['Shared pool cars between offices', 'Staff travelling between our three offices either rent cars or claim personal mileage. The same routes are driven several times a week and nobody can see whether a colleague is already making the trip.', 'Lease two pool cars per office and let staff book them, and offer spare seats, through a shared calendar on the intranet.', 'Lower travel costs, fewer individual journeys and an easier way to share trips.', 2],
  ['Secure client portal for document uploads', 'Clients email sensitive documents as attachments, which is slow and risky.', 'Offer a branded upload portal with expiring links and automatic filing into the matter folder.', 'Fewer security incidents and faster onboarding of new client matters.', 0],
  ['Reusable cups at every coffee point', 'Each office throws away hundreds of disposable cups every week.', 'Provide branded reusable cups and a small dishwasher at every coffee point.', 'Around 30,000 fewer disposable cups a year.', 2],
  ['Book quiet rooms from the intranet', 'Quiet rooms are booked on paper sheets, so they are often double-booked.', 'Add the quiet rooms to the existing room booking tool with a 2-hour limit.', 'Less frustration and fairer access to focus space.', 1],
  ['Monthly cross-office lunch-and-learn', 'Teams in different offices rarely hear about each other’s work.', 'A 45-minute online session once a month where one team presents a recent project.', 'Better knowledge sharing and more cross-office collaboration.', 3],
  ['Retire the fax line for court filings', 'A single fax machine is still kept just for a handful of filings each year.', 'Move the remaining filings to the court e-filing service and cancel the line.', 'Saves line rental and removes a manual process.', 1],
  ['Client feedback after every matter', 'We only hear from clients when something has gone wrong.', 'Send a three-question survey automatically when a matter is closed and share results with the team.', 'Earlier warning of unhappy clients and evidence for pitches.', 0],
  ['Onboarding buddy for new starters', 'New joiners say their first weeks feel lonely, especially in smaller offices.', 'Pair every new starter with a buddy from another team for their first three months.', 'Faster settling-in and better retention in the first year.', 3],
  ['Paperless onboarding pack for new starters', 'New joiners sign and scan a dozen forms on day one before they can start work.', 'Replace the paper pack with e-signature forms sent before the first day.', 'Day one starts with real work instead of paperwork.', 1],
  ['Solar panels on the Bristol office roof', 'The Bristol office roof is flat, south-facing and unused.', 'Lease solar panels through a power purchase agreement with no upfront cost.', 'Covers about 20% of the office electricity.', 2],
  ['Template library for client letters', 'Everyone keeps their own version of standard letters, with outdated wording.', 'One reviewed template library in the document system, owned by a small editorial group.', 'Consistent quality and less time spent on routine letters.', 0],
  ['Mental health first aiders in every office', 'Staff do not know whom to talk to when they are struggling.', 'Train two volunteers per office as mental health first aiders and list them on the intranet.', 'Earlier support and fewer long-term absences.', 3],
  ['Automatic conflict check on new matters', 'Conflict checks are done by hand by searching three systems, which takes up to a day.', 'Connect the matter intake form to a single search across all three systems.', 'New matters open the same day.', 0],
  ['Cycle-to-work storage and showers', 'Staff would cycle in but there is nowhere safe to leave bikes in Leeds.', 'Rent 20 secure bike spaces nearby and refurbish the unused shower room.', 'More active commuting and fewer car parking requests.', 2],
  ['One-click screen sharing in meeting rooms', 'Meetings start late because people can’t get the room screen to connect.', 'Install wireless presentation hubs in every meeting room.', 'About ten minutes saved per meeting.', 1],
  ['Plain-English summaries for clients', 'Clients say our advice letters are hard to read.', 'Add a one-page plain-English summary to every advice letter.', 'Happier clients and fewer follow-up questions.', 0],
  ['Recognition wall on the intranet', 'Good work often goes unnoticed outside the team.', 'A simple intranet page where anyone can thank a colleague publicly.', 'Stronger team spirit across offices.', 3],
  ['Switch to a green energy tariff', 'Two of our offices are still on standard energy tariffs.', 'Move all offices to a certified renewable tariff when the contracts end.', 'Large cut in reported carbon emissions at similar cost.', 2],
  ['Self-service IT password reset', 'The IT helpdesk spends a third of its time resetting passwords.', 'Enable self-service password reset with multi-factor verification.', 'Frees helpdesk time and gets people working again in minutes.', 1],
  ['Matter dashboards for clients', 'Clients phone to ask about the status of their matters.', 'Give clients a read-only dashboard with milestones and next steps.', 'Fewer status calls and more transparency.', 0],
  ['Flexible start times', 'Fixed 9am starts clash with school runs and long commutes.', 'Core hours from 10am to 3pm with flexible start and finish.', 'Better work-life balance and easier recruiting.', 3],
  ['Digital signatures for internal approvals', 'Internal approvals still need wet signatures and scanning.', 'Use the e-signature tool for internal approval forms as well.', 'Approvals in hours instead of days.', 1],
  ['Food waste composting', 'Food waste from the kitchens goes into general waste.', 'Add food waste caddies and a weekly collection by a local composting firm.', 'Less landfill and a visible green step for staff.', 2],
  ['Mentoring across offices', 'Junior staff in small offices have few senior people to learn from.', 'A mentoring scheme that matches juniors with seniors in other offices.', 'Faster development and a stronger link between offices.', 3],
  ['Shared calendar of client events', 'Teams invite the same clients to events in the same week without knowing.', 'One shared calendar of client events visible to all partners.', 'Better coordinated client contact.', 0],
  ['Smarter printing by default', 'Printers default to single-sided colour printing.', 'Set double-sided black-and-white as default and add follow-me printing.', 'Around 40% less paper and toner.', 2],
  ['Knowledge base for recurring questions', 'The same questions reach HR and IT every week.', 'A searchable knowledge base with answers to the top 50 questions.', 'Fewer tickets and quicker answers for staff.', 1],
  ['Quarterly team volunteering day', 'Staff want to give back but do not have time.', 'One paid volunteering day per person per quarter with partner charities.', 'Stronger community ties and engagement.', 3],
  ['Video calls instead of client travel', 'Many short client meetings involve a full day of travel.', 'Offer video meetings as the default for routine updates.', 'Less travel time and lower emissions.', 2],
  ['Standard project kick-off checklist', 'Projects start without agreed scope, budget or contacts.', 'A one-page kick-off checklist that must be completed before work starts.', 'Fewer write-offs and clearer client expectations.', 0],
  ['Meeting-free Friday afternoons', 'Calendars are so full that there is no time for focused work.', 'No internal meetings on Friday afternoons across the firm.', 'More focus time and better quality work.', 3],
  ['Central contract renewal reminders', 'Supplier contracts renew automatically because nobody tracks the dates.', 'Record all supplier contracts in one register with reminders 90 days before renewal.', 'Avoids unwanted renewals and gives room to negotiate.', 1],
  ['Plant-based catering by default', 'Catering for internal events is mostly meat-based.', 'Make plant-based options the default with meat on request.', 'Lower footprint of events and more inclusive menus.', 2],
  ['Client onboarding in one form', 'New clients fill in four separate forms with the same information.', 'Merge them into one online form that feeds all systems.', 'Faster onboarding and fewer data errors.', 0],
  ['Learning budget per person', 'Training requests need several approvals and are often refused.', 'A fixed yearly learning budget each person can spend on approved courses.', 'More development and less admin.', 3],
  ['Retire unused software licences', 'We pay for licences that nobody has used for months.', 'Review licence usage every quarter and cancel unused seats.', 'Direct cost savings on software.', 1],
  ['LED lighting with motion sensors', 'Lights stay on all night in meeting rooms and corridors.', 'Replace old lighting with LEDs and motion sensors.', 'Lower energy bills and emissions.', 2],
  ['Lessons-learned review after big projects', 'The same mistakes repeat because nobody records what went wrong.', 'A 30-minute review after every large project, stored in the knowledge base.', 'Fewer repeated mistakes.', 0],
  ['Wellbeing hour each week', 'Staff feel they cannot take breaks during busy periods.', 'One protected hour each week for exercise, a walk or rest.', 'Less stress and better health.', 3],
  ['Electronic timesheets on mobile', 'Timesheets are filled in late because they only work on desktop.', 'A mobile-friendly timesheet with reminders.', 'More accurate time recording and faster billing.', 1],
  ['Office plant and air quality programme', 'The Glasgow office feels stuffy in the afternoons.', 'Add plants and simple CO2 monitors that show when to open windows.', 'Better air and concentration.', 2],
  ['Client newsletter on regulatory changes', 'Clients learn about regulatory changes from competitors first.', 'A short monthly newsletter on changes that affect our clients.', 'Positions us as proactive advisers.', 0],
  ['Job shadowing between teams', 'People do not understand what other teams actually do.', 'Allow one day of job shadowing per year in another team.', 'Better cooperation and career ideas.', 3],
  ['Single sign-on for all tools', 'Staff juggle a dozen passwords for different tools.', 'Connect all business tools to single sign-on.', 'Fewer password resets and better security.', 1],
  ['Rainwater for office toilets', 'Leeds uses mains water for toilets although the building has a gutter system.', 'Install a small rainwater harvesting tank for toilet flushing.', 'Lower water bills and use.', 2],
  ['Partner office hours for juniors', 'Juniors hesitate to approach partners with questions.', 'Each partner offers one open office hour per month.', 'More confident juniors and faster answers.', 3],
  ['Automatic matter closure reminders', 'Closed matters stay open in the system for months and distort reports.', 'Send reminders when a matter has had no activity for 60 days.', 'Cleaner data and accurate reports.', 0],
  ['Second-hand office furniture first', 'New furniture is bought although good used items are in storage.', 'Check the storage inventory and second-hand suppliers before buying new.', 'Less waste and lower costs.', 2],
  ['Bring your own device policy', 'Staff carry two phones because private devices are not allowed.', 'A clear policy and device management for private phones.', 'Convenience and lower hardware costs.', 1],
  ['Welcome breakfast for new clients', 'New clients only meet the partner, not the wider team.', 'Invite new clients to a short breakfast with the whole team.', 'Stronger relationships from the start.', 0],
  ['Language classes for staff', 'Several clients are based abroad and we rely on agencies to translate.', 'Offer subsidised language classes in German and French.', 'Closer relations with international clients.', 3],
  ['Digital visitor sign-in', 'Visitors sign a paper book at reception, which is not GDPR-friendly.', 'A tablet sign-in that notifies the host automatically.', 'Better data protection and a better first impression.', 1],
  ['Carbon budget for business travel', 'Nobody knows how much carbon our travel causes.', 'Report travel emissions per team and set a yearly budget.', 'Measurable reduction of travel emissions.', 2],
  ['Peer review of key client documents', 'Important documents go out without a second pair of eyes.', 'A lightweight four-eyes check for documents above a set value.', 'Fewer errors in client work.', 0],
  ['Celebrate project milestones', 'Project successes are not celebrated, especially in remote teams.', 'A small budget per team to mark big milestones.', 'Higher motivation and team spirit.', 3],
  ['Shared drive clean-up week', 'The shared drive is full of duplicates and outdated files.', 'One week per year where every team archives or deletes old files.', 'Faster search and lower storage costs.', 1],
  ['Refill stations instead of bottled water', 'Meeting rooms are stocked with plastic water bottles.', 'Install filtered water refill stations and glass carafes.', 'Thousands fewer plastic bottles each year.', 2],
  ['Client satisfaction score in partner reviews', 'Partner reviews look only at billable hours.', 'Add client satisfaction as a factor in partner reviews.', 'More focus on long-term client relationships.', 0],
  ['Quiet coaches on team away days', 'Away days are packed with workshops and leave no time to talk.', 'Plan unstructured time and smaller group conversations into away days.', 'Better connections between colleagues.', 3],
];

/** Small seeded random generator (mulberry32) so the demo data is the same on every reset. */
function createRandom(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ACTIVE_PATH: IdeaStage[] = ['SUBMITTED', 'UNDER_REVIEW', 'PILOTING', 'IMPLEMENTED'];

const MOVE_REASONS: Partial<Record<IdeaStage, string>> = {
  UNDER_REVIEW: 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.',
  PILOTING: 'Scores are convincing. We start a three-month pilot in one office.',
  IMPLEMENTED: 'The pilot met its goals. The idea is rolled out to all offices.',
};

// Demo comments (US-7) on non-confidential, non-anonymous ideas; the same list is in
// build/supabase/scripts/import_demo_comments.sql, keep both in sync.
// [idea_id, author name, index of the answered comment or null, text, created_at]
const COMMENTS: [number, string, number | null, string, string][] = [
  [1, "Sofia Marin", null, "Would this also work for foreign currency receipts? I travel to Dublin a lot.", "2026-04-12T09:14:00Z"],
  [1, "Daniel Okafor", 0, "Yes, the plan is to read the currency from the receipt and convert at the monthly rate Finance already uses.", "2026-04-12T11:02:00Z"],
  [1, "Sofia Marin", 1, "Great, that would remove my biggest monthly headache.", "2026-04-12T13:40:00Z"],
  [1, "Ruth Evans", null, "Please include how long receipts must be kept. Our audit rules ask for seven years.", "2026-04-20T10:30:00Z"],
  [1, "Chloe Bennett", null, "+1 from me. Finance chases me every month.", "2026-05-03T15:05:00Z"],
  [2, "Tom Hallworth", null, "Insurance for pool cars needs a look: do we cover all staff drivers?", "2026-04-15T08:45:00Z"],
  [2, "Chloe Bennett", 5, "Good point. I will ask our broker and add the answer here.", "2026-04-15T16:20:00Z"],
  [2, "Gareth Lowe", null, "Glasgow to Leeds is the route I drive most. Could an electric car cover it?", "2026-04-22T12:10:00Z"],
  [2, "Marcus Reid", 7, "Range is fine for that route, but charging at the Leeds office would be needed.", "2026-04-23T09:00:00Z"],
  [2, "Gareth Lowe", 8, "Then charging points should be part of the proposal.", "2026-04-23T10:25:00Z"],
  [3, "Aisha Rahman", null, "Which clients would use it first? A pilot with two or three clients would be enough.", "2026-04-18T14:00:00Z"],
  [3, "Priya Shah", null, "IT security should review the expiring links before we promise anything to clients.", "2026-04-25T09:30:00Z"],
  [3, "Tom Hallworth", 11, "Agreed, I have asked IT for a short review.", "2026-04-25T17:15:00Z"],
  [5, "Morgan Hughes", null, "Two hours may be too short for deep work. Could we allow a second booking?", "2026-05-02T11:20:00Z"],
  [5, "Sam Patel", 13, "Or four hours with a check-in, so unused rooms are released.", "2026-05-02T14:50:00Z"],
  [9, "Sofia Marin", null, "My buddy made my first weeks much easier. Thank you for suggesting it!", "2026-06-10T09:05:00Z"],
  [9, "Gareth Lowe", 15, "Great to hear, thanks Sofia!", "2026-06-10T10:30:00Z"],
  [9, "Lena Fischer", null, "Could buddies get a short guide with ideas for the first coffee chat?", "2026-06-18T13:45:00Z"],
  [11, "Aisha Rahman", null, "What is the expected payback time compared with the power purchase agreement?", "2026-05-12T10:00:00Z"],
  [11, "Lena Fischer", 18, "With the agreement there is no upfront cost; the roof survey will show the exact saving.", "2026-05-12T15:30:00Z"],
  [11, "Daniel Okafor", null, "Does the roof need reinforcement first?", "2026-05-20T08:40:00Z"],
  [8, "Chloe Bennett", null, "Three questions are a good limit. Please keep one free-text question.", "2026-04-30T12:00:00Z"],
];

const DECLINE_REASONS = [
  'The costs are too high compared with the expected benefit at the moment.',
  'A similar initiative is already running; please support that one instead.',
  'Not feasible with our current systems. Worth revisiting after the IT upgrade.',
];

export function createSeed(): Database {
  const random = createRandom(42);
  const pick = <T,>(list: T[]): T => list[Math.floor(random() * list.length)];

  const users: AppUser[] = USERS.map(([name, office, role], i) => ({
    user_id: i + 1,
    email: `${name.toLowerCase().replace(/\s+/g, '.')}@tallis.uk`,
    display_name: name,
    office,
    role,
    role_changed_by: role === 'STAFF' || i === 0 ? null : 1,
    role_changed_at: role === 'STAFF' || i === 0 ? null : '2026-03-02T09:00:00.000Z',
    is_active: true,
  }));

  const categories: Category[] = CATEGORIES.map(([name, description], i) => ({
    category_id: i + 1,
    name,
    description,
    sort_order: i + 1,
    is_active: true,
  }));

  const reviewers = users.filter((u) => u.role === 'REVIEWER');
  const ideas: Idea[] = [];
  const history: IdeaStageHistory[] = [];
  const votes: Vote[] = [];
  const scores: IdeaScore[] = [];

  const start = Date.parse('2026-03-02T08:00:00.000Z');
  const end = Date.parse('2026-10-07T17:00:00.000Z');
  const day = 24 * 60 * 60 * 1000;

  IDEAS.forEach(([title, problem, solution, expected_impact, categoryIndex], i) => {
    const idea_id = i + 1;
    // Older ideas are further down the pipeline.
    const created = new Date(start + ((end - start) * i) / IDEAS.length + random() * 0.5 * day);
    const age = (end - created.getTime()) / (end - start);
    const submitter = users[(i * 5 + 4) % users.length];

    const stepsMax = age > 0.6 ? 3 : age > 0.35 ? 2 : age > 0.12 ? 1 : 0;
    const steps = Math.min(stepsMax, Math.floor(random() * (stepsMax + 1.6)));
    const declined = i % 9 === 6 && steps < 3;
    const finalStage: IdeaStage = declined ? 'DECLINED' : ACTIVE_PATH[steps];

    const idea: Idea = {
      idea_id,
      title,
      problem,
      solution,
      expected_impact,
      category_id: categoryIndex + 1,
      submitter_id: submitter.user_id,
      current_stage: finalStage,
      is_confidential: i % 8 === 3,
      is_anonymous: i % 7 === 5,
      resubmission_of: null,
      created_at: created.toISOString(),
    };
    ideas.push(idea);

    // Stage history: creation, then one entry per move.
    let at = created.getTime();
    history.push({
      history_id: history.length + 1,
      idea_id,
      from_stage: null,
      to_stage: 'SUBMITTED',
      changed_by: submitter.user_id,
      reason: 'Idea submitted.',
      changed_at: new Date(at).toISOString(),
    });
    const otherReviewers = reviewers.filter((r) => r.user_id !== submitter.user_id);
    for (let s = 1; s <= steps; s++) {
      at += (5 + random() * 20) * day;
      history.push({
        history_id: history.length + 1,
        idea_id,
        from_stage: ACTIVE_PATH[s - 1],
        to_stage: ACTIVE_PATH[s],
        changed_by: pick(otherReviewers).user_id,
        reason: MOVE_REASONS[ACTIVE_PATH[s]] ?? '',
        changed_at: new Date(Math.min(at, end)).toISOString(),
      });
    }
    if (declined) {
      at += (5 + random() * 15) * day;
      history.push({
        history_id: history.length + 1,
        idea_id,
        from_stage: ACTIVE_PATH[steps],
        to_stage: 'DECLINED',
        changed_by: pick(otherReviewers).user_id,
        reason: pick(DECLINE_REASONS),
        changed_at: new Date(Math.min(at, end)).toISOString(),
      });
    }

    // Scores exist once an idea has been reviewed (reached Reviewing or was declined after it).
    if (steps >= 1 || declined) {
      const scorers = otherReviewers.slice(0, steps >= 2 ? otherReviewers.length : 1 + Math.floor(random() * 2));
      for (const reviewer of scorers) {
        for (const criterion of SCORING_CRITERIA) {
          const base = declined ? 2 : 3;
          scores.push({
            idea_id,
            reviewer_id: reviewer.user_id,
            criterion_id: criterion.criterion_id,
            score: Math.min(5, Math.max(1, base + Math.floor(random() * 3) - (declined ? 1 : 0))),
            remark: null,
          });
        }
      }
    }

    // Votes: older and more advanced ideas collect more votes; only from people who can see the idea,
    // never from the submitter and never on confidential ideas (US-4). random() is still called for
    // every user, so the rest of the demo data stays the same.
    const voteChance = 0.15 + 0.12 * steps + 0.25 * age;
    for (const user of users) {
      const allowed = !idea.is_confidential && user.user_id !== idea.submitter_id;
      if (canSeeIdea(idea, user) && random() < voteChance && allowed) {
        votes.push({ idea_id, user_id: user.user_id, created_at: new Date(created.getTime() + day).toISOString() });
      }
    }
  });

  const comments: Comment[] = COMMENTS.map(([idea_id, author, parent, body, created_at], i) => ({
    comment_id: i + 1,
    idea_id,
    author_id: users.find((u) => u.display_name === author)!.user_id,
    parent_comment_id: parent === null ? null : parent + 1,
    body,
    created_at,
  }));

  return { users, categories, ideas, history, votes, comments, relations: [], scores };
}

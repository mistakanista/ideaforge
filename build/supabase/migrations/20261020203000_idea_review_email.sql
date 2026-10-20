-- =====================================================================
-- IdeaForge: email to the submitter after a review (US-8, step 2)
--   * table email_log: one row per mail, written by the trigger, finished by the
--     Edge Function send-email (SENT / SIMULATED / FAILED)
--   * trigger on idea_transition: builds the mail and calls the Edge Function
--     through pg_net (asynchronous). A problem with the mail never blocks a review.
--   * only reviews made through the API (signed-in user) send mail; imports and
--     SQL editor scripts (no auth.uid()) do not
--   * the mail names the stage and the reason, not the reviewer
--   * which addresses really get a mail is decided by the Edge Function
--     (secret MAIL_REAL_RECIPIENTS); all others are only simulated
--
-- Settings (not in this file, because they differ per environment and one is a secret):
--   Vault secrets mail_function_url, mail_function_secret and optional app_url,
--   set once with scripts/set_mail_settings.sql. Without them the log row gets
--   NOT_CONFIGURED and no request is made.
-- =====================================================================

create extension if not exists pg_net;

create table public.email_log (
  log_id        bigint generated always as identity primary key,
  transition_id bigint references public.idea_transition (transition_id),
  idea_id       bigint references public.idea (idea_id),
  to_email      text not null,
  subject       text not null,
  status        text not null default 'PENDING'
                check (status in ('PENDING', 'SENT', 'SIMULATED', 'FAILED', 'NOT_CONFIGURED')),
  detail        text,
  created_at    timestamptz not null default now()
);

create index ix_email_log_transition on public.email_log (transition_id);
create index ix_email_log_idea on public.email_log (idea_id);

comment on table public.email_log is 'One row per notification mail (US-8). Simulated mails are logged here too.';
comment on column public.email_log.status is 'PENDING until the Edge Function reports; SENT, SIMULATED (address not in MAIL_REAL_RECIPIENTS), FAILED, or NOT_CONFIGURED (vault settings missing).';
comment on column public.email_log.detail is 'Error text for FAILED.';

alter table public.email_log enable row level security;
revoke all on public.email_log from anon, authenticated;
grant select on public.email_log to authenticated;

create policy "Admins can read the email log"
  on public.email_log for select to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- Trigger: mail to the submitter after a review
-- ---------------------------------------------------------------------
create function public.notify_submitter_after_review() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_idea    public.idea%rowtype;
  v_to      text;
  v_name    text;
  v_url     text;
  v_secret  text;
  v_app     text;
  v_stage   text;
  v_subject text;
  v_body    text;
  v_log_id  bigint;
begin
  -- Imports and SQL editor scripts have no signed-in user and send no mail
  if auth.uid() is null then
    return null;
  end if;

  begin
    select * into v_idea from public.idea where idea_id = new.idea_id;
    select email, display_name into v_to, v_name from public.app_user where user_id = v_idea.submitter_id;

    v_stage := case new.to_stage
      when 'UNDER_REVIEW' then 'Reviewing'
      when 'PILOTING' then 'Piloting'
      when 'IMPLEMENTED' then 'Implemented'
      when 'DECLINED' then 'Declined'
      else new.to_stage::text end;

    select decrypted_secret into v_url from vault.decrypted_secrets where name = 'mail_function_url';
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'mail_function_secret';
    select decrypted_secret into v_app from vault.decrypted_secrets where name = 'app_url';

    if new.to_stage = 'DECLINED' then
      v_subject := 'Your idea "' || v_idea.title || '" was declined';
      v_body := 'Reason: ' || new.reason;
    else
      v_subject := 'Your idea "' || v_idea.title || '" is now: ' || v_stage;
      v_body := 'Scores (1 to 5, higher is better): impact ' || new.score_impact
             || ', cost ' || new.score_cost || ', feasibility ' || new.score_feasibility || '.'
             || coalesce(E'\nRemark: ' || new.reason, '');
    end if;
    v_body := 'Hello ' || v_name || E',\n\nYour idea "' || v_idea.title || E'" has been reviewed.\n'
           || 'New stage: ' || v_stage || E'\n' || v_body
           || coalesce(E'\n\nOpen IdeaForge: ' || v_app, '')
           || E'\n\nThis message was sent automatically by IdeaForge.';

    insert into public.email_log (transition_id, idea_id, to_email, subject)
    values (new.transition_id, new.idea_id, v_to, v_subject)
    returning log_id into v_log_id;

    if v_url is null or v_secret is null then
      update public.email_log set status = 'NOT_CONFIGURED' where log_id = v_log_id;
      return null;
    end if;

    -- Asynchronous: the request is sent after the transaction has been committed
    perform net.http_post(
      url     := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-mail-secret', v_secret),
      body    := jsonb_build_object('to', v_to, 'subject', v_subject, 'text', v_body, 'log_id', v_log_id)
    );
  exception when others then
    -- A problem with the mail must never block the review
    raise warning 'Review email failed: %', sqlerrm;
    begin
      insert into public.email_log (transition_id, idea_id, to_email, subject, status, detail)
      values (new.transition_id, new.idea_id, coalesce(v_to, '?'), coalesce(v_subject, '?'), 'FAILED', sqlerrm);
    exception when others then
      null;
    end;
  end;
  return null;
end $$;

create trigger trg_idea_transition_notify
  after insert on public.idea_transition
  for each row execute function public.notify_submitter_after_review();

revoke execute on function public.notify_submitter_after_review() from public, anon, authenticated;

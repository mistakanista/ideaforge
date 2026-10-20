-- =====================================================================
-- IdeaForge: test email of the top ideas digest (US-12, CR-1)
--
-- send_digest_test(as_of) is called by the digest page when an admin simulates a day.
-- It sends the test mail only when that day is the FIRST WORKING DAY of its month
-- (Monday to Friday; public holidays are not considered yet, open question for the client):
--   1st is a weekday   -> the 1st
--   1st is a Saturday  -> Monday the 3rd
--   1st is a Sunday    -> Monday the 2nd
-- The mail lists the top 5 ideas of digest_top_ideas(as_of) and goes to the address in the
-- Vault secret digest_test_recipient (set by hand per environment, see
-- scripts/set_mail_settings.sql, so no address is stored in the code). It is sent through
-- the Edge Function send-email like the review mails (US-8) and logged in email_log;
-- which addresses really get a mail is decided by the function (MAIL_REAL_RECIPIENTS).
-- A real monthly mail to all staff is not part of this migration.
--
-- Result: NOT_FIRST_WORKING_DAY (nothing sent), NOT_CONFIGURED (vault settings missing),
-- QUEUED (request is on its way, the log row shows SENT / SIMULATED / FAILED later) or FAILED.
-- =====================================================================

create function public.is_first_working_day(p_day date) returns boolean
language sql immutable set search_path = '' as $$
  select p_day = date_trunc('month', p_day)::date
    + case extract(isodow from date_trunc('month', p_day))::int when 6 then 2 when 7 then 1 else 0 end;
$$;

comment on function public.is_first_working_day(date) is 'True on the first Monday-to-Friday day of the month of p_day (public holidays are not considered).';

create function public.send_digest_test(p_as_of date) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_to      text;
  v_url     text;
  v_secret  text;
  v_app     text;
  v_subject text;
  v_body    text;
  v_log_id  bigint;
  v_row     record;
  v_rank    integer := 0;
  v_list    text := '';
begin
  if not public.is_admin() then
    raise exception 'Only admins can send the digest test';
  end if;
  if not public.is_first_working_day(p_as_of) then
    return 'NOT_FIRST_WORKING_DAY';
  end if;

  select decrypted_secret into v_to from vault.decrypted_secrets where name = 'digest_test_recipient';
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'mail_function_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'mail_function_secret';
  select decrypted_secret into v_app from vault.decrypted_secrets where name = 'app_url';
  if v_to is null then
    return 'NOT_CONFIGURED';
  end if;

  begin
    for v_row in select * from public.digest_top_ideas(p_as_of) loop
      v_rank := v_rank + 1;
      v_list := v_list || v_rank || '. ' || v_row.title || ' (' || v_row.category_name || ', '
        || coalesce(v_row.submitter_name, 'Anonymous') || E')\n   Total ' || v_row.total
        || ': ' || v_row.rating_sum || ' rating points from ' || v_row.review_count || ' review(s) + '
        || v_row.vote_count || E' vote(s)\n';
    end loop;
    if v_rank = 0 then
      v_list := E'No ideas were reviewed in this period.\n';
    end if;

    v_subject := 'IdeaForge top ideas digest (test), ' || to_char(p_as_of, 'FMMonth YYYY');
    v_body := E'Hello,\n\nthese are the top ideas of the last 31 days before '
           || to_char(p_as_of, 'FMDD FMMonth YYYY') || E' (review ratings plus votes):\n\n'
           || v_list
           || coalesce(E'\nOpen IdeaForge: ' || v_app, '')
           || E'\n\nThis is a test message sent automatically by IdeaForge.';

    insert into public.email_log (to_email, subject) values (v_to, v_subject) returning log_id into v_log_id;

    if v_url is null or v_secret is null then
      update public.email_log set status = 'NOT_CONFIGURED' where log_id = v_log_id;
      return 'NOT_CONFIGURED';
    end if;

    -- Asynchronous: the request is sent after the transaction has been committed
    perform net.http_post(
      url     := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-mail-secret', v_secret),
      body    := jsonb_build_object('to', v_to, 'subject', v_subject, 'text', v_body, 'log_id', v_log_id)
    );
    return 'QUEUED';
  exception when others then
    raise warning 'Digest test email failed: %', sqlerrm;
    begin
      insert into public.email_log (to_email, subject, status, detail)
      values (v_to, coalesce(v_subject, '?'), 'FAILED', sqlerrm);
    exception when others then
      null;
    end;
    return 'FAILED';
  end;
end $$;

comment on function public.send_digest_test(date) is 'Sends the digest test mail (admins only) if p_as_of is the first working day of its month; returns NOT_FIRST_WORKING_DAY, NOT_CONFIGURED, QUEUED or FAILED.';

revoke execute on function public.send_digest_test(date) from public, anon;
grant execute on function public.send_digest_test(date) to authenticated;
revoke execute on function public.is_first_working_day(date) from public, anon;
grant execute on function public.is_first_working_day(date) to authenticated;

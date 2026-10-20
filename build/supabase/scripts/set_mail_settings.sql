-- =====================================================================
-- IdeaForge: settings for the review emails (US-8). Run once per environment
-- (local database and cloud project) in the SQL editor; run again to change a value.
-- Replace the three placeholders, run, and do NOT save the edited text or commit it.
--   <FUNCTION_URL>  local: http://host.docker.internal:54321/functions/v1/send-email
--                   cloud: https://owwdzjerddgavqjqxrru.supabase.co/functions/v1/send-email
--   <MAIL_FUNCTION_SECRET>  the same value as the secret MAIL_FUNCTION_SECRET of the Edge Function
--   <APP_URL>       link shown in the mail, for example the Netlify address (or leave the text as '' to omit)
-- =====================================================================
do $$
declare
  v_settings constant jsonb := jsonb_build_object(
    'mail_function_url', '<FUNCTION_URL>',
    'mail_function_secret', '<MAIL_FUNCTION_SECRET>',
    'app_url', '<APP_URL>');
  v_name  text;
  v_value text;
begin
  for v_name, v_value in select key, value from jsonb_each_text(v_settings) loop
    continue when v_value = '';
    if exists (select 1 from vault.secrets where name = v_name) then
      perform vault.update_secret((select id from vault.secrets where name = v_name), v_value);
    else
      perform vault.create_secret(v_value, v_name);
    end if;
  end loop;
end $$;

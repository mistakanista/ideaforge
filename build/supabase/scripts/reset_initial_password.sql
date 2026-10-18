-- =====================================================================
-- IdeaForge: replace the initial password in the CLOUD project (US-0).
-- Run in the Supabase dashboard: SQL Editor -> paste this file -> replace <NEW_PASSWORD> -> Run.
-- Do NOT save the edited text (no saved snippet) and never commit the password.
--
-- Affects every user who still has an initial password (app_user.must_change_password = true),
-- so users who already chose their own password are not touched.
-- Those users keep must_change_password = true: the trigger on_auth_password_changed clears the
-- flag on every password change, so the script sets it again right after the update.
-- Safe to run again (it just sets the same password again for users who still have the flag).
-- =====================================================================

do $$
declare
  v_ids   bigint[];
  v_count int;
begin
  select array_agg(user_id) into v_ids from public.app_user where must_change_password;
  if v_ids is null then
    raise notice 'No user with an initial password found. Nothing changed.';
    return;
  end if;

  update auth.users u
     set encrypted_password = extensions.crypt('<NEW_PASSWORD>', extensions.gen_salt('bf')),
         updated_at = now()
    from public.app_user a
   where a.auth_user_id = u.id
     and a.user_id = any (v_ids);
  get diagnostics v_count = row_count;

  -- the password trigger cleared the flag; the new password is an initial password again
  perform set_config('ideaforge.password_changed', 'on', true);
  update public.app_user set must_change_password = true where user_id = any (v_ids);
  perform set_config('ideaforge.password_changed', '', true);

  raise notice 'New initial password set for % users; they must change it at the first login.', v_count;
end $$;

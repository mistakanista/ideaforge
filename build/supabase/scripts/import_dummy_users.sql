-- =====================================================================
-- IdeaForge: import the dummy users into the CLOUD project (US-0).
-- Run once in the Supabase dashboard: SQL Editor -> paste this file -> Run.
-- Safe to run again: users whose email already exists are skipped.
--
-- Same users as seed.sql (local), with two differences:
--   * Priya Shah stays STAFF, because the initial password tallis123 is public.
--     After her password has been changed, an existing admin promotes her:
--       update public.app_user
--          set role = 'ADMIN',
--              role_changed_by = (select user_id from public.app_user where email = '<admin email>')
--        where email = 'priya.shah@tallis.uk';
--   * The reviewer roles are granted by the existing admin of the project
--     (the script stops if there is no active admin yet).
-- All users must change the password tallis123 at their first login (must_change_password).
-- =====================================================================

do $$
declare
  u        record;
  v_id     uuid;
  v_email  text;
  v_admin  bigint;
  v_count  int := 0;
begin
  select user_id into v_admin from public.app_user where role = 'ADMIN' and is_active order by user_id limit 1;
  if v_admin is null then
    raise exception 'No active admin found. Make your own account admin first, then run this script again.';
  end if;

  for u in
    select * from (values
      ('Priya Shah',    'BRISTOL'), ('Ruth Evans',   'LEEDS'),   ('Tom Hallworth', 'GLASGOW'),
      ('Aisha Rahman',  'BRISTOL'), ('Daniel Okafor', 'BRISTOL'), ('Sofia Marin',   'LEEDS'),
      ('Lena Fischer',  'GLASGOW'), ('Marcus Reid',  'LEEDS'),   ('Gareth Lowe',   'GLASGOW'),
      ('Chloe Bennett', 'BRISTOL'), ('Sam Patel',    'LEEDS'),   ('Morgan Hughes', 'GLASGOW')
    ) as t (full_name, office)
  loop
    v_email := lower(replace(u.full_name, ' ', '.')) || '@tallis.uk';
    continue when exists (select 1 from auth.users where lower(email) = v_email);

    v_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
      extensions.crypt('tallis123', extensions.gen_salt('bf')), now(),
      '{"provider": "email", "providers": ["email"]}', jsonb_build_object('full_name', u.full_name),
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), v_id, v_id::text, 'email',
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
      now(), now(), now()
    );

    update public.app_user set office = u.office, must_change_password = true where auth_user_id = v_id;
    v_count := v_count + 1;
  end loop;

  update public.app_user set role = 'REVIEWER', role_changed_by = v_admin
  where email in ('ruth.evans@tallis.uk', 'tom.hallworth@tallis.uk', 'aisha.rahman@tallis.uk')
    and role = 'STAFF';

  raise notice 'Imported % new users; reviewer roles granted by app_user %.', v_count, v_admin;
end $$;

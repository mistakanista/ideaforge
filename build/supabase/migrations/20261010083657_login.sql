-- =====================================================================
-- IdeaForge: US-0 Login and authorize, step 1 (database)
--
-- * app_user.must_change_password: true for users who got an initial password
--   (e.g. imported dummy users). It is cleared automatically when the password
--   is really changed in Supabase Auth, so the first-login step cannot be skipped.
--   Only admins can set or clear it through the API.
-- * login_allowlist: only Tallis & Reeve staff may sign in (client answer 22, US-10).
--   An entry is a domain ('@tallis.uk') or a single email address (e.g. a developer's
--   Gmail for testing Google login). New auth users with other emails are rejected
--   in handle_new_user(), so their sign-up / first login fails. Existing users are not affected.
--   Not readable or writable through the API; maintained in the SQL editor:
--     insert into public.login_allowlist (entry, note) values ('name@gmail.com', 'developer test account');
-- =====================================================================

-- ---------------------------------------------------------------------
-- First-login flag
-- ---------------------------------------------------------------------
alter table public.app_user
  add column must_change_password boolean not null default false;

comment on column public.app_user.must_change_password is
  'True while the user still has to replace an initial password; cleared automatically on a real password change.';

-- Only admins may change the flag through the API; the password trigger below may always clear it
create function public.app_user_password_flag_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.must_change_password is distinct from old.must_change_password
     and auth.uid() is not null
     and not public.is_admin()
     and coalesce(current_setting('ideaforge.password_changed', true), '') <> 'on' then
    raise exception 'Only admins can change must_change_password';
  end if;
  return new;
end $$;

create trigger trg_app_user_password_flag
  before update of must_change_password on public.app_user
  for each row execute function public.app_user_password_flag_check();

-- A real password change in Supabase Auth clears the flag
create function public.handle_password_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('ideaforge.password_changed', 'on', true);
  update public.app_user set must_change_password = false
  where auth_user_id = new.id and must_change_password;
  perform set_config('ideaforge.password_changed', '', true);
  return new;
end $$;

create trigger on_auth_password_changed
  after update of encrypted_password on auth.users
  for each row when (new.encrypted_password is distinct from old.encrypted_password)
  execute function public.handle_password_change();

-- ---------------------------------------------------------------------
-- Sign-in allowlist
-- ---------------------------------------------------------------------
create table public.login_allowlist (
  entry      text primary key
             check (entry = lower(entry)
                    and entry ~ '^([a-z0-9._%+-]+)?@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$'),
  note       text,
  created_at timestamptz not null default now()
);

comment on table public.login_allowlist is
  'Who may sign in: a domain (''@tallis.uk'') or a single lower-case email address.';

alter table public.login_allowlist enable row level security;
revoke all on public.login_allowlist from anon, authenticated;

insert into public.login_allowlist (entry, note) values ('@tallis.uk', 'Tallis & Reeve staff');

create function public.is_login_allowed(p_email text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_email is not null and exists (
    select 1 from public.login_allowlist
    where entry = lower(p_email)
       or entry = '@' || split_part(lower(p_email), '@', 2)
  );
$$;

-- Same as in 20261009205516_app_user.sql, plus the allowlist check
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_login_allowed(new.email) then
    raise exception 'Access is restricted to Tallis & Reeve staff';
  end if;

  insert into public.app_user (auth_user_id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(new.email, '@', 1)
    )
  );
  return new;
end $$;

-- Trigger and helper functions are not meant to be called through the API
revoke execute on function
  public.app_user_password_flag_check(), public.handle_password_change(),
  public.is_login_allowed(text), public.handle_new_user()
  from public, anon, authenticated;

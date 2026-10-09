-- =====================================================================
-- IdeaForge: users and roles (based on design/DatenModel/V2-StammdatenIntegriert)
--
-- * Every Google login creates a row in auth.users (Supabase Auth);
--   trigger handle_new_user() creates the matching app_user row with role STAFF.
-- * Rules enforced in the database:
--   - new users always start as STAFF
--   - only an active admin can change roles or deactivate users
--   - bootstrap: the very first admin may be set without role_changed_by
--     (SQL editor only, never through the API)
--   - the last active admin cannot be downgraded or deactivated
--   - users may only change their own display_name and office
-- * Difference to V2: google_sub is replaced by auth_user_id (link to auth.users);
--   the Google account id is stored by Supabase in auth.identities.
-- =====================================================================

create type public.user_role as enum ('STAFF', 'REVIEWER', 'ADMIN');

create table public.app_user (
  user_id         bigint generated always as identity primary key,
  auth_user_id    uuid not null unique references auth.users (id) on delete cascade,
  email           text not null check (position('@' in email) > 1),
  display_name    text not null check (length(trim(display_name)) > 0),
  office          text check (office ~ '^[A-Z0-9_]+$'),
  role            public.user_role not null default 'STAFF',
  role_changed_by bigint references public.app_user (user_id),
  role_changed_at timestamptz,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  last_login_at   timestamptz
);

create unique index ux_app_user_email on public.app_user (lower(email));
create index ix_app_user_role on public.app_user (role) where is_active;

comment on table public.app_user is 'IdeaForge users, one row per Supabase Auth user (Google login).';
comment on column public.app_user.office is 'Office code, e.g. BRISTOL; labels live in the frontend config. Empty until the user or an admin sets it.';
comment on column public.app_user.role_changed_by is 'Admin who changed the role last; NULL for STAFF and for the bootstrap admin.';

-- ---------------------------------------------------------------------
-- Helper functions for RLS and triggers (security definer avoids RLS recursion)
-- ---------------------------------------------------------------------
create function public.current_app_user_id() returns bigint
language sql stable security definer set search_path = '' as $$
  select user_id from public.app_user where auth_user_id = auth.uid() and is_active;
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.app_user
    where auth_user_id = auth.uid() and role = 'ADMIN' and is_active
  );
$$;

-- ---------------------------------------------------------------------
-- Rules for inserts and updates of app_user
-- ---------------------------------------------------------------------
create function public.app_user_check() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  via_api constant boolean := auth.uid() is not null;  -- request from a signed-in app user
begin
  if tg_op = 'INSERT' then
    if new.role <> 'STAFF' or new.role_changed_by is not null then
      raise exception 'New users always start as STAFF';
    end if;
    return new;
  end if;

  -- Fields nobody may change
  if new.user_id <> old.user_id or new.auth_user_id <> old.auth_user_id
     or new.email <> old.email or new.created_at <> old.created_at then
    raise exception 'user_id, auth_user_id, email and created_at cannot be changed';
  end if;

  -- Only admins may change roles or the active flag of a user (through the API)
  if via_api and not public.is_admin()
     and (new.role <> old.role or new.is_active <> old.is_active
          or new.role_changed_by is distinct from old.role_changed_by
          or new.role_changed_at is distinct from old.role_changed_at) then
    raise exception 'Only admins can change roles or deactivate users';
  end if;

  if new.role <> old.role then
    if via_api then
      -- The acting admin is always the signed-in user, it cannot be faked
      new.role_changed_by := public.current_app_user_id();
    elsif new.role_changed_by is null then
      -- Bootstrap: first admin without a granting admin, only when no active admin exists
      if new.role <> 'ADMIN' or exists (
        select 1 from public.app_user where role = 'ADMIN' and is_active and user_id <> new.user_id
      ) then
        raise exception 'Role % can only be granted by an admin', new.role;
      end if;
    elsif not exists (
      select 1 from public.app_user where user_id = new.role_changed_by and role = 'ADMIN' and is_active
    ) then
      raise exception 'User % is not an active admin and cannot change roles', new.role_changed_by;
    end if;
    new.role_changed_at := now();
  end if;

  -- The last active admin can neither be downgraded nor deactivated
  if old.role = 'ADMIN' and old.is_active and (new.role <> 'ADMIN' or not new.is_active)
     and not exists (
       select 1 from public.app_user where role = 'ADMIN' and is_active and user_id <> old.user_id
     ) then
    raise exception 'The last active admin cannot be downgraded or deactivated';
  end if;

  return new;
end $$;

create trigger trg_app_user_check
  before insert or update on public.app_user
  for each row execute function public.app_user_check();

-- ---------------------------------------------------------------------
-- Sync with Supabase Auth: create app_user on first login, track last login
-- ---------------------------------------------------------------------
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.handle_user_login() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.app_user set last_login_at = new.last_sign_in_at where auth_user_id = new.id;
  return new;
end $$;

create trigger on_auth_user_login
  after update of last_sign_in_at on auth.users
  for each row when (new.last_sign_in_at is distinct from old.last_sign_in_at)
  execute function public.handle_user_login();

-- Trigger functions are not meant to be called through the API
revoke execute on function public.app_user_check(), public.handle_new_user(), public.handle_user_login()
  from public, anon, authenticated;
revoke execute on function public.current_app_user_id(), public.is_admin() from public, anon;

-- ---------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------
alter table public.app_user enable row level security;

-- Anonymous visitors see nothing; rows are only created by handle_new_user()
revoke all on public.app_user from anon;
revoke insert, delete, truncate on public.app_user from authenticated;

create policy "Signed-in users can read users"
  on public.app_user for select to authenticated
  using (true);

create policy "Users can update their own profile"
  on public.app_user for update to authenticated
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));

create policy "Admins can update all users"
  on public.app_user for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
